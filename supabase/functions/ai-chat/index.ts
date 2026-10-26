// AI chat edge function — SSE streaming variant.
//
// Two request shapes are dispatched on this endpoint:
//
//   1. Chat:  { session_id: string | null, message: string }
//             Validates input, resolves/creates a session, persists the user
//             turn, and then opens an SSE stream that carries the
//             orchestration loop's events to the client as they happen:
//
//               event: session       data: { type, session_id }    (always first real event)
//               event: turn          data: { type, role, text }
//               event: tool_call     data: { type, tool, input, tool_use_id }
//               event: tool_result   data: { type, tool, output, tool_use_id, is_error }
//               event: done          data: { type, stop_reason, usage }
//               event: error         data: { type, code, message }
//
//             Pre-stream failures (auth, validation, session-not-found,
//             persistence of the user turn) return a flat JSON error, same
//             shape as previous versions. Mid-stream failures are emitted as
//             `error` events — the HTTP status is already 200/event-stream by
//             then. The request-level 90s timeout that used to surface as a
//             flat 504 is now a mid-stream `error` event with code
//             'request_timeout'.
//
//   2. Debug: { debug_tool: string, input?: unknown }  — Director only,
//             additionally gated by AI_CHAT_DEBUG_ENABLED='true' env var.
//             When the env var is unset or any value other than the literal
//             string 'true', the branch returns 404 — the surface looks as
//             if it doesn't exist. The Director role check is a second line
//             of defense for the in-dev case.
//
// Persistence is incremental. Cancellation is honoured: when the client
// disconnects (fetch reader closes), `req.signal` aborts the per-request
// AbortController, which is propagated to `anthropic.messages.stream` and
// checked at iteration boundaries — no further DB rows are written after the
// abort, and no `error` event is emitted (the client is gone). The same
// controller is also tripped by the 90s timeout, which still surfaces as a
// mid-stream `error` event with code 'request_timeout'. Anything persisted
// BEFORE the abort (user turn, any complete assistant turn already inserted)
// stays — partial-but-real responses survive the cancel by design.
//
// Session and message ownership is enforced in this layer with explicit
// user_id / session_id filters on the service client; tool handlers still
// use the JWT-scoped userClient internally.

import { encodeBase64 } from 'jsr:@std/encoding@1/base64'

import { corsHeaders, handlePreflight } from '../_shared/cors.ts'
import { authenticate, type AuthContext } from '../_shared/auth.ts'
import { selectAvailableTools, TOOLS, type ToolHandlerExtras } from '../_shared/tools.ts'
import {
  type AnthropicBlock,
  anthropic,
  dispatchTool,
  type InMemoryMessage,
  type LoopConfig,
  type LoopHooks,
  type MessageStore,
  runOrchestrationLoop,
  type TextBlock,
} from '../_shared/orchestrator.ts'
import { SSEWriter, SseEventSink } from '../_shared/sse.ts'
import { buildStaticSystemPrompt, buildUserContext } from '../_shared/prompts.ts'
import { checkRateLimit } from '../_shared/rateLimit.ts'
import { describeRoute, sanitizeRoute } from '../_shared/routeLabels.ts'
import type { HelpSearchContext } from '../_shared/help-search.ts'
import type { Json } from '../_shared/database.ts'
import {
  ATTACHMENT_KEEP_RECENT,
  buildSummaryUserText,
  type ChainMessage,
  type ContentBlock,
  enforceHardCeiling,
  injectSummaryBanner,
  planCompaction,
  renderTurnsForSummary,
  selectKeptChain,
  stripOldAttachments,
  SUMMARY_SYSTEM_PROMPT,
} from '../_shared/context-window.ts'

const jsonHeaders = { ...corsHeaders, 'content-type': 'application/json' }

// Hard cap on a single chat stream. Surfaces as a mid-stream `error` event
// with code 'request_timeout' — the connection has already been upgraded to
// 200/text-event-stream by the time we time out, so 5xx is no longer
// available. The in-flight loop keeps running after the timeout fires until
// Supabase's invocation cap kills it.
const REQUEST_TIMEOUT_MS = 90_000

// Hard cap on a user-supplied message string. Counts JS string length, not
// UTF-8 bytes — this is a runaway-prompt guard, not a payload-size guard.
const MAX_MESSAGE_LENGTH = 4000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Multimodal attachments. Files are uploaded to the `ai-chat-attachments`
// bucket BEFORE the chat request lands; the client passes their metadata
// (storage_path + size/kind/mime) here so the edge function can validate,
// download bytes, and build Anthropic image/document/text blocks. For
// kind='text' the content is already extracted client-side and ≤50KB.
type AttachmentKind = 'image' | 'pdf' | 'text'
interface AttachmentInput {
  storage_path: string
  file_name: string
  file_size: number
  mime_type: string
  kind: AttachmentKind
  extracted_text?: string | null
}

interface ChatRequestBody {
  session_id?: string | null
  message?: string
  // When set, the new user message is inserted as a sibling of the referenced
  // row (same parent_id) — a new branch in the conversation tree. Requires a
  // real session_id; rejected on brand-new conversations.
  edit_message_id?: string | null
  // For non-edit sends on an existing session, the active branch's leaf id.
  // The new user message will hang off this parent. Null only for the first
  // message in a session (or, equivalently, when the session was just
  // created server-side).
  parent_message_id?: string | null
  // location.pathname from the React Router context at send time. Used to
  // prepend a "[Kontekst: ...]" line to the in-memory user message and to
  // route-boost help-KB lookups. Sanitized server-side; the persisted user
  // row never contains the route line.
  current_route?: string | null
  // Per-message file attachments. Server re-validates size, kind, MIME and
  // storage_path prefix; client limits are advisory only.
  attachments?: AttachmentInput[] | null
  // Client-proposed UUID for the to-be-created session. Lets the client
  // upload attachments to `{auth_user_id}/{session_id}/...` BEFORE the
  // server creates the session row. Honoured only when session_id is null;
  // ignored if a session with the same id already exists.
  proposed_session_id?: string | null
}

