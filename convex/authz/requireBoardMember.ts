import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

import { ConvexError } from 'convex/values'

import { authComponent } from '../auth'

/** Throws unless the current session is an authenticated board member. */
export async function requireBoardMember(
  ctx: MutationCtx | QueryCtx
): Promise<Doc<'operatorProfiles'>> {
  const user = await authComponent.safeGetAuthUser(ctx)
  if (!user || typeof user._id !== 'string')
    throw new ConvexError('Unauthenticated.')

  const profile = await ctx.db
    .query('operatorProfiles')
    .withIndex('by_authUserId', q => q.eq('authUserId', user._id))
    .unique()
    .catch(() => null)

  if (!profile || profile.role !== 'boardMember')
    throw new ConvexError('Only board members can perform this action.')

  return profile
}
