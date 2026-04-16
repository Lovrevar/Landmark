import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { getTotalUnreadCount } from '../services/chatService'

export const CHAT_READ_EVENT = 'chat:marked-read'

export function dispatchChatRead() {
  window.dispatchEvent(new Event(CHAT_READ_EVENT))
}

export function useChatNotifications() {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const mountedRef = useRef(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const refreshFromDb = useCallback(async () => {
    if (!user) return
    try {
      const count = await getTotalUnreadCount(user.id)
      if (mountedRef.current) {
        setUnreadCount(count)
      }
    } catch {
      // silently fail
    }
  }, [user])

  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      refreshFromDb()
    }, 300)
  }, [refreshFromDb])

  useEffect(() => {
    refreshFromDb()
  }, [refreshFromDb])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('layout-chat-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as { sender_id: string }
          if (msg.sender_id !== user.id) {
            setUnreadCount(prev => prev + 1)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  useEffect(() => {
    window.addEventListener(CHAT_READ_EVENT, debouncedRefresh)
    return () => window.removeEventListener(CHAT_READ_EVENT, debouncedRefresh)
  }, [debouncedRefresh])

  return { unreadCount, refresh: refreshFromDb }
}
