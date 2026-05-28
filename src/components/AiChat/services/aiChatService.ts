import { supabase } from '../../../lib/supabase'
import type {
  AiAttachmentRow,
  AiChatEvent,
  AiChatStreamCallbacks,
  AiMessageRow,
  AiSession,
  AttachmentKind,
} from '../../../types/aiChat'
import { AiChatHttpError } from '../../../types/aiChat'

export async function listSessions(): Promise<AiSession[]> {
  const { data, error } = await supabase
    .from('ai_sessions')
    .select('id, user_id, title, created_at, updated_at, cancel_requested_at')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AiSession[]
}

// Loads the full message tree for a session AND batched attachments for all
// messages in that tree. The attachments query is fail-open: a side-table
// hiccup degrades the UI (no chips/thumbnails render) but does not block
// history load — the model still has full fidelity via the persisted
// content JSONB which already includes base64 image/document blocks.
export async function loadSession(sessionId: string): Promise<AiMessageRow[]> {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('id, session_id, role, content, model, input_tokens, output_tokens, stop_reason, created_at, parent_id')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as AiMessageRow[]
  if (rows.length === 0) return rows

  const ids = rows.map((r) => r.id)
  const { data: atts, error: attErr } = await supabase
    .from('ai_message_attachments')
    .select('id, message_id, storage_path, file_name, file_size, mime_type, kind, extracted_text, created_at')
    .in('message_id', ids)
    .order('created_at', { ascending: true })
  if (attErr) {
    console.warn('[aiChatService] attachments fetch failed; rendering without chips:', attErr)
    return rows
  }

  const byMessageId = new Map<string, AiAttachmentRow[]>()
  for (const a of (atts ?? []) as Array<AiAttachmentRow & { message_id: string; kind: string }>) {
    const list = byMessageId.get(a.message_id) ?? []
    list.push({ ...a, kind: a.kind as AttachmentKind })
    byMessageId.set(a.message_id, list)
  }
  return rows.map((r) => {
    const list = byMessageId.get(r.id)
    return list ? { ...r, attachments: list } : r
  })
}

export async function renameSession(sessionId: string, title: string): Promise<void> {
  // updated_at is bumped automatically by the update_ai_sessions_updated_at
  // BEFORE UPDATE trigger, so we don't set it explicitly here.
  const { error } = await supabase
    .from('ai_sessions')
    .update({ title })
    .eq('id', sessionId)
  if (error) throw error
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_sessions')
    .delete()
    .eq('id', sessionId)
  if (error) throw error
}

// Fire-and-forget cancel beacon. Returns a promise that the caller is expected
// to ignore (the edge function compares this beacon against its own request-
// start timestamp; a slightly stale write still works as long as it lands
// within the loop's polling window).
export function sendCancelBeacon(sessionId: string): void {
  void supabase
    .from('ai_sessions')
    .update({ cancel_requested_at: new Date().toISOString() })
    .eq('id', sessionId)
    .then(({ error }) => {
      if (error) {
        console.error('[aiChatService] cancel beacon write failed:', error)
      }
    })
}

// Body shape for an attachment included alongside the user turn. Matches the
// server-side AttachmentInput in supabase/functions/ai-chat/index.ts; keep
// these in sync.
export interface AttachmentRequestBody {
  storage_path: string
  file_name: string
  file_size: number
  mime_type: string
  kind: AttachmentKind
  extracted_text?: string | null
}

export async function streamMessage(args: {
  sessionId: string | null
  message: string
  editMessageId?: string | null
  parentMessageId?: string | null
  // location.pathname captured at send time by the caller (typically the
  // store hook via useLocation()). Used server-side to prepend a
  // "[Kontekst: ...]" line to the in-memory user message and to route-boost
  // help-KB lookups. Never persisted in ai_messages.content.
  currentRoute?: string | null
  // Per-message file attachments (metadata only — bytes already in storage).
  attachments?: AttachmentRequestBody[]
  // Client-proposed UUID for new sessions; lets the storage path use the
  // final session id even before the server creates the row. Honoured only
  // when sessionId is null.
  proposedSessionId?: string | null
  callbacks: AiChatStreamCallbacks
  signal?: AbortSignal
}): Promise<void> {
  const {
    sessionId,
    message,
    editMessageId,
    parentMessageId,
    currentRoute,
    attachments,
    proposedSessionId,
    callbacks,
    signal,
  } = args

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) {
    throw new AiChatHttpError(401, 'no_session', 'Not authenticated')
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) {
    throw new AiChatHttpError(500, 'no_supabase_url', 'VITE_SUPABASE_URL is not configured')
  }
  const functionUrl = `${supabaseUrl}/functions/v1/ai-chat`

  // Sending the JWT as `apikey` too is harmless — the edge function authenticates
  // from `Authorization`, but devtools snippets used both and it worked, so we
  // mirror that here to avoid surprise 401s from intermediate layers.
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: sessionId,
      message,
      edit_message_id: editMessageId ?? null,
      parent_message_id: parentMessageId ?? null,
      current_route: currentRoute ?? null,
      attachments: attachments && attachments.length > 0 ? attachments : null,
      proposed_session_id: proposedSessionId ?? null,
    }),
    signal,
  })

  if (!response.ok) {
    let payload: { error?: { code?: string; message?: string } } | null = null
    try {
      payload = await response.json()
    } catch {
      /* fall through */
    }
    const code = payload?.error?.code ?? 'http_error'
    const msg = payload?.error?.message ?? `HTTP ${response.status}`
    throw new AiChatHttpError(response.status, code, msg)
  }

  if (!response.body) {
    throw new AiChatHttpError(500, 'no_body', 'Response body is empty')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  const dispatchFrame = (frame: string): void => {
    if (frame.startsWith(':')) return

    let dataStr = ''
    for (const line of frame.split('\n')) {
      if (line.startsWith('data:')) {
        const piece = line.slice(5).replace(/^ /, '')
        dataStr += (dataStr ? '\n' : '') + piece
      }
      // We deliberately ignore `event:` / `id:` / `retry:` lines — the JSON
      // payload's own `type` field is the source of truth.
    }
    if (!dataStr) return

    let event: AiChatEvent
    try {
      event = JSON.parse(dataStr) as AiChatEvent
    } catch {
      console.warn('[aiChatService] failed to parse SSE frame:', dataStr.slice(0, 500))
      return
    }

    switch (event.type) {
      case 'session':
        callbacks.onSession?.(event)
        break
      case 'turn':
        callbacks.onTurn?.(event)
        break
      case 'tool_call':
        callbacks.onToolCall?.(event)
        break
      case 'tool_result':
        callbacks.onToolResult?.(event)
        break
      case 'done':
        callbacks.onDone?.(event)
        break
      case 'error':
        callbacks.onError?.(event)
        break
    }
    callbacks.onAny?.(event)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sepIndex: number
    while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sepIndex)
      buffer = buffer.slice(sepIndex + 2)
      if (frame.length > 0) dispatchFrame(frame)
    }
  }

  if (buffer.length > 0) {
    console.warn('[aiChatService] discarding partial SSE frame at end of stream:', buffer.slice(0, 500))
  }
}
