import { describe, it, expect } from 'vitest'
import { buildEventUpdate, hasParticipantChanges, planParticipantChanges } from './eventEdit'
import type { CalendarEvent, EventParticipant, NewEventInput } from '../../../types/tasks'

const CREATOR = 'u-creator'

function row(userId: string, response: EventParticipant['response'] = 'pending'): EventParticipant {
  return {
    id: `row-${userId}`,
    event_id: 'e1',
    user_id: userId,
    response,
    acknowledged_at: null,
    created_at: '2026-09-01T08:00:00Z',
  }
}

function stored(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'e1',
    title: 'Sastanak',
    description: 'Opis',
    location: 'Ured',
    created_by: CREATOR,
    // The shape PostgREST returns
    start_at: '2026-09-16T07:00:00+00:00',
    end_at: '2026-09-16T08:00:00+00:00',
    event_type: 'meeting',
    is_private: false,
    all_day: false,
    project_id: null,
    recurrence: null,
    reminder_offsets: [15, 60],
    busy: true,
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T08:00:00Z',
    participants: [],
    ...overrides,
  }
}

/** The form's output for an untouched `stored()` event. */
function form(overrides: Partial<NewEventInput> = {}): NewEventInput {
  return {
    title: 'Sastanak',
    description: 'Opis',
    location: 'Ured',
    start_at: '2026-09-16T07:00:00.000Z',
    end_at: '2026-09-16T08:00:00.000Z',
    event_type: 'meeting',
    is_private: false,
    all_day: false,
    participant_ids: [],
    project_id: null,
    recurrence: null,
    reminder_offsets: [60, 15],
    busy: true,
    ...overrides,
  }
}

describe('buildEventUpdate', () => {
  it('is empty when nothing changed, whatever the timestamp format or reminder order', () => {
    expect(buildEventUpdate(stored(), form())).toEqual({})
  })

  it('carries only the changed columns', () => {
    expect(
      buildEventUpdate(stored(), form({ title: 'Novi naslov', busy: false, project_id: 'p1' })),
    ).toEqual({ title: 'Novi naslov', busy: false, project_id: 'p1' })
  })

  it('lets a one-off event move and gain a repeat rule', () => {
    const update = buildEventUpdate(
      stored(),
      form({
        start_at: '2026-09-17T09:00:00.000Z',
        end_at: '2026-09-17T10:00:00.000Z',
        recurrence: 'FREQ=WEEKLY;BYDAY=TH',
      }),
    )
    expect(update).toEqual({
      start_at: '2026-09-17T09:00:00.000Z',
      end_at: '2026-09-17T10:00:00.000Z',
      recurrence: 'FREQ=WEEKLY;BYDAY=TH',
    })
  })

  it('never sends timing or rule changes for a recurring series', () => {
    const update = buildEventUpdate(
      stored({ recurrence: 'FREQ=WEEKLY;BYDAY=WE' }),
      form({
        title: 'Tjedni sastanak',
        start_at: '2026-09-17T09:00:00.000Z',
        end_at: '2026-09-17T10:00:00.000Z',
        recurrence: 'FREQ=DAILY',
      }),
    )
    expect(update).toEqual({ title: 'Tjedni sastanak' })
  })

  it('treats a null stored description as empty', () => {
    const prev = stored({ description: null as unknown as string })
    expect(buildEventUpdate(prev, form({ description: '' }))).toEqual({})
  })
})

describe('planParticipantChanges', () => {
  it('removes dropped invitees, invites new ones, and leaves the rest (and their RSVP) alone', () => {
    const plan = planParticipantChanges(
      [row('a', 'accepted'), row('b', 'declined'), row('c')],
      CREATOR,
      { isPrivate: false, participantIds: ['a', 'c', 'd'] },
    )
    expect(plan).toEqual({ removeRowIds: ['row-b'], addUserIds: ['d'], creatorRow: null })
  })

  it('reports no change when the list is the same', () => {
    const plan = planParticipantChanges([row('a'), row('b')], CREATOR, {
      isPrivate: false,
      participantIds: ['b', 'a'],
    })
    expect(hasParticipantChanges(plan)).toBe(false)
  })

  it('ignores duplicates and the creator in the picked list', () => {
    const plan = planParticipantChanges([], CREATOR, {
      isPrivate: false,
      participantIds: ['a', CREATOR, 'a'],
    })
    expect(plan.addUserIds).toEqual(['a'])
  })

  it('never removes the creator row on a public event', () => {
    const plan = planParticipantChanges([row(CREATOR, 'accepted'), row('a')], CREATOR, {
      isPrivate: false,
      participantIds: [],
    })
    expect(plan).toEqual({ removeRowIds: ['row-a'], addUserIds: [], creatorRow: null })
  })

  it('public → private removes everyone else and adds the accepted creator row', () => {
    const plan = planParticipantChanges([row('a', 'accepted'), row('b')], CREATOR, {
      isPrivate: true,
      participantIds: ['a', 'b'],
    })
    expect(plan).toEqual({ removeRowIds: ['row-a', 'row-b'], addUserIds: [], creatorRow: 'insert' })
  })

  it('private with an unaccepted creator row asks for it to be accepted', () => {
    const plan = planParticipantChanges([row(CREATOR, 'pending')], CREATOR, {
      isPrivate: true,
      participantIds: [],
    })
    expect(plan.creatorRow).toBe('accept')
    expect(hasParticipantChanges(plan)).toBe(true)
  })

  it('private → public invites the picked users and keeps the creator row', () => {
    const plan = planParticipantChanges([row(CREATOR, 'accepted')], CREATOR, {
      isPrivate: false,
      participantIds: ['a', 'b'],
    })
    expect(plan).toEqual({ removeRowIds: [], addUserIds: ['a', 'b'], creatorRow: null })
  })
})
