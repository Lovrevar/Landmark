import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { supabase } from '../../../lib/supabase'
import {
  deleteSession as deleteSessionService,
  listSessions,
  loadSession,
  renameSession as renameSessionService,
  streamMessage,
  type AttachmentRequestBody,
} from '../services/aiChatService'
import {
  AttachmentError,
  deleteAiAttachment,
  MAX_ATTACHMENTS_PER_MESSAGE,
  uploadAiAttachment,
  type AttachmentMeta,
} from '../services/aiAttachmentsService'
import {
  AiChatHttpError,
  type AiMessageRow,
  type AiSession,
} from '../../../types/aiChat'
import {
  applyEventToMessages,
  computeMostRecentLeaf,
  deriveActiveBranch,
  type RenderMessage,
} from '../lib/normalizeMessages'
import { errorLabel } from '../lib/labels'
import { logActivity } from '../../../lib/activityLog'

export interface PendingAttachment {
  id: string                   // local UUID, stable across uploads
  file: File
  status: 'pending' | 'uploading' | 'uploaded' | 'error'
  meta?: AttachmentMeta        // populated once the upload succeeds
  errorCode?: string           // from AttachmentError.code on failure
}

export interface AiChatStore {
  isOpen: boolean
  sessions: AiSession[]
  loadingSessions: boolean
  currentSessionId: string | null
  messages: RenderMessage[]
  loadingMessages: boolean
  isStreaming: boolean
  inputDisabled: boolean
  // Files the user has queued for the next send. Lives only on the client;
  // gets cleared once sendMessage succeeds. The chip strip in AiChatInput
  // renders directly from this list.
  pendingAttachments: PendingAttachment[]

  open: () => void
  close: () => void
  newConversation: () => void
  selectSession: (id: string) => Promise<void>
  sendMessage: (text: string) => Promise<void>
  // User-initiated stop. Aborts the in-flight stream; the edge function reads
  // req.signal, cancels the Anthropic call, and exits without further DB
  // writes. Partial assistant text already streamed stays visible.
  stopStreaming: () => void
  editMessage: (messageId: string, newText: string) => Promise<void>
  regenerateLastTurn: () => Promise<void>
  renameSession: (id: string, title: string) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  // Switch which leaf of the conversation tree is currently rendered. The
  // caller supplies a leaf id pre-computed from BranchInfo on the user
  // message they're switching at.
  switchToLeaf: (leafId: string) => void
  // Pending-attachment tray actions. addPendingAttachments enforces the
  // 4-cap and silently drops the overflow; the UI is expected to disable
  // the paperclip at the cap, so overflow is a sanity guard only.
  addPendingAttachments: (files: File[]) => void
  removePendingAttachment: (id: string) => Promise<void>
  clearPendingAttachments: () => Promise<void>
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
  // Canonical row set for the currently selected session. Refreshed on
  // session select and after every successful stream. The rendered
  // `messages` is derived from this + `activeLeafIdRef.current`.
  const messageRowsRef = useRef<AiMessageRow[]>([])
  const activeLeafIdRef = useRef<string | null>(null)

