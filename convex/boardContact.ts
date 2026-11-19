import type { Doc, Id } from './_generated/dataModel'
import type { ActionCtx, MutationCtx, QueryCtx } from './_generated/server'

import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'

import { internal } from './_generated/api'
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query
} from './_generated/server'
import { requireBoardMember } from './authz/requireBoardMember'

const MAX_NAME = 200
const MAX_STREET = 500
const MAX_MESSAGE = 10_000
const MAX_RECIPIENTS = 25
const MAX_EMAIL_ERROR_LEN = 200
const MAX_SUBMISSIONS_PAGE = 50
const MAX_RECIPIENT_NAME = 160
const MAX_RECIPIENT_EMAIL = 254
const BURST_WINDOW_MS = 10 * 60_000
const BURST_SUBMISSION_LIMIT = 20
const DAILY_WINDOW_MS = 24 * 60 * 60_000
const DAILY_SUBMISSION_LIMIT = 80
const RESEND_DEADLINE_MS = 8_000
const DELIVERY_CONFIRMATION_WINDOW_MS = 2 * 60_000

const recipientValidator = v.object({
  displayName: v.string(),
  email: v.string()
})

function simpleEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function normalizeEmailList(raw: string | undefined): string[] {
  if (!raw)
    return []

  return [
    ...new Set(
      raw
        .split(',')
        .map(email => email.trim().toLowerCase())
        .filter(simpleEmailValid)
    )
  ]
}

async function readNewestBoardContactRouting(
  ctx: QueryCtx | MutationCtx
) {
  const rows = await ctx.db.query('boardContactRouting').collect()
  const newest = rows.reduce<Doc<'boardContactRouting'> | null>((best, row) =>
    !best || row._creationTime > best._creationTime ? row : best, null)
  return { newest, rows }
}

function normalizeRecipientInput(raw: { displayName: string, email: string }): {
  displayName: string
  email: string
} {
  const displayName = raw.displayName.trim()
  const email = raw.email.trim().toLowerCase()
  return { displayName, email }
}

function normalizePageSize(requested: number): number {
  if (!Number.isFinite(requested))
    throw new ConvexError('Requested page size is invalid.')

  return Math.min(MAX_SUBMISSIONS_PAGE, Math.max(1, Math.floor(requested)))
}

function assertSubmissionFields(args: {
  message: string
  streetAddress: string
  submitterName: string
}): { message: string, streetAddress: string, submitterName: string } {
  const submitterName = args.submitterName.trim()
  const streetAddress = args.streetAddress.trim()
  const message = args.message.trim()

  if (!submitterName)
    throw new ConvexError('Name is required.')
  if (!streetAddress)
    throw new ConvexError('Street address is required.')
  if (!message)
    throw new ConvexError('Message is required.')

  if (submitterName.length > MAX_NAME)
    throw new ConvexError(`Name must be at most ${MAX_NAME} characters.`)
  if (streetAddress.length > MAX_STREET)
    throw new ConvexError(`Street address must be at most ${MAX_STREET} characters.`)
  if (message.length > MAX_MESSAGE)
    throw new ConvexError(`Message must be at most ${MAX_MESSAGE} characters.`)

  return { message, streetAddress, submitterName }
}

function buildPlainTextEmailBody(doc: {
  message: string
  streetAddress: string
  submitterName: string
}): string {
  return [
    'A resident submitted the Fox Ridge HOA contact form.',
    '',
    `Name: ${doc.submitterName}`,
    `Street address: ${doc.streetAddress}`,
    '',
    'Message:',
    doc.message
  ].join('\n')
}

function safeSubjectName(name: string): string {
  const oneLine = name.replace(/[\r\n]+/g, ' ').trim()
  return oneLine.length > 80 ? `${oneLine.slice(0, 77)}…` : oneLine
}

export const createPendingBoardContactSubmission = internalMutation({
  args: {
    message: v.string(),
    streetAddress: v.string(),
    submitterName: v.string()
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const budget = await ctx.db.query('boardContactSubmissionBudget').unique()
    const submissionTimes = (budget?.submissionTimes ?? []).filter(time => time > now - DAILY_WINDOW_MS)

    // shortcut: Saturation can block all residents, revisit the shared budget if this affects routine traffic.
    const burstCount = submissionTimes.filter(time => time > now - BURST_WINDOW_MS).length
    if (burstCount >= BURST_SUBMISSION_LIMIT || submissionTimes.length >= DAILY_SUBMISSION_LIMIT)
      throw new ConvexError('CONTACT_SUBMIT_RATE_LIMITED')

    submissionTimes.push(now)
    if (budget)
      await ctx.db.patch(budget._id, { submissionTimes })
    else
      await ctx.db.insert('boardContactSubmissionBudget', { submissionTimes })

    const submissionId = await ctx.db.insert('boardContactSubmissions', {
      emailDeliveryStatus: 'pending',
      message: args.message,
      streetAddress: args.streetAddress,
      submitterName: args.submitterName
    })
    await ctx.scheduler.runAfter(
      DELIVERY_CONFIRMATION_WINDOW_MS,
      internal.boardContact.markStaleDeliveryUnconfirmed,
      { submissionId }
    )
    return { submissionId }
  },
  returns: v.object({ submissionId: v.id('boardContactSubmissions') })
})

