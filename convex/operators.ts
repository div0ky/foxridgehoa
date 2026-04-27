import { v } from 'convex/values'

import { mutation } from './_generated/server'
import { requireBoardMember } from './authz/requireBoardMember'
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
    await requireBoardMember(ctx)

    return await signUpAndInsertOperatorProfile({
      ctx,
      email: args.email,
      name: args.name,
      password: args.password,
      role: args.role
    })
  }
})