  // Pending attachments tray. Cleared on send success and on session
  // switch / new conversation / delete-current-session. The ref mirrors
  // state for closure-safe reads inside async send/edit handlers.
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([])
  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments
  }, [pendingAttachments])

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

  // Best-effort cleanup of already-uploaded objects in the pending tray.
  // Used by clearPendingAttachments and by session-switch / new-conversation
  // paths. Stays out of the user-visible state machine — failures are
  // logged-only inside deleteAiAttachment.
  const purgeUploadedPendingObjects = useCallback(async (
    list: PendingAttachment[],
  ): Promise<void> => {
    await Promise.all(
      list
        .filter((p) => p.status === 'uploaded' && p.meta)
        .map((p) => deleteAiAttachment(p.meta!.storage_path)),
    )
  }, [])

  const clearPendingAttachments = useCallback(async (): Promise<void> => {
    const snapshot = pendingAttachmentsRef.current
    setPendingAttachments([])
    await purgeUploadedPendingObjects(snapshot)
  }, [purgeUploadedPendingObjects])

  const addPendingAttachments = useCallback((files: File[]) => {
    if (files.length === 0) return
    setPendingAttachments((prev) => {
      const slots = MAX_ATTACHMENTS_PER_MESSAGE - prev.length
      if (slots <= 0) return prev
      const next: PendingAttachment[] = []
      for (const f of files.slice(0, slots)) {
        // Dedupe within this single drop/pick on (name, size, lastModified) —
        // two files with identical metadata are almost certainly duplicates.
        const dup = prev.some(
          (p) =>
            p.file.name === f.name
            && p.file.size === f.size
            && p.file.lastModified === f.lastModified,
        )
        if (dup) continue
        next.push({ id: crypto.randomUUID(), file: f, status: 'pending' })
      }
      return next.length > 0 ? [...prev, ...next] : prev
    })
  }, [])

  const removePendingAttachment = useCallback(async (id: string): Promise<void> => {
    const target = pendingAttachmentsRef.current.find((p) => p.id === id)
    setPendingAttachments((prev) => prev.filter((p) => p.id !== id))
    if (target?.status === 'uploaded' && target.meta) {
      await deleteAiAttachment(target.meta.storage_path)
    }
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
    messageRowsRef.current = []
    activeLeafIdRef.current = null
    void clearPendingAttachments()
  }, [user, clearPendingAttachments])

  const selectSession = useCallback(
    async (id: string) => {
      if (!user) return
      if (id === currentSessionIdRef.current) return

      if (streamAbortRef.current) {
        streamAbortRef.current.abort()
        streamAbortRef.current = null
        setIsStreaming(false)
      }

      // Switching sessions abandons the pending tray. Clean up any
      // already-uploaded objects so they don't orphan in storage.
      void clearPendingAttachments()

      setCurrentSessionId(id)
      setMessages([])
      setLoadingMessages(true)

      try {
        const rows = (await loadSession(id)) as AiMessageRow[]
        messageRowsRef.current = rows
        const leafId = computeMostRecentLeaf(rows)
        activeLeafIdRef.current = leafId
        setMessages(deriveActiveBranch(rows, leafId))
      } catch (err) {
        console.error('[useAiChatStore] loadSession failed:', err)
        const errId = genId()
        setMessages([
          {
            kind: 'error',
            id: errId,
            rowId: errId,
            code: 'load_failed',
            message: 'Greška pri učitavanju razgovora.',
            createdAt: new Date().toISOString(),
          },
        ])
      } finally {
        setLoadingMessages(false)
      }
    },
    [user, clearPendingAttachments],
  )

  // After a successful stream, replace optimistic state with the canonical
  // row tree from the DB and pick the newest leaf as the active branch.
  const reloadActiveBranch = useCallback(async (sessionId: string): Promise<void> => {
    try {
      const rows = (await loadSession(sessionId)) as AiMessageRow[]
      // Guard against the user navigating away while we were loading.
      if (currentSessionIdRef.current !== sessionId) return
      messageRowsRef.current = rows
      const leafId = computeMostRecentLeaf(rows)
      activeLeafIdRef.current = leafId
      setMessages(deriveActiveBranch(rows, leafId))
    } catch (err) {
      console.error('[useAiChatStore] reload failed:', err)
    }
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!user) return
      const trimmed = text.trim()
      const pendingSnapshot = pendingAttachmentsRef.current
      // Attachments-only send is allowed; require text OR at least one
      // attachment to proceed.
      if (!trimmed && pendingSnapshot.length === 0) return
      if (isStreamingRef.current) return

      const isNewConversation = currentSessionIdRef.current === null
      const capturedSessionId = currentSessionIdRef.current
      const capturedActiveLeafId = activeLeafIdRef.current
      // For brand-new conversations, generate the session UUID client-side
      // so attachment uploads can use the final {auth_user_id}/{session_id}/
      // prefix. The server honours this via proposed_session_id.
      const proposedSessionId = isNewConversation ? genId() : null
      const effectiveSessionId = capturedSessionId ?? proposedSessionId ?? ''
      const userText = trimmed

      // Optimistic user row. Bookkeeping ids are synthetic (no underlying DB
      // row yet) — that's fine, the post-stream reloadActiveBranch() replaces
      // this state with canonical rows.
      const optimisticId = genId()
      const optimisticUserRow: RenderMessage = {
        kind: 'user',
        id: optimisticId,
        rowId: optimisticId,
        text: userText,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, optimisticUserRow])

      setIsStreaming(true)
      const controller = new AbortController()
      streamAbortRef.current = controller

      // Track which paths we ourselves uploaded in this send call so we can
      // cleanup orphans on a post-upload failure.
      const uploadedPathsThisCall: string[] = []
      // Flips true once the SSE stream delivers its first event. By then the
      // edge function's handleChat has already persisted the user row AND
      // the ai_message_attachments rows (that happens before the
      // orchestration loop streams anything). So this doubles as "the turn
      // and its attachments are committed server-side" — used to decide
      // whether to clear the pending tray and whether the uploaded objects
      // are still orphans. Needed because Supabase's Edge runtime can throw
      // on stream teardown AFTER the full response was delivered, which
      // would otherwise route a fully-successful send through the catch.
      let turnCommitted = false

      try {
        // ---- Upload phase ----
        // Upload every pending entry that lacks a meta and collect the
        // results into a LOCAL array. We must NOT read pendingAttachmentsRef
        // afterwards to build the request: that ref is synced from state via
        // a useEffect, and no render has committed between the
        // setPendingAttachments calls below and the request build — the ref
        // would be stale and the attachments would silently drop from the
        // request (the message would send as text-only).
        const collectedMetas: AttachmentMeta[] = []
        for (const p of pendingSnapshot) {
          if (p.meta) {
            // Already uploaded on an earlier attempt — reuse as-is.
            collectedMetas.push(p.meta)
            continue
          }
          // Mark uploading
          setPendingAttachments((prev) =>
            prev.map((q) => (q.id === p.id ? { ...q, status: 'uploading' } : q)),
          )
          try {
            const meta = await uploadAiAttachment(p.file, effectiveSessionId)
            uploadedPathsThisCall.push(meta.storage_path)
            collectedMetas.push(meta)
            setPendingAttachments((prev) =>
              prev.map((q) =>
                q.id === p.id ? { ...q, status: 'uploaded', meta } : q,
              ),
            )
          } catch (uploadErr) {
            const code =
              uploadErr instanceof AttachmentError
                ? uploadErr.code
                : 'upload_failed'
            const message =
              uploadErr instanceof AttachmentError
                ? uploadErr.message
                : errorLabel('upload_failed', 'Greška pri prijenosu datoteke.')
            setPendingAttachments((prev) =>
              prev.map((q) =>
                q.id === p.id
                  ? { ...q, status: 'error', errorCode: code }
                  : q,
              ),
            )
            // Drop the optimistic user row so the chat doesn't show a
            // half-state. The user keeps their typed text (still in the
            // input via the caller) and the pending tray so they can retry.
            setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
            // Surface the error as an inline error bubble.
            const errId = genId()
            setMessages((prev) => [
              ...prev,
              {
                kind: 'error',
                id: errId,
                rowId: errId,
                code,
                message,
                createdAt: new Date().toISOString(),
              },
            ])
            // Clean up any earlier-uploaded paths from this send (since
            // we're not going through with it).
            await Promise.all(uploadedPathsThisCall.map(deleteAiAttachment))
            return
          }
        }

        // Build the attachment payload from the LOCAL collected metas.
        const requestAttachments: AttachmentRequestBody[] = collectedMetas.map((m) => ({
          storage_path: m.storage_path,
          file_name: m.file_name,
          file_size: m.file_size,
          mime_type: m.mime_type,
          kind: m.kind,
          extracted_text: m.extracted_text ?? null,
        }))

        // Patch the optimistic user row with the uploaded attachments so
        // the chip strip on the user's bubble appears immediately.
        if (requestAttachments.length > 0) {
          const renderAtts = requestAttachments.map((r, idx) => ({
            id: `optimistic-${optimisticId}-${idx}`,
            message_id: optimisticId,
            storage_path: r.storage_path,
            file_name: r.file_name,
            file_size: r.file_size,
            mime_type: r.mime_type,
            kind: r.kind,
            extracted_text: r.extracted_text ?? null,
            created_at: new Date().toISOString(),
          }))
          setMessages((prev) =>
            prev.map((m) =>
              m.id === optimisticId && m.kind === 'user'
                ? { ...m, attachments: renderAtts }
                : m,
            ),
          )
        }

        // Capture the route at send time. We can't useLocation() here because
        // AiChatProvider sits ABOVE <Router> in App.tsx (so chat state survives
        // route changes — see docs/AI_CHAT.md). React Router writes to
        // window.location before each render, so reading it now matches what
        // useLocation() in any child component would return for the same tick.
        const currentRoute = typeof window !== 'undefined' ? window.location.pathname : null
        await streamMessage({
          sessionId: capturedSessionId,
          message: userText,
          parentMessageId: capturedActiveLeafId,
          currentRoute,
          attachments: requestAttachments,
          proposedSessionId,
          signal: controller.signal,
          callbacks: {
            onAny: () => {
              // Any event means handleChat finished — user row + attachments
              // are persisted server-side.
              turnCommitted = true
            },
            onSession: (event) => {
              if (!isNewConversation) return
              setCurrentSessionId(event.session_id)
              const synthesized: AiSession = {
                id: event.session_id,
                user_id: user.id,
                title: userText.slice(0, 60).trim() || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                cancel_requested_at: null,
              }
              setSessions((prev) => [synthesized, ...prev])
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

        // Clean resolution — the turn is committed. (The tray is cleared in
        // `finally` via turnCommitted, so a post-delivery stream-teardown
        // throw still clears it.)
        turnCommitted = true

        // Reload to pick up the canonical rows (with real ids + parent_ids
        // and the freshly-computed active leaf). For a new conversation the
        // session id arrives mid-stream via onSession, so we fall back to
        // the ref if capturedSessionId was null.
        const sid = capturedSessionId ?? currentSessionIdRef.current
        if (sid) await reloadActiveBranch(sid)
      } catch (err) {
        // Clean up orphan storage objects ONLY if the turn never reached the
        // server. Once any event arrived, handleChat already linked the
        // attachments to a persisted message — deleting them here would
        // break the saved attachments on the next history reload.
        if (uploadedPathsThisCall.length > 0 && !turnCommitted) {
          await Promise.all(uploadedPathsThisCall.map(deleteAiAttachment))
        }
        if (err instanceof DOMException && err.name === 'AbortError') {
          // User cancelled via newConversation/selectSession — silent.
        } else if (
          err instanceof Error &&
          (err.name === 'AbortError' || (err as { code?: string }).code === 'AbortError')
        ) {
          // Some environments surface AbortError as a plain Error.
        } else if (err instanceof AiChatHttpError) {
          // AiChatHttpError is only thrown for a non-OK HTTP response, i.e.
          // a pre-stream failure — the turn was NOT persisted. Surface it
          // and leave the pending tray intact so the user can retry.
          const errId = genId()
          setMessages((prev) => [
            ...prev,
            {
              kind: 'error',
              id: errId,
              rowId: errId,
              code: err.code,
              message: err.message,
              createdAt: new Date().toISOString(),
            },
          ])
        } else {
          console.error('[useAiChatStore] streamMessage failed:', err)
          // If events had already arrived, the response was delivered and
          // this is a stream-teardown artifact (Supabase Edge runtime) — not
          // a real failure. Don't show a misleading error bubble.
          if (!turnCommitted) {
            const errId = genId()
            setMessages((prev) => [
              ...prev,
              {
                kind: 'error',
                id: errId,
                rowId: errId,
                code: 'unknown_error',
                message: 'Neočekivana greška. Pokušajte ponovno.',
                createdAt: new Date().toISOString(),
              },
            ])
          }
        }
      } finally {
        // The turn (and its attachments) are committed server-side once any
        // event arrived — clear the pending tray. Done here, not on the
        // success path, so a post-delivery stream-teardown throw still
        // clears it. Storage objects are NOT deleted: they're linked to the
        // persisted message now.
        if (turnCommitted) {
          setPendingAttachments([])
        }
        // Guard cleanup by controller identity: if a later newConversation /
        // selectSession / sendMessage replaced our controller, this stream's
        // late completion must not clobber the newer stream's state.
        if (streamAbortRef.current === controller) {
          streamAbortRef.current = null
          setIsStreaming(false)
        }
      }
    },
    [user, reloadActiveBranch],
  )

  // Fork off an alternative branch at `messageId`. The server inserts a new
  // sibling user row under the target's parent, streams the assistant
  // response, and we reload — the new branch becomes the active leaf, with
  // the original branch still in the tree and reachable via the sibling
  // switcher arrows.
  const editMessage = useCallback(
    async (messageId: string, newText: string) => {
      if (!user) return
      const trimmed = newText.trim()
      if (!trimmed) return
      if (isStreamingRef.current) return

      const sessionId = currentSessionIdRef.current
      if (!sessionId) return

      const targetIdx = messagesRef.current.findIndex((m) => m.id === messageId)
      if (targetIdx === -1) return
      const target = messagesRef.current[targetIdx]
      if (target.kind !== 'user') return

      // Optimistic prefix: everything before the target in the active path.
      // The target itself (and its descendants in this branch) disappear
      // because we're moving to a new branch; they'll come back if the user
      // clicks ‹ to flip back, after the post-stream reload populates branch
      // metadata from the canonical tree.
      const prefix = messagesRef.current.slice(0, targetIdx)
      const optimisticId = genId()
      const optimisticUserRow: RenderMessage = {
        kind: 'user',
        id: optimisticId,
        rowId: optimisticId,
        text: trimmed,
        createdAt: new Date().toISOString(),
      }
      setMessages([...prefix, optimisticUserRow])

      setIsStreaming(true)
      const controller = new AbortController()
      streamAbortRef.current = controller

      try {
        const currentRoute = typeof window !== 'undefined' ? window.location.pathname : null
        await streamMessage({
          sessionId,
          message: trimmed,
          editMessageId: target.rowId,
          currentRoute,
          signal: controller.signal,
          callbacks: {
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

        await reloadActiveBranch(sessionId)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // silent
        } else if (
          err instanceof Error &&
          (err.name === 'AbortError' || (err as { code?: string }).code === 'AbortError')
        ) {
          // silent
        } else if (err instanceof AiChatHttpError) {
          setMessages((prev) => [
            ...prev,
            {
              kind: 'error',
              id: genId(),
              rowId: genId(),
              code: err.code,
              message: err.message,
              createdAt: new Date().toISOString(),
            },
          ])
        } else {
          console.error('[useAiChatStore] editMessage failed:', err)
          setMessages((prev) => [
            ...prev,
            {
              kind: 'error',
              id: genId(),
              rowId: genId(),
              code: 'unknown_error',
              message: 'Neočekivana greška. Pokušajte ponovno.',
              createdAt: new Date().toISOString(),
            },
          ])
        }
      } finally {
        if (streamAbortRef.current === controller) {
          streamAbortRef.current = null
          setIsStreaming(false)
        }
      }
    },
    [user, reloadActiveBranch],
  )

  // Regenerate the last assistant response by re-editing the most recent
  // user message with its own text. Backend treats it identically to an edit.
  const regenerateLastTurn = useCallback(async () => {
    if (!user) return
    if (isStreamingRef.current) return
    const lastUser = [...messagesRef.current].reverse().find((m) => m.kind === 'user')
    if (!lastUser) return
    await editMessage(lastUser.id, lastUser.text)
  }, [user, editMessage])

  const renameSession = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      try {
        await renameSessionService(id, trimmed)
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, title: trimmed } : s)),
        )
        void logActivity({
          action: 'ai_session.update',
          entity: 'ai_session',
          entityId: id,
          metadata: { changed_fields: ['title'] },
          severity: 'medium',
        })
      } catch (err) {
        console.error('[useAiChatStore] renameSession failed:', err)
      }
    },
    [],
  )

  const deleteSession = useCallback(
    async (id: string) => {
      const target = sessions.find((s) => s.id === id)
      const deletedTitle = target?.title ?? null
      try {
        await deleteSessionService(id)
        setSessions((prev) => prev.filter((s) => s.id !== id))
        if (currentSessionIdRef.current === id) {
          if (streamAbortRef.current) {
            streamAbortRef.current.abort()
            streamAbortRef.current = null
            setIsStreaming(false)
          }
          setCurrentSessionId(null)
          setMessages([])
          messageRowsRef.current = []
          activeLeafIdRef.current = null
          void clearPendingAttachments()
        }
        void logActivity({
          action: 'ai_session.delete',
          entity: 'ai_session',
          entityId: id,
          metadata: deletedTitle ? { entity_name: deletedTitle } : {},
          severity: 'high',
        })
      } catch (err) {
        console.error('[useAiChatStore] deleteSession failed:', err)
      }
    },
    [sessions, clearPendingAttachments],
  )

  // User-initiated stop. Two things have to happen:
  //   1. Abort the local fetch reader so the UI returns to idle immediately
  //      and any further SSE events from the (still-running) backend are
  //      dropped.
  //   2. Write `now()` into ai_sessions.cancel_requested_at for the current
  //      session. The edge function's orchestration loop polls that column
  //      at every iteration boundary and after every tool dispatch — that's
  //      what actually stops the backend. Transport-layer cancellation via
  //      req.signal / writer.closed does NOT work in Supabase's current Edge
  //      runtime, so this DB beacon is the real cancel signal.
  // Guarded by controller identity for the same reason the `finally` block of
  // sendMessage / editMessage is: if a later send replaced our controller,
  // we must not clobber the newer stream's state. A neutral 'interrupted'
  // marker is appended so the user has a visual cue; it lives only in the
  // client tree and disappears on the next session reload.
  const stopStreaming = useCallback(() => {
    const ctrl = streamAbortRef.current
    if (!ctrl) return
    ctrl.abort()
    if (streamAbortRef.current !== ctrl) return
    streamAbortRef.current = null
    setIsStreaming(false)
    const markerId = genId()
    setMessages((prev) => [
      ...prev,
      {
        kind: 'interrupted',
        id: markerId,
        rowId: markerId,
        createdAt: new Date().toISOString(),
      },
    ])

    // Fire-and-forget. The edge function compares the beacon against its own
    // request-start timestamp, so a slightly stale write still works as long
    // as it lands within the loop's polling window. Failure is logged only;
    // the UI has already returned to idle either way.
    const sid = currentSessionIdRef.current
    if (sid) {
      void supabase
        .from('ai_sessions')
        .update({ cancel_requested_at: new Date().toISOString() })
        .eq('id', sid)
        .then(({ error }) => {
          if (error) {
            console.error('[useAiChatStore] cancel beacon write failed:', error)
          }
        })
    }
  }, [])

  // Re-render the conversation along a different branch. The caller supplies
  // a leaf id (the most-recent descendant of the sibling they want to view);
  // we walk parents from there to root and replace `messages` accordingly.
  // No DB write — branch choice is client-side only and resets to "newest
  // leaf wins" on the next loadSession.
  const switchToLeaf = useCallback((leafId: string) => {
    activeLeafIdRef.current = leafId
    setMessages(deriveActiveBranch(messageRowsRef.current, leafId))
  }, [])

  return {
    isOpen,
    sessions,
    loadingSessions,
    currentSessionId,
    messages,
    loadingMessages,
    isStreaming,
    inputDisabled: isStreaming || loadingMessages,
    pendingAttachments,

    open,
    close,
    newConversation,
    selectSession,
    sendMessage,
    stopStreaming,
    editMessage,
    regenerateLastTurn,
    renameSession,
    deleteSession,
    switchToLeaf,
    addPendingAttachments,
    removePendingAttachment,
    clearPendingAttachments,
  }
}
