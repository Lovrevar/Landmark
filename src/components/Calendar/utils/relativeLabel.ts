// Keys are written out in full rather than assembled from a prefix, so a static scan of
// t() calls still finds all eight.
const FUTURE = {
  minutes: 'calendar.next_up.in_minutes',
  hours: 'calendar.next_up.in_hours',
  days: 'calendar.next_up.in_days',
  weeks: 'calendar.next_up.in_weeks',
} as const

const PAST = {
  minutes: 'calendar.next_up.ago_minutes',
  hours: 'calendar.next_up.ago_hours',
  days: 'calendar.next_up.ago_days',
  weeks: 'calendar.next_up.ago_weeks',
} as const

export function relativeLabel(
  target: Date,
  now: Date,
  t: (k: string, v?: Record<string, unknown>) => string,
): string {
  const ms = target.getTime() - now.getTime()
  // Magnitude picks the unit, sign picks the wording. The calendar's two callers only ever
  // pass upcoming occurrences, but TaskRow passes deadlines, which are routinely past — and
  // a signed comparison sends every one of those into the "now" branch below.
  const minutes = Math.round(Math.abs(ms) / 60000)
  if (minutes < 1) return t('calendar.next_up.now')

  const k = ms < 0 ? PAST : FUTURE
  if (minutes < 60) return t(k.minutes, { count: minutes })
  const hours = Math.round(minutes / 60)
  if (hours < 24) return t(k.hours, { count: hours })
  const days = Math.round(hours / 24)
  if (days < 7) return t(k.days, { count: days })
  const weeks = Math.round(days / 7)
  return t(k.weeks, { count: weeks })
}
