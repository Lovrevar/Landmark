import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import type { ChatConversation, ChatMessage } from '../../../types/chat'
import {
  fetchConversations,
  fetchMessages,
  sendMessage as sendMessageService,
  markAsRead,
  createConversation,
} from '../services/chatService'
import { dispatchChatRead, dispatchUnreadCount } from './useChatNotifications'

const POLL_INTERVAL_MS = 3000

export function useChat() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const activeConvRef = useRef<string | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])

  useEffect(() => {
    activeConvRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const loadConversations = useCallback(async () => {
    if (!user) return
    try {
      setLoadingConversations(true)
      const data = await fetchConversations(user.id)
      setConversations(data)
    } catch (err) {
      console.error('Failed to load conversations:', err)
    } finally {
      setLoadingConversations(false)
    }
  }, [user])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    const total = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)
    dispatchUnreadCount(total)
  }, [conversations])

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!user) return
    try {
      setLoadingMessages(true)
      const data = await fetchMessages(conversationId)
      setMessages(data)
      await markAsRead(conversationId, user.id)
      dispatchChatRead()
      setConversations(prev =>
        prev.map(c =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c,
        ),
      )
    } catch (err) {
      console.error('Failed to load messages:', err)
    } finally {
      setLoadingMessages(false)
    }
  }, [user])

  const selectConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId)
    loadMessages(conversationId)
  }, [loadMessages])

  const mergeNewMessages = useCallback((
    incoming: ChatMessage[],
    conversationId: string,
  ) => {
    if (!user) return

    setMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id))
      const newOnes = incoming.filter(m => !existingIds.has(m.id))
      if (newOnes.length === 0) return prev
      return [...prev, ...newOnes]
    })

    const hasNewFromOthers = incoming.some(m => {
      const isNew = !messagesRef.current.some(em => em.id === m.id)
      return isNew && m.sender_id !== user.id
    })

    if (hasNewFromOthers) {
      markAsRead(conversationId, user.id)
        .then(() => dispatchChatRead())
        .catch(() => {})
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('chat-messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const newMsg = payload.new as ChatMessage

          const { data: senderData } = await supabase
            .from('users')
            .select('id, username, role')
            .eq('id', newMsg.sender_id)
            .maybeSingle()

          const enrichedMsg: ChatMessage = {
            ...newMsg,
            sender: senderData || undefined,
          }

          if (activeConvRef.current === newMsg.conversation_id) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev
              return [...prev, enrichedMsg]
            })

            if (newMsg.sender_id !== user.id) {
              markAsRead(newMsg.conversation_id, user.id)
                .then(() => dispatchChatRead())
                .catch(() => {})
            }
          }

          setConversations(prev => {
            const updated = prev.map(c => {
              if (c.id !== newMsg.conversation_id) return c
              const isActive = activeConvRef.current === c.id
              return {
                ...c,
                last_message: enrichedMsg,
                unread_count: isActive || newMsg.sender_id === user.id
                  ? c.unread_count
                  : c.unread_count + 1,
              }
            })

            return updated.sort((a, b) => {
              const aTime = a.last_message?.created_at || a.created_at
              const bTime = b.last_message?.created_at || b.created_at
              return new Date(bTime).getTime() - new Date(aTime).getTime()
            })
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  useEffect(() => {
    if (!user || !activeConversationId) return

    const convId = activeConversationId

    const interval = setInterval(async () => {
      if (activeConvRef.current !== convId) return

      try {
        const fresh = await fetchMessages(convId)
        mergeNewMessages(fresh, convId)
      } catch {
        // silent
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [user, activeConversationId, mergeNewMessages])

  const handleSendMessage = useCallback(async (content: string) => {
    if (!user || !activeConversationId || !content.trim()) return
    try {
      setSendingMessage(true)
      const saved = await sendMessageService(activeConversationId, user.id, content.trim())

      const enrichedMsg: ChatMessage = {
        ...saved,
        sender: { id: user.id, username: user.username, role: user.role },
      }

      setMessages(prev => {
        if (prev.some(m => m.id === saved.id)) return prev
        return [...prev, enrichedMsg]
      })

      setConversations(prev => {
        const updated = prev.map(c => {
          if (c.id !== activeConversationId) return c
          return { ...c, last_message: enrichedMsg }
        })
        return updated.sort((a, b) => {
          const aTime = a.last_message?.created_at || a.created_at
          const bTime = b.last_message?.created_at || b.created_at
          return new Date(bTime).getTime() - new Date(aTime).getTime()
        })
      })
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSendingMessage(false)
    }
  }, [user, activeConversationId])

  const handleCreateConversation = useCallback(async (
    participantIds: string[],
    name: string | null,
    isGroup: boolean,
  ): Promise<string | null> => {
    if (!user) return null
    try {
      const convId = await createConversation(user.id, participantIds, name, isGroup)
      await loadConversations()
      selectConversation(convId)
      return convId
    } catch (err) {
      console.error('Failed to create conversation:', err)
      return null
    }
  }, [user, loadConversations, selectConversation])

  const activeConversation = conversations.find(c => c.id === activeConversationId) || null

  return {
    conversations,
    activeConversation,
    activeConversationId,
    messages,
    loadingConversations,
    loadingMessages,
    sendingMessage,
    selectConversation,
    sendMessage: handleSendMessage,
    createConversation: handleCreateConversation,
    refreshConversations: loadConversations,
  }
}