interface DebugRequestBody {
  debug_tool?: string
  input?: unknown
}

// What handleChat hands to streamChatResponse once all pre-stream work
// succeeds: enough state to run the orchestration loop without re-reading
// the DB.
interface ChatStreamPrep {
  sessionId: string
  newlyCreatedSession: boolean
  messages: InMemoryMessage[]
  userMessage: string
  // The id of the row we last inserted on this request — starts as the user
  // turn we just persisted. The orchestration loop chains every subsequent
  // row (assistant + tool_result) off this id so the tree stays well-formed.
  lastInsertedId: string
  // Resolved page-context for this request. `routePattern` and `routeLabel`
  // are populated when the client-supplied path resolves via routeLabels.ts;
  // null when missing/unknown (no context line is prepended in that case).
  // `routeRaw` is the sanitized client input — used in telemetry only.
  helpSearch: HelpSearchContext
  routeLabel: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flatError(code: string, message: string, status: number): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: jsonHeaders,
  })
}

// ---------------------------------------------------------------------------
// Attachments: limits, whitelists, validation, multimodal block builder.
// ---------------------------------------------------------------------------

const MAX_ATTACHMENTS_PER_MESSAGE = 4
const ATTACHMENT_SIZE_LIMITS: Record<AttachmentKind, number> = {
  image: 5 * 1024 * 1024,
  pdf: 10 * 1024 * 1024,
  text: 2 * 1024 * 1024,
}
const EXTRACTED_TEXT_MAX_BYTES = 50 * 1024

const ATTACHMENT_MIME_WHITELIST: Record<AttachmentKind, Set<string>> = {
  image: new Set(['image/png', 'image/jpeg', 'image/webp']),
  pdf: new Set(['application/pdf']),
  text: new Set([
    'text/plain',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ]),
}
const ATTACHMENT_EXT_WHITELIST: Record<AttachmentKind, Set<string>> = {
  image: new Set(['png', 'jpg', 'jpeg', 'webp']),
  pdf: new Set(['pdf']),
  text: new Set(['txt', 'csv', 'xls', 'xlsx']),
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Validate per-attachment shape, size, kind/MIME/extension whitelist, and
// the storage_path prefix. Returns a flat error Response on the first
// failure, or null on success. `authUserId` is the auth.users.id used as
// the first storage path segment (NOT public.users.id — that's what the
// bucket RLS compares to auth.uid()).
function validateAttachments(
  attachments: AttachmentInput[],
  authUserId: string,
): Response | null {
  if (attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    return flatError(
      'too_many_attachments',
      `Maksimalno ${MAX_ATTACHMENTS_PER_MESSAGE} priloga po poruci.`,
      400,
    )
  }
  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i]
    if (!att || typeof att !== 'object') {
      return flatError('invalid_attachment', `Neispravan prilog na poziciji ${i}.`, 400)
    }
    if (att.kind !== 'image' && att.kind !== 'pdf' && att.kind !== 'text') {
      return flatError('invalid_attachment_kind', `Nepoznata vrsta priloga: ${att.kind}.`, 400)
    }
    if (typeof att.mime_type !== 'string' || !ATTACHMENT_MIME_WHITELIST[att.kind].has(att.mime_type)) {
      return flatError(
        'unsupported_attachment_type',
        `Format datoteke "${att.mime_type}" nije podržan.`,
        400,
      )
    }
    if (typeof att.file_name !== 'string' || att.file_name.length === 0 || att.file_name.length > 255) {
      return flatError('invalid_attachment', `Ime datoteke nije ispravno.`, 400)
    }
    const ext = att.file_name.toLowerCase().split('.').pop() ?? ''
    if (!ATTACHMENT_EXT_WHITELIST[att.kind].has(ext)) {
      return flatError(
        'unsupported_attachment_type',
        `Ekstenzija ".${ext}" ne odgovara vrsti priloga.`,
        400,
      )
    }
    if (typeof att.file_size !== 'number' || att.file_size <= 0 || !Number.isFinite(att.file_size)) {
      return flatError('invalid_attachment', `Veličina datoteke nije ispravna.`, 400)
    }
    if (att.file_size > ATTACHMENT_SIZE_LIMITS[att.kind]) {
      return flatError(
        'attachment_too_large',
        `Datoteka "${att.file_name}" prelazi maksimalnu veličinu.`,
        400,
      )
    }
    // Storage path must live under the user's prefix and not escape via
    // traversal. The service client bypasses bucket RLS, so this prefix
    // check is the actual security control.
    if (typeof att.storage_path !== 'string'
      || !att.storage_path.startsWith(`${authUserId}/`)
      || att.storage_path.includes('..')
      || att.storage_path.startsWith('/')
      || att.storage_path.includes('\0')) {
      return flatError(
        'attachment_path_rejected',
        'Putanja priloga nije ispravna.',
        400,
      )
    }
    if (att.kind === 'text') {
      if (typeof att.extracted_text !== 'string' || att.extracted_text.length === 0) {
        return flatError(
          'invalid_attachment',
          `Tekstualni prilog "${att.file_name}" nema sadržaja.`,
          400,
        )
      }
      const byteLen = new TextEncoder().encode(att.extracted_text).byteLength
      if (byteLen > EXTRACTED_TEXT_MAX_BYTES) {
        return flatError(
          'attachment_too_large',
          `Izvučeni tekst priloga "${att.file_name}" prelazi 50 KB.`,
          400,
        )
      }
    } else if (att.extracted_text !== null && att.extracted_text !== undefined) {
      return flatError(
        'invalid_attachment',
        `extracted_text smije postojati samo za tekstualne priloge.`,
        400,
      )
    }
  }
  return null
}

