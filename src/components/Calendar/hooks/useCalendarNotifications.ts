import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { fetchPendingCount } from '../services/calendarService'

export const CALENDAR_READ_EVENT = 'calendar:marked-read'
const POLL_INTERVAL_MS = 20_000
const WINDOW_DAYS = 30

export function dispatchCalendarRead() {
  window.dispatchEvent(new Event(CALENDAR_READ_EVENT))
}

export function useCalendarNotifications() {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const refresh = useCallback(async () => {
    if (!user) return
    try {
      const now = new Date()
      const to = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000)
      const c = await fetchPendingCount(user.id, now.toISOString(), to.toISOString())
      if (mountedRef.current) setUnreadCount(c)
    } catch {
      /* ignore */
    }
  }, [user])

  useEffect(() => {
    refresh()
    const i = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(i)
  }, [refresh])

  useEffect(() => {
    const handleRead = () => refresh()
    window.addEventListener(CALENDAR_READ_EVENT, handleRead)
    return () => window.removeEventListener(CALENDAR_READ_EVENT, handleRead)
  }, [refresh])

  return { unreadCount, refresh }
}
