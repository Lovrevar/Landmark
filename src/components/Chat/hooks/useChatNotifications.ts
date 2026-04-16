import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { getTotalUnreadCount } from '../services/chatService'

export const CHAT_READ_EVENT = 'chat:marked-read'

const POLL_INTERVAL_MS = 15_000

export function dispatchChatRead() {
  window.dispatchEvent(new Event(CHAT_READ_EVENT))
}

export function dispatchUnreadCount(count: number) {
  window.dispatchEvent(
    new CustomEvent('chat:unread-update', { detail: count }),
  )
}

export function useChatNotifications() {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const refreshFromDb = useCallback(async () => {
    if (!user) return
    try {
      const count = await getTotalUnreadCount(user.id)
      if (mountedRef.current) setUnreadCount(count)
    } catch {
      // silently fail
    }
  }, [user])

  useEffect(() => {
    refreshFromDb()
    const interval = setInterval(refreshFromDb, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refreshFromDb])

  useEffect(() => {
    const handleRead = () => refreshFromDb()
    const handleUpdate = (e: Event) => {
      const count = (e as CustomEvent<number>).detail
      if (mountedRef.current) setUnreadCount(count)
    }

    window.addEventListener(CHAT_READ_EVENT, handleRead)
    window.addEventListener('chat:unread-update', handleUpdate)
    return () => {
      window.removeEventListener(CHAT_READ_EVENT, handleRead)
      window.removeEventListener('chat:unread-update', handleUpdate)
    }
  }, [refreshFromDb])

  return { unreadCount, refresh: refreshFromDb }
}
