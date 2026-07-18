/// <reference types="vite/client" />

import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'

import { api } from './_generated/api'
import { validateMeetingScheduleInput } from './meetingSchedule'
import schema from './schema'

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts'])

test('getPublicMeetingSchedule returns null when empty', async () => {
  const t = convexTest(schema, modules)
  const result = await t.query(api.meetingSchedule.getPublicMeetingSchedule, { year: 2026 })

  expect(result.ok).toBe(true)
  expect(result.data.schedule).toBeNull()
})

test('getPublicMeetingSchedule returns schedule when row exists', async () => {
  const t = convexTest(schema, modules)
  const t2026 = Date.UTC(2026, 0, 7, 23, 30, 0, 0)
  const tAnnual = Date.UTC(2026, 10, 19, 0, 30, 0, 0)

  await t.run(async (ctx) => {
    await ctx.db.insert('meetingSchedules', {
      annualMeeting: tAnnual,
      boardMeetings: [t2026, t2026, t2026, t2026],
      updatedAt: 1000,
      year: 2026
    })
  })

  const result = await t.query(api.meetingSchedule.getPublicMeetingSchedule, { year: 2026 })
  expect(result.ok).toBe(true)
  expect(result.data.schedule?.year).toBe(2026)
  expect(result.data.schedule?.boardMeetings).toHaveLength(4)
  expect(result.data.schedule?.annualMeeting).toBe(tAnnual)
})

test('getPublicMeetingSchedule picks newest row when duplicates exist for year', async () => {
  const t = convexTest(schema, modules)
  const older = Date.UTC(2026, 0, 1, 12, 0, 0, 0)
  const newer = Date.UTC(2026, 6, 1, 12, 0, 0, 0)

  await t.run(async (ctx) => {
    await ctx.db.insert('meetingSchedules', {
      annualMeeting: 1,
      boardMeetings: [older, older, older, older],
      updatedAt: 1,
      year: 2026
    })
    await ctx.db.insert('meetingSchedules', {
      annualMeeting: 2,
      boardMeetings: [newer, newer, newer, newer],
      updatedAt: 2,
      year: 2026
    })
  })

  const result = await t.query(api.meetingSchedule.getPublicMeetingSchedule, { year: 2026 })
  expect(result.data.schedule?.annualMeeting).toBe(2)
  expect(result.data.schedule?.boardMeetings?.[0]).toBe(newer)
})

test('setMeetingSchedule rejects unauthenticated caller', async () => {
  const t = convexTest(schema, modules)
  const t2026 = Date.UTC(2026, 0, 7, 23, 30, 0, 0)

  await expect(
    t.mutation(api.meetingSchedule.setMeetingSchedule, {
      annualMeeting: t2026,
      boardMeetings: [t2026, t2026, t2026, t2026],
      year: 2026
    })
  ).rejects.toThrow()
})

test('validateMeetingScheduleInput sorts valid board meetings', () => {
  const year = new Date().getFullYear()
  const boardMeetings = [
    Date.UTC(year, 8, 1, 18),
    Date.UTC(year, 2, 1, 18),
    Date.UTC(year, 11, 1, 18),
    Date.UTC(year, 5, 1, 18)
  ]

  const result = validateMeetingScheduleInput({
    annualMeeting: Date.UTC(year, 10, 1, 18),
    boardMeetings,
    year
  })

  expect(result.boardMeetings).toEqual([...boardMeetings].sort((a, b) => a - b))
})

test('validateMeetingScheduleInput rejects duplicate and out-of-year dates', () => {
  const year = new Date().getFullYear()
  const meeting = Date.UTC(year, 2, 1, 18)

  expect(() =>
    validateMeetingScheduleInput({
      annualMeeting: Date.UTC(year, 10, 1, 18),
      boardMeetings: [meeting, meeting, Date.UTC(year, 5, 1, 18), Date.UTC(year, 8, 1, 18)],
      year
    })
  ).toThrow(/unique/i)

  expect(() =>
    validateMeetingScheduleInput({
      annualMeeting: Date.UTC(year + 1, 0, 2, 18),
      boardMeetings: [
        Date.UTC(year, 2, 1, 18),
        Date.UTC(year, 5, 1, 18),
        Date.UTC(year, 8, 1, 18),
        Date.UTC(year, 11, 1, 18)
      ],
      year
    })
  ).toThrow(/within/i)
})
