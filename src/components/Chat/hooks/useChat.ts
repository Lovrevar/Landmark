import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { useToast } from '../../../contexts/ToastContext'
import { toErrorMessage } from '../../../lib/errorMessage'
import type { ChatConversation, ChatMessage } from '../../../types/chat'
import {
  fetchConversations,
  fetchMessages,
  sendMessage as sendMessageService,
  uploadChatFile,
  markAsRead,
  createConversation,
} from '../services/chatService'
import { dispatchChatRead, dispatchUnreadCount } from './useChatNotifications'

const POLL_INTERVAL_MS = 3000

export function useChat() {
  const { user } = useAuth()
  const toast = useToast()
  const { t } = useTranslation()
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  // Two independent loads, two errors: a conversation list that could not be read must not
  // render as "no conversations yet", and neither must an unread thread as "no messages".
  const [conversationsError, setConversationsError] = useState<Error | null>(null)
  const [messagesError, setMessagesError] = useState<Error | null>(null)
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
      setConversationsError(null)
      const data = await fetchConversations()
      setConversations(data)
    } catch (err) {
      console.error('Failed to load conversations:', err)
      setConversationsError(err instanceof Error ? err : new Error(String(err)))
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
      setMessagesError(null)
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
      setMessages([])
      setMessagesError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoadingMessages(false)
    }
  }, [user])

  const selectConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId)
    loadMessages(conversationId)
  }, [loadMessages])

  /** Retries whichever load the panel is currently showing as failed. */
  const retryMessages = useCallback(() => {
    if (activeConvRef.current) void loadMessages(activeConvRef.current)
  }, [loadMessages])

  // Read receipts are bookkeeping: a failure only leaves the badge stale, so it is logged
  // rather than put in front of the user. It gets its own helper so nothing in a handler
  // swallows a rejection with an empty `.catch(() => {})`.
  const markConversationRead = useCallback(async (conversationId: string, userId: string) => {
    try {
      await markAsRead(conversationId, userId)
      dispatchChatRead()
    } catch (err) {
      console.error('Failed to mark conversation as read:', err)
    }
  }, [])

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
      void markConversationRead(conversationId, user.id)
    }
  }, [user, markConversationRead])

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
              void markConversationRead(newMsg.conversation_id, user.id)
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
  }, [user, markConversationRead])

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

  const appendMessageAndUpdateConversations = useCallback((
    enrichedMsg: ChatMessage,
    convId: string,
  ) => {
    setMessages(prev => {
      if (prev.some(m => m.id === enrichedMsg.id)) return prev
      return [...prev, enrichedMsg]
    })

    setConversations(prev => {
      const updated = prev.map(c => {
        if (c.id !== convId) return c
        return { ...c, last_message: enrichedMsg }
      })
      return updated.sort((a, b) => {
        const aTime = a.last_message?.created_at || a.created_at
        const bTime = b.last_message?.created_at || b.created_at
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      })
    })
  }, [])

  const handleSendMessage = useCallback(async (content: string, file?: File | null) => {
    if (!user || !activeConversationId) return
    if (!content.trim() && !file) return

    try {
      setSendingMessage(true)

      let attachment: { url: string; name: string; size: number; type: string } | null = null
      if (file) {
        attachment = await uploadChatFile(file, activeConversationId)
      }

      const saved = await sendMessageService(
        activeConversationId,
        user.id,
        content.trim(),
        attachment,
      )

      const enrichedMsg: ChatMessage = {
        ...saved,
        sender: { id: user.id, username: user.username, role: user.role },
      }

      appendMessageAndUpdateConversations(enrichedMsg, activeConversationId)
    } catch (err) {
      console.error('Failed to send message:', err)
      throw err
    } finally {
      setSendingMessage(false)
    }
  }, [user, activeConversationId, appendMessageAndUpdateConversations])

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
      // Returning null is how the modal learns to stay open; the toast is what the user sees.
      console.error('Failed to create conversation:', err)
      toast.error(toErrorMessage(err, t('chat.create_failed')))
      return null
    }
  }, [user, loadConversations, selectConversation, toast, t])

  const activeConversation = conversations.find(c => c.id === activeConversationId) || null

  return {
    conversations,
    activeConversation,
    activeConversationId,
    messages,
    loadingConversations,
    loadingMessages,
    sendingMessage,
    conversationsError,
    messagesError,
    retryConversations: loadConversations,
    retryMessages,
    selectConversation,
    sendMessage: handleSendMessage,
    createConversation: handleCreateConversation,
    refreshConversations: loadConversations,
  }
}
