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

  expect(firstPage.page.map(update => update.bodyMarkdown)).toEqual([
    'Update 30',
    'Update 20'
  ])
  expect(firstPage.isDone).toBe(false)
  expect(firstPage).toHaveProperty('pageStatus')
  expect(firstPage).toHaveProperty('splitCursor')

  const secondPage = await t.query(api.communityUpdates.paginateCommunityUpdatesPublic, {
    paginationOpts: {
      cursor: firstPage.continueCursor,
      numItems: 2
    }
  })

  expect(secondPage.page.map(update => update.bodyMarkdown)).toEqual(['Update 10'])
  expect(secondPage.isDone).toBe(true)
})

test('paginateCommunityUpdatesPublic caps untrusted page sizes', async () => {
  const t = convexTest(schema, modules)

  await t.run(async (ctx) => {
    for (let postedAt = 1; postedAt <= 60; postedAt++) {
      await ctx.db.insert('communityUpdates', {
        authorDisplayName: 'Test Board',
        bodyMarkdown: `Update ${postedAt}`,
        createdAt: postedAt,
        images: [],
        postedAt,
        postedByAuthUserId: 'user_test',
        updatedAt: postedAt
      })
    }
  })

  const result = await t.query(api.communityUpdates.paginateCommunityUpdatesPublic, {
    paginationOpts: { cursor: null, numItems: 10_000 }
  })

  expect(result.page).toHaveLength(50)
  expect(result.isDone).toBe(false)
})

test('listCommunityUpdatesPublic rejects non-finite limits', async () => {
  const t = convexTest(schema, modules)

  await expect(
    t.query(api.communityUpdates.listCommunityUpdatesPublic, { limit: Number.NaN })
  ).rejects.toThrow(/item count is invalid/i)
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

test('getCommunityUpdatePublic returns null for malformed update ids instead of throwing', async () => {
  const t = convexTest(schema, modules)

  const result = await t.query(api.communityUpdates.getCommunityUpdatePublic, {
    updateId: 'not-a-valid-convex-id'
  })

  expect(result.ok).toBe(true)
  expect(result.data.update).toBeNull()
})

test('paginateCommunityUpdatesPublic respects endCursor ranges across edits and deletes', async () => {
  const t = convexTest(schema, modules)
  let firstId!: import('./_generated/dataModel').Id<'communityUpdates'>

  await t.run(async (ctx) => {
    firstId = await ctx.db.insert('communityUpdates', {
      authorDisplayName: 'Board',
      bodyMarkdown: 'Post 30',
      createdAt: 30,
      images: [],
      postedAt: 30,
      postedByAuthUserId: 'u',
      updatedAt: 30
    })
    for (const postedAt of [20, 10]) {
      await ctx.db.insert('communityUpdates', {
        authorDisplayName: 'Board',
        bodyMarkdown: `Post ${postedAt}`,
        createdAt: postedAt,
        images: [],
        postedAt,
        postedByAuthUserId: 'u',
        updatedAt: postedAt
      })
    }
  })

  const page1 = await t.query(api.communityUpdates.paginateCommunityUpdatesPublic, {
    paginationOpts: { cursor: null, id: 1, numItems: 2 }
  })
  expect(page1.page.map(u => u.bodyMarkdown)).toEqual(['Post 30', 'Post 20'])

  await t.run(async (ctx) => {
    await ctx.db.delete(firstId)
  })

  const sealedPage1 = await t.query(api.communityUpdates.paginateCommunityUpdatesPublic, {
    paginationOpts: { cursor: null, endCursor: page1.continueCursor, id: 1, numItems: 2 }
  })
  const page2 = await t.query(api.communityUpdates.paginateCommunityUpdatesPublic, {
    paginationOpts: { cursor: page1.continueCursor, id: 1, numItems: 2 }
  })

  expect(sealedPage1.page.map(u => u.bodyMarkdown)).toEqual(['Post 20'])
  expect(page2.page.map(u => u.bodyMarkdown)).toEqual(['Post 10'])
})

test('updateCommunityUpdate throws when unauthenticated', async () => {
  const t = convexTest(schema, modules)

  let updateId!: import('./_generated/dataModel').Id<'communityUpdates'>
  await t.run(async (ctx) => {
    updateId = await ctx.db.insert('communityUpdates', {
      authorDisplayName: 'Original Author',
      bodyMarkdown: 'Original content',
      createdAt: 100,
      images: [],
      postedAt: 100,
      postedByAuthUserId: 'user_orig',
      updatedAt: 100
    })
  })

  await expect(
    t.mutation(api.communityUpdates.updateCommunityUpdate, {
      bodyMarkdown: 'Updated content',
      postedAt: 200,
      updateId
    })
  ).rejects.toThrow(/unauthenticated/i)
})