/** Success means Resend accepted the send and the row is `sent`. */
export const submitBoardContactMessage = action({
  args: {
    message: v.string(),
    streetAddress: v.string(),
    submitterName: v.string()
  },
  handler: async (ctx, args) => {
    const normalized = assertSubmissionFields(args)

    const insertResult: { submissionId: Id<'boardContactSubmissions'> } = await ctx.runMutation(
      internal.boardContact.createPendingBoardContactSubmission,
      normalized
    )
    const { submissionId } = insertResult

    await deliverBoardContactEmailOnce(ctx, { submissionId })

    const doc = await ctx.runQuery(internal.boardContact.getSubmissionForDelivery, {
      submissionId
    })

    if (!doc)
      throw new ConvexError('CONTACT_SUBMIT_INTERNAL')

    if (doc.emailDeliveryStatus === 'failed') {
      if (doc.emailLastError === 'ERR_RESEND_TIMEOUT'
        || doc.emailLastError === 'ERR_RESEND_NETWORK'
        || doc.emailLastError === 'ERR_DELIVERY_UNCONFIRMED') {
        throw new ConvexError('CONTACT_SUBMIT_DELIVERY_INCOMPLETE')
      }
      throw new ConvexError('CONTACT_SUBMIT_DELIVERY_FAILED')
    }

    if (doc.emailDeliveryStatus === 'skipped_no_recipients')
      throw new ConvexError('CONTACT_SUBMIT_NO_RECIPIENTS')

    if (doc.emailDeliveryStatus !== 'sent')
      throw new ConvexError('CONTACT_SUBMIT_DELIVERY_INCOMPLETE')

    return {
      data: { submissionId },
      ok: true as const
    }
  },
  returns: v.object({
    data: v.object({ submissionId: v.id('boardContactSubmissions') }),
    ok: v.literal(true)
  })
})

export const getBoardContactRouting = query({
  args: {},
  handler: async (ctx) => {
    await requireBoardMember(ctx)

    const { newest: doc } = await readNewestBoardContactRouting(ctx)
    if (!doc) {
      return {
        data: { routing: null },
        ok: true as const
      }
    }

    return {
      data: {
        routing: {
          recipients: doc.recipients,
          routingId: doc._id,
          updatedAt: doc.updatedAt
        }
      },
      ok: true as const
    }
  },
  returns: v.object({
    data: v.object({
      routing: v.union(v.null(), v.object({
        recipients: v.array(recipientValidator),
        routingId: v.id('boardContactRouting'),
        updatedAt: v.number()
      }))
    }),
    ok: v.literal(true)
  })
})

export const setBoardContactRouting = mutation({
  args: {
    expectedRoutingId: v.optional(v.id('boardContactRouting')),
    expectedUpdatedAt: v.optional(v.union(v.number(), v.null())),
    recipients: v.array(recipientValidator)
  },
  handler: async (ctx, args) => {
    await requireBoardMember(ctx)

    if (args.recipients.length > MAX_RECIPIENTS) {
      throw new ConvexError(
        `At most ${MAX_RECIPIENTS} notification recipients are allowed.`
      )
    }

    const normalized: { displayName: string, email: string }[] = []
    for (const r of args.recipients) {
      const { displayName, email } = normalizeRecipientInput(r)
      if (!displayName)
        throw new ConvexError('Each recipient needs a display name.')
      if (!email)
        throw new ConvexError('Each recipient needs an email address.')
      if (displayName.length > MAX_RECIPIENT_NAME)
        throw new ConvexError(`Recipient name must be at most ${MAX_RECIPIENT_NAME} characters.`)
      if (email.length > MAX_RECIPIENT_EMAIL)
        throw new ConvexError(`Recipient email must be at most ${MAX_RECIPIENT_EMAIL} characters.`)
      if (!simpleEmailValid(email))
        throw new ConvexError(`Invalid email: ${email}`)
      normalized.push({ displayName, email })
    }

    const seen = new Set<string>()
    for (const r of normalized) {
      if (seen.has(r.email))
        throw new ConvexError(`Duplicate email: ${r.email}`)
      seen.add(r.email)
    }

    const { newest, rows } = await readNewestBoardContactRouting(ctx)
    if ((args.expectedUpdatedAt !== undefined && args.expectedUpdatedAt !== (newest?.updatedAt ?? null))
      || (args.expectedRoutingId !== undefined && args.expectedRoutingId !== newest?._id)) {
      throw new ConvexError({ code: 'STALE_SERVER_DRAFT', message: 'Contact routing changed. Load the latest recipients.' })
    }

    const now = Date.now()
    const updatedAt = newest ? Math.max(now, newest.updatedAt + 1) : now
    if (!newest) {
      const routingId = await ctx.db.insert('boardContactRouting', {
        recipients: normalized,
        updatedAt
      })
      return {
        data: { routingId },
        ok: true as const
      }
    }

    for (const row of rows) {
      if (row._id !== newest._id)
        await ctx.db.delete(row._id)
    }

    await ctx.db.patch(newest._id, {
      recipients: normalized,
      updatedAt
    })

    return {
      data: { routingId: newest._id },
      ok: true as const
    }
  },
  returns: v.object({ data: v.object({ routingId: v.id('boardContactRouting') }), ok: v.literal(true) })
})

