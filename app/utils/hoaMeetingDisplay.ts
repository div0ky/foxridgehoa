/** Wall-clock zone for public meeting copy (Wentzville, MO). */
export const HOA_MEETING_TIME_ZONE = 'America/Chicago'

/**
 * Renders a single instant like `1/7 at 5:30 PM` in Central Time.
 */
export function formatHoaMeetingLine({ atMs }: { atMs: number }): string {
  const d = new Date(atMs)
  const dtf = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    hour12: true,
    minute: '2-digit',
    month: 'numeric',
    timeZone: HOA_MEETING_TIME_ZONE
  })
  const parts = dtf.formatToParts(d)
  const g = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(p => p.type === type)?.value ?? ''
  const month = g('month')
  const day = g('day')
  const hour = g('hour')
  const minute = g('minute')
  const dayPeriod = g('dayPeriod')
  const time = minute ? `${hour}:${minute}${dayPeriod ? ` ${dayPeriod}` : ''}` : `${hour}${dayPeriod ? ` ${dayPeriod}` : ''}`

  return `${month}/${day} at ${time}`
}

/** Calendar year and 0-based month of an instant on the HOA's Central Time wall clock. */
export function getHoaCalendarParts({ atMs }: { atMs: number }): { month: number, year: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    timeZone: HOA_MEETING_TIME_ZONE,
    year: 'numeric'
  }).formatToParts(new Date(atMs))
  const g = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)?.value)

  return { month: g('month') - 1, year: g('year') }
}
