/// <reference types="vite/client" />

import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { api, internal } from './_generated/api'
import schema from './schema'

vi.mock('./auth', () => ({
  authComponent: {
    safeGetAuthUser: async (ctx: import('./_generated/server').QueryCtx) => {
      const identity = await ctx.auth.getUserIdentity()
      return identity ? { _id: identity.subject } : undefined
    }
  }
}))

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts'])

test('submitBoardContactMessage rejects empty name', async () => {
  const t = convexTest(schema, modules)

  await expect(
    t.action(api.boardContact.submitBoardContactMessage, {
      message: 'Hello',
      streetAddress: '123 Rifle Ridge',
      submitterName: '   '
    })
  ).rejects.toThrow(/name/i)
})

test('submitBoardContactMessage throws when no recipients; row skipped', async () => {
  const t = convexTest(schema, modules)
  delete process.env.RESEND_TO

  await expect(
    t.action(api.boardContact.submitBoardContactMessage, {
      message: 'Pool question.',
      streetAddress: '456 Fox Creek',
      submitterName: 'Jane Resident'
    })
  ).rejects.toThrow(/CONTACT_SUBMIT_NO_RECIPIENTS/)

  const row = await t.run(async (ctx) => {
    const rows = await ctx.db.query('boardContactSubmissions').collect()
    return rows[0]
  })

  expect(row?.emailDeliveryStatus).toBe('skipped_no_recipients')
  expect(row?.submitterName).toBe('Jane Resident')
})

test('submitBoardContactMessage sends to RESEND_TO when routing is empty', async () => {
  const t = convexTest(schema, modules)

  const fetchMock = vi.fn<typeof fetch>(async () =>
    Promise.resolve({
      json: async () => ({ id: 're_primary' }),
      ok: true,
      status: 200
    } as Response)
  )
  const prevFetch = globalThis.fetch
  vi.stubGlobal('fetch', fetchMock)

  try {
    process.env.RESEND_API_KEY = 'test_key'
    process.env.RESEND_FROM = 'Fox <from@test.com>'
    process.env.RESEND_TO = 'board@example.com'

    const result = await t.action(api.boardContact.submitBoardContactMessage, {
      message: 'Pool question.',
      streetAddress: '456 Fox Creek',
      submitterName: 'Jane Resident'
    })

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalled()
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      from: 'Fox <from@test.com>',
      to: ['board@example.com']
    })

    const row = await t.run(async (ctx) => {
      const rows = await ctx.db.query('boardContactSubmissions').collect()
      return rows[0]
    })

    expect(row?.emailDeliveryStatus).toBe('sent')
    expect(row?.resendEmailId).toBe('re_primary')
  } finally {
    vi.unstubAllGlobals()
    globalThis.fetch = prevFetch
    delete process.env.RESEND_API_KEY
    delete process.env.RESEND_FROM
    delete process.env.RESEND_TO
  }
})

test('setBoardContactRouting throws when unauthenticated', async () => {
  const t = convexTest(schema, modules)

  await expect(
    t.mutation(api.boardContact.setBoardContactRouting, {
      recipients: [{ displayName: 'A', email: 'a@example.com' }]
    })
  ).rejects.toThrow(/unauthenticated/i)
})

test('routing saves normalize recipients and reject stale board drafts', async () => {
  const t = convexTest(schema, modules)
  await t.run(async (ctx) => {
    for (const authUserId of ['director', 'colleague'])
      await ctx.db.insert('operatorProfiles', { authUserId, role: 'boardMember' })
  })
  const director = t.withIdentity({ subject: 'director' })
  const colleague = t.withIdentity({ subject: 'colleague' })
  const readRouting = async () => (await director.query(api.boardContact.getBoardContactRouting, {})).data.routing
  const original = { recipients: [{ displayName: ' Director ', email: ' DIRECTOR@example.com ' }] }
  const updated = { recipients: [{ displayName: 'Colleague', email: 'colleague@example.com' }] }
  const now = Date.now()
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now)

  try {
    expect(await readRouting()).toBeNull()
    const { data: { routingId } } = await director.mutation(api.boardContact.setBoardContactRouting, original)
    expect(await readRouting()).toEqual({
      recipients: [{ displayName: 'Director', email: 'director@example.com' }],
      routingId,
      updatedAt: now
    })
    await expect(director.mutation(api.boardContact.setBoardContactRouting, {
      ...original,
      expectedUpdatedAt: null
    })).rejects.toThrow(/STALE_SERVER_DRAFT/)

    const version = { expectedRoutingId: routingId, expectedUpdatedAt: now }
    await colleague.mutation(api.boardContact.setBoardContactRouting, { ...updated, ...version })
    await expect(director.mutation(api.boardContact.setBoardContactRouting, { ...original, ...version }))
      .rejects.toThrow(/STALE_SERVER_DRAFT/)
    expect(await readRouting()).toEqual({ ...updated, routingId, updatedAt: now + 1 })

    const replacementId = await t.run(ctx => ctx.db.insert('boardContactRouting', { ...updated, updatedAt: now + 1 }))
    await expect(director.mutation(api.boardContact.setBoardContactRouting, {
      ...original,
      expectedRoutingId: routingId,
      expectedUpdatedAt: now + 1
    })).rejects.toThrow(/STALE_SERVER_DRAFT/)
    expect(await readRouting()).toEqual({ ...updated, routingId: replacementId, updatedAt: now + 1 })
  } finally {
    clock.mockRestore()
  }
})

