import { useState, useEffect, useCallback } from 'react'
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

  const refresh = useCallback(async () => {
    if (!user) return
    try {
      const count = await getTotalUnreadCount(user.id)
      setUnreadCount(count)
    } catch {
      // silently fail
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('chat-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as { sender_id: string }
          if (msg.sender_id !== user.id) {
            refresh()
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, refresh])

  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener(CHAT_READ_EVENT, handler)
    return () => window.removeEventListener(CHAT_READ_EVENT, handler)
  }, [refresh])

  return { unreadCount, refresh }
}
