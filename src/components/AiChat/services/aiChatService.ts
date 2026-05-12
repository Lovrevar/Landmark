import { supabase } from '../../../lib/supabase'
import type {
  AiChatEvent,
  AiChatStreamCallbacks,
  AiMessageRow,
  AiSession,
} from '../../../types/aiChat'
import { AiChatHttpError } from '../../../types/aiChat'

export async function listSessions(): Promise<AiSession[]> {
  const { data, error } = await supabase
    .from('ai_sessions')
    .select('id, user_id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AiSession[]
}

export async function loadSession(sessionId: string): Promise<AiMessageRow[]> {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('id, session_id, role, content, model, input_tokens, output_tokens, stop_reason, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as AiMessageRow[]
}

export async function streamMessage(args: {
  sessionId: string | null
  message: string
  callbacks: AiChatStreamCallbacks
  signal?: AbortSignal
}): Promise<void> {
  const { sessionId, message, callbacks, signal } = args

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
    body: JSON.stringify({ session_id: sessionId, message }),
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
