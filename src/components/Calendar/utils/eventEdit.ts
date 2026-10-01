import type {
  CalendarEvent,
  EventParticipant,
  EventResponse,
  NewEventInput,
} from '../../../types/tasks'
import type { EventUpdate } from '../services/calendarService'

// Pure pieces of editing an existing event, kept out of the service so they can be tested
// without a database: which columns actually changed, and which participant rows to touch.

function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return a === b
  // The DB returns "2026-09-15T07:00:00+00:00", the form sends "2026-09-15T07:00:00.000Z".
  return new Date(a).getTime() === new Date(b).getTime()
}

function sameOffsets(a: number[] | null | undefined, b: number[] | null | undefined): boolean {
  const x = [...(a ?? [])].sort((m, n) => m - n)
  const y = [...(b ?? [])].sort((m, n) => m - n)
  return x.length === y.length && x.every((v, i) => v === y[i])
}

/**
 * The columns the edit form changed, and nothing else — so `changed_fields` in the activity log
 * says what the user did rather than listing every column.
 *
 * The timing of a recurring series (`start_at`, `end_at`, `recurrence`) is never included.
 * Every exception and per-occurrence RSVP is keyed by the RRULE-derived `original_start_at`;
 * moving the series or changing its rule would orphan them silently. The form shows those
 * fields read-only, and this is the backstop. A one-off event has no such rows, so its date,
 * time and a newly added rule are all editable.
 */
export function buildEventUpdate(previous: CalendarEvent, input: NewEventInput): EventUpdate {
  const updates: EventUpdate = {}
  if (input.title !== previous.title) updates.title = input.title
  if (input.description !== (previous.description ?? '')) updates.description = input.description
  if (input.location !== (previous.location ?? '')) updates.location = input.location
  if (input.event_type !== previous.event_type) updates.event_type = input.event_type
  if (input.is_private !== previous.is_private) updates.is_private = input.is_private
  if (input.busy !== previous.busy) updates.busy = input.busy
  if ((input.project_id ?? null) !== (previous.project_id ?? null)) {
    updates.project_id = input.project_id ?? null
  }
  if (!sameOffsets(input.reminder_offsets, previous.reminder_offsets)) {
    updates.reminder_offsets = input.reminder_offsets
  }

  if (!previous.recurrence) {
    if (!sameInstant(input.start_at, previous.start_at)) updates.start_at = input.start_at
    if (!sameInstant(input.end_at, previous.end_at)) updates.end_at = input.end_at
    if (input.recurrence) updates.recurrence = input.recurrence
  }

  return updates
}

export interface ParticipantChangePlan {
  /** calendar_event_participants row ids to delete */
  removeRowIds: string[]
  /** users to invite; inserted as `pending` */
  addUserIds: string[]
  /** private events only: the creator's own row is missing (`insert`) or not accepted (`accept`) */
  creatorRow: 'insert' | 'accept' | null
}

/**
 * Reconciles an event's participant rows with the edit form, touching as few rows as possible.
 *
 * - A user still invited keeps their row, and with it their RSVP and `acknowledged_at`.
 * - A user no longer invited loses their row; a newly invited one gets a `pending` row.
 * - The creator's own row is never removed. On a private event it must exist and be accepted,
 *   the same shape createEvent writes; on a public event the creator needs no row at all.
 * - Private means nobody else: switching public → private removes every other row, and
 *   private → public invites whoever was picked.
 *
 * RLS already allows exactly this: only the event creator may insert or delete participant
 * rows, and a user may update their own row.
 */
export function planParticipantChanges(
  existing: Pick<EventParticipant, 'id' | 'user_id' | 'response'>[],
  creatorId: string,
  next: { isPrivate: boolean; participantIds: string[] },
): ParticipantChangePlan {
  const creatorRow = existing.find(p => p.user_id === creatorId) ?? null
  const others = existing.filter(p => p.user_id !== creatorId)

  const wanted: string[] = []
  if (!next.isPrivate) {
    const seen = new Set<string>()
    for (const id of next.participantIds) {
      if (id === creatorId || seen.has(id)) continue
      seen.add(id)
      wanted.push(id)
    }
  }
  const wantedSet = new Set(wanted)
  const have = new Set(others.map(p => p.user_id))

  let creatorAction: ParticipantChangePlan['creatorRow'] = null
  if (next.isPrivate) {
    const accepted: EventResponse = 'accepted'
    if (!creatorRow) creatorAction = 'insert'
    else if (creatorRow.response !== accepted) creatorAction = 'accept'
  }

  return {
    removeRowIds: others.filter(p => !wantedSet.has(p.user_id)).map(p => p.id),
    addUserIds: wanted.filter(id => !have.has(id)),
    creatorRow: creatorAction,
  }
}

export function hasParticipantChanges(plan: ParticipantChangePlan): boolean {
  return plan.removeRowIds.length > 0 || plan.addUserIds.length > 0 || plan.creatorRow !== null
}
