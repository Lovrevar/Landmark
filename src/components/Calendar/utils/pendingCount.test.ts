import { describe, it, expect } from 'vitest'
import {
  PENDING_WINDOW_DAYS,
  countPendingOccurrences,
  pendingWindow,
  selectPendingOccurrences,
} from './pendingCount'
import { expandEvents } from './recurrence'
import type { CalendarEvent, EventParticipant } from '../../../types/tasks'

const ME = 'user-me'
const OTHER = 'user-other'

function row(eventId: string, userId: string, response: EventParticipant['response']): EventParticipant {
  return {
    id: `p-${eventId}-${userId}`,
    event_id: eventId,
    user_id: userId,
    response,
    acknowledged_at: null,
    created_at: '2026-09-01T08:00:00Z',
  }
}

function event(id: string, createdBy: string, startIso: string, participants: EventParticipant[], recurrence: string | null = null): CalendarEvent {
  const start = new Date(startIso)
  return {
    id,
    title: id,
    description: '',
    location: '',
    created_by: createdBy,
    start_at: start.toISOString(),
    end_at: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
    event_type: 'meeting',
    is_private: false,
    all_day: false,
    project_id: null,
    recurrence,
    reminder_offsets: [],
    busy: true,
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T08:00:00Z',
    participants,
    exceptions: [],
    occurrence_responses: [],
  }
}

const NOW = new Date('2026-09-15T10:00:00Z')

describe('pendingWindow', () => {
  it('spans PENDING_WINDOW_DAYS from now', () => {
    const { from, to } = pendingWindow(NOW)
    expect(from).toEqual(NOW)
    expect((to.getTime() - from.getTime()) / 86_400_000).toBe(PENDING_WINDOW_DAYS)
  })
})

describe('countPendingOccurrences', () => {
  const { from, to } = pendingWindow(NOW)

  it("does not count the user's own public meeting as an invitation", () => {
    const mine = event('mine', ME, '2026-09-16T07:00:00Z', [row('mine', OTHER, 'pending')])
    expect(countPendingOccurrences([mine], ME, from, to)).toBe(0)
  })

  it('counts an unanswered invitation from someone else', () => {
    const invite = event('invite', OTHER, '2026-09-16T07:00:00Z', [row('invite', ME, 'pending')])
    expect(countPendingOccurrences([invite], ME, from, to)).toBe(1)
  })

  it('counts each unanswered occurrence of an invited series', () => {
    const series = event('series', OTHER, '2026-09-16T07:00:00Z', [row('series', ME, 'pending')], 'FREQ=WEEKLY;COUNT=3')
    expect(countPendingOccurrences([series], ME, from, to)).toBe(3)
  })

  it('ignores answered invitations and occurrences that already started', () => {
    const answered = event('answered', OTHER, '2026-09-16T07:00:00Z', [row('answered', ME, 'accepted')])
    const started = event('started', OTHER, '2026-09-15T09:30:00Z', [row('started', ME, 'pending')])
    expect(countPendingOccurrences([answered, started], ME, from, to)).toBe(0)
  })
})

describe('selectPendingOccurrences', () => {
  it('agrees with the badge count over a wider fetched range', () => {
    // The sidebar fetches a wider window than the badge; cutting it with the same window must
    // give the same number.
    const events = [
      event('a', OTHER, '2026-09-20T07:00:00Z', [row('a', ME, 'pending')]),
      event('b', OTHER, '2026-10-14T07:00:00Z', [row('b', ME, 'pending')]),
      event('late', OTHER, '2026-10-20T07:00:00Z', [row('late', ME, 'pending')]),
      event('early', OTHER, '2026-09-15T06:00:00Z', [row('early', ME, 'pending')]),
      event('mine', ME, '2026-09-18T07:00:00Z', [row('mine', OTHER, 'pending')]),
    ]
    const { from, to } = pendingWindow(NOW)
    const wide = expandEvents(events, new Date('2026-09-15T00:00:00Z'), new Date('2026-10-17T00:00:00Z'), ME)
    const selected = selectPendingOccurrences(wide, from, to)
    expect(selected.map(o => o.event.id)).toEqual(['a', 'b'])
    expect(selected).toHaveLength(countPendingOccurrences(events, ME, from, to))
  })
})