// Build the multimodal content array for the user's turn. Image and PDF
// bytes are downloaded from the bucket (service-role; prefix check in
// validateAttachments is what keeps cross-user paths out) and base64
// encoded into Anthropic image/document blocks. Text-kind attachments use
// the already-extracted UTF-8 from the client. The plain text block
// carrying the user's typed message is appended LAST so context (the
// files) precedes the question — and so the route-augmentation later can
// find it by type.
async function buildUserContentBlocks(
  userText: string,
  attachments: AttachmentInput[],
  serviceClient: AuthContext['serviceClient'],
): Promise<AnthropicBlock[]> {
  const out: AnthropicBlock[] = []
  for (const att of attachments) {
    if (att.kind === 'text') {
      out.push({
        type: 'text',
        text: `[Priložena datoteka: ${att.file_name}]\n\n${att.extracted_text ?? ''}`,
      })
      continue
    }
    const { data, error } = await serviceClient.storage
      .from('ai-chat-attachments')
      .download(att.storage_path)
    if (error || !data) {
      throw new Error(`attachment_download_failed:${att.storage_path}`)
    }
    const bytes = new Uint8Array(await data.arrayBuffer())
    const base64 = encodeBase64(bytes)
    if (att.kind === 'image') {
      out.push({
        type: 'image',
        source: { type: 'base64', media_type: att.mime_type, data: base64 },
      })
    } else {
      out.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      })
    }
  }
  out.push({ type: 'text', text: userText })
  return out
}

// Fire-and-forget title backfill for newly-created sessions. The first 60
// characters of the user's opening message become the thread title; failures
// are logged but never propagated to the caller.
async function backfillTitleIfNew(
  ctx: AuthContext,
  sessionId: string,
  userMessage: string,
  newlyCreated: boolean,
): Promise<void> {
  if (!newlyCreated) return
  const title = userMessage.slice(0, 60).trim()
  const { error: titleError } = await ctx.serviceClient
    .from('ai_sessions')
    .update({ title })
    .eq('id', sessionId)
    .eq('user_id', ctx.userId)
  if (titleError) {
    console.error('[ai-chat] title backfill failed', {
      userId: ctx.userId,
      sessionId,
      code: titleError.code,
    })
  }
}

// ---------------------------------------------------------------------------
// Post-turn context compaction. Best-effort and off the user's critical
// path: once the turn's answer has been delivered, fold older turns into
// the session's running summary so the NEXT turn starts from a compact
// base. Never throws — a compaction failure must not surface to the user;
// it just means the next turn replays a little more history and retries.
// ---------------------------------------------------------------------------

async function maybeCompactSession(ctx: AuthContext, sessionId: string): Promise<void> {
  try {
    const { data: rows, error } = await ctx.serviceClient
      .from('ai_messages')
      .select('id, role, content, parent_id, created_at')
      .eq('session_id', sessionId)
    if (error || !rows || rows.length === 0) return

    // The branch we just extended ends at the newest leaf — a row that is no
    // other row's parent. Among leaves (branches), the newest created_at is
    // the one this request just used.
    const parentIds = new Set(
      rows.map((r) => r.parent_id).filter((p): p is string => p !== null),
    )
    const leaves = rows.filter((r) => !parentIds.has(r.id))
    let leaf = leaves[0] ?? rows[0]
    for (const r of leaves) if (r.created_at > leaf.created_at) leaf = r

    const byId = new Map<string, (typeof rows)[number]>()
    for (const r of rows) byId.set(r.id, r)
    const chain: ChainMessage[] = []
    const seen = new Set<string>()
    let cursor: string | null = leaf.id
    while (cursor) {
      if (seen.has(cursor)) break
      seen.add(cursor)
      const row = byId.get(cursor)
      if (!row) break
      chain.unshift({
        id: row.id,
        role: row.role as 'user' | 'assistant',
        content: Array.isArray(row.content) ? row.content as unknown as ContentBlock[] : [],
      })
      cursor = row.parent_id
    }

    const { data: meta } = await ctx.serviceClient
      .from('ai_sessions')
      .select('context_summary, summary_through_message_id')
      .eq('id', sessionId)
      .maybeSingle()

    const plan = planCompaction(
      chain,
      meta?.context_summary ?? null,
      meta?.summary_through_message_id ?? null,
    )
    if (!plan) return

    // A cheaper/faster model can be pointed at summarisation via
    // AI_CHAT_SUMMARY_MODEL; it defaults to the main chat model.
    const summaryModel = Deno.env.get('AI_CHAT_SUMMARY_MODEL')
      ?? Deno.env.get('AI_CHAT_MODEL')
      ?? 'claude-sonnet-4-6'

    const rendered = renderTurnsForSummary(plan.summarizeTurns)
    const resp = await anthropic.messages.create({
      model: summaryModel,
      max_tokens: 2048,
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: buildSummaryUserText(plan.priorSummary, rendered),
      }],
    })
    const summaryText = (resp.content as AnthropicBlock[])
      .filter((b): b is TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
    if (!summaryText) return

    const { error: updateError } = await ctx.serviceClient
      .from('ai_sessions')
      .update({
        context_summary: summaryText,
        summary_through_message_id: plan.newBoundaryId,
      })
      .eq('id', sessionId)
      .eq('user_id', ctx.userId)
    if (updateError) {
      console.error('[ai-chat] compaction persist failed', {
        userId: ctx.userId,
        sessionId,
        code: updateError.code,
      })
      return
    }

    console.log('[ai-chat] session compacted', {
      userId: ctx.userId,
      sessionId,
      summarizedTurns: plan.summarizeTurns.length,
      summaryChars: summaryText.length,
    })
  } catch (err) {
    console.error('[ai-chat] compaction failed (non-fatal)', {
      userId: ctx.userId,
      sessionId,
      reason: err instanceof Error ? err.message : String(err),
    })
  }
}

