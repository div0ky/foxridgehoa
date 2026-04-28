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

  meetingSchedules: defineTable({
    annualMeeting: v.number(),
    boardMeetings: v.array(v.number()),
    updatedAt: v.number(),
    year: v.number()
  }).index('by_year', ['year']),

  operatorProfiles: defineTable({
    authUserId: v.string(),
    role: operatorRole
  }).index('by_authUserId', ['authUserId']),

  siteBanner: defineTable({
    body: v.string(),
    showUntil: v.number(),
    updatedAt: v.number()
  }),

  boardContactRouting: defineTable({
    recipients: v.array(
      v.object({
        displayName: v.string(),
        email: v.string()
      })
    ),
    updatedAt: v.number()
  }),

  boardContactSubmissions: defineTable({
    emailDeliveryStatus: v.union(
      v.literal('pending'),
      v.literal('sending'),
      v.literal('sent'),
      v.literal('failed'),
      v.literal('skipped_no_recipients')
    ),
    emailLastError: v.optional(v.string()),
    message: v.string(),
    resendEmailId: v.optional(v.string()),
    streetAddress: v.string(),
    submitterName: v.string()
  })
})
