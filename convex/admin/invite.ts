import { v } from 'convex/values'

import { mutation } from '../_generated/server'
import { requireBoardMember } from '../authz/requireBoardMember'
import { operatorRole } from '../schema'
import { signUpAndInsertOperatorProfile } from './provisioning'

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