export const listBoardContactSubmissions = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireBoardMember(ctx)

    const paginationOpts = {
      ...args.paginationOpts,
      numItems: normalizePageSize(args.paginationOpts.numItems)
    }
    const result = await ctx.db
      .query('boardContactSubmissions')
      .order('desc')
      .paginate(paginationOpts)

    return {
      data: {
        continueCursor: result.continueCursor,
        isDone: result.isDone,
        page: result.page.map(doc => ({
          createdAt: doc._creationTime,
          emailDeliveryStatus: doc.emailDeliveryStatus,
          emailLastError: doc.emailLastError,
          message: doc.message,
          streetAddress: doc.streetAddress,
          submissionId: doc._id,
          submitterName: doc.submitterName
        }))
      },
      ok: true as const
    }
  }
})

export const deleteBoardContactSubmission = mutation({
  args: { submissionId: v.id('boardContactSubmissions') },
  handler: async (ctx, { submissionId }) => {
    await requireBoardMember(ctx)

    const doc = await ctx.db.get(submissionId)
    if (!doc) {
      return {
        data: { deleted: false },
        ok: true as const
      }
    }

    await ctx.db.delete(submissionId)

    return {
      data: { deleted: true },
      ok: true as const
    }
  }
})

export const getSubmissionForDelivery = internalQuery({
  args: { submissionId: v.id('boardContactSubmissions') },
  handler: async (ctx, { submissionId }) => {
    const doc = await ctx.db.get(submissionId)
    if (!doc)
      return null

    return {
      emailDeliveryStatus: doc.emailDeliveryStatus,
      emailLastError: doc.emailLastError,
      message: doc.message,
      streetAddress: doc.streetAddress,
      submitterName: doc.submitterName
    }
  }
})

export const getRoutingConfig = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { newest: doc } = await readNewestBoardContactRouting(ctx)
    if (!doc)
      return { recipients: [] as { displayName: string, email: string }[] }

    return { recipients: doc.recipients }
  }
})

export const claimSubmissionForSending = internalMutation({
  args: { submissionId: v.id('boardContactSubmissions') },
  handler: async (ctx, { submissionId }) => {
    const doc = await ctx.db.get(submissionId)
    if (!doc || doc.emailDeliveryStatus !== 'pending')
      return { claimed: false as const }

    await ctx.db.patch(submissionId, { emailDeliveryStatus: 'sending' })
    return { claimed: true as const }
  }
})

export const markDeliverySkipped = internalMutation({
  args: { submissionId: v.id('boardContactSubmissions') },
  handler: async (ctx, { submissionId }) => {
    const doc = await ctx.db.get(submissionId)
    if (!doc || doc.emailDeliveryStatus !== 'pending')
      return

    await ctx.db.patch(submissionId, {
      emailDeliveryStatus: 'skipped_no_recipients'
    })
  }
})

export const markDeliverySent = internalMutation({
  args: {
    resendEmailId: v.optional(v.string()),
    submissionId: v.id('boardContactSubmissions')
  },
  handler: async (ctx, { resendEmailId, submissionId }) => {
    const doc = await ctx.db.get(submissionId)
    if (!doc || doc.emailDeliveryStatus !== 'sending')
      return

    await ctx.db.patch(submissionId, {
      emailDeliveryStatus: 'sent',
      emailLastError: undefined,
      resendEmailId
    })
  }
})

