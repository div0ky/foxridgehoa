import { describe, expect, test } from 'vitest'

import {
  formatHoaMeetingLine,
  getHoaCurrentMonth,
  getHoaCurrentYear
} from './hoaMeetingDisplay'

describe('hoaMeetingDisplay', () => {
  test('formats meeting times in Central Time', () => {
    // 2026-01-07 23:30 UTC = 2026-01-07 5:30 PM CST
    expect(formatHoaMeetingLine({ atMs: Date.UTC(2026, 0, 7, 23, 30) })).toBe('1/7 at 5:30 PM')
  })

  test('resolves year and month in Wentzville (America/Chicago) across UTC midnight', () => {
    // 2026-01-01 02:30 UTC = 2025-12-31 8:30 PM CST
    const newYearsEveInCentral = new Date(Date.UTC(2026, 0, 1, 2, 30))
    expect(getHoaCurrentYear(newYearsEveInCentral)).toBe(2025)
    expect(getHoaCurrentMonth(newYearsEveInCentral)).toBe(11)

    // 2026-03-01 03:00 UTC = 2026-02-28 9:00 PM CST
    const febEndInCentral = new Date(Date.UTC(2026, 2, 1, 3, 0))
    expect(getHoaCurrentYear(febEndInCentral)).toBe(2026)
    expect(getHoaCurrentMonth(febEndInCentral)).toBe(1)
  })
})