test('deleteBoardContactSubmission throws when unauthenticated', async () => {
  const t = convexTest(schema, modules)
  const { submissionId } = await t.mutation(
    internal.boardContact.createPendingBoardContactSubmission,
    {
      message: 'Please remove this.',
      streetAddress: '7 Ridge',
      submitterName: 'Resident'
    }
  )

  await expect(
    t.mutation(api.boardContact.deleteBoardContactSubmission, { submissionId })
  ).rejects.toThrow(/unauthenticated/i)
})

test('deliverBoardContactEmail marks skipped when no recipients', async () => {
  const t = convexTest(schema, modules)
  delete process.env.RESEND_TO

  const { submissionId } = await t.mutation(
    internal.boardContact.createPendingBoardContactSubmission,
    {
      message: 'Hi',
      streetAddress: '1 Main',
      submitterName: 'Bob'
    }
  )

  await t.action(internal.boardContact.deliverBoardContactEmail, {
    submissionId
  })

  const row = await t.run(async (ctx) => {
    return ctx.db.get(submissionId)
  })

  expect(row?.emailDeliveryStatus).toBe('skipped_no_recipients')
})

test('submitBoardContactMessage sends via Resend when configured', async () => {
  const t = convexTest(schema, modules)

  await t.run(async (ctx) => {
    await ctx.db.insert('boardContactRouting', {
      recipients: [
        { displayName: 'Director', email: 'dir@example.com' },
        { displayName: 'Other', email: 'other@example.com' }
      ],
      updatedAt: Date.now()
    })
  })

  const fetchMock = vi.fn<typeof fetch>(async () =>
    Promise.resolve({
      json: async () => ({ id: 're_456' }),
      ok: true,
      status: 200
    } as Response)
  )
  const prevFetch = globalThis.fetch
  vi.stubGlobal('fetch', fetchMock)

  try {
    process.env.RESEND_API_KEY = 'test_key'
    process.env.RESEND_FROM = 'Fox <from@test.com>'
    process.env.RESEND_TO = 'board@example.com'

    const result = await t.action(api.boardContact.submitBoardContactMessage, {
      message: 'Hi board',
      streetAddress: '9 Oak',
      submitterName: 'Chris'
    })

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalled()
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      bcc: ['dir@example.com', 'other@example.com'],
      from: 'Fox <from@test.com>',
      to: ['board@example.com']
    })

    const row = await t.run(async (ctx) => {
      const rows = await ctx.db.query('boardContactSubmissions').collect()
      return rows.find(r => r.submitterName === 'Chris')
    })

    expect(row?.emailDeliveryStatus).toBe('sent')
    expect(row?.resendEmailId).toBe('re_456')
  } finally {
    vi.unstubAllGlobals()
    globalThis.fetch = prevFetch
    delete process.env.RESEND_API_KEY
    delete process.env.RESEND_FROM
    delete process.env.RESEND_TO
  }
})

test('deliverBoardContactEmail sends via Resend and marks sent', async () => {
  const t = convexTest(schema, modules)

  await t.run(async (ctx) => {
    await ctx.db.insert('boardContactRouting', {
      recipients: [
        { displayName: 'Director', email: 'dir@example.com' },
        { displayName: 'Other', email: 'other@example.com' }
      ],
      updatedAt: Date.now()
    })
  })

  const { submissionId } = await t.mutation(
    internal.boardContact.createPendingBoardContactSubmission,
    {
      message: 'Hi board',
      streetAddress: '9 Oak',
      submitterName: 'Chris'
    }
  )

  const fetchMock = vi.fn<typeof fetch>(async () =>
    Promise.resolve({
      json: async () => ({ id: 're_456' }),
      ok: true,
      status: 200
    } as Response)
  )
  const prevFetch = globalThis.fetch
  vi.stubGlobal('fetch', fetchMock)

  try {
    process.env.RESEND_API_KEY = 'test_key'
    process.env.RESEND_FROM = 'Fox <from@test.com>'

    await t.action(internal.boardContact.deliverBoardContactEmail, {
      submissionId
    })

    const row = await t.run(async (ctx) => {
      return ctx.db.get(submissionId)
    })

    expect(row?.emailDeliveryStatus).toBe('sent')
    expect(row?.resendEmailId).toBe('re_456')
    expect(fetchMock).toHaveBeenCalled()
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      from: 'Fox <from@test.com>',
      to: ['dir@example.com', 'other@example.com']
    })
  } finally {
    vi.unstubAllGlobals()
    globalThis.fetch = prevFetch
    delete process.env.RESEND_API_KEY
    delete process.env.RESEND_FROM
  }
})

