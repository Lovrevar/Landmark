/**
 * Helpers for SQL `date` (date-only) columns.
 *
 * Postgres `date` values arrive as 'YYYY-MM-DD' strings. Passing them straight
 * to `new Date('YYYY-MM-DD')` parses them as **UTC midnight**, while everything
 * else in the app (`new Date()`, date-fns `startOfMonth`, etc.) works in the
 * browser's **local** zone. For users east of UTC (Croatia is UTC+1/+2) that
 * mismatch shifts a date back by a day, corrupting month buckets, overdue
 * detection, and "this week" windows.
 *
 * These helpers parse and bucket date-only strings consistently in local time.
 */

/**
 * Parse a date-only (or ISO datetime) string as **local** midnight.
 * Returns an Invalid Date for empty/garbage input (caller should guard with
 * `isValidDate` where a row may be missing the value).
 */
export function parseLocalDate(value: string | null | undefined): Date {
  if (!value) return new Date(NaN)
  const [datePart] = value.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  if (!y || !m || !d) return new Date(NaN)
  return new Date(y, m - 1, d)
}

/** True when `value` parses to a real calendar date. */
export function isValidDate(value: string | null | undefined): boolean {
  return !Number.isNaN(parseLocalDate(value).getTime())
}

/** 'YYYY-MM' bucket key derived directly from the string (timezone-independent). */
export function monthKey(value: string | null | undefined): string {
  if (!value) return ''
  return value.split('T')[0].slice(0, 7)
}

/** Local midnight today, for date-only comparisons. */
export function startOfTodayLocal(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/**
 * Whole calendar days from today to `value` (date-only). Positive = future,
 * 0 = today, negative = past. Both sides normalised to local midnight so the
 * result is stable through the day and inclusive of "today".
 */
export function daysFromToday(value: string | null | undefined): number {
  const target = parseLocalDate(value)
  if (Number.isNaN(target.getTime())) return NaN
  const today = startOfTodayLocal()
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}