// ---------------------------------------------------------------------------
// Pre-stream phase — validation, session resolution, history load, and
// user-message persistence. Returns either a flat Response (any failure
// surfaces here, before the stream is opened) or a ChatStreamPrep ready
// to hand to streamChatResponse.
// ---------------------------------------------------------------------------

async function handleChat(
  ctx: AuthContext,
  body: ChatRequestBody,
): Promise<Response | ChatStreamPrep> {
  const rawMessage = typeof body.message === 'string' ? body.message : ''
  if (!rawMessage) {
    return flatError('bad_request', 'message is required and must be a non-empty string', 400)
  }
  // Length cap counts the raw string before .trim() so users can't sneak past
  // it with leading whitespace.
  if (rawMessage.length > MAX_MESSAGE_LENGTH) {
    return flatError('message_too_long', `Message exceeds ${MAX_MESSAGE_LENGTH} character limit.`, 400)
  }
  const userMessage = rawMessage.trim()
  if (!userMessage) {
    return flatError('bad_request', 'message is required and must be a non-empty string', 400)
  }

  // ---- Attachments: validation up front, before rate-limit so a malformed
  //      payload doesn't consume the per-window budget. ----
  const rawAttachments = Array.isArray(body.attachments) ? body.attachments : []
  const editIdEarly = typeof body.edit_message_id === 'string' && body.edit_message_id.length > 0
    ? body.edit_message_id
    : null
  if (rawAttachments.length > 0 && editIdEarly) {
    return flatError(
      'edit_with_attachments_unsupported',
      'Uređivanje poruke ne podržava priloge.',
      400,
    )
  }
  const attachmentValidation = validateAttachments(rawAttachments, ctx.authUserId)
  if (attachmentValidation) return attachmentValidation
  const attachments: AttachmentInput[] = rawAttachments

  // ---- Rate limit check ----
  // Pre-session: blocks before we touch ai_sessions/ai_messages, so an
  // over-limit request leaves no trace beyond the log line below. Debug
  // branch is not affected (it has its own gate).
  const verdict = await checkRateLimit(ctx)
  if (!verdict.ok) {
    console.warn('[ai-chat] rate limit hit', {
      userId: ctx.userId,
      reason: verdict.reason,
      count: verdict.count,
      limit: verdict.limit,
      windowMs: verdict.windowMs,
    })
    return flatError(
      'rate_limited',
      'Previše zahtjeva. Pokušajte ponovno za nekoliko minuta.',
      429,
    )
  }

  // ---- Session resolution (service client, explicit user_id filter) ----
  let sessionId: string
  let newlyCreatedSession = false

  if (body.session_id == null) {
    // Client may propose a UUID so attachments can be uploaded under the
    // final `{auth_user_id}/{session_id}/...` path before the row exists.
    // Honour it only if (a) syntactically a uuid and (b) no session with
    // that id already exists. Otherwise fall through to a server-generated
    // id.
    const proposed = typeof body.proposed_session_id === 'string'
      && UUID_RE.test(body.proposed_session_id)
      ? body.proposed_session_id
      : null
    let proposedTaken = false
    if (proposed) {
      const { data: existing, error: probeError } = await ctx.serviceClient
        .from('ai_sessions')
        .select('id')
        .eq('id', proposed)
        .maybeSingle()
      if (probeError) {
        console.error('[ai-chat] proposed session probe failed', {
          userId: ctx.userId,
          code: probeError.code,
        })
        return flatError('internal_error', 'Failed to check proposed session', 500)
      }
      proposedTaken = !!existing
    }
    const insertPayload: { user_id: string; title: null; id?: string } =
      { user_id: ctx.userId, title: null }
    if (proposed && !proposedTaken) insertPayload.id = proposed
    const { data: created, error: createError } = await ctx.serviceClient
      .from('ai_sessions')
      .insert(insertPayload)
      .select('id')
      .single()

    if (createError || !created) {
      console.error('[ai-chat] session insert failed', {
        userId: ctx.userId,
        code: createError?.code,
      })
      return flatError('internal_error', 'Failed to create session', 500)
    }
    sessionId = created.id
    newlyCreatedSession = true
  } else {
    const { data: existing, error: lookupError } = await ctx.serviceClient
      .from('ai_sessions')
      .select('id')
      .eq('id', body.session_id)
      .eq('user_id', ctx.userId)
      .maybeSingle()

    if (lookupError) {
      console.error('[ai-chat] session lookup failed', {
        userId: ctx.userId,
        code: lookupError.code,
      })
      return flatError('internal_error', 'Failed to load session', 500)
    }
    if (!existing) {
      return flatError('session_not_found', 'Session not found', 404)
    }
    sessionId = existing.id
  }

  // ---- Resolve the parent of the new user row ----
  // Two modes:
  //   - Edit: insert as a sibling of the target user message, so they share
  //     a parent and become switchable branches in the UI.
  //   - Regular send: chain off the active leaf supplied by the client.
  // First message in a new session: parent stays null.
  const editMessageId = typeof body.edit_message_id === 'string' && body.edit_message_id.length > 0
    ? body.edit_message_id
    : null
  const clientParentId = typeof body.parent_message_id === 'string' && body.parent_message_id.length > 0
    ? body.parent_message_id
    : null

  let newParentId: string | null = null

  if (editMessageId) {
    if (newlyCreatedSession) {
      return flatError(
        'invalid_request',
        'Cannot edit a message in a brand-new conversation.',
        400,
      )
    }

    const { data: target, error: targetError } = await ctx.serviceClient
      .from('ai_messages')
      .select('id, role, parent_id')
      .eq('id', editMessageId)
      .eq('session_id', sessionId)
      .maybeSingle()

    if (targetError) {
      console.error('[ai-chat] edit target lookup failed', {
        userId: ctx.userId,
        sessionId,
        code: targetError.code,
      })
      return flatError('internal_error', 'Failed to look up message to edit.', 500)
    }
    if (!target) {
      return flatError('not_found', 'Message not found.', 404)
    }
    if (target.role !== 'user') {
      return flatError('invalid_request', 'Only user messages can be edited.', 400)
    }
    newParentId = target.parent_id
  } else if (clientParentId && !newlyCreatedSession) {
    // Validate the client-supplied parent belongs to this session.
    const { data: parent, error: parentError } = await ctx.serviceClient
      .from('ai_messages')
      .select('id')
      .eq('id', clientParentId)
      .eq('session_id', sessionId)
      .maybeSingle()

    if (parentError) {
      console.error('[ai-chat] parent lookup failed', {
        userId: ctx.userId,
        sessionId,
        code: parentError.code,
      })
      return flatError('internal_error', 'Failed to look up parent message.', 500)
    }
    if (!parent) {
      return flatError('not_found', 'Parent message not found.', 404)
    }
    newParentId = parent.id
  }

  // ---- Load history along the active branch ----
  // The model needs the ancestor chain root → newParentId so the new turn
  // is contextualised by the correct branch. For a brand-new conversation
  // (newParentId === null), this is empty.
  const messages: InMemoryMessage[] = []
  if (newParentId !== null) {
    const { data: sessionRows, error: historyError } = await ctx.serviceClient
      .from('ai_messages')
      .select('id, role, content, parent_id')
      .eq('session_id', sessionId)

    if (historyError) {
      console.error('[ai-chat] history load failed', {
        userId: ctx.userId,
        sessionId,
        code: historyError.code,
      })
      return flatError('internal_error', 'Failed to load history', 500)
    }

    const byId = new Map<string, { id: string; role: string; content: Json; parent_id: string | null }>()
    for (const r of sessionRows ?? []) {
      byId.set(r.id, r as { id: string; role: string; content: Json; parent_id: string | null })
    }

    // Walk parents from newParentId to root; collect into chain.
    const chain: ChainMessage[] = []
    let cursor: string | null = newParentId
    const seen = new Set<string>()
    while (cursor) {
      if (seen.has(cursor)) {
        console.error('[ai-chat] cycle detected in parent chain', {
          userId: ctx.userId,
          sessionId,
          cursor,
        })
        return flatError('internal_error', 'Conversation tree is corrupted.', 500)
      }
      seen.add(cursor)
      const row = byId.get(cursor)
      if (!row) break
      chain.unshift({
        id: row.id,
        role: row.role as 'user' | 'assistant',
        content: Array.isArray(row.content) ? row.content as unknown as ContentBlock[] : [],
      })
      cursor = row.parent_id
    }

    // ---- Context-window management ----
    // A long-lived thread would otherwise replay its entire history on every
    // turn and eventually exceed the model's context window. Older turns are
    // folded into a running summary (built by the post-turn compaction step
    // and stored on ai_sessions); here we apply whatever summary already
    // exists, enforce a hard backstop, and strip stale attachments. See
    // _shared/context-window.ts.
    const { data: sessionMeta } = await ctx.serviceClient
      .from('ai_sessions')
      .select('context_summary, summary_through_message_id')
      .eq('id', sessionId)
      .maybeSingle()

    const { keptChain, summaryText } = selectKeptChain(
      chain,
      sessionMeta?.context_summary ?? null,
      sessionMeta?.summary_through_message_id ?? null,
    )
    for (const m of enforceHardCeiling(keptChain)) {
      messages.push({ role: m.role, content: m.content })
    }
    // Drop image/PDF bytes from all but the most recent few history messages
    // — they are the single biggest context cost and rarely relevant once
    // the conversation has moved on. Runs before the new user turn is
    // appended below, so the current message's attachments are kept.
    stripOldAttachments(messages, ATTACHMENT_KEEP_RECENT)
    // Fold the running summary into the oldest surviving message as plain
    // context (in-memory only — the persisted rows are never rewritten).
    if (summaryText && messages.length > 0) {
      injectSummaryBanner(messages[0], summaryText)
    }
  }

  // ---- Build the multimodal user-turn content ----
  // Image/PDF bytes come from the bucket (service role; the prefix check in
  // validateAttachments is what keeps cross-user paths out). The full block
  // array — including base64 image/document blocks — is what gets persisted
  // as ai_messages.content, so history reload replays the exact same input
  // to Anthropic without re-downloading from storage.
  let userContent: AnthropicBlock[]
  try {
    userContent = attachments.length > 0
      ? await buildUserContentBlocks(userMessage, attachments, ctx.serviceClient)
      : [{ type: 'text', text: userMessage }]
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[ai-chat] attachment processing failed', {
      userId: ctx.userId,
      sessionId,
      err: errMsg,
    })
    return flatError(
      'attachment_processing_failed',
      'Greška pri obradi priloga.',
      500,
    )
  }

  // ---- Persist + append the user turn ----
  const { data: userInsertRow, error: userInsertError } = await ctx.serviceClient
    .from('ai_messages')
    .insert({
      session_id: sessionId,
      role: 'user',
      content: userContent as unknown as Json,
      parent_id: newParentId,
    })
    .select('id')
    .single()

  if (userInsertError || !userInsertRow) {
    console.error('[ai-chat] user message insert failed', {
      userId: ctx.userId,
      sessionId,
      code: userInsertError?.code,
    })
    return flatError('internal_error', 'Failed to persist user message', 500)
  }
  messages.push({ role: 'user', content: userContent })

  // ---- Persist attachment side-table rows ----
  // The user row is the authoritative replay record; this side-table feeds
  // chip/thumbnail rendering. If this insert fails we roll back the user
  // row (best-effort) so the UI doesn't get a half-linked message.
  if (attachments.length > 0) {
    const attachmentRows = attachments.map((att) => ({
      message_id: userInsertRow.id,
      storage_path: att.storage_path,
      file_name: att.file_name,
      file_size: att.file_size,
      mime_type: att.mime_type,
      kind: att.kind,
      extracted_text: att.kind === 'text' ? att.extracted_text ?? null : null,
    }))
    const { error: attachInsertError } = await ctx.serviceClient
      .from('ai_message_attachments')
      .insert(attachmentRows)
    if (attachInsertError) {
      console.error('[ai-chat] attachment insert failed; rolling back user row', {
        userId: ctx.userId,
        sessionId,
        messageId: userInsertRow.id,
        code: attachInsertError.code,
      })
      // Best-effort cleanup. Failures here are logged-only — the user
      // row delete will cascade-clean any partially-inserted attachment
      // rows via the FK, and the storage objects are best-effort
      // removed too so a retry can reuse the same paths.
      await ctx.serviceClient
        .from('ai_messages')
        .delete()
        .eq('id', userInsertRow.id)
      await ctx.serviceClient
        .storage
        .from('ai-chat-attachments')
        .remove(attachments.map((a) => a.storage_path))
        .catch(() => undefined)
      return flatError('internal_error', 'Failed to persist attachments', 500)
    }
  }

  // ---- Resolve the route context ----
  // Sanitize the client-supplied path and try to match a known route pattern.
  // Unknown / malformed values silently drop to no-context — we never want a
  // garbage path interpolated into the prompt.
  const sanitizedRoute = sanitizeRoute(body.current_route ?? null)
  const routeDesc = sanitizedRoute ? describeRoute(sanitizedRoute) : null
  const helpSearch: HelpSearchContext = {
    currentRoutePattern: routeDesc?.pattern ?? null,
    currentRouteRaw: sanitizedRoute,
  }
  const routeLabel = routeDesc?.label ?? null

  return {
    sessionId,
    newlyCreatedSession,
    messages,
    userMessage,
    lastInsertedId: userInsertRow.id,
    helpSearch,
    routeLabel,
  }
}

