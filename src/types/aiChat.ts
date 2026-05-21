import type { Database } from './database'

// Generated row types narrow only the role column. The DB CHECK
// enforces 'user' | 'assistant' but the generated type widens to string.
export type AiSession = Database['public']['Tables']['ai_sessions']['Row']

export type AttachmentKind = 'image' | 'pdf' | 'text'

type AiAttachmentRowGen = Database['public']['Tables']['ai_message_attachments']['Row']
// Narrow `kind` from `string` to the DB CHECK union.
export type AiAttachmentRow = Omit<AiAttachmentRowGen, 'kind'> & {
  kind: AttachmentKind
}

type AiMessageRowGen = Database['public']['Tables']['ai_messages']['Row']
export type AiMessageRow = Omit<AiMessageRowGen, 'role'> & {
  role: 'user' | 'assistant'
  // Populated by loadSession via a batched side-table query. Live (in-flight)
  // optimistic rows leave this undefined; canonical rows after reload have
  // an array (possibly empty).
  attachments?: AiAttachmentRow[]
}

// ---------------------------------------------------------------------------
// create_document — the agent-authored document spec. It is carried in the
// input of a `create_document` tool_use block (no dedicated SSE event), and
// the file itself is generated client-side on download. See
// components/AiChat/lib/documentGenerator.ts.
// ---------------------------------------------------------------------------
export type DocumentFormat = 'pdf' | 'xlsx' | 'markdown'

export interface DocumentSheet {
  name: string
  columns: string[]
  rows: Array<Array<string | number | boolean | null>>
}

export interface DocumentSpec {
  title: string
  format: DocumentFormat
  // Present for 'pdf' and 'markdown'.
  markdown?: string
  // Present for 'xlsx'.
  sheets?: DocumentSheet[]
}

// SSE event taxonomy — must match the backend's Event union exactly.
// See supabase/functions/ai-chat/index.ts.
export type AiChatEvent =
  | { type: 'session'; session_id: string }
  | { type: 'turn'; role: 'assistant'; text: string }
  | { type: 'tool_call'; tool: string; input: unknown; tool_use_id: string }
  | { type: 'tool_result'; tool: string; output: unknown; tool_use_id: string; is_error: boolean }
  | { type: 'done'; stop_reason: string; usage: { input_tokens: number; output_tokens: number } }
  | { type: 'error'; code: string; message: string }

// Callbacks the consumer passes to streamMessage. Each fires once per event
// of that type as it arrives off the SSE stream. onAny fires for every event
// (useful for logging / state machines that want a single integration point).
export interface AiChatStreamCallbacks {
  onSession?: (e: Extract<AiChatEvent, { type: 'session' }>) => void
  onTurn?: (e: Extract<AiChatEvent, { type: 'turn' }>) => void
  onToolCall?: (e: Extract<AiChatEvent, { type: 'tool_call' }>) => void
  onToolResult?: (e: Extract<AiChatEvent, { type: 'tool_result' }>) => void
  onDone?: (e: Extract<AiChatEvent, { type: 'done' }>) => void
  onError?: (e: Extract<AiChatEvent, { type: 'error' }>) => void
  onAny?: (e: AiChatEvent) => void
}

// Thrown by streamMessage when the HTTP response is a flat 4xx/5xx error
// envelope (pre-stream failures: bad_request, message_too_long,
// session_not_found, etc.). Mid-stream errors are NOT thrown — they arrive
// as `error` events and are surfaced via onError/onAny.
export class AiChatHttpError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'AiChatHttpError'
    this.status = status
    this.code = code
  }
}
