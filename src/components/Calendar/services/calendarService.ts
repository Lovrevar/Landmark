import { supabase } from '../../../lib/supabase'
import { logActivity } from '../../../lib/activityLog'
import type { CalendarEvent, EventResponse, NewEventInput, TaskUser } from '../../../types/tasks'

const EVENT_FIELDS = 'id, title, description, location, created_by, start_at, end_at, event_type, is_private, all_day, created_at, updated_at'

export async function fetchEventsInRange(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<CalendarEvent[]> {
  const { data: partRows, error: pErr } = await supabase
    .from('calendar_event_participants')
    .select('event_id')
    .eq('user_id', userId)
  if (pErr) throw pErr
  const participantIds = (partRows || []).map(r => r.event_id)

  const { data: created, error: cErr } = await supabase
    .from('calendar_events')
    .select(EVENT_FIELDS)
    .eq('created_by', userId)
    .gte('start_at', fromIso)
    .lte('start_at', toIso)
  if (cErr) throw cErr

  let participantEvents: CalendarEvent[] = []
  if (participantIds.length > 0) {
    const { data: pEvents, error: peErr } = await supabase
      .from('calendar_events')
      .select(EVENT_FIELDS)
      .in('id', participantIds)
      .gte('start_at', fromIso)
      .lte('start_at', toIso)
    if (peErr) throw peErr
    participantEvents = (pEvents || []) as CalendarEvent[]
  }

  const byId = new Map<string, CalendarEvent>()
  ;[...(created || []), ...participantEvents].forEach(e => byId.set(e.id, e as CalendarEvent))
  const events = Array.from(byId.values())
  await hydrateEvents(events)
  return events.sort((a, b) => a.start_at.localeCompare(b.start_at))
}

async function hydrateEvents(events: CalendarEvent[]) {
  if (events.length === 0) return
  const ids = events.map(e => e.id)
  const creatorIds = [...new Set(events.map(e => e.created_by))]

  const [{ data: participants }, { data: creators }] = await Promise.all([
    supabase
      .from('calendar_event_participants')
      .select('id, event_id, user_id, response, acknowledged_at, created_at')
      .in('event_id', ids),
    supabase.from('users').select('id, username, role').in('id', creatorIds),
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
      created_by: userId,
    })
    .select(EVENT_FIELDS)
    .single()
  if (error) throw error

  if (input.is_private) {
    await supabase.from('calendar_event_participants').insert({
      event_id: inserted.id,
      user_id: userId,
      response: 'accepted',
      acknowledged_at: new Date().toISOString(),
    })
  } else if (input.participant_ids.length > 0) {
    const rows = input.participant_ids.map(uid => ({
      event_id: inserted.id,
      user_id: uid,
      response: uid === userId ? ('accepted' as EventResponse) : ('pending' as EventResponse),
      acknowledged_at: uid === userId ? new Date().toISOString() : null,
    }))
    await supabase.from('calendar_event_participants').insert(rows)
  }

  logActivity({
    action: 'calendar_event.create',
    entity: 'calendar_event',
    entityId: inserted.id,
    severity: 'medium',
    metadata: {
      entity_name: input.title,
      event_type: input.event_type,
      is_private: input.is_private,
      participant_count: input.is_private ? 1 : input.participant_ids.length,
    },
  })

  return inserted as CalendarEvent
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
    },
  })
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