// ---------------------------------------------------------------------------
// The chat turn: the shared loop (_shared/orchestrator.ts) with chat's
// settings, the SSE sink, rows inserted as they are produced, the DB-backed
// stop button, and the title backfill once a new conversation is answered.
// ---------------------------------------------------------------------------

function chatLoopConfig(ctx: AuthContext): LoopConfig {
  // The system prompt is split into two blocks. The first is the static
  // instruction body — byte-identical for every user — and carries the cache
  // breakpoint, so the tool schemas + static system text become a cacheable
  // prefix shared across users of the same role (tools are role-filtered, so
  // role is the caching granularity). The second block is the small per-user
  // context (identity, role, role/email-specific notes); it sits after the
  // breakpoint and is not itself a cross-user cache prefix. The
  // conversation-array breakpoint is slid forward each iteration by
  // applyMessageCacheBreakpoint.
  const system = [
    {
      type: 'text',
      text: buildStaticSystemPrompt(),
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: buildUserContext(ctx),
    },
  ]
  const tools: Array<Record<string, unknown>> = selectAvailableTools(ctx).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }))
  if (tools.length > 0) {
    tools[tools.length - 1].cache_control = { type: 'ephemeral' }
  }
  return {
    channel: 'chat',
    model: Deno.env.get('AI_CHAT_MODEL') ?? 'claude-sonnet-4-6',
    // Headroom for create_document, whose tool-call payload carries an
    // entire authored document. Too low and the model truncates mid
    // tool-call (stop_reason 'max_tokens'); the loop's truncation guard
    // turns any leftover truncation into a clean error instead of a stuck
    // client-side spinner.
    maxTokens: 8192,
    maxIterations: 10,
    toolTimeoutMs: 15000,
    system,
    tools,
    logTag: '[ai-chat]',
  }
}

