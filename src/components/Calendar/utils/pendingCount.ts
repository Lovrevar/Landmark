import type { CalendarEvent } from '../../../types/tasks'
import { expandEvents, type ExpandedOccurrence } from './recurrence'

/**
 * How far ahead "awaiting my response" looks. The header badge and the calendar sidebar both
 * read this, so the two numbers describe the same set of invitations.
 */
export const PENDING_WINDOW_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/** The awaiting-response window starting at `now`. */
export function pendingWindow(now: Date = new Date()): { from: Date; to: Date } {
  return { from: now, to: new Date(now.getTime() + PENDING_WINDOW_DAYS * DAY_MS) }
}

/**
 * The occurrences still waiting for the current user's answer: resolved response `pending`
 * and starting inside [from, to]. Sorted by start.
 */
export function selectPendingOccurrences(
  occurrences: ExpandedOccurrence[],
  from: Date,
  to: Date,
): ExpandedOccurrence[] {
  return occurrences
    .filter(o => o.myResponse === 'pending' && o.start >= from && o.start <= to)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
}

export function countPendingOccurrences(
  events: CalendarEvent[],
  currentUserId: string,
  from: Date,
  to: Date,
): number {
  return selectPendingOccurrences(expandEvents(events, from, to, currentUserId), from, to).length
}
