import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import {
  acknowledgeAllEvents,
  createEvent,
  deleteEvent,
  fetchEventsInRange,
  respondToEvent,
} from '../services/calendarService'
import { dispatchCalendarRead } from './useCalendarNotifications'
import type { CalendarEvent, EventResponse, NewEventInput } from '../../../types/tasks'

export function useCalendar() {
  const { user } = useAuth()
  const [anchor, setAnchor] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const year = anchor.getFullYear()
      const month = anchor.getMonth()
      const from = new Date(year, month - 1, 1).toISOString()
      const to = new Date(year, month + 2, 0, 23, 59, 59).toISOString()
      const data = await fetchEventsInRange(user.id, from, to)
      setEvents(data)
    } finally {
      setLoading(false)
    }
  }, [anchor, user])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!user) return
    acknowledgeAllEvents(user.id).then(() => dispatchCalendarRead())
  }, [user])

  const todayEvents = useMemo(() => {
    const today = new Date().toDateString()
    return events
      .filter(e => new Date(e.start_at).toDateString() === today)
      .sort((a, b) => a.start_at.localeCompare(b.start_at))
  }, [events])

  const upcoming = useMemo(() => {
    const now = Date.now()
    return events.filter(e => new Date(e.start_at).getTime() > now).slice(0, 5)
  }, [events])

  const create = useCallback(async (input: NewEventInput) => {
    if (!user) return
    await createEvent(input, user.id)
    await load()
  }, [user, load])

  const respond = useCallback(async (
    participantId: string,
    response: EventResponse,
    eventId?: string,
    eventTitle?: string,
  ) => {
    await respondToEvent(participantId, response, eventId, eventTitle)
    await load()
  }, [load])

  const remove = useCallback(async (eventId: string, eventTitle?: string) => {
    await deleteEvent(eventId, eventTitle)
    await load()
  }, [load])

  const prevMonth = useCallback(() => {
    setAnchor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }, [])

  const nextMonth = useCallback(() => {
    setAnchor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }, [])

  const goToday = useCallback(() => setAnchor(new Date()), [])

  return {
    anchor,
    events,
    loading,
    todayEvents,
    upcoming,
    create,
    respond,
    remove,
    prevMonth,
    nextMonth,
    goToday,
    refresh: load,
  }
}
