/// <reference types="vite/client" />

import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'

import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts'])

test('listCommunityUpdatesPublic returns empty when no rows', async () => {
  const t = convexTest(schema, modules)
  const result = await t.query(api.communityUpdates.listCommunityUpdatesPublic, {})

  expect(result.ok).toBe(true)
  expect(result.data.updates).toEqual([])
})

test('listCommunityUpdatesPublic returns inserted update without images', async () => {
  const t = convexTest(schema, modules)

  await t.run(async (ctx) => {
    await ctx.db.insert('communityUpdates', {
      authorDisplayName: 'Test Board',
      bodyMarkdown: '# Hello',
      createdAt: 1_700_000_000_000,
      images: [],
      postedAt: 1_700_000_001_000,
      postedByAuthUserId: 'user_test',
      updatedAt: 1_700_000_000_000
    })
  })

  const result = await t.query(api.communityUpdates.listCommunityUpdatesPublic, { limit: 10 })

  expect(result.ok).toBe(true)
  expect(result.data.updates).toHaveLength(1)
  expect(result.data.updates[0]?.authorDisplayName).toBe('Test Board')
  expect(result.data.updates[0]?.bodyMarkdown).toBe('# Hello')
  expect(result.data.updates[0]?.imageUrls).toEqual([])
  expect(result.data.updates[0]?.createdAt).toBe(1_700_000_000_000)
  expect(result.data.updates[0]?.postedAt).toBe(1_700_000_001_000)
})

test('paginateCommunityUpdatesPublic returns older pages by posted time', async () => {
  const t = convexTest(schema, modules)

  await t.run(async (ctx) => {
    for (const postedAt of [30, 10, 20]) {
      await ctx.db.insert('communityUpdates', {
        authorDisplayName: 'Test Board',
        bodyMarkdown: `Update ${postedAt}`,
        createdAt: postedAt * 100,
        images: [],
        postedAt,
        postedByAuthUserId: 'user_test',
        updatedAt: postedAt * 100
      })
    }
  })

  const firstPage = await t.query(api.communityUpdates.paginateCommunityUpdatesPublic, {
    paginationOpts: { cursor: null, numItems: 2 }
  })

  expect(firstPage.data.updates.map(update => update.bodyMarkdown)).toEqual([
    'Update 30',
    'Update 20'
  ])
  expect(firstPage.data.isDone).toBe(false)

  const secondPage = await t.query(api.communityUpdates.paginateCommunityUpdatesPublic, {
    paginationOpts: {
      cursor: firstPage.data.continueCursor,
      numItems: 2
    }
  })

  expect(secondPage.data.updates.map(update => update.bodyMarkdown)).toEqual(['Update 10'])
  expect(secondPage.data.isDone).toBe(true)
})

test('getCommunityUpdatePublic returns null after doc deleted', async () => {
  const t = convexTest(schema, modules)

  let removedId!: import('./_generated/dataModel').Id<'communityUpdates'>

  await t.run(async (ctx) => {
    removedId = await ctx.db.insert('communityUpdates', {
      authorDisplayName: 'Gone',
      bodyMarkdown: 'x',
      createdAt: 1,
      images: [],
      postedAt: 2,
      postedByAuthUserId: 'u',
      updatedAt: 1
    })
    await ctx.db.delete(removedId)
  })

  const result = await t.query(api.communityUpdates.getCommunityUpdatePublic, {
    updateId: removedId
  })

  expect(result.ok).toBe(true)
  expect(result.data.update).toBeNull()
})
