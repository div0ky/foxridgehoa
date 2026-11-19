import { describe, expect, it } from 'vitest'

import { getHoaCalendarParts } from './hoaMeetingDisplay'

describe('getHoaCalendarParts', () => {
  it('rolls year and month over at Central midnight, not UTC midnight', () => {
    // 2026-01-01T05:59:59Z is still Dec 31 2025 in America/Chicago (CST).
    expect(getHoaCalendarParts({ atMs: Date.parse('2026-01-01T05:59:59Z') })).toEqual({ month: 11, year: 2025 })
    expect(getHoaCalendarParts({ atMs: Date.parse('2026-01-01T06:00:00Z') })).toEqual({ month: 0, year: 2026 })
    // Month boundary in CDT: 2026-03-01T06:00:00Z is Mar 1 00:00 CST.
    expect(getHoaCalendarParts({ atMs: Date.parse('2026-03-01T05:59:59Z') })).toEqual({ month: 1, year: 2026 })
    expect(getHoaCalendarParts({ atMs: Date.parse('2026-03-01T06:00:00Z') })).toEqual({ month: 2, year: 2026 })
  })
})
