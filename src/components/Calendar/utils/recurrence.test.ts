import { describe, it, expect } from 'vitest'
import { expandEvents } from './recurrence'
import type { CalendarEvent, EventParticipant, OccurrenceResponse } from '../../../types/tasks'

// Calendar ids are public.users ids (not auth ids): `created_by` and participant `user_id` alike.
const CREATOR = 'user-creator'
const GUEST = 'user-guest'

function participant(userId: string, response: EventParticipant['response']): EventParticipant {
  return {
    id: `p-${userId}`,
    event_id: 'e1',
    user_id: userId,
    response,
    acknowledged_at: null,
    created_at: '2026-09-01T08:00:00Z',
  }
}

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'e1',
    title: 'Sastanak',
    description: '',
    location: '',
    created_by: CREATOR,
    start_at: '2026-09-16T07:00:00Z',
    end_at: '2026-09-16T08:00:00Z',
    event_type: 'meeting',
    is_private: false,
    all_day: false,
    project_id: null,
    recurrence: null,
    reminder_offsets: [],
    busy: true,
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T08:00:00Z',
    participants: [participant(GUEST, 'pending')],
    exceptions: [],
    occurrence_responses: [],
    ...overrides,
  }
}

const FROM = new Date('2026-09-15T00:00:00Z')
const TO = new Date('2026-10-15T00:00:00Z')

describe('expandEvents — myResponse', () => {
  it('treats the creator of a public event, who has no participant row, as accepted', () => {
    const [occ] = expandEvents([event()], FROM, TO, CREATOR)
    expect(occ.myResponse).toBe('accepted')
    expect(occ.myParticipantId).toBeNull()
    expect(occ.isDeclined).toBe(false)
  })

  it('treats the creator of every occurrence of a recurring series as accepted', () => {
    const occs = expandEvents(
      [event({ recurrence: 'FREQ=WEEKLY;COUNT=3' })],
      FROM,
      TO,
      CREATOR,
    )
    expect(occs).toHaveLength(3)
    expect(occs.every(o => o.myResponse === 'accepted')).toBe(true)
  })

  it('still leaves an invited user without an answer as pending', () => {
    const [occ] = expandEvents([event()], FROM, TO, GUEST)
    expect(occ.myResponse).toBe('pending')
    expect(occ.myParticipantId).toBe(`p-${GUEST}`)
  })

  it('uses the creator row when one exists (private events carry an accepted self-row)', () => {
    const [occ] = expandEvents(
      [event({ is_private: true, participants: [participant(CREATOR, 'declined')] })],
      FROM,
      TO,
      CREATOR,
    )
    expect(occ.myResponse).toBe('declined')
  })

  it('lets an occurrence response override the series answer', () => {
    const override: OccurrenceResponse = {
      id: 'r1',
      event_id: 'e1',
      user_id: GUEST,
      original_start_at: '2026-09-16T07:00:00+00:00',
      response: 'declined',
      acknowledged_at: '2026-09-02T08:00:00Z',
      created_at: '2026-09-02T08:00:00Z',
    }
    const [occ] = expandEvents(
      [event({ participants: [participant(GUEST, 'accepted')], occurrence_responses: [override] })],
      FROM,
      TO,
      GUEST,
    )
    expect(occ.myResponse).toBe('declined')
  })

  it('is pending for everyone when there is no current user', () => {
    const [occ] = expandEvents([event()], FROM, TO, null)
    expect(occ.myResponse).toBe('pending')
  })
})
