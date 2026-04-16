import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { getTotalUnreadCount } from '../services/chatService'

const CHAT_UNREAD_EVENT = 'chat:unread-update'
export const CHAT_READ_EVENT = 'chat:marked-read'

export function dispatchChatRead() {
  window.dispatchEvent(new Event(CHAT_READ_EVENT))
}

export function dispatchUnreadCount(count: number) {
  window.dispatchEvent(new CustomEvent(CHAT_UNREAD_EVENT, { detail: count }))
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
      if (mountedRef.current) {
        setUnreadCount(count)
      }
    } catch {
      // silently fail
    }
  }, [user])

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
    const handleUnreadUpdate = (e: Event) => {
      const count = (e as CustomEvent<number>).detail
      if (mountedRef.current) {
        setUnreadCount(count)
      }
    }
    const handleRead = () => { refreshFromDb() }

    window.addEventListener(CHAT_UNREAD_EVENT, handleUnreadUpdate)
    window.addEventListener(CHAT_READ_EVENT, handleRead)
    return () => {
      window.removeEventListener(CHAT_UNREAD_EVENT, handleUnreadUpdate)
      window.removeEventListener(CHAT_READ_EVENT, handleRead)
    }
  }, [refreshFromDb])

  return { unreadCount, refresh: refreshFromDb }
}
