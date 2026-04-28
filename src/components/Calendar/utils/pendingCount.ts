import type { CalendarEvent } from '../../../types/tasks'
import { expandEvents } from './recurrence'

export function countPendingOccurrences(
  events: CalendarEvent[],
  currentUserId: string,
  from: Date,
  to: Date,
): number {
  const occurrences = expandEvents(events, from, to, currentUserId)
  let n = 0
  for (const o of occurrences) {
    if (o.myResponse === 'pending' && o.start >= from) n++
  }
  return n
}
