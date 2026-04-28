import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { supabase } from '../../../lib/supabase'
import { fetchEventsInRange } from '../services/calendarService'
import { expandEvents, type ExpandedOccurrence } from '../utils/recurrence'
import type { CalendarEvent } from '../../../types/tasks'

export interface UseEventsInRangeArgs {
  fromIso: string
  toIso: string
  activeTypes?: string[]
  activeProjectId?: string | null
  activeParticipantIds?: string[]
  search?: string
}

export interface UseEventsInRangeResult {
  rawEvents: CalendarEvent[]
  occurrences: ExpandedOccurrence[]
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useEventsInRange({
  fromIso,
  toIso,
  activeTypes = [],
  activeProjectId = null,
  activeParticipantIds = [],
  search = '',
}: UseEventsInRangeArgs): UseEventsInRangeResult {
  const { user } = useAuth()
  const [rawEvents, setRawEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const reqIdRef = useRef(0)

  const load = useCallback(async () => {
    if (!user) return
    const id = ++reqIdRef.current
    setLoading(true)
    setError(null)
    try {
      const data = await fetchEventsInRange(user.id, fromIso, toIso)
      if (id === reqIdRef.current) setRawEvents(data)
    } catch (e) {
      if (id === reqIdRef.current) setError(e as Error)
    } finally {
      if (id === reqIdRef.current) setLoading(false)
    }
  }, [user, fromIso, toIso])

  useEffect(() => { load() }, [load])

  // Realtime: subscribe to calendar_events and calendar_event_participants.
  // Any change triggers a refresh; the range query re-runs and rebuilds occurrences.
  useEffect(() => {
    if (!user) return
    let cancelled = false

    const scheduleReload = () => {
      if (!cancelled) load()
    }

    const eventsChannel = supabase
      .channel(`calendar-events-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        scheduleReload,
      )
      .subscribe()

    const participantsChannel = supabase
      .channel(`calendar-event-participants-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_event_participants' },
        scheduleReload,
      )
      .subscribe()

    const exceptionsChannel = supabase
      .channel(`calendar-event-exceptions-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_event_exceptions' },
        scheduleReload,
      )
      .subscribe()

    const occurrenceResponsesChannel = supabase
      .channel(`calendar-occurrence-responses-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_occurrence_responses',
          filter: `user_id=eq.${user.id}`,
        },
        scheduleReload,
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(eventsChannel)
      supabase.removeChannel(participantsChannel)
      supabase.removeChannel(exceptionsChannel)
      supabase.removeChannel(occurrenceResponsesChannel)
    }
  }, [user, load])

  const occurrences = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase()
    const filtered = rawEvents.filter(e => {
      if (activeTypes.length > 0 && !activeTypes.includes(e.event_type)) return false
      if (activeProjectId && e.project_id !== activeProjectId) return false
      if (activeParticipantIds.length > 0) {
        const ids = new Set([e.created_by, ...(e.participants?.map(p => p.user_id) || [])])
        const anyMatch = activeParticipantIds.some(id => ids.has(id))
        if (!anyMatch) return false
      }
      if (lowerSearch) {
        const haystack = `${e.title} ${e.description} ${e.location}`.toLowerCase()
        if (!haystack.includes(lowerSearch)) return false
      }
      return true
    })
    return expandEvents(filtered, new Date(fromIso), new Date(toIso), user?.id ?? null)
  }, [rawEvents, fromIso, toIso, activeTypes, activeProjectId, activeParticipantIds, search, user?.id])

  return { rawEvents, occurrences, loading, error, refresh: load }
}