function dbMessageStore(ctx: AuthContext, sessionId: string): MessageStore {
  return {
    async insert(row) {
      const { data, error } = await ctx.serviceClient
        .from('ai_messages')
        .insert({ session_id: sessionId, ...row })
        .select('id')
        .single()
      return { id: data?.id ?? null, code: error?.code }
    },
  }
}

async function runChatTurn(
  ctx: AuthContext,
  sse: SSEWriter,
  prep: ChatStreamPrep,
  signal: AbortSignal,
  onDbCancel: () => void,
): Promise<void> {
  const { sessionId, newlyCreatedSession, messages, userMessage } = prep

  // Prepend a "[Kontekst: ...]" line to the LAST message in the in-memory
  // array (which is always the just-persisted user turn). This is deliberately
  // done in-memory only — the ai_messages row already stored the user's raw
  // text in handleChat. Replaying the augmented message into the persisted
  // history would leak a stale route into every follow-up turn.
  //
  // With attachments, the user content can be a mixed array: image and
  // document blocks precede the trailing text block. We mutate just the
  // text block (by type, not by index) so the route context is prepended
  // to the typed message without clobbering image/document blocks.
  if (prep.routeLabel && messages.length > 0) {
    const last = messages[messages.length - 1]
    if (last.role === 'user' && Array.isArray(last.content)) {
      const blocks = last.content as AnthropicBlock[]
      const textIdx = blocks.findIndex((b) => b.type === 'text')
      if (textIdx !== -1) {
        const contextLine =
          `[Kontekst: korisnik je trenutno na ${prep.helpSearch.currentRoutePattern} — ${prep.routeLabel}]`
        const original = (blocks[textIdx] as TextBlock).text
        const augmented = blocks.slice()
        augmented[textIdx] = { type: 'text', text: `${contextLine}\n\n${original}` }
        messages[messages.length - 1] = { role: 'user', content: augmented }
      }
    }
  }

  // Loop start instant. Cancel beacons (ai_sessions.cancel_requested_at) only
  // count if their timestamp is strictly greater than this — that way a stop
  // from a previous turn that's still sitting in the column doesn't kill a
  // fresh turn on the same session.
  const requestStartedAt = new Date().toISOString()

  const hooks: LoopHooks = {
    // Poll the DB-backed cancel beacon. Returns true iff the user pressed stop
    // since this loop started (or the per-request controller already aborted,
    // in which case the signal-based path is doing its job and we exit anyway).
    // On query error we fail open — Supabase hiccups should not lock the user
    // into an unstoppable loop, but they also should not surface a fake cancel.
    async isCancelled() {
      if (signal.aborted) return true
      const { data, error } = await ctx.serviceClient
        .from('ai_sessions')
        .select('cancel_requested_at')
        .eq('id', sessionId)
        .eq('user_id', ctx.userId)
        .maybeSingle()
      if (error) {
        console.error('[ai-chat] cancel beacon read failed', {
          userId: ctx.userId,
          sessionId,
          code: error.code,
        })
        return false
      }
      const beacon = data?.cancel_requested_at
      if (!beacon) return false
      if (beacon > requestStartedAt) {
        console.log('[ai-chat] cancel beacon trip', {
          userId: ctx.userId,
          sessionId,
          beacon,
          requestStartedAt,
        })
        onDbCancel()
        return true
      }
      return false
    },
    async onComplete() {
      await backfillTitleIfNew(ctx, sessionId, userMessage, newlyCreatedSession)
    },
  }

  const extras: ToolHandlerExtras = { helpSearch: prep.helpSearch }
  await runOrchestrationLoop(
    ctx,
    chatLoopConfig(ctx),
    { sessionId, messages, lastInsertedId: prep.lastInsertedId, extras },
    new SseEventSink(sse),
    dbMessageStore(ctx, sessionId),
    hooks,
    signal,
  )
}

