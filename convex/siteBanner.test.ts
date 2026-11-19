/// <reference types="vite/client" />

import { convexTest } from 'convex-test'
import { expect, test, vi } from 'vitest'

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

test('getPublicSiteBanner returns null when empty', async () => {
  const t = convexTest(schema, modules)
  const result = await t.query(api.siteBanner.getPublicSiteBanner, {})

  expect(result.ok).toBe(true)
  expect(result.data.banner).toBeNull()
})

test('purgeExpiredSiteBanners deletes expired rows', async () => {
  const t = convexTest(schema, modules)

  await t.run(async (ctx) => {
    await ctx.db.insert('siteBanner', {
      body: 'old',
      showUntil: 1000,
      updatedAt: 500
    })
  })

  const before = await t.query(api.siteBanner.getPublicSiteBanner, {})
  expect(before.data.banner?.body).toBe('old')

  await t.mutation(internal.siteBanner.purgeExpiredSiteBanners, {})

  const after = await t.query(api.siteBanner.getPublicSiteBanner, {})
  expect(after.data.banner).toBeNull()
})

test('purgeExpiredSiteBanners keeps future rows', async () => {
  const t = convexTest(schema, modules)
  const future = Date.now() + 86_400_000

  await t.run(async (ctx) => {
    await ctx.db.insert('siteBanner', {
      body: 'future',
      showUntil: future,
      updatedAt: Date.now()
    })
  })

  await t.mutation(internal.siteBanner.purgeExpiredSiteBanners, {})

  const after = await t.query(api.siteBanner.getPublicSiteBanner, {})
  expect(after.data.banner?.body).toBe('future')
})

test('banner writes and clears reject drafts based on an older row or revision', async () => {
  const t = convexTest(schema, modules)
  await t.run(ctx => ctx.db.insert('operatorProfiles', { authUserId: 'board-test', role: 'boardMember' }))
  const board = t.withIdentity({ subject: 'board-test' })
  const readBanner = async () => (await board.query(api.siteBanner.getAdminSiteBanner, {})).data.banner!
  const now = Date.now()
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
  const banner = { body: 'First banner', showUntil: now + 86_400_000 }

  try {
    await board.mutation(api.siteBanner.setSiteBanner, { ...banner, expectedUpdatedAt: null })
    const first = await readBanner()
    await expect(board.mutation(api.siteBanner.setSiteBanner, { ...banner, expectedUpdatedAt: null })).rejects.toThrow(/STALE_SERVER_DRAFT/)

    await board.mutation(api.siteBanner.setSiteBanner, { ...banner, body: 'Second banner', expectedUpdatedAt: first.updatedAt })
    const second = await readBanner()
    expect(second.updatedAt).toBeGreaterThan(first.updatedAt)
    await expect(board.mutation(api.siteBanner.clearSiteBanner, { expectedUpdatedAt: first.updatedAt })).rejects.toThrow(/STALE_SERVER_DRAFT/)
    expect((await readBanner()).body).toBe('Second banner')

    await board.mutation(api.siteBanner.clearSiteBanner, { expectedUpdatedAt: second.updatedAt })
    await board.mutation(api.siteBanner.setSiteBanner, { ...banner, body: 'Replacement' })
    const replacement = await readBanner()
    expect(replacement.updatedAt).toBe(first.updatedAt)
    expect(replacement.id).not.toBe(first.id)
    await expect(board.mutation(api.siteBanner.setSiteBanner, {
      ...banner,
      expectedBannerId: first.id,
      expectedUpdatedAt: first.updatedAt
    })).rejects.toThrow(/STALE_SERVER_DRAFT/)
    await expect(board.mutation(api.siteBanner.clearSiteBanner, {
      expectedBannerId: first.id,
      expectedUpdatedAt: first.updatedAt
    })).rejects.toThrow(/STALE_SERVER_DRAFT/)
    expect((await readBanner()).body).toBe('Replacement')
    await board.mutation(api.siteBanner.clearSiteBanner, {})
    expect((await board.query(api.siteBanner.getAdminSiteBanner, {})).data.banner).toBeNull()
  } finally {
    clock.mockRestore()
  }
})
