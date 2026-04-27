import { query } from './_generated/server'
import { authComponent } from './auth'

/** Current session’s HOA profile linked to Better Auth user id (`authUserId`). */
export const getMyOperatorProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx)
    if (!user || typeof user._id !== 'string')
      return { data: { profile: null }, ok: true as const }

    const doc = await ctx.db
      .query('operatorProfiles')
      .withIndex('by_authUserId', q => q.eq('authUserId', user._id))
      .unique()
      .catch(() => null)

    if (!doc)
      return { data: { profile: null }, ok: true as const }

    return {
      data: {
        profile: {
          authUserId: doc.authUserId,
          operatorProfileId: doc._id,
          role: doc.role
        }
      },
      ok: true as const
    }
  }
})
