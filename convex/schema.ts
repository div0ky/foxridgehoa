import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export const operatorRole = v.union(
  v.literal('homeOwner'),
  v.literal('boardMember'),
  v.literal('managementCompany')
)

export default defineSchema({
  operatorProfiles: defineTable({
    authUserId: v.string(),
    role: operatorRole
  }).index('by_authUserId', ['authUserId'])
})
