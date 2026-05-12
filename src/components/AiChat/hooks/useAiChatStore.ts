import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { listSessions, loadSession, streamMessage } from '../services/aiChatService'
import { AiChatHttpError, type AiSession } from '../../../types/aiChat'
import {
  applyEventToMessages,
  normalizeFromPersistedRows,
  type RenderMessage,
} from '../lib/normalizeMessages'

export interface AiChatStore {
  isOpen: boolean
  sessions: AiSession[]
  loadingSessions: boolean
  currentSessionId: string | null
  messages: RenderMessage[]
  loadingMessages: boolean
  isStreaming: boolean
  inputDisabled: boolean

  open: () => void
  close: () => void
  newConversation: () => void
  selectSession: (id: string) => Promise<void>
  sendMessage: (text: string) => Promise<void>
}

const genId = (): string => crypto.randomUUID()

export function useAiChatStore(): AiChatStore {
  const { user } = useAuth()

  const [isOpen, setIsOpen] = useState(false)
  const [sessions, setSessions] = useState<AiSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<RenderMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessionsLoaded, setSessionsLoaded] = useState(false)

  const messagesRef = useRef<RenderMessage[]>([])
  const currentSessionIdRef = useRef<string | null>(null)
  const streamAbortRef = useRef<AbortController | null>(null)
  const isStreamingRef = useRef(false)
  const sessionsLoadedRef = useRef(false)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
  }, [currentSessionId])

  useEffect(() => {
    isStreamingRef.current = isStreaming
  }, [isStreaming])

  useEffect(() => {
    sessionsLoadedRef.current = sessionsLoaded
  }, [sessionsLoaded])

  // Defensive unmount cleanup. The provider sits above <Router> so in practice
  // this only fires on full app teardown, but aborting is cheap.
  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort()
      streamAbortRef.current = null
    }
  }, [])

  const fetchSessions = useCallback(async () => {
    if (!user) return
    try {
      setLoadingSessions(true)
      const data = await listSessions()
      setSessions(data)
      setSessionsLoaded(true)
    } catch (err) {
      console.error('[useAiChatStore] listSessions failed:', err)
    } finally {
      setLoadingSessions(false)
    }
  }, [user])

  const open = useCallback(() => {
    if (!user) return
    setIsOpen(true)
    if (!sessionsLoadedRef.current) {
      void fetchSessions()
    }
  }, [user, fetchSessions])

  const close = useCallback(() => {
    // Do NOT clear sessions/messages/currentSessionId and do NOT abort the
    // stream. Closing the panel is not a cancel; the user may reopen to see
    // the answer arrive.
    setIsOpen(false)
  }, [])

  const newConversation = useCallback(() => {
    if (!user) return
    if (streamAbortRef.current) {
      streamAbortRef.current.abort()
      streamAbortRef.current = null
      setIsStreaming(false)
    }
    setCurrentSessionId(null)
    setMessages([])
  }, [user])

  const selectSession = useCallback(
    async (id: string) => {
      if (!user) return
      if (id === currentSessionIdRef.current) return

      if (streamAbortRef.current) {
        streamAbortRef.current.abort()
        streamAbortRef.current = null
        setIsStreaming(false)
      }

      setCurrentSessionId(id)
      setMessages([])
      setLoadingMessages(true)

      try {
        const rows = await loadSession(id)
        setMessages(normalizeFromPersistedRows(rows))
      } catch (err) {
        console.error('[useAiChatStore] loadSession failed:', err)
        setMessages([
          {
            kind: 'error',
            id: genId(),
            code: 'load_failed',
            message: 'Greška pri učitavanju razgovora.',
            createdAt: new Date().toISOString(),
          },
        ])
      } finally {
        setLoadingMessages(false)
      }
    },
    [user],
  )

  const sendMessage = useCallback(
    async (text: string) => {
      if (!user) return
      const trimmed = text.trim()
      if (!trimmed) return
      if (isStreamingRef.current) return

      const isNewConversation = currentSessionIdRef.current === null
      const capturedSessionId = currentSessionIdRef.current
      const userText = trimmed

      // The optimistic user row is the only client-side source of truth for
      // the user's text until the next loadSession(). If the network drops
      // mid-stream before the backend persists the user row, the row remains
      // locally but is missing server-side; on next load it will silently
      // disappear. Acceptable for v1 — DO NOT 'fix' this by double-writing,
      // which produces a worse bug.
      const optimisticUserRow: RenderMessage = {
        kind: 'user',
        id: genId(),
        text: userText,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, optimisticUserRow])

      setIsStreaming(true)
      const controller = new AbortController()
      streamAbortRef.current = controller

      try {
        await streamMessage({
          sessionId: capturedSessionId,
          message: userText,
          signal: controller.signal,
          callbacks: {
            onSession: (event) => {
              if (!isNewConversation) return
              setCurrentSessionId(event.session_id)
              const synthesized: AiSession = {
                id: event.session_id,
                user_id: user.id,
                title: userText.slice(0, 60).trim() || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
              setSessions((prev) => [synthesized, ...prev])
              // Client-timestamp is provisional; sessionsLoaded:false ensures
              // the next open() re-fetches and replaces this row with the
              // canonical version. v1 session-list UI does not render absolute
              // timestamps so the jump is invisible to users.
              setSessionsLoaded(false)
            },
            onTurn: (event) => {
              setMessages((prev) => applyEventToMessages(prev, event, genId))
            },
            onToolCall: (event) => {
              setMessages((prev) => applyEventToMessages(prev, event, genId))
            },
            onToolResult: (event) => {
              setMessages((prev) => applyEventToMessages(prev, event, genId))
            },
            onError: (event) => {
              setMessages((prev) => applyEventToMessages(prev, event, genId))
            },
          },
        })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // User cancelled via newConversation/selectSession — silent.
        } else if (
          err instanceof Error &&
          (err.name === 'AbortError' || (err as { code?: string }).code === 'AbortError')
        ) {
          // Some environments surface AbortError as a plain Error.
        } else if (err instanceof AiChatHttpError) {
          setMessages((prev) => [
            ...prev,
            {
              kind: 'error',
              id: genId(),
              code: err.code,
              message: err.message,
              createdAt: new Date().toISOString(),
            },
          ])
        } else {
          console.error('[useAiChatStore] streamMessage failed:', err)
          setMessages((prev) => [
            ...prev,
            {
              kind: 'error',
              id: genId(),
              code: 'unknown_error',
              message: 'Neočekivana greška. Pokušajte ponovno.',
              createdAt: new Date().toISOString(),
            },
          ])
        }
      } finally {
        // Guard cleanup by controller identity: if a later newConversation /
        // selectSession / sendMessage replaced our controller, this stream's
        // late completion must not clobber the newer stream's state.
        if (streamAbortRef.current === controller) {
          streamAbortRef.current = null
          setIsStreaming(false)
        }
      }
    },
    [user],
  )

  return {
    isOpen,
    sessions,
    loadingSessions,
    currentSessionId,
    messages,
    loadingMessages,
    isStreaming,
    inputDisabled: isStreaming || loadingMessages,

    open,
    close,
    newConversation,
    selectSession,
    sendMessage,
  }
}
