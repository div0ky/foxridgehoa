import type { Doc } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

import { ConvexError, v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { requireBoardMember } from './authz/requireBoardMember'

const BOARD_MEETING_COUNT = 4

function assertAllowedScheduleYear(year: number): void {
  const thisYear = new Date().getFullYear()
  if (year < thisYear - 1 || year > thisYear + 2) {
    throw new ConvexError('Year is out of the allowed range.')
  }
}

async function getNewestScheduleForYear(
  ctx: QueryCtx | MutationCtx,
  year: number
): Promise<Doc<'meetingSchedules'> | null> {
  const rows = await ctx.db
    .query('meetingSchedules')
    .withIndex('by_year', q => q.eq('year', year))
    .collect()

  if (rows.length === 0)
    return null

  return rows.reduce((best, row) => (row.updatedAt > best.updatedAt ? row : best))
}

const scheduleReturn = (doc: Doc<'meetingSchedules'>) => ({
  annualMeeting: doc.annualMeeting,
  boardMeetings: doc.boardMeetings,
  updatedAt: doc.updatedAt,
  year: doc.year
})

export const getPublicMeetingSchedule = query({
  args: { year: v.number() },
  handler: async (ctx, { year }) => {
    const doc = await getNewestScheduleForYear(ctx, year)
    if (!doc) {
      return {
        data: { schedule: null },
        ok: true as const
      }
    }

    return {
      data: { schedule: scheduleReturn(doc) },
      ok: true as const
    }
  }
})

export const getAdminMeetingSchedule = query({
  args: { year: v.number() },
  handler: async (ctx, { year }) => {
    await requireBoardMember(ctx)

    const doc = await getNewestScheduleForYear(ctx, year)
    if (!doc) {
      return {
        data: { schedule: null },
        ok: true as const
      }
    }

    return {
      data: {
        schedule: {
          id: doc._id,
          ...scheduleReturn(doc)
        }
      },
      ok: true as const
    }
  }
})

export const setMeetingSchedule = mutation({
  args: {
    annualMeeting: v.number(),
    boardMeetings: v.array(v.number()),
    year: v.number()
  },
  handler: async (ctx, args) => {
    await requireBoardMember(ctx)
    assertAllowedScheduleYear(args.year)

    if (args.boardMeetings.length !== BOARD_MEETING_COUNT) {
      throw new ConvexError(
        `Provide exactly ${BOARD_MEETING_COUNT} board meeting dates.`
      )
    }

    for (const t of args.boardMeetings) {
      if (!Number.isFinite(t))
        throw new ConvexError('A board meeting time is invalid.')
    }

    if (!Number.isFinite(args.annualMeeting))
      throw new ConvexError('Annual meeting time is invalid.')

    const updatedAt = Date.now()
    const rows = await ctx.db
      .query('meetingSchedules')
      .withIndex('by_year', q => q.eq('year', args.year))
      .collect()

    const data = {
      annualMeeting: args.annualMeeting,
      boardMeetings: args.boardMeetings,
      updatedAt,
      year: args.year
    }

    if (rows.length === 0) {
      const scheduleId = await ctx.db.insert('meetingSchedules', data)
      return {
        data: { scheduleId },
        ok: true as const
      }
    }

    const keep = rows.reduce((best, row) =>
      row.updatedAt > best.updatedAt ? row : best
    )

    for (const row of rows) {
      if (row._id !== keep._id)
        await ctx.db.delete(row._id)
    }

    await ctx.db.patch(keep._id, {
      annualMeeting: args.annualMeeting,
      boardMeetings: args.boardMeetings,
      updatedAt
    })

    return {
      data: { scheduleId: keep._id },
      ok: true as const
    }
  }
})
