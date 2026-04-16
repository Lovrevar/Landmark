import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { getTotalUnreadCount } from '../services/chatService'

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
            setUnreadCount(prev => prev + 1)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const clearCount = useCallback(() => {
    setUnreadCount(0)
  }, [])

  return { unreadCount, refresh, clearCount }
}
