// The Day/Week timeline only shows working-day hours, not the full 24. Events
// that fall outside the window are clamped at the edges (or hidden entirely
// when they do not intersect the window). DAY_START_HOUR is the first hour
// label rendered at the top of the column; DAY_END_HOUR is one past the last.
// e.g. 6 → 20 renders 14 hour rows labelled 6 AM … 7 PM (the final row spans
// 19:00 → 20:00).
export const DAY_START_HOUR = 6
export const DAY_END_HOUR = 20
export const DAY_HOURS = DAY_END_HOUR - DAY_START_HOUR
export const VISIBLE_START_MIN = DAY_START_HOUR * 60
export const VISIBLE_END_MIN = DAY_END_HOUR * 60

export const HOUR_HEIGHT = 60       // px per hour on the vertical timeline
export const SLOT_MINUTES = 15       // snap granularity for click-to-create

export function pxPerMinute() {
  return HOUR_HEIGHT / 60
}

export function minutesToPx(minutes: number) {
  return minutes * pxPerMinute()
}

export function pxToMinutes(px: number) {
  return px / pxPerMinute()
}

export function snapMinutes(minutes: number) {
  return Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function startOfWeek(date: Date): Date {
  const d = startOfDay(date)
  const day = d.getDay()
  const mondayOffset = (day + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - mondayOffset)
  return d
}

export function endOfWeek(date: Date): Date {
  const d = startOfWeek(date)
  d.setDate(d.getDate() + 7)
  d.setMilliseconds(-1)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Fractional minutes from day start (00:00) for a given Date. Event timestamps
 *  are still absolute; callers shift by VISIBLE_START_MIN to map into the
 *  displayed timeline column. */
export function minutesFromDayStart(date: Date, dayStart: Date): number {
  return (date.getTime() - dayStart.getTime()) / 60000
}

export function formatHourLabel(hour: number, locale: string) {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}
