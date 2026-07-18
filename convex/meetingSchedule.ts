import type { Doc } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

import { ConvexError, v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { requireBoardMember } from './authz/requireBoardMember'

const BOARD_MEETING_COUNT = 4
const HOA_TIME_ZONE = 'America/Chicago'

function assertAllowedScheduleYear(year: number): void {
  const thisYear = new Date().getFullYear()
  if (year < thisYear - 1 || year > thisYear + 2) {
    throw new ConvexError('Year is out of the allowed range.')
  }
}

function yearInHoaTimeZone(timestamp: number): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: HOA_TIME_ZONE,
      year: 'numeric'
    }).format(new Date(timestamp))
  )
}

export function validateMeetingScheduleInput(args: {
  annualMeeting: number
  boardMeetings: number[]
  year: number
}): { annualMeeting: number, boardMeetings: number[], year: number } {
  if (!Number.isInteger(args.year))
    throw new ConvexError('Year is invalid.')
  assertAllowedScheduleYear(args.year)

  if (args.boardMeetings.length !== BOARD_MEETING_COUNT) {
    throw new ConvexError(
      `Provide exactly ${BOARD_MEETING_COUNT} board meeting dates.`
    )
  }

  const allMeetings = [...args.boardMeetings, args.annualMeeting]
  for (const meetingTime of allMeetings) {
    if (!Number.isFinite(meetingTime))
      throw new ConvexError('A meeting time is invalid.')
    if (yearInHoaTimeZone(meetingTime) !== args.year)
      throw new ConvexError(`Every meeting must fall within ${args.year} in Central Time.`)
  }

  if (new Set(args.boardMeetings).size !== args.boardMeetings.length)
    throw new ConvexError('Board meeting dates must be unique.')

  return {
    annualMeeting: args.annualMeeting,
    boardMeetings: [...args.boardMeetings].sort((a, b) => a - b),
    year: args.year
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
    if (!Number.isInteger(year))
      throw new ConvexError('Year is invalid.')

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
    if (!Number.isInteger(year))
      throw new ConvexError('Year is invalid.')

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
    const schedule = validateMeetingScheduleInput(args)

    const updatedAt = Date.now()
    const rows = await ctx.db
      .query('meetingSchedules')
      .withIndex('by_year', q => q.eq('year', args.year))
      .collect()

    const data = {
      annualMeeting: schedule.annualMeeting,
      boardMeetings: schedule.boardMeetings,
      updatedAt,
      year: schedule.year
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
      annualMeeting: schedule.annualMeeting,
      boardMeetings: schedule.boardMeetings,
      updatedAt
    })

    return {
      data: { scheduleId: keep._id },
      ok: true as const
    }
  }
})
