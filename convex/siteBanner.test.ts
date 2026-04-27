/// <reference types="vite/client" />

import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'

import { api, internal } from './_generated/api'
import schema from './schema'

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