export const markDeliveryFailed = internalMutation({
  args: {
    error: v.string(),
    submissionId: v.id('boardContactSubmissions')
  },
  handler: async (ctx, { error, submissionId }) => {
    const doc = await ctx.db.get(submissionId)
    if (!doc || doc.emailDeliveryStatus !== 'sending')
      return

    const clipped = error.slice(0, MAX_EMAIL_ERROR_LEN)
    await ctx.db.patch(submissionId, {
      emailDeliveryStatus: 'failed',
      emailLastError: clipped
    })
  }
})

export const markStaleDeliveryUnconfirmed = internalMutation({
  args: { submissionId: v.id('boardContactSubmissions') },
  handler: async (ctx, { submissionId }) => {
    const doc = await ctx.db.get(submissionId)
    if (doc?.emailDeliveryStatus === 'pending' || doc?.emailDeliveryStatus === 'sending') {
      await ctx.db.patch(submissionId, {
        emailDeliveryStatus: 'failed',
        emailLastError: 'ERR_DELIVERY_UNCONFIRMED'
      })
    }
    return null
  },
  returns: v.null()
})

async function deliverBoardContactEmailOnce(
  ctx: ActionCtx,
  { submissionId }: { submissionId: Id<'boardContactSubmissions'> }
): Promise<void> {
  const submission = await ctx.runQuery(internal.boardContact.getSubmissionForDelivery, {
    submissionId
  })
  if (!submission)
    return

  if (submission.emailDeliveryStatus !== 'pending')
    return

  const routing = await ctx.runQuery(internal.boardContact.getRoutingConfig, {})
  const routingEmails = [
    ...new Set(
      routing.recipients
        .map((r: { displayName: string, email: string }) => r.email.trim().toLowerCase())
        .filter((e: string) => simpleEmailValid(e))
    )
  ]
  const configuredToEmails = normalizeEmailList(process.env.RESEND_TO)
  const recipientEmails = configuredToEmails.length > 0 ? configuredToEmails : routingEmails
  const primaryRecipientSet = new Set(recipientEmails)
  const bccEmails = configuredToEmails.length > 0
    ? routingEmails.filter(email => !primaryRecipientSet.has(email))
    : []

  if (recipientEmails.length === 0) {
    await ctx.runMutation(internal.boardContact.markDeliverySkipped, { submissionId })
    return
  }

  const claimResult = await ctx.runMutation(internal.boardContact.claimSubmissionForSending, {
    submissionId
  })
  if (!claimResult.claimed)
    return

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM

  if (!apiKey || !from) {
    await ctx.runMutation(internal.boardContact.markDeliveryFailed, {
      error: 'ERR_MISSING_RESEND_ENV',
      submissionId
    })
    return
  }

  const subject = `Fox Ridge HOA — board contact: ${safeSubjectName(submission.submitterName)}`
  const text = buildPlainTextEmailBody(submission)

  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  // The HTTP status confirms the outcome even if the response body takes too long.
  let response: Response | undefined
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      resolve(null)
      controller.abort()
    }, RESEND_DEADLINE_MS)
  })
  const json: unknown = await Promise.race([
    fetch('https://api.resend.com/emails', {
      body: JSON.stringify({
        from,
        ...(bccEmails.length > 0 ? { bcc: bccEmails } : {}),
        subject,
        text,
        to: recipientEmails
      }),
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      method: 'POST',
      signal: controller.signal
    }).then((res) => {
      response = res
      return res.json()
    }),
    deadline
  ]).catch(() => null).finally(() => clearTimeout(timer))

  if (!response) {
    await ctx.runMutation(internal.boardContact.markDeliveryFailed, {
      error: controller.signal.aborted ? 'ERR_RESEND_TIMEOUT' : 'ERR_RESEND_NETWORK',
      submissionId
    })
    return
  }

  if (!response.ok) {
    const message = json && typeof json === 'object' && 'message' in json && typeof json.message === 'string'
      ? json.message.replace(/\s+/g, ' ').trim().slice(0, 120)
      : ''
    await ctx.runMutation(internal.boardContact.markDeliveryFailed, {
      error: `ERR_RESEND_API:${message || `HTTP_${response.status}`}`,
      submissionId
    })
    return
  }

  const resendEmailId = json && typeof json === 'object' && 'id' in json && typeof json.id === 'string'
    ? json.id
    : undefined
  await ctx.runMutation(internal.boardContact.markDeliverySent, {
    resendEmailId,
    submissionId
  })
}

export const deliverBoardContactEmail = internalAction({
  args: { submissionId: v.id('boardContactSubmissions') },
  handler: async (ctx, args) => {
    await deliverBoardContactEmailOnce(ctx, args)
  }
})