test('deliverBoardContactEmail sends only once when actions race', async () => {
  const t = convexTest(schema, modules)

  await t.run(async (ctx) => {
    await ctx.db.insert('boardContactRouting', {
      recipients: [{ displayName: 'Director', email: 'dir@example.com' }],
      updatedAt: Date.now()
    })
  })

  const { submissionId } = await t.mutation(
    internal.boardContact.createPendingBoardContactSubmission,
    {
      message: 'Please send this once.',
      streetAddress: '9 Oak',
      submitterName: 'Chris'
    }
  )

  const fetchMock = vi.fn(async () => {
    await new Promise(resolve => setTimeout(resolve, 25))
    return {
      json: async () => ({ id: 're_once' }),
      ok: true,
      status: 200
    } as Response
  })
  vi.stubGlobal('fetch', fetchMock)

  try {
    process.env.RESEND_API_KEY = 'test_key'
    process.env.RESEND_FROM = 'Fox <from@test.com>'

    await Promise.all([
      t.action(internal.boardContact.deliverBoardContactEmail, { submissionId }),
      t.action(internal.boardContact.deliverBoardContactEmail, { submissionId })
    ])

    const row = await t.run(async ctx => ctx.db.get(submissionId))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(row?.emailDeliveryStatus).toBe('sent')
    expect(row?.resendEmailId).toBe('re_once')
  } finally {
    vi.unstubAllGlobals()
    delete process.env.RESEND_API_KEY
    delete process.env.RESEND_FROM
  }
})

describe('board contact submission budgets and delivery deadlines', () => {
  const draft = { message: 'Pool question.', streetAddress: '7 Ridge', submitterName: 'Resident' }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv('RESEND_API_KEY', 'test_key')
    vi.stubEnv('RESEND_FROM', 'Fox <from@test.com>')
    vi.stubEnv('RESEND_TO', 'board@example.com')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  test('the shared rolling budgets cap inserts and sends, including under concurrent submissions', async () => {
    const t = convexTest(schema, modules)
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', fetchMock)

    const submit = () => t.action(api.boardContact.submitBoardContactMessage, draft)
    const startedAt = Date.now()
    const burst = await Promise.allSettled(Array.from({ length: 21 }, submit))
    expect(burst.filter(result => result.status === 'fulfilled')).toHaveLength(20)
    expect(burst.filter(result => result.status === 'rejected')).toEqual([
      expect.objectContaining({ reason: expect.objectContaining({ data: 'CONTACT_SUBMIT_RATE_LIMITED' }) })
    ])
    expect(fetchMock).toHaveBeenCalledTimes(20)

    await t.run(async (ctx) => {
      const rows = await ctx.db.query('boardContactSubmissions').collect()
      expect(rows).toHaveLength(20)
      await ctx.db.delete(rows[0]!._id)
    })
    await expect(submit()).rejects.toThrow(/CONTACT_SUBMIT_RATE_LIMITED/)

    for (const minute of [10, 20, 30]) {
      vi.setSystemTime(startedAt + minute * 60_000)
      for (let i = 0; i < 20; i++)
        await expect(submit()).resolves.toMatchObject({ ok: true })
    }
    vi.setSystemTime(startedAt + 40 * 60_000)
    await expect(submit()).rejects.toThrow(/CONTACT_SUBMIT_RATE_LIMITED/)
    expect(fetchMock).toHaveBeenCalledTimes(80)
    expect(await t.run(ctx => ctx.db.query('boardContactSubmissions').collect())).toHaveLength(79)

    vi.setSystemTime(startedAt + 24 * 60 * 60_000)
    await expect(submit()).resolves.toMatchObject({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(81)
  })

  test.each([
    { expectedError: 'CONTACT_SUBMIT_DELIVERY_INCOMPLETE', status: undefined, storedError: 'ERR_RESEND_TIMEOUT' },
    { expectedError: 'CONTACT_SUBMIT_DELIVERY_FAILED', status: 422, storedError: 'ERR_RESEND_API:HTTP_422' },
    { expectedError: null, status: 200, storedError: undefined }
  ])('the deadline bounds a stalled Resend response with status $status', async ({ expectedError, status, storedError }) => {
    const t = convexTest(schema, modules)
    const { promise: stallStarted, resolve: beginStall } = Promise.withResolvers<AbortSignal | null | undefined>()
    const fetchMock = vi.fn<typeof fetch>(async (_url, options) => {
      const stall = () => {
        beginStall(options?.signal)
        return new Promise<never>(() => {})
      }
      if (status === undefined)
        return stall()

      const response = new Response(null, { status })
      vi.spyOn(response, 'json').mockImplementation(stall)
      return response
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = expect(t.action(api.boardContact.submitBoardContactMessage, draft))
    const submitted = expectedError
      ? result.rejects.toThrow(expectedError)
      : result.resolves.toMatchObject({ ok: true })
    const signal = await stallStarted
    await vi.advanceTimersByTimeAsync(8_000)
    await submitted

    expect(signal?.aborted).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const row = await t.run(ctx => ctx.db.query('boardContactSubmissions').unique())
    expect(row).toMatchObject({
      ...draft,
      emailDeliveryStatus: expectedError ? 'failed' : 'sent'
    })
    expect(row?.emailLastError).toBe(storedError)
  })

  test('scheduled confirmation marks interrupted attempts and leaves accepted mail alone', async () => {
    const t = convexTest(schema, modules)
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ id: 're_accepted' })))
    vi.stubGlobal('fetch', fetchMock)

    const { submissionId: pendingId } = await t.mutation(internal.boardContact.createPendingBoardContactSubmission, draft)
    const { submissionId: sendingId } = await t.mutation(internal.boardContact.createPendingBoardContactSubmission, draft)
    await t.mutation(internal.boardContact.claimSubmissionForSending, { submissionId: sendingId })
    const result = await t.action(api.boardContact.submitBoardContactMessage, draft)
    expect(result.ok).toBe(true)

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const rows = await t.run(ctx => Promise.all([
      ctx.db.get(pendingId),
      ctx.db.get(sendingId),
      ctx.db.get(result.data.submissionId)
    ]))
    const unconfirmed = expect.objectContaining({
      ...draft,
      emailDeliveryStatus: 'failed',
      emailLastError: 'ERR_DELIVERY_UNCONFIRMED'
    })
    expect(rows).toEqual([
      unconfirmed,
      unconfirmed,
      expect.objectContaining({ emailDeliveryStatus: 'sent', resendEmailId: 're_accepted' })
    ])
  })
})

