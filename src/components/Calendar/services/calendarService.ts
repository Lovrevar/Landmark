import { supabase } from '../../../lib/supabase'
import { logActivity } from '../../../lib/activityLog'
import { countPendingOccurrences } from '../utils/pendingCount'
import {
  buildEventUpdate,
  hasParticipantChanges,
  planParticipantChanges,
} from '../utils/eventEdit'
import type {
  CalendarEvent,
  EventException,
  EventResponse,
  NewEventInput,
  OccurrenceResponse,
  TaskUser,
} from '../../../types/tasks'

const EVENT_FIELDS = [
  'id',
  'title',
  'description',
  'location',
  'created_by',
  'start_at',
  'end_at',
  'event_type',
  'is_private',
  'all_day',
  'project_id',
  'recurrence',
  'reminder_offsets',
  'busy',
  'created_at',
  'updated_at',
].join(', ')

export interface ProjectOption {
  id: string
  name: string
}

export async function fetchProjectOptions(): Promise<ProjectOption[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .order('name', { ascending: true })
  if (error) throw error
  return (data || []) as ProjectOption[]
}

/**
 * Calendar tables (event participants, busy blocks) key users by
 * public.users.id, unlike the task tables which use auth user ids.
 * `id` here is the app user id; `auth_user_id` is carried along so the
 * tasks overlay can translate participant filters into the task id space.
 */
export interface CalendarUser {
  id: string
  auth_user_id: string | null
  username: string
  role: string
}

export async function fetchCalendarUsers(): Promise<CalendarUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, auth_user_id, username, role')
    .order('username')
  if (error) throw error
  return (data || []) as CalendarUser[]
}

