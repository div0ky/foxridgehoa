/// <reference types="vite/client" />

import type { GenericDatabaseWriter, SystemDataModel } from 'convex/server'

import { register } from '@convex-dev/better-auth/test'
import { convexTest } from 'convex-test'
import { expect, test, vi } from 'vitest'

import { communityUpdateHeadline } from '../app/utils/communityUpdateExcerpt'
import { api, components } from './_generated/api'
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

test('homepage previews expose only teaser fields in published order', async () => {
  const t = convexTest(schema, modules)
  const oldestId = await t.run(async (ctx) => {
    const missingPhoto = await ctx.storage.store(new Blob(['missing']))
    const firstPhoto = await ctx.storage.store(new Blob(['first']))
    const secondPhoto = await ctx.storage.store(new Blob(['second']))
    await ctx.storage.delete(missingPhoto)

    const updateIds = []
    for (const postedAt of [10, undefined, 30, 20]) {
      const title = postedAt === 20 ? `${'A'.repeat(87)}🦊` : postedAt ? 'Pool opens Saturday' : ''
      updateIds.push(await ctx.db.insert('communityUpdates', {
        authorDisplayName: 'Test Board',
        bodyMarkdown: `\n \n### ${title}\n${'Body text '.repeat(3200)}`.slice(0, 32_000),
        createdAt: 100 - (postedAt ?? 0),
        images: postedAt === 30 ? [missingPhoto, firstPhoto, secondPhoto].map(storageId => ({ storageId })) : [],
        postedAt,
        postedByAuthUserId: 'user_test',
        updatedAt: 100
      }))
    }
    return updateIds[0]!
  })

  const { listCommunityUpdatePreviewsPublic, listCommunityUpdatesPublic } = api.communityUpdates
  const full = await t.query(listCommunityUpdatesPublic, { limit: 3 })
  expect(full.data.updates.map(update => update.postedAt)).toEqual([30, 20, 10])
  expect(full.data.updates.map(update => update.bodyMarkdown.length)).toEqual([32_000, 32_000, 32_000])
  expect(full.data.updates[0]?.imageUrls).toHaveLength(2)
  await expect(t.query(listCommunityUpdatePreviewsPublic, {})).resolves.toEqual({
    data: {
      updates: full.data.updates.map(update => ({
        authorDisplayName: update.authorDisplayName,
        headline: new TextDecoder().decode(new TextEncoder().encode(communityUpdateHeadline(update.bodyMarkdown))),
        id: update.id,
        imageUrl: update.imageUrls[0] ?? null,
        postedAt: update.postedAt
      }))
    },
    ok: true
  })

  await t.run(ctx => ctx.db.delete('communityUpdates', oldestId))
  const { data: { updates } } = await t.query(listCommunityUpdatePreviewsPublic, {})
  expect(updates[2]).toMatchObject({ headline: 'Community update', imageUrl: null, postedAt: 100 })
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

  expect(result.data.updates).toHaveLength(50)
  expect(result.data.isDone).toBe(false)
})

test('listCommunityUpdatesPublic rejects non-finite limits', async () => {
  const t = convexTest(schema, modules)

  await expect(
    t.query(api.communityUpdates.listCommunityUpdatesPublic, { limit: Number.NaN })
  ).rejects.toThrow(/item count is invalid/i)
})

