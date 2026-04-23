export function relativeLabel(
  target: Date,
  now: Date,
  t: (k: string, v?: Record<string, unknown>) => string,
): string {
  const ms = target.getTime() - now.getTime()
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return t('calendar.next_up.now')
  if (minutes < 60) return t('calendar.next_up.in_minutes', { count: minutes })
  const hours = Math.round(minutes / 60)
  if (hours < 24) return t('calendar.next_up.in_hours', { count: hours })
  const days = Math.round(hours / 24)
  if (days < 7) return t('calendar.next_up.in_days', { count: days })
  const weeks = Math.round(days / 7)
  return t('calendar.next_up.in_weeks', { count: weeks })
}
