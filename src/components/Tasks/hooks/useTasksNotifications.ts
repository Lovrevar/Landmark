import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { getUnacknowledgedTaskCount } from '../services/tasksService'

export const TASKS_READ_EVENT = 'tasks:marked-read'
const POLL_INTERVAL_MS = 20_000

export function dispatchTasksRead() {
  window.dispatchEvent(new Event(TASKS_READ_EVENT))
}

export function useTasksNotifications() {
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
      const c = await getUnacknowledgedTaskCount(user.id)
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
    window.addEventListener(TASKS_READ_EVENT, handleRead)
    return () => window.removeEventListener(TASKS_READ_EVENT, handleRead)
  }, [refresh])

  return { unreadCount, refresh }
}