test('deliverBoardContactEmail marks failed when Resend returns error', async () => {
  const t = convexTest(schema, modules)

  await t.run(async (ctx) => {
    await ctx.db.insert('boardContactRouting', {
      recipients: [{ displayName: 'Director', email: 'dir@example.com' }],
      updatedAt: Date.now()
    })
  })

  const { submissionId } = await t.mutation(
    internal.boardContact.createPendingBoardContactSubmission,
    {
      message: 'M',
      streetAddress: '1 St',
      submitterName: 'Pat'
    }
  )

  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Promise.resolve({
        json: async () => ({ message: 'Invalid domain' }),
        ok: false,
        status: 422
      } as Response)
    )
  )

  try {
    process.env.RESEND_API_KEY = 'test_key'
    process.env.RESEND_FROM = 'Fox <from@test.com>'

    await t.action(internal.boardContact.deliverBoardContactEmail, {
      submissionId
    })

    const row = await t.run(async (ctx) => {
      return ctx.db.get(submissionId)
    })

    expect(row?.emailDeliveryStatus).toBe('failed')
    expect(row?.emailLastError).toMatch(/^ERR_RESEND_API:Invalid domain$/i)
  } finally {
    vi.unstubAllGlobals()
    delete process.env.RESEND_API_KEY
    delete process.env.RESEND_FROM
  }
})

test('submitBoardContactMessage throws when Resend returns error', async () => {
  const t = convexTest(schema, modules)

  await t.run(async (ctx) => {
    await ctx.db.insert('boardContactRouting', {
      recipients: [{ displayName: 'Director', email: 'dir@example.com' }],
      updatedAt: Date.now()
    })
  })

  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Promise.resolve({
        json: async () => ({ message: 'Invalid domain' }),
        ok: false,
        status: 422
      } as Response)
    )
  )

  try {
    process.env.RESEND_API_KEY = 'test_key'
    process.env.RESEND_FROM = 'Fox <from@test.com>'

    await expect(
      t.action(api.boardContact.submitBoardContactMessage, {
        message: 'M',
        streetAddress: '1 St',
        submitterName: 'Pat'
      })
    ).rejects.toThrow(/CONTACT_SUBMIT_DELIVERY_FAILED/)

    const row = await t.run(async (ctx) => {
      const rows = await ctx.db.query('boardContactSubmissions').collect()
      return rows[0]
    })

    expect(row?.emailDeliveryStatus).toBe('failed')
  } finally {
    vi.unstubAllGlobals()
    delete process.env.RESEND_API_KEY
    delete process.env.RESEND_FROM
  }
})
