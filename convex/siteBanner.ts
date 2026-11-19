import type { Doc } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

import { ConvexError, v } from 'convex/values'

import { internalMutation, mutation, query } from './_generated/server'
import { requireBoardMember } from './authz/requireBoardMember'

const MAX_BANNER_BODY_CHARS = 2_000

async function readSiteBanners(ctx: QueryCtx | MutationCtx) {
  const rows = await ctx.db.query('siteBanner').collect()
  const newest = rows.reduce<Doc<'siteBanner'> | null>((best, row) =>
    !best || row._creationTime > best._creationTime ? row : best, null)
  return { newest, rows }
}

function assertBannerVersion(newest: Doc<'siteBanner'> | null, expected: {
  expectedBannerId?: Doc<'siteBanner'>['_id']
  expectedUpdatedAt?: number | null
}) {
  // Clearing and recreating a banner can reuse a timestamp.
  if ((expected.expectedUpdatedAt !== undefined && expected.expectedUpdatedAt !== (newest?.updatedAt ?? null))
    || (expected.expectedBannerId !== undefined && expected.expectedBannerId !== newest?._id)) {
    throw new ConvexError({ code: 'STALE_SERVER_DRAFT', message: 'The site banner changed. Load the latest version.' })
  }
}

export const getPublicSiteBanner = query({
  args: {},
  handler: async (ctx) => {
    const { newest: doc } = await readSiteBanners(ctx)
    if (!doc) {
      return {
        data: { banner: null },
        ok: true as const
      }
    }

    return {
      data: {
        banner: {
          body: doc.body,
          showUntil: doc.showUntil
        }
      },
      ok: true as const
    }
  }
})

export const getAdminSiteBanner = query({
  args: {},
  handler: async (ctx) => {
    await requireBoardMember(ctx)

    const { newest: doc } = await readSiteBanners(ctx)
    if (!doc) {
      return {
        data: { banner: null },
        ok: true as const
      }
    }

    return {
      data: {
        banner: {
          body: doc.body,
          id: doc._id,
          showUntil: doc.showUntil,
          updatedAt: doc.updatedAt
        }
      },
      ok: true as const
    }
  }
})

export const setSiteBanner = mutation({
  args: {
    body: v.string(),
    expectedBannerId: v.optional(v.id('siteBanner')),
    expectedUpdatedAt: v.optional(v.union(v.number(), v.null())),
    showUntil: v.number()
  },
  handler: async (ctx, args) => {
    await requireBoardMember(ctx)

    const trimmed = args.body.trim()
    if (!trimmed)
      throw new ConvexError('Banner text is required.')
    if (trimmed.length > MAX_BANNER_BODY_CHARS)
      throw new ConvexError(`Banner text must be at most ${MAX_BANNER_BODY_CHARS} characters.`)

    if (!Number.isFinite(args.showUntil))
      throw new ConvexError('Show-until time is invalid.')

    const now = Date.now()
    if (args.showUntil <= now)
      throw new ConvexError('Show-until must be in the future.')

    const { newest, rows } = await readSiteBanners(ctx)
    assertBannerVersion(newest, args)
    const updatedAt = newest ? Math.max(now, newest.updatedAt + 1) : now

    if (!newest) {
      const bannerId = await ctx.db.insert('siteBanner', {
        body: trimmed,
        showUntil: args.showUntil,
        updatedAt
      })
      return {
        data: { bannerId },
        ok: true as const
      }
    }

    for (const row of rows) {
      if (row._id !== newest._id)
        await ctx.db.delete(row._id)
    }

    await ctx.db.patch(newest._id, {
      body: trimmed,
      showUntil: args.showUntil,
      updatedAt
    })

    return {
      data: { bannerId: newest._id },
      ok: true as const
    }
  },
  returns: v.object({ data: v.object({ bannerId: v.id('siteBanner') }), ok: v.literal(true) })
})

export const clearSiteBanner = mutation({
  args: {
    expectedBannerId: v.optional(v.id('siteBanner')),
    expectedUpdatedAt: v.optional(v.union(v.number(), v.null()))
  },
  handler: async (ctx, args) => {
    await requireBoardMember(ctx)

    const { newest, rows } = await readSiteBanners(ctx)
    assertBannerVersion(newest, args)
    for (const row of rows)
      await ctx.db.delete(row._id)

    return { ok: true as const }
  },
  returns: v.object({ ok: v.literal(true) })
})

export const purgeExpiredSiteBanners = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const rows = await ctx.db.query('siteBanner').collect()
    for (const row of rows) {
      if (row.showUntil <= now)
        await ctx.db.delete(row._id)
    }
    return null
  }
})
