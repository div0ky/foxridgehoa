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

async function readSchedulesForYear(
  ctx: QueryCtx | MutationCtx,
  year: number
) {
  const rows = await ctx.db
    .query('meetingSchedules')
    .withIndex('by_year', q => q.eq('year', year))
    .collect()

  const newest = rows.reduce<Doc<'meetingSchedules'> | null>((best, row) =>
    !best || row.updatedAt > best.updatedAt ? row : best, null)
  return { newest, rows }
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

    const { newest: doc } = await readSchedulesForYear(ctx, year)
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

    const { newest } = await readSchedulesForYear(ctx, year)

    return {
      data: {
        schedule: newest
          ? {
            id: newest._id,
            ...scheduleReturn(newest)
          }
          : null,
        year
      },
      ok: true as const
    }
  },
  returns: v.object({
    data: v.object({
      schedule: v.union(v.null(), v.object({
        annualMeeting: v.number(),
        boardMeetings: v.array(v.number()),
        id: v.id('meetingSchedules'),
        updatedAt: v.number(),
        year: v.number()
      })),
      year: v.number()
    }),
    ok: v.literal(true)
  })
})

export const setMeetingSchedule = mutation({
  args: {
    annualMeeting: v.number(),
    boardMeetings: v.array(v.number()),
    expectedUpdatedAt: v.optional(v.union(v.number(), v.null())),
    year: v.number()
  },
  handler: async (ctx, args) => {
    await requireBoardMember(ctx)
    const schedule = validateMeetingScheduleInput(args)

    const { newest, rows } = await readSchedulesForYear(ctx, schedule.year)
    if (args.expectedUpdatedAt !== undefined && args.expectedUpdatedAt !== (newest?.updatedAt ?? null)) {
      throw new ConvexError({ code: 'STALE_SERVER_DRAFT', message: 'The meeting schedule changed. Load the latest version.' })
    }
    const now = Date.now()
    const updatedAt = newest ? Math.max(now, newest.updatedAt + 1) : now

    const data = {
      annualMeeting: schedule.annualMeeting,
      boardMeetings: schedule.boardMeetings,
      updatedAt,
      year: schedule.year
    }

    if (!newest) {
      const scheduleId = await ctx.db.insert('meetingSchedules', data)
      return {
        data: { scheduleId },
        ok: true as const
      }
    }

    for (const row of rows) {
      if (row._id !== newest._id)
        await ctx.db.delete(row._id)
    }

    await ctx.db.patch(newest._id, {
      annualMeeting: schedule.annualMeeting,
      boardMeetings: schedule.boardMeetings,
      updatedAt
    })

    return {
      data: { scheduleId: newest._id },
      ok: true as const
    }
  },
  returns: v.object({ data: v.object({ scheduleId: v.id('meetingSchedules') }), ok: v.literal(true) })
})
