import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export const operatorRole = v.union(
  v.literal('homeOwner'),
  v.literal('boardMember'),
  v.literal('managementCompany')
)

const importantDocumentFileEntry = v.object({
  label: v.string(),
  storageId: v.id('_storage')
})

export default defineSchema({
  importantDocuments: defineTable({
    description: v.string(),
    files: v.array(importantDocumentFileEntry),
    icon: v.optional(v.string()),
    sortOrder: v.number(),
    title: v.string()
  }),

  operatorProfiles: defineTable({
    authUserId: v.string(),
    role: operatorRole
  }).index('by_authUserId', ['authUserId']),

  siteBanner: defineTable({
    body: v.string(),
    showUntil: v.number(),
    updatedAt: v.number()
  })
})
