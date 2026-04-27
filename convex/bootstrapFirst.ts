import { ConvexError, v } from 'convex/values'

import { internalMutation } from './_generated/server'
import { signUpAndInsertOperatorProfile } from './operatorProvisioning'

export const bootstrapFirstOperator = internalMutation({
  args: {
    bootstrapSecret: v.string(),
    email: v.string(),
    name: v.string(),
    password: v.string()
  },
  handler: async (ctx, args) => {
    const configured = process.env.OPERATOR_BOOTSTRAP_SECRET
    if (!configured || args.bootstrapSecret !== configured)
      throw new ConvexError('Invalid bootstrap credential.')

    const existed = await ctx.db.query('operatorProfiles').take(1)
    if (existed.length > 0)
      throw new ConvexError('Bootstrap already completed.')

    return await signUpAndInsertOperatorProfile({
      ctx,
      email: args.email,
      name: args.name,
      password: args.password,
      role: 'boardMember'
    })
  }
})
