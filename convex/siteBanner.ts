import type { Doc } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

import { ConvexError, v } from 'convex/values'

import { internalMutation, mutation, query } from './_generated/server'
import { requireBoardMember } from './authz/requireBoardMember'

async function readNewestSiteBanner(ctx: QueryCtx | MutationCtx): Promise<Doc<'siteBanner'> | null> {
  const rows = await ctx.db.query('siteBanner').collect()
  if (rows.length === 0)
    return null

  return rows.reduce((best, row) =>
    row._creationTime > best._creationTime ? row : best
  )
}

export const getPublicSiteBanner = query({
  args: {},
  handler: async (ctx) => {
    const doc = await readNewestSiteBanner(ctx)
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

    const doc = await readNewestSiteBanner(ctx)
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
    showUntil: v.number()
  },
  handler: async (ctx, args) => {
    await requireBoardMember(ctx)

    const trimmed = args.body.trim()
    if (!trimmed)
      throw new ConvexError('Banner text is required.')

    if (!Number.isFinite(args.showUntil))
      throw new ConvexError('Show-until time is invalid.')

    const now = Date.now()
    if (args.showUntil <= now)
      throw new ConvexError('Show-until must be in the future.')

    const rows = await ctx.db.query('siteBanner').collect()
    const updatedAt = now

    if (rows.length === 0) {
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

    const newest = rows.reduce((best, row) =>
      row._creationTime > best._creationTime ? row : best
    )

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
  }
})

export const clearSiteBanner = mutation({
  args: {},
  handler: async (ctx) => {
    await requireBoardMember(ctx)

    const rows = await ctx.db.query('siteBanner').collect()
    for (const row of rows)
      await ctx.db.delete(row._id)

    return { ok: true as const }
  }
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