// ---------------------------------------------------------------------------
// Stream response builder — flushes `: ready`, emits the session event, and
// runs the orchestration loop under a single AbortController that is tripped
// by either (a) client disconnect via `req.signal` or (b) the 90s request
// timeout. The cause is tracked in `abortReason` so the post-loop branch
// can emit the right event (or no event, for client disconnect).
// ---------------------------------------------------------------------------

function streamChatResponse(
  ctx: AuthContext,
  prep: ChatStreamPrep,
  reqSignal: AbortSignal,
): Response {
  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()

  // One controller per request. The SDK call, the iteration-boundary checks,
  // and the post-tool-dispatch checks all read its signal.
  const controller = new AbortController()
  // Set on first abort source to fire. Read by the post-loop branch.
  let abortReason: 'client_disconnect' | 'request_timeout' | null = null

  const onClientDisconnect = (source: string): void => {
    if (abortReason !== null) return
    abortReason = 'client_disconnect'
    console.log('[ai-chat] client disconnect detected', {
      userId: ctx.userId,
      sessionId: prep.sessionId,
      source,
    })
    controller.abort()
  }

  // Primary detection: Deno's req.signal aborts on client TCP disconnect.
  if (reqSignal.aborted) {
    onClientDisconnect('req.signal.already_aborted')
  } else {
    reqSignal.addEventListener('abort', () => onClientDisconnect('req.signal'), { once: true })
  }

  // Secondary detection: when Deno's HTTP layer cancels the readable side of
  // our response (because the client closed the TCP connection), the writable
  // side enters the errored state and writer.closed rejects.
  writer.closed.catch(() => onClientDisconnect('writer.closed'))

  // Tertiary detection (most reliable in Supabase's Edge runtime): the SSE
  // writer notifies us when any write — including the 15s heartbeat probe —
  // throws because the socket is dead. This catches cases where neither
  // req.signal nor writer.closed surfaces the disconnect.
  const sse = new SSEWriter(writer, () => onClientDisconnect('sse.write_failed'))

  ;(async () => {
    let timeoutHandle: number | undefined
    try {
      // Flush headers + signal liveness to any proxy. Must precede real work.
      await sse.writeComment('ready')

      // Always emit session first so the frontend learns the id immediately.
      await sse.writeEvent('session', {
        type: 'session',
        session_id: prep.sessionId,
      })

      timeoutHandle = setTimeout(() => {
        if (abortReason !== null) return
        abortReason = 'request_timeout'
        controller.abort()
      }, REQUEST_TIMEOUT_MS)

      await runChatTurn(
        ctx,
        sse,
        prep,
        controller.signal,
        () => onClientDisconnect('db_cancel_beacon'),
      )

      if (abortReason === 'request_timeout') {
        console.error('[ai-chat] request timeout', {
          userId: ctx.userId,
          sessionId: prep.sessionId,
        })
        await sse.writeEvent('error', {
          type: 'error',
          code: 'request_timeout',
          message: 'Zahtjev je trajao predugo. Pokušajte ponovno.',
        })
      } else if (abortReason === 'client_disconnect') {
        // Silent on the wire — the reader is gone. (Detection log already
        // emitted by onClientDisconnect with the triggering source.)
      }

      // The turn finished cleanly. Off the user's critical path — they
      // already have their answer — fold older turns into the running
      // summary so the next turn starts from a compact base. This holds the
      // SSE connection open a few extra seconds; the heartbeat covers it.
      // maybeCompactSession never throws, so it cannot trip the catch below.
      if (abortReason === null) {
        await maybeCompactSession(ctx, prep.sessionId)
      }
    } catch (err) {
      // Anything that throws past the loop's own catch is either an abort
      // that escaped (silent) or a genuine bug (emit + log loudly).
      if (controller.signal.aborted) {
        console.log('[ai-chat] stream aborted', {
          userId: ctx.userId,
          sessionId: prep.sessionId,
          reason: abortReason ?? 'unknown_abort',
        })
      } else {
        console.error('[ai-chat] stream worker error', {
          userId: ctx.userId,
          sessionId: prep.sessionId,
          reason: err instanceof Error ? err.message : String(err),
        })
        await sse.writeEvent('error', {
          type: 'error',
          code: 'internal_error',
          message: 'Interna greška u toku.',
        })
      }
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle)
        timeoutHandle = undefined
      }
      // The reqSignal listener is `{ once: true }` and reqSignal is request-
      // scoped — no manual remove is needed (or possible: it was registered
      // via an arrow wrapper so the original reference isn't kept).
      await sse.close()
    }
  })()

  return new Response(stream.readable, {
    status: 200,
    headers: {
      ...corsHeaders,
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      'connection': 'keep-alive',
    },
  })
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // Diagnostic: unconditional request-entry log. Confirms which build of the
  // function is live. If you don't see this line in `supabase functions logs`
  // for every request, the deploy didn't actually replace the running version.
  console.log('[ai-chat] request', {
    method: req.method,
    build: 'cancel-support-v2',
  })

  const preflight = handlePreflight(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return flatError('method_not_allowed', 'Only POST is supported', 405)
  }

  try {
    const auth = await authenticate(req)
    if ('error' in auth) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: jsonHeaders,
      })
    }

    let body: (ChatRequestBody & DebugRequestBody) | null = null
    try {
      body = await req.json() as (ChatRequestBody & DebugRequestBody) | null
    } catch {
      // If the request actually carried a body but it wasn't valid JSON, fail
      // explicitly with a clear bad_request. Empty / missing body still flows
      // through and surfaces as 'message is required' in handleChat.
      const contentLength = req.headers.get('content-length')
      if (contentLength && contentLength !== '0') {
        return flatError('bad_request', 'Request body must be valid JSON.', 400)
      }
      body = null
    }

    // ---- DEBUG branch (Director-only single-tool invocation) ----
    if (body && typeof body.debug_tool === 'string') {
      // Outer fence: env-var gate. Read per-request (not at module scope) so
      // toggling the secret takes effect without a redeploy. Strict equality
      // on the literal string 'true' — anything else (missing, '1', 'yes',
      // 'TRUE') counts as disabled. Return 404 so the debug surface looks
      // as if it doesn't exist; a 403 would confirm the path to a probe.
      const debugEnabled = Deno.env.get('AI_CHAT_DEBUG_ENABLED') === 'true'
      if (!debugEnabled) {
        console.warn('[ai-chat:debug] gated off (AI_CHAT_DEBUG_ENABLED not set to true)', {
          userId: auth.userId,
        })
        return flatError('not_found', 'Not found', 404)
      }
      if (auth.role !== 'Director') {
        console.warn('[ai-chat:debug] forbidden', { userId: auth.userId, role: auth.role })
        return flatError('debug_forbidden', 'Debug endpoint requires Director role', 403)
      }

      const toolName = body.debug_tool
      // Pre-flight 404 for unknown tool names so the response is 404 rather
      // than a 500 from dispatchTool's throw.
      if (!TOOLS.find((t) => t.name === toolName)) {
        return flatError('tool_not_found', `Tool "${toolName}" not found`, 404)
      }

      console.log('[ai-chat:debug] invoking tool', { userId: auth.userId, tool: toolName })

      try {
        const toolInput = (body.input ?? {}) as Record<string, unknown>
        // The debug branch has no route context — pass a null pair so
        // search_help still works (without route boost / telemetry).
        const debugExtras: ToolHandlerExtras = {
          helpSearch: { currentRoutePattern: null, currentRouteRaw: null },
        }
        const output = await dispatchTool(toolName, toolInput, auth, debugExtras)
        return new Response(
          JSON.stringify({ ok: true, debug: { tool: toolName, output } }),
          { status: 200, headers: jsonHeaders },
        )
      } catch (toolErr) {
        const message = toolErr instanceof Error ? toolErr.message : String(toolErr)
        console.error('[ai-chat:debug] tool handler error', {
          userId: auth.userId,
          tool: toolName,
          reason: message,
        })
        return flatError('tool_error', message, 500)
      }
    }

    // ---- Chat branch ----
    // Pre-stream phase runs synchronously up to user-message persistence; on
    // any failure it returns a flat 4xx/5xx. On success it returns a prep
    // object and we hand off to streamChatResponse, which returns immediately
    // with an SSE Response whose body is fed by a background worker.
    const chatResult = await handleChat(auth, body ?? {})
    if (chatResult instanceof Response) {
      return chatResult
    }
    return streamChatResponse(auth, chatResult, req.signal)
  } catch (err) {
    console.error('[ai-chat] unhandled error', {
      reason: err instanceof Error ? err.message : String(err),
    })
    return flatError('internal_error', 'Internal server error', 500)
  }
})
