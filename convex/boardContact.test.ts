/// <reference types="vite/client" />

import { convexTest } from 'convex-test'
import { expect, test, vi } from 'vitest'

import { api, internal } from './_generated/api'
import schema from './schema'

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

  const fetchMock = vi.fn(async () =>
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

  const fetchMock = vi.fn(async () =>
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

  const fetchMock = vi.fn(async () =>
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
