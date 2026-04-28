import { supabase } from '../../../lib/supabase'
import { logActivity } from '../../../lib/activityLog'
import { countPendingOccurrences } from '../utils/pendingCount'
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
  const { data, error } = await supabase
    .from('calendar_event_exceptions')
    .insert({
      event_id: eventId,
      original_start_at: originalStartAt,
      override_start_at: override.override_start_at ?? null,
      override_end_at: override.override_end_at ?? null,
      override_title: override.override_title ?? null,
      is_cancelled: override.is_cancelled ?? false,
    })
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

export async function getUnacknowledgedEventCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('calendar_event_participants')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('acknowledged_at', null)
  if (error) return 0
  return count || 0
}

export async function acknowledgeAllEvents(userId: string): Promise<void> {
  const { data } = await supabase
    .from('calendar_event_participants')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('acknowledged_at', null)
    .select('id')

  const count = data?.length ?? 0
  if (count > 0) {
    logActivity({
      action: 'calendar_event.acknowledge_all',
      entity: 'calendar_event',
      severity: 'low',
      metadata: { count },
    })
  }
}
