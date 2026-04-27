import { ConvexError, v } from 'convex/values'

import { mutation } from './_generated/server'
import { authComponent } from './auth'
import { signUpAndInsertOperatorProfile } from './operatorProvisioning'
import { operatorRole } from './schema'

export const provisionOperator = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    password: v.string(),
    role: operatorRole
  },
  handler: async (ctx, args) => {
    const caller = await authComponent.safeGetAuthUser(ctx)
    if (!caller || typeof caller._id !== 'string')
      throw new ConvexError('Unauthenticated.')

    const callerProfile = await ctx.db
      .query('operatorProfiles')
      .withIndex('by_authUserId', q => q.eq('authUserId', caller._id))
      .unique()
      .catch(() => null)

    if (!callerProfile || callerProfile.role !== 'boardMember')
      throw new ConvexError('Only board members can add users.')

    return await signUpAndInsertOperatorProfile({
      ctx,
      email: args.email,
      name: args.name,
      password: args.password,
      role: args.role
    })
  }
})
