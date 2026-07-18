import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { authComponent } from './auth'
import { requireBoardMember } from './authz/requireBoardMember'

const MAX_BODY_MARKDOWN_CHARS = 32_000
const MAX_AUTHOR_NAME_CHARS = 160
const MAX_ADMIN_LIST = 250
const MAX_IMAGES_PER_UPDATE = 3
const MAX_PUBLIC_LIST = 100
const MAX_PUBLIC_PAGE = 50
/** Keep images small for HOA micro-updates — avoid Convex storage spikes. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp'
])

type StorageCtx = MutationCtx | QueryCtx

type StorageMeta = {
  _creationTime: number
  _id: Id<'_storage'>
  contentType?: string
  sha256: string
  size: number
}

async function assertImageBlob(
  ctx: { db: { system: { get: (table: '_storage', id: Id<'_storage'>) => Promise<StorageMeta | null> } } },
  storageId: Id<'_storage'>
): Promise<void> {
  const meta: StorageMeta | null = await ctx.db.system.get('_storage', storageId)
  if (!meta)
    throw new ConvexError('Uploaded image not found. Try uploading again.')

  const contentType = meta.contentType?.toLowerCase() ?? ''
  if (!ALLOWED_IMAGE_CONTENT_TYPES.has(contentType))
    throw new ConvexError('Only JPEG, PNG, WebP, GIF, or AVIF images are allowed.')

  if (meta.size > MAX_IMAGE_BYTES)
    throw new ConvexError('Each image must be at most 5 MB.')
}

function normalizeRequestedCount(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined)
    return fallback
  if (!Number.isFinite(value))
    throw new ConvexError('Requested item count is invalid.')

  return Math.min(maximum, Math.max(1, Math.floor(value)))
}

function assertUniqueStorageIds(storageIds: Id<'_storage'>[]): void {
  if (new Set(storageIds).size !== storageIds.length)
    throw new ConvexError('The same image cannot be attached more than once.')
}

async function imageUrlsForDoc(
  ctx: StorageCtx,
  images: Doc<'communityUpdates'>['images']
): Promise<Array<string>> {
  const urls = await Promise.all(
    images.map(async ({ storageId }) => {
      const url = await ctx.storage.getUrl(storageId)
      return url ?? ''
    })
  )
  return urls.filter(Boolean)
}

async function mapDocPublic(
  ctx: StorageCtx,
  doc: Doc<'communityUpdates'>
) {
  const postedAt = doc.postedAt ?? doc.createdAt

  return {
    authorDisplayName: doc.authorDisplayName,
    bodyMarkdown: doc.bodyMarkdown,
    createdAt: doc.createdAt,
    id: doc._id,
    imageUrls: await imageUrlsForDoc(ctx, doc.images),
    postedAt
  }
}

export const listCommunityUpdatesPublic = query({
  args: {
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const capped = normalizeRequestedCount(args.limit, 50, MAX_PUBLIC_LIST)

    const docs = await ctx.db
      .query('communityUpdates')
      .withIndex('by_postedAt')
      .order('desc')
      .take(capped)
    const updates = await Promise.all(docs.map(doc => mapDocPublic(ctx, doc)))

    return {
      data: { updates },
      ok: true as const
    }
  }
})

export const paginateCommunityUpdatesPublic = query({
  args: {
    paginationOpts: paginationOptsValidator
  },
  handler: async (ctx, args) => {
    const paginationOpts = {
      ...args.paginationOpts,
      numItems: normalizeRequestedCount(
        args.paginationOpts.numItems,
        MAX_PUBLIC_PAGE,
        MAX_PUBLIC_PAGE
      )
    }
    const result = await ctx.db
      .query('communityUpdates')
      .withIndex('by_postedAt')
      .order('desc')
      .paginate(paginationOpts)
    const updates = await Promise.all(result.page.map(doc => mapDocPublic(ctx, doc)))

    return {
      data: {
        continueCursor: result.continueCursor,
        isDone: result.isDone,
        updates
      },
      ok: true as const
    }
  }
})

export const getCommunityUpdatePublic = query({
  args: {
    updateId: v.id('communityUpdates')
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.updateId)
    if (!doc) {
      return {
        data: { update: null },
        ok: true as const
      }
    }

    return {
      data: {
        update: await mapDocPublic(ctx, doc)
      },
      ok: true as const
    }
  }
})

export const listCommunityUpdatesAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireBoardMember(ctx)

    const all = await ctx.db
      .query('communityUpdates')
      .withIndex('by_postedAt')
      .order('desc')
      .take(MAX_ADMIN_LIST)

    const updates = await Promise.all(
      all.map(async doc => ({
        authorDisplayName: doc.authorDisplayName,
        bodyMarkdown: doc.bodyMarkdown,
        createdAt: doc.createdAt,
        id: doc._id,
        images: doc.images,
        imageUrls: await imageUrlsForDoc(ctx, doc.images),
        postedAt: doc.postedAt ?? doc.createdAt,
        postedByAuthUserId: doc.postedByAuthUserId,
        updatedAt: doc.updatedAt
      }))
    )

    return {
      data: { updates },
      ok: true as const
    }
  }
})

export const generateCommunityUpdateImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireBoardMember(ctx)
    return await ctx.storage.generateUploadUrl()
  }
})

export const createCommunityUpdate = mutation({
  args: {
    bodyMarkdown: v.string(),
    imageStorageIds: v.optional(v.array(v.id('_storage'))),
    postedAt: v.number()
  },
  handler: async (ctx, args) => {
    await requireBoardMember(ctx)

    const user = await authComponent.safeGetAuthUser(ctx)
    if (!user || typeof user._id !== 'string')
      throw new ConvexError('Unauthenticated.')

    const rawName = typeof user.name === 'string' ? user.name.trim() : ''
    if (!rawName)
      throw new ConvexError('Set a display name on your account before posting.')
    if (rawName.length > MAX_AUTHOR_NAME_CHARS)
      throw new ConvexError(`Display name must be at most ${MAX_AUTHOR_NAME_CHARS} characters.`)

    const trimmed = args.bodyMarkdown.trim()
    if (!trimmed)
      throw new ConvexError('Update content is required.')

    if (trimmed.length > MAX_BODY_MARKDOWN_CHARS)
      throw new ConvexError(`Update is too long (${MAX_BODY_MARKDOWN_CHARS} characters max).`)

    if (!Number.isFinite(args.postedAt))
      throw new ConvexError('Post date and time is invalid.')

    const storageIds = args.imageStorageIds ?? []
    if (storageIds.length > MAX_IMAGES_PER_UPDATE)
      throw new ConvexError(`At most ${MAX_IMAGES_PER_UPDATE} images per update.`)
    assertUniqueStorageIds(storageIds)

    for (const storageId of storageIds)
      await assertImageBlob(ctx, storageId)

    const now = Date.now()

    const updateId = await ctx.db.insert('communityUpdates', {
      authorDisplayName: rawName,
      bodyMarkdown: trimmed,
      createdAt: now,
      images: storageIds.map(storageId => ({ storageId })),
      postedAt: args.postedAt,
      postedByAuthUserId: user._id,
      updatedAt: now
    })

    return {
      data: { updateId },
      ok: true as const
    }
  }
})

export const deleteCommunityUpdate = mutation({
  args: {
    updateId: v.id('communityUpdates')
  },
  handler: async (ctx, args) => {
    await requireBoardMember(ctx)

    const doc = await ctx.db.get(args.updateId)
    if (!doc)
      throw new ConvexError('Update not found.')

    for (const { storageId } of doc.images)
      await ctx.storage.delete(storageId)

    await ctx.db.delete(args.updateId)

    return { ok: true as const }
  }
})

export const updateCommunityUpdate = mutation({
  args: {
    bodyMarkdown: v.string(),
    imageStorageIds: v.optional(v.array(v.id('_storage'))),
    postedAt: v.number(),
    updateId: v.id('communityUpdates')
  },
  handler: async (ctx, args) => {
    await requireBoardMember(ctx)

    const doc = await ctx.db.get(args.updateId)
    if (!doc)
      throw new ConvexError('Update not found.')

    const trimmed = args.bodyMarkdown.trim()
    if (!trimmed)
      throw new ConvexError('Update content is required.')

    if (trimmed.length > MAX_BODY_MARKDOWN_CHARS)
      throw new ConvexError(`Update is too long (${MAX_BODY_MARKDOWN_CHARS} characters max).`)

    if (!Number.isFinite(args.postedAt))
      throw new ConvexError('Post date and time is invalid.')

    const storageIds = args.imageStorageIds ?? []
    if (storageIds.length > MAX_IMAGES_PER_UPDATE)
      throw new ConvexError(`At most ${MAX_IMAGES_PER_UPDATE} images per update.`)
    assertUniqueStorageIds(storageIds)

    for (const storageId of storageIds)
      await assertImageBlob(ctx, storageId)

    // Clean up images that are no longer referenced
    const newStorageIds = new Set(storageIds)
    for (const { storageId } of doc.images) {
      if (!newStorageIds.has(storageId))
        await ctx.storage.delete(storageId)
    }

    const now = Date.now()

    await ctx.db.patch(args.updateId, {
      bodyMarkdown: trimmed,
      images: storageIds.map(storageId => ({ storageId })),
      postedAt: args.postedAt,
      updatedAt: now
    })

    return {
      data: { updateId: args.updateId },
      ok: true as const
    }
  }
})