test('getCommunityUpdatePublic returns an update only for an existing update ID', async () => {
  const t = convexTest(schema, modules)
  const query = api.communityUpdates.getCommunityUpdatePublic
  const notFound = { data: { update: null }, ok: true }

  await expect(t.query(query, { updateId: 'abc' })).resolves.toEqual(notFound)

  const publicFields = {
    authorDisplayName: 'Test Board',
    bodyMarkdown: '# Hello',
    createdAt: 1_700_000_000_000,
    postedAt: 1_700_000_001_000
  }
  const updateId = await t.run(ctx => ctx.db.insert('communityUpdates', {
    ...publicFields,
    images: [],
    postedByAuthUserId: 'user_test',
    updatedAt: publicFields.createdAt
  }))

  await expect(t.query(query, { updateId })).resolves.toEqual({
    data: { update: { ...publicFields, id: updateId, imageUrls: [] } },
    ok: true
  })

  await t.run(ctx => ctx.db.delete('communityUpdates', updateId))
  await expect(t.query(query, { updateId })).resolves.toEqual(notFound)
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

test('stale edits preserve the latest update and its stored photos', async ({ onTestFinished }) => {
  const t = convexTest(schema, modules)
  register(t)

  const now = Date.now()
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
  onTestFinished(() => {
    clock.mockRestore()
  })

  const adapter = components.betterAuth.adapter
  const user = await t.mutation(adapter.create, {
    input: {
      data: {
        createdAt: now,
        email: 'board@example.test',
        emailVerified: true,
        name: 'Test Board',
        updatedAt: now
      },
      model: 'user'
    }
  })
  const session = await t.mutation(adapter.create, {
    input: {
      data: {
        createdAt: now,
        expiresAt: now + 86_400_000,
        token: 'test-session',
        updatedAt: now,
        userId: user._id
      },
      model: 'session'
    }
  })
  const { addedPhoto, originalPhoto } = await t.run(async (ctx) => {
    await ctx.db.insert('operatorProfiles', { authUserId: user._id, role: 'boardMember' })
    const originalPhoto = await ctx.storage.store(new Blob(['original photo'], { type: 'image/png' }))
    const addedPhoto = await ctx.storage.store(new Blob(['added photo'], { type: 'image/png' }))

    // convex-test stores blobs without copying their MIME type into the storage metadata.
    const storageDb = ctx.db as unknown as GenericDatabaseWriter<SystemDataModel>
    for (const storageId of [originalPhoto, addedPhoto])
      await storageDb.patch('_storage', storageId, { contentType: 'image/png' })

    return { addedPhoto, originalPhoto }
  })

  const board = t.withIdentity({ sessionId: session._id, subject: user._id })
  const { createCommunityUpdate, getCommunityUpdatePublic, updateCommunityUpdate } = api.communityUpdates
  const { data: { updateId } } = await board.mutation(createCommunityUpdate, {
    bodyMarkdown: 'Original update',
    imageStorageIds: [originalPhoto],
    postedAt: 100
  })
  const currentFields = { bodyMarkdown: 'Latest update', postedAt: 200 }
  await board.mutation(updateCommunityUpdate, {
    ...currentFields,
    expectedUpdatedAt: now,
    imageStorageIds: [originalPhoto, addedPhoto],
    updateId
  })

  const latest = await t.query(getCommunityUpdatePublic, { updateId })
  expect(latest.data.update).toMatchObject(currentFields)
  expect(latest.data.update?.imageUrls).toHaveLength(2)

  const staleEdit = {
    bodyMarkdown: 'Stale edit',
    expectedUpdatedAt: now,
    imageStorageIds: [originalPhoto],
    postedAt: 300,
    updateId
  }
  const conflict = { data: { code: 'STALE_SERVER_DRAFT' } }
  await expect(board.mutation(updateCommunityUpdate, staleEdit)).rejects.toMatchObject(conflict)
  await expect(t.query(getCommunityUpdatePublic, { updateId })).resolves.toEqual(latest)
  await t.run(async (ctx) => {
    expect(await ctx.db.get('communityUpdates', updateId)).toMatchObject({
      ...currentFields,
      images: [{ storageId: originalPhoto }, { storageId: addedPhoto }],
      updatedAt: now + 1
    })
    expect(await (await ctx.storage.get(originalPhoto))?.text()).toBe('original photo')
    expect(await (await ctx.storage.get(addedPhoto))?.text()).toBe('added photo')
  })

  await board.mutation(updateCommunityUpdate, {
    ...currentFields,
    expectedUpdatedAt: now + 1,
    imageStorageIds: [addedPhoto],
    updateId
  })
  await expect(t.run(ctx => ctx.storage.get(originalPhoto))).resolves.toBeNull()
  await expect(board.mutation(updateCommunityUpdate, staleEdit)).rejects.toMatchObject(conflict)

  await board.mutation(updateCommunityUpdate, { ...currentFields, updateId })
  await expect(t.run(ctx => ctx.storage.get(addedPhoto))).resolves.toBeNull()
  await expect(t.run(ctx => ctx.db.get('communityUpdates', updateId))).resolves.toMatchObject({
    images: [],
    updatedAt: now + 3
  })
})