export async function fetchEventsInRange(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<CalendarEvent[]> {
  // 1. Participant event ids
  const { data: partRows, error: pErr } = await supabase
    .from('calendar_event_participants')
    .select('event_id')
    .eq('user_id', userId)
  if (pErr) throw pErr
  const participantIds = (partRows || []).map(r => r.event_id)

  // 2. Non-recurring events overlapping the window (creator OR participant).
  //    Overlap semantics: start_at < to AND end_at > from.
  const { data: createdNonRec, error: cErr } = await supabase
    .from('calendar_events')
    .select(EVENT_FIELDS)
    .is('recurrence', null)
    .eq('created_by', userId)
    .lt('start_at', toIso)
    .gt('end_at', fromIso)
  if (cErr) throw cErr

  let partNonRec: CalendarEvent[] = []
  if (participantIds.length > 0) {
    const { data, error } = await supabase
      .from('calendar_events')
      .select(EVENT_FIELDS)
      .is('recurrence', null)
      .in('id', participantIds)
      .lt('start_at', toIso)
      .gt('end_at', fromIso)
    if (error) throw error
    partNonRec = (data || []) as unknown as CalendarEvent[]
  }

  // 3. Recurring masters — unbounded lower bound (occurrences can fall inside
  //    the window even when master start_at is before it). Client expands.
  const { data: createdRec, error: crErr } = await supabase
    .from('calendar_events')
    .select(EVENT_FIELDS)
    .not('recurrence', 'is', null)
    .eq('created_by', userId)
    .lte('start_at', toIso)
  if (crErr) throw crErr

  let partRec: CalendarEvent[] = []
  if (participantIds.length > 0) {
    const { data, error } = await supabase
      .from('calendar_events')
      .select(EVENT_FIELDS)
      .not('recurrence', 'is', null)
      .in('id', participantIds)
      .lte('start_at', toIso)
    if (error) throw error
    partRec = (data || []) as unknown as CalendarEvent[]
  }

  const byId = new Map<string, CalendarEvent>()
  const merged = [
    ...((createdNonRec || []) as unknown as CalendarEvent[]),
    ...partNonRec,
    ...((createdRec || []) as unknown as CalendarEvent[]),
    ...partRec,
  ]
  merged.forEach(e => {
    byId.set(e.id, e)
  })
  const events = Array.from(byId.values())
  await hydrateEvents(events, userId)
  return events.sort((a, b) => a.start_at.localeCompare(b.start_at))
}

async function hydrateEvents(events: CalendarEvent[], currentUserId: string) {
  if (events.length === 0) return
  const ids = events.map(e => e.id)
  const creatorIds = [...new Set(events.map(e => e.created_by))]

  const [
    { data: participants },
    { data: creators },
    { data: exceptions },
    { data: occurrenceResponses },
  ] = await Promise.all([
    supabase
      .from('calendar_event_participants')
      .select('id, event_id, user_id, response, acknowledged_at, created_at')
      .in('event_id', ids),
    supabase.from('users').select('id, username, role').in('id', creatorIds),
    supabase
      .from('calendar_event_exceptions')
      .select('id, event_id, original_start_at, override_start_at, override_end_at, override_title, is_cancelled, created_at')
      .in('event_id', ids),
    supabase
      .from('calendar_occurrence_responses')
      .select('id, event_id, user_id, original_start_at, response, acknowledged_at, created_at')
      .in('event_id', ids)
      .eq('user_id', currentUserId),
  ])

  const userIds = [...new Set((participants || []).map(p => p.user_id))]
  const { data: users } = userIds.length
    ? await supabase.from('users').select('id, username, role').in('id', userIds)
    : { data: [] as TaskUser[] }

  const userMap = new Map<string, TaskUser>((users || []).map(u => [u.id, u]))
  const creatorMap = new Map<string, TaskUser>((creators || []).map(u => [u.id, u]))

  events.forEach(e => {
    e.creator = creatorMap.get(e.created_by)
    e.participants = (participants || [])
      .filter(p => p.event_id === e.id)
      .map(p => ({ ...p, user: userMap.get(p.user_id) })) as CalendarEvent['participants']
    e.exceptions = (exceptions || []).filter(x => x.event_id === e.id) as EventException[]
    e.occurrence_responses = (occurrenceResponses || [])
      .filter(r => r.event_id === e.id) as OccurrenceResponse[]
  })
}

export async function createEvent(input: NewEventInput, userId: string): Promise<CalendarEvent> {
  const { data: inserted, error } = await supabase
    .from('calendar_events')
    .insert({
      title: input.title,
      description: input.description,
      location: input.location,
      start_at: input.start_at,
      end_at: input.end_at,
      event_type: input.event_type,
      is_private: input.is_private,
      all_day: input.all_day,
      project_id: input.project_id,
      recurrence: input.recurrence,
      reminder_offsets: input.reminder_offsets,
      busy: input.busy,
      created_by: userId,
    })
    .select(EVENT_FIELDS)
    .single()
  if (error) throw error

  const event = inserted as unknown as CalendarEvent

  if (input.is_private) {
    await supabase.from('calendar_event_participants').insert({
      event_id: event.id,
      user_id: userId,
      response: 'accepted',
      acknowledged_at: new Date().toISOString(),
    })
  } else if (input.participant_ids.length > 0) {
    const rows = input.participant_ids.map(uid => ({
      event_id: event.id,
      user_id: uid,
      response: uid === userId ? ('accepted' as EventResponse) : ('pending' as EventResponse),
      acknowledged_at: uid === userId ? new Date().toISOString() : null,
    }))
    await supabase.from('calendar_event_participants').insert(rows)
  }

  logActivity({
    action: 'calendar_event.create',
    entity: 'calendar_event',
    entityId: event.id,
    projectId: input.project_id,
    severity: 'medium',
    metadata: {
      entity_name: input.title,
      event_type: input.event_type,
      is_private: input.is_private,
      recurring: !!input.recurrence,
      busy: input.busy,
      reminder_count: input.reminder_offsets.length,
      participant_count: input.is_private ? 1 : input.participant_ids.length,
    },
  })

  return event
}

export async function respondToEvent(
  participantId: string,
  response: EventResponse,
  eventId?: string,
  eventTitle?: string,
): Promise<void> {
  const { error } = await supabase
    .from('calendar_event_participants')
    .update({ response, acknowledged_at: new Date().toISOString() })
    .eq('id', participantId)
  if (error) throw error

  logActivity({
    action: 'calendar_event.respond',
    entity: 'calendar_event',
    entityId: eventId ?? null,
    severity: 'low',
    metadata: {
      entity_name: eventTitle,
      response,
      participant_id: participantId,
      scope: 'series',
    },
  })
}

export async function respondToOccurrence(
  eventId: string,
  userId: string,
  originalStartAtIso: string,
  response: EventResponse,
  eventTitle?: string,
): Promise<OccurrenceResponse> {
  const { data, error } = await supabase
    .from('calendar_occurrence_responses')
    .upsert(
      {
        event_id: eventId,
        user_id: userId,
        original_start_at: originalStartAtIso,
        response,
        acknowledged_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,user_id,original_start_at' },
    )
    .select('id, event_id, user_id, original_start_at, response, acknowledged_at, created_at')
    .single()
  if (error) throw error

  const row = data as unknown as OccurrenceResponse

  logActivity({
    action: 'calendar_event.respond',
    entity: 'calendar_event',
    entityId: eventId,
    severity: 'low',
    metadata: {
      entity_name: eventTitle,
      response,
      scope: 'occurrence',
      original_start_at: originalStartAtIso,
    },
  })

  return row
}

export async function deleteEvent(eventId: string, eventTitle?: string): Promise<void> {
  const { error } = await supabase.from('calendar_events').delete().eq('id', eventId)
  if (error) throw error

  logActivity({
    action: 'calendar_event.delete',
    entity: 'calendar_event',
    entityId: eventId,
    severity: 'high',
    metadata: { entity_name: eventTitle },
  })
}

export type EventUpdate = Partial<
  Pick<
    CalendarEvent,
    | 'title'
    | 'description'
    | 'location'
    | 'start_at'
    | 'end_at'
    | 'event_type'
    | 'is_private'
    | 'all_day'
    | 'project_id'
    | 'recurrence'
    | 'reminder_offsets'
    | 'busy'
  >
>

export async function updateEvent(
  eventId: string,
  updates: EventUpdate,
  eventTitle?: string,
): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from('calendar_events')
    .update(updates)
    .eq('id', eventId)
    .select(EVENT_FIELDS)
    .single()
  if (error) throw error

  const updated = data as unknown as CalendarEvent

  logActivity({
    action: 'calendar_event.update',
    entity: 'calendar_event',
    entityId: eventId,
    projectId: updated.project_id,
    severity: 'medium',
    metadata: {
      entity_name: eventTitle ?? updated.title,
      changed_fields: Object.keys(updates),
    },
  })

  return updated
}

/**
 * Saves the edit form: the changed event columns, then the participant rows.
 *
 * `previous` is the event as the form loaded it, participants included. Only columns that
 * differ are written (see buildEventUpdate — a recurring series never gets new timing), and
 * participants are reconciled row by row (see planParticipantChanges), so an unchanged
 * invitee keeps their RSVP.
 *
 * Logged once as `calendar_event.update`. `changed_fields` gains `participants` when rows were
 * added or removed, with the counts in metadata. There is no transaction across the writes: if
 * a participant write fails after the event row was updated, what did succeed is still logged
 * and the error is rethrown for the form to show.
 */
export async function updateEventWithParticipants(
  eventId: string,
  input: NewEventInput,
  previous: CalendarEvent,
): Promise<void> {
  const updates = buildEventUpdate(previous, input)
  const plan = planParticipantChanges(previous.participants ?? [], previous.created_by, {
    isPrivate: input.is_private,
    participantIds: input.participant_ids,
  })
  if (Object.keys(updates).length === 0 && !hasParticipantChanges(plan)) return

  const changedFields: string[] = []
  let projectId = previous.project_id
  let removed = 0
  let added = 0

  try {
    if (Object.keys(updates).length > 0) {
      const { data, error } = await supabase
        .from('calendar_events')
        // No trigger maintains updated_at on this table.
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', eventId)
        .select('id, project_id')
        .single()
      if (error) throw error
      projectId = (data as { project_id: string | null }).project_id
      changedFields.push(...Object.keys(updates))
    }

    if (plan.removeRowIds.length > 0) {
      const { error } = await supabase
        .from('calendar_event_participants')
        .delete()
        .eq('event_id', eventId)
        .in('id', plan.removeRowIds)
      if (error) throw error
      removed = plan.removeRowIds.length
    }

    const now = new Date().toISOString()
    const rows: {
      event_id: string
      user_id: string
      response: EventResponse
      acknowledged_at: string | null
    }[] = plan.addUserIds.map(uid => ({
      event_id: eventId,
      user_id: uid,
      response: 'pending',
      acknowledged_at: null,
    }))
    if (plan.creatorRow === 'insert') {
      rows.push({ event_id: eventId, user_id: previous.created_by, response: 'accepted', acknowledged_at: now })
    }
    if (rows.length > 0) {
      const { error } = await supabase.from('calendar_event_participants').insert(rows)
      if (error) throw error
      added = plan.addUserIds.length
    }

    if (plan.creatorRow === 'accept') {
      const { error } = await supabase
        .from('calendar_event_participants')
        .update({ response: 'accepted', acknowledged_at: now })
        .eq('event_id', eventId)
        .eq('user_id', previous.created_by)
      if (error) throw error
    }
  } finally {
    if (removed > 0 || added > 0) changedFields.push('participants')
    if (changedFields.length > 0) {
      logActivity({
        action: 'calendar_event.update',
        entity: 'calendar_event',
        entityId: eventId,
        projectId,
        severity: 'medium',
        metadata: {
          entity_name: input.title || previous.title,
          changed_fields: changedFields,
          ...(removed > 0 || added > 0
            ? { participants_added: added, participants_removed: removed }
            : {}),
        },
      })
    }
  }
}

export interface ExceptionOverride {
  override_start_at?: string | null
  override_end_at?: string | null
  override_title?: string | null
  is_cancelled?: boolean
}

export async function createException(
  eventId: string,
  originalStartAt: string,
  override: ExceptionOverride,
  eventTitle?: string,
): Promise<EventException> {
  // Upsert: the table is UNIQUE (event_id, original_start_at), so a plain insert failed for an
  // occurrence that already had an exception — cancelling a renamed or moved occurrence did
  // nothing. The creator holds INSERT and UPDATE policies on this table, which ON CONFLICT needs.
  const { data, error } = await supabase
    .from('calendar_event_exceptions')
    .upsert(
      {
        event_id: eventId,
        original_start_at: originalStartAt,
        override_start_at: override.override_start_at ?? null,
        override_end_at: override.override_end_at ?? null,
        override_title: override.override_title ?? null,
        is_cancelled: override.is_cancelled ?? false,
      },
      { onConflict: 'event_id,original_start_at' },
    )
    .select('id, event_id, original_start_at, override_start_at, override_end_at, override_title, is_cancelled, created_at')
    .single()
  if (error) throw error

  const exception = data as unknown as EventException

  logActivity({
    action: 'calendar_event.exception_create',
    entity: 'calendar_event',
    entityId: eventId,
    severity: override.is_cancelled ? 'high' : 'medium',
    metadata: {
      entity_name: eventTitle,
      exception_id: exception.id,
      original_start_at: originalStartAt,
      is_cancelled: override.is_cancelled ?? false,
      changed_fields: Object.keys(override),
    },
  })

  return exception
}

export async function deleteException(
  exceptionId: string,
  eventId: string,
  eventTitle?: string,
): Promise<void> {
  const { error } = await supabase
    .from('calendar_event_exceptions')
    .delete()
    .eq('id', exceptionId)
  if (error) throw error

  logActivity({
    action: 'calendar_event.exception_delete',
    entity: 'calendar_event',
    entityId: eventId,
    severity: 'medium',
    metadata: { entity_name: eventTitle, exception_id: exceptionId },
  })
}

export async function fetchPendingCount(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<number> {
  const events = await fetchEventsInRange(userId, fromIso, toIso)
  return countPendingOccurrences(events, userId, new Date(fromIso), new Date(toIso))
}
