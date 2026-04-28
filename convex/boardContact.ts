import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

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

const recipientValidator = v.object({
  displayName: v.string(),
  email: v.string()
})

function simpleEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function readNewestBoardContactRouting(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<'boardContactRouting'> | null> {
  const rows = await ctx.db.query('boardContactRouting').collect()
  if (rows.length === 0)
    return null

  return rows.reduce((best, row) =>
    row._creationTime > best._creationTime ? row : best
  )
}

function normalizeRecipientInput(raw: { displayName: string, email: string }): {
  displayName: string
  email: string
} {
  const displayName = raw.displayName.trim()
  const email = raw.email.trim().toLowerCase()
  return { displayName, email }
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

/** Inserts a row; validation runs in the public action before this is called. */
export const createPendingBoardContactSubmission = internalMutation({
  args: {
    message: v.string(),
    streetAddress: v.string(),
    submitterName: v.string()
  },
  handler: async (ctx, args) => {
    const submissionId = await ctx.db.insert('boardContactSubmissions', {
      emailDeliveryStatus: 'pending',
      message: args.message,
      streetAddress: args.streetAddress,
      submitterName: args.submitterName
    })
    return { submissionId }
  }
})

/**
 * Saves the submission and sends email in one round-trip (no scheduler).
 * Success means Resend accepted the send and the row is `sent`.
 */
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

    await ctx.runAction(internal.boardContact.deliverBoardContactEmail, { submissionId })

    const doc = await ctx.runQuery(internal.boardContact.getSubmissionForDelivery, {
      submissionId
    })

    if (!doc)
      throw new ConvexError('CONTACT_SUBMIT_INTERNAL')

    if (doc.emailDeliveryStatus === 'failed')
      throw new ConvexError('CONTACT_SUBMIT_DELIVERY_FAILED')

    if (doc.emailDeliveryStatus === 'skipped_no_recipients')
      throw new ConvexError('CONTACT_SUBMIT_NO_RECIPIENTS')

    if (doc.emailDeliveryStatus !== 'sent')
      throw new ConvexError('CONTACT_SUBMIT_DELIVERY_INCOMPLETE')

    return {
      data: { submissionId },
      ok: true as const
    }
  }
})

export const getBoardContactRouting = query({
  args: {},
  handler: async (ctx) => {
    await requireBoardMember(ctx)

    const doc = await readNewestBoardContactRouting(ctx)
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
  }
})

export const setBoardContactRouting = mutation({
  args: {
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

    const rows = await ctx.db.query('boardContactRouting').collect()
    const updatedAt = Date.now()

    if (rows.length === 0) {
      const routingId = await ctx.db.insert('boardContactRouting', {
        recipients: normalized,
        updatedAt
      })
      return {
        data: { routingId },
        ok: true as const
      }
    }

    const newest = rows.reduce((best, row) =>
      row._creationTime > best._creationTime ? row : best
    )

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
  }
})

export const listBoardContactSubmissions = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireBoardMember(ctx)

    const result = await ctx.db
      .query('boardContactSubmissions')
      .order('desc')
      .paginate(args.paginationOpts)

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
    const doc = await readNewestBoardContactRouting(ctx)
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

export const deliverBoardContactEmail = internalAction({
  args: { submissionId: v.id('boardContactSubmissions') },
  handler: async (ctx, { submissionId }) => {
    const submission = await ctx.runQuery(internal.boardContact.getSubmissionForDelivery, {
      submissionId
    })
    if (!submission)
      return

    if (
      submission.emailDeliveryStatus !== 'pending'
      && submission.emailDeliveryStatus !== 'sending'
    ) {
      return
    }

    const routing = await ctx.runQuery(internal.boardContact.getRoutingConfig, {})
    const recipientEmails = [
      ...new Set(
        routing.recipients
          .map((r: { displayName: string, email: string }) => r.email.trim().toLowerCase())
          .filter((e: string) => simpleEmailValid(e))
      )
    ]

    if (recipientEmails.length === 0) {
      await ctx.runMutation(internal.boardContact.markDeliverySkipped, { submissionId })
      return
    }

    const claimResult = await ctx.runMutation(internal.boardContact.claimSubmissionForSending, {
      submissionId
    })
    let shouldSend = claimResult.claimed
    if (!shouldSend) {
      const again = await ctx.runQuery(internal.boardContact.getSubmissionForDelivery, {
        submissionId
      })
      if (again?.emailDeliveryStatus === 'sending')
        shouldSend = true
    }
    if (!shouldSend)
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

    try {
      const res = await fetch('https://api.resend.com/emails', {
        body: JSON.stringify({
          from,
          subject,
          text,
          to: recipientEmails
        }),
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        method: 'POST'
      })

      const json: unknown = await res.json().catch(() => null)
      const message
        = json
          && typeof json === 'object'
          && 'message' in json
          && typeof (json as { message: unknown }).message === 'string'
          ? (json as { message: string }).message
          : null

      if (!res.ok) {
        const detail = message
          ? message.replace(/\s+/g, ' ').trim().slice(0, 120)
          : `HTTP_${res.status}`
        await ctx.runMutation(internal.boardContact.markDeliveryFailed, {
          error: `ERR_RESEND_API:${detail}`,
          submissionId
        })
        return
      }

      const resendEmailId
        = json
          && typeof json === 'object'
          && 'id' in json
          && typeof (json as { id: unknown }).id === 'string'
          ? (json as { id: string }).id
          : undefined

      await ctx.runMutation(internal.boardContact.markDeliverySent, {
        resendEmailId,
        submissionId
      })
    } catch {
      await ctx.runMutation(internal.boardContact.markDeliveryFailed, {
        error: 'ERR_RESEND_NETWORK',
        submissionId
      })
    }
  }
})
