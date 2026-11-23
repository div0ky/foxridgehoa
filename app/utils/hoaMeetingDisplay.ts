/** Wall-clock zone for public meeting copy (Wentzville, MO). */
export const HOA_MEETING_TIME_ZONE = 'America/Chicago'

const meetingLineFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  hour: 'numeric',
  hour12: true,
  minute: '2-digit',
  month: 'numeric',
  timeZone: HOA_MEETING_TIME_ZONE
})

const hoaYearFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: HOA_MEETING_TIME_ZONE,
  year: 'numeric'
})

const hoaMonthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'numeric',
  timeZone: HOA_MEETING_TIME_ZONE
})

/** Calendar year in Wentzville, MO (`America/Chicago`) so SSR and client always agree. */
export function getHoaCurrentYear(date: Date = new Date()): number {
  return Number(hoaYearFormatter.format(date))
}

/** Zero-indexed calendar month (0 = Jan .. 11 = Dec) in Wentzville, MO (`America/Chicago`). */
export function getHoaCurrentMonth(date: Date = new Date()): number {
  return Number(hoaMonthFormatter.format(date)) - 1
}

/**
 * Renders a single instant like `1/7 at 5:30 PM` in Central Time.
 */
export function formatHoaMeetingLine({ atMs }: { atMs: number }): string {
  const parts = meetingLineFormatter.formatToParts(new Date(atMs))
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(p => p.type === type)?.value ?? ''
  const month = getPart('month')
  const day = getPart('day')
  const hour = getPart('hour')
  const minute = getPart('minute')
  const dayPeriod = getPart('dayPeriod')
  const time = minute ? `${hour}:${minute}${dayPeriod ? ` ${dayPeriod}` : ''}` : `${hour}${dayPeriod ? ` ${dayPeriod}` : ''}`

  return `${month}/${day} at ${time}`
}
