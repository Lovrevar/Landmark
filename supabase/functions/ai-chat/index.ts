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
// Persistence remains incremental and runs to completion regardless of the
// client's connection state. Session and message ownership is enforced in
// this layer with explicit user_id / session_id filters on the service
// client; tool handlers still use the JWT-scoped userClient internally.

// TODO: pin @anthropic-ai/sdk version before prod deploy
import Anthropic from 'npm:@anthropic-ai/sdk'

import { corsHeaders, handlePreflight } from '../_shared/cors.ts'
import { authenticate, type AuthContext } from '../_shared/auth.ts'
import { selectAvailableTools, TOOLS } from '../_shared/tools.ts'
import { buildSystemPrompt } from '../_shared/prompts.ts'
import { checkRateLimit } from '../_shared/rateLimit.ts'
import type { Json } from '../_shared/database.ts'

const jsonHeaders = { ...corsHeaders, 'content-type': 'application/json' }

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

// Hard cap on a single chat stream. Surfaces as a mid-stream `error` event
// with code 'request_timeout' — the connection has already been upgraded to
// 200/text-event-stream by the time we time out, so 5xx is no longer
// available. The in-flight loop keeps running after the timeout fires until
// Supabase's invocation cap kills it.
const REQUEST_TIMEOUT_MS = 90_000

// Hard cap on a user-supplied message string. Counts JS string length, not
// UTF-8 bytes — this is a runaway-prompt guard, not a payload-size guard.
const MAX_MESSAGE_LENGTH = 4000

// SSE keepalive cadence. Proxies and browsers close idle TCP connections
// after ~30–60s; a single slow tool roundtrip easily exceeds that, so we
// emit `: keepalive` comments while the loop is between real events. Resets
// on every real write.
const HEARTBEAT_INTERVAL_MS = 15_000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Event =
  | { type: 'session'; session_id: string }
  | { type: 'turn'; role: 'assistant'; text: string }
  | { type: 'tool_call'; tool: string; input: unknown; tool_use_id: string }
  | { type: 'tool_result'; tool: string; output: unknown; tool_use_id: string; is_error: boolean }
  | { type: 'done'; stop_reason: string; usage: { input_tokens: number; output_tokens: number } }
  | { type: 'error'; code: string; message: string }

// Loose mirror of Anthropic's content-block shapes. Defined locally so we
// don't depend on internal SDK type paths that can shift between versions.
interface TextBlock { type: 'text'; text: string }
interface ToolUseBlock { type: 'tool_use'; id: string; name: string; input: unknown }
type AnthropicBlock =
  | TextBlock
  | ToolUseBlock
  | { type: string; [k: string]: unknown }

interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error: boolean
}

interface InMemoryMessage {
  role: 'user' | 'assistant'
  content: unknown
}

interface ChatRequestBody {
  session_id?: string | null
  message?: string
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
}

// ---------------------------------------------------------------------------
// SSE writer: SSE framing + idle-heartbeat in one helper. Owns a single
// heartbeat timer that fires every HEARTBEAT_INTERVAL_MS unless a real write
// (event or comment) resets it. close() is idempotent — safe to call from a
// finally block even if an earlier write already closed the underlying writer.
// ---------------------------------------------------------------------------

class SSEWriter {
  private readonly writer: WritableStreamDefaultWriter<Uint8Array>
  private readonly encoder = new TextEncoder()
  private heartbeatTimer: number | undefined
  private closed = false

  constructor(writer: WritableStreamDefaultWriter<Uint8Array>) {
    this.writer = writer
    this.scheduleHeartbeat()
  }

  private scheduleHeartbeat(): void {
    if (this.closed) return
    if (this.heartbeatTimer !== undefined) {
      clearTimeout(this.heartbeatTimer)
    }
    this.heartbeatTimer = setTimeout(() => {
      if (this.closed) return
      // Fire-and-forget — if the writer was closed mid-flight we swallow.
      this.writer.write(this.encoder.encode(': keepalive\n\n')).catch(() => {})
      this.scheduleHeartbeat()
    }, HEARTBEAT_INTERVAL_MS)
  }

  async writeEvent<E extends Event>(name: E['type'], data: E): Promise<void> {
    if (this.closed) return
    try {
      await this.writer.write(
        this.encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`),
      )
      this.scheduleHeartbeat()
    } catch {
      // Client disconnected or writer already closed — silently absorb.
    }
  }

  async writeComment(text: string): Promise<void> {
    if (this.closed) return
    try {
      await this.writer.write(this.encoder.encode(`: ${text}\n\n`))
      this.scheduleHeartbeat()
    } catch {
      // ignore
    }
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    if (this.heartbeatTimer !== undefined) {
      clearTimeout(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
    try {
      await this.writer.close()
    } catch {
      // already closed
    }
  }
}

// ---------------------------------------------------------------------------
// Tool dispatch — used by BOTH the debug branch and the orchestration loop.
// ---------------------------------------------------------------------------

async function dispatchTool(
  name: string,
  input: unknown,
  ctx: AuthContext,
): Promise<unknown> {
  const tool = TOOLS.find((t) => t.name === name)
  if (!tool) throw new Error(`unknown tool: ${name}`)
  return await tool.handler(input as Record<string, unknown>, ctx)
}

// Race the tool handler against a 15s timeout and normalise failure modes
// into a single envelope shape. Handlers also signal failure via a returned
// { error: '...' } object without throwing — we treat that as is_error too.
async function dispatchToolWithTimeout(
  name: string,
  input: unknown,
  ctx: AuthContext,
): Promise<{ output: unknown; isError: boolean }> {
  try {
    const output = await Promise.race([
      dispatchTool(name, input, ctx),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('tool_timeout')), 15000),
      ),
    ])
    // Intentional: domain 'not found' surfaces as is_error to the model in v1; revisit if it causes retry loops.
    const isErrorEnvelope =
      output !== null &&
      typeof output === 'object' &&
      'error' in (output as Record<string, unknown>)
    return { output, isError: isErrorEnvelope }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { output: { error: `tool execution failed: ${message}` }, isError: true }
  }
}

// Map an Anthropic SDK error to a user-facing event code + Croatian message,
// plus a flag telling the caller whether to log loudly. `shouldLog: true`
// covers (a) our-fault errors (bad request shape, bad API key) and (b) the
// unknown-error fall-through so we never silently swallow a class we haven't
// mapped yet. Rate-limit / timeout / unreachable are expected operational
// states and don't pollute the log.
//
// APIConnectionTimeoutError must be checked before APIConnectionError —
// it's a subclass.
function mapAnthropicError(err: unknown): { code: string; message: string; shouldLog: boolean } {
  if (err instanceof Anthropic.RateLimitError) {
    return {
      code: 'model_rate_limited',
      message: 'Model je trenutno preopterećen. Pokušajte ponovno za nekoliko trenutaka.',
      shouldLog: false,
    }
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return {
      code: 'model_timeout',
      message: 'Model nije odgovorio na vrijeme. Pokušajte ponovno.',
      shouldLog: false,
    }
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return {
      code: 'model_unreachable',
      message: 'Greška u komunikaciji s modelom. Pokušajte ponovno.',
      shouldLog: false,
    }
  }
  if (err instanceof Anthropic.BadRequestError) {
    return {
      code: 'model_bad_request',
      message: 'Interna greška pri pripremi upita. Prijavite ovo administratoru.',
      shouldLog: true,
    }
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return {
      code: 'model_auth_failed',
      message: 'Greška u autentikaciji s modelom. Prijavite ovo administratoru.',
      shouldLog: true,
    }
  }
  return {
    code: 'model_error',
    message: 'Greška pri pozivu modela. Pokušajte ponovno.',
    shouldLog: true,
  }
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
    const { data: created, error: createError } = await ctx.serviceClient
      .from('ai_sessions')
      .insert({ user_id: ctx.userId, title: null })
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

  // ---- Load history ----
  const { data: historyRows, error: historyError } = await ctx.serviceClient
    .from('ai_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (historyError) {
    console.error('[ai-chat] history load failed', {
      userId: ctx.userId,
      sessionId,
      code: historyError.code,
    })
    return flatError('internal_error', 'Failed to load history', 500)
  }

  const messages: InMemoryMessage[] = (historyRows ?? []).map((r) => ({
    role: r.role as 'user' | 'assistant',
    content: r.content,
  }))

  // ---- Persist + append the user turn ----
  const userContent: TextBlock[] = [{ type: 'text', text: userMessage }]
  const { error: userInsertError } = await ctx.serviceClient
    .from('ai_messages')
    .insert({
      session_id: sessionId,
      role: 'user',
      content: userContent as unknown as Json,
    })

  if (userInsertError) {
    console.error('[ai-chat] user message insert failed', {
      userId: ctx.userId,
      sessionId,
      code: userInsertError.code,
    })
    return flatError('internal_error', 'Failed to persist user message', 500)
  }
  messages.push({ role: 'user', content: userContent })

  return { sessionId, newlyCreatedSession, messages, userMessage }
}

// ---------------------------------------------------------------------------
// Orchestration loop — writes events to the SSE writer as they happen.
// Persistence order:
//   1. anthropic.messages.create
//   2. persist assistant row (the durable record comes before the wire frame)
//   3. emit text -> turn / tool_use -> tool_call events in content-block order
//   4. if tool_use: dispatch handlers, emit tool_result events, then persist
//      the user-role tool_result row
//   5. otherwise emit done, backfill title if newly-created, return
// ---------------------------------------------------------------------------

async function runOrchestrationLoop(
  ctx: AuthContext,
  sse: SSEWriter,
  prep: ChatStreamPrep,
): Promise<void> {
  const { sessionId, newlyCreatedSession, messages, userMessage } = prep
  const model = Deno.env.get('AI_CHAT_MODEL') ?? 'claude-sonnet-4-6'
  const system = buildSystemPrompt(ctx)
  const availableTools = selectAvailableTools(ctx).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }))

  const MAX_ITERATIONS = 10
  let lastUsage = { input_tokens: 0, output_tokens: 0 }

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let response: Awaited<ReturnType<typeof anthropic.messages.create>>
    try {
      response = await anthropic.messages.create({
        model,
        // Tunable — Sonnet 4.x supports up to 8192 default; raise if real conversations get truncated.
        max_tokens: 4096,
        system,
        tools: availableTools as unknown as Parameters<typeof anthropic.messages.create>[0]['tools'],
        messages: messages as unknown as Parameters<typeof anthropic.messages.create>[0]['messages'],
      })
    } catch (err) {
      const mapped = mapAnthropicError(err)
      if (mapped.shouldLog) {
        const errorClass = err instanceof Error ? err.constructor.name : typeof err
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error('[ai-chat] anthropic call failed', {
          userId: ctx.userId,
          sessionId,
          iteration,
          errorClass,
          // Truncate to keep accidental content out of logs. No request body,
          // no system prompt, no message content is logged anywhere on this path.
          errorMessage: errorMessage.slice(0, 200),
        })
      }
      await sse.writeEvent('error', {
        type: 'error',
        code: mapped.code,
        message: mapped.message,
      })
      return
    }

    lastUsage = {
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
    }

    // Persist assistant row BEFORE emitting any of its events. The DB row is
    // the durable contract; the wire is a projection of it.
    const { error: assistantInsertError } = await ctx.serviceClient
      .from('ai_messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content: response.content as unknown as Json,
        model: response.model ?? model,
        input_tokens: response.usage?.input_tokens ?? null,
        output_tokens: response.usage?.output_tokens ?? null,
        stop_reason: response.stop_reason ?? null,
      })

    if (assistantInsertError) {
      console.error('[ai-chat] assistant message insert failed', {
        userId: ctx.userId,
        sessionId,
        iteration,
        code: assistantInsertError.code,
      })
      await sse.writeEvent('error', {
        type: 'error',
        code: 'persistence_error',
        message: 'Greška pri spremanju odgovora.',
      })
      return
    }

    messages.push({ role: 'assistant', content: response.content })

    // Emit events in content-block order: text -> turn, tool_use -> tool_call.
    const toolUses: ToolUseBlock[] = []
    for (const block of response.content as AnthropicBlock[]) {
      if (block.type === 'text') {
        await sse.writeEvent('turn', {
          type: 'turn',
          role: 'assistant',
          text: (block as TextBlock).text,
        })
      } else if (block.type === 'tool_use') {
        const t = block as ToolUseBlock
        toolUses.push(t)
        await sse.writeEvent('tool_call', {
          type: 'tool_call',
          tool: t.name,
          input: t.input,
          tool_use_id: t.id,
        })
      }
      // Unknown block types (e.g. thinking) are silently skipped — they are
      // still persisted in the assistant row above for fidelity.
    }

    const stopReason = response.stop_reason ?? 'end_turn'

    // Defensive guard: if the SDK reports stop_reason='tool_use' but no
    // tool_use blocks were emitted in this turn, there's nothing to dispatch.
    // Treat as terminal so we don't persist an empty tool_result row or
    // re-loop into the model with no new information.
    if (stopReason === 'tool_use' && toolUses.length === 0) {
      await sse.writeEvent('done', {
        type: 'done',
        stop_reason: stopReason,
        usage: lastUsage,
      })
      await backfillTitleIfNew(ctx, sessionId, userMessage, newlyCreatedSession)
      return
    }

    if (stopReason === 'tool_use') {
      // Run handlers sequentially in tool_call order. Emit each tool_result
      // event as soon as the handler returns; the persisted tool_result row
      // is built up alongside and inserted after the last handler completes.
      const toolResultBlocks: ToolResultBlock[] = []

      for (const tu of toolUses) {
        const { output, isError } = await dispatchToolWithTimeout(tu.name, tu.input, ctx)
        await sse.writeEvent('tool_result', {
          type: 'tool_result',
          tool: tu.name,
          output,
          tool_use_id: tu.id,
          is_error: isError,
        })
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          // Anthropic's API requires `content` to be a string here.
          content: JSON.stringify(output),
          is_error: isError,
        })
      }

      const { error: toolResultInsertError } = await ctx.serviceClient
        .from('ai_messages')
        .insert({
          session_id: sessionId,
          role: 'user',
          content: toolResultBlocks as unknown as Json,
        })

      if (toolResultInsertError) {
        console.error('[ai-chat] tool_result insert failed', {
          userId: ctx.userId,
          sessionId,
          iteration,
          code: toolResultInsertError.code,
        })
        await sse.writeEvent('error', {
          type: 'error',
          code: 'persistence_error',
          message: 'Greška pri spremanju rezultata alata.',
        })
        return
      }

      messages.push({ role: 'user', content: toolResultBlocks })
      continue
    }

    // Terminal stop_reason (end_turn, max_tokens, stop_sequence, or anything
    // else surfaced by the SDK). Emit done with the raw value — don't normalise.
    await sse.writeEvent('done', {
      type: 'done',
      stop_reason: stopReason,
      usage: lastUsage,
    })
    await backfillTitleIfNew(ctx, sessionId, userMessage, newlyCreatedSession)
    return
  }

  // ---- 10-iteration cap reached without a terminal stop_reason ----
  console.error('[ai-chat] tool iteration limit reached', {
    userId: ctx.userId,
    sessionId,
  })

  const limitMessage = 'Dostignut je limit poziva alata. Pokušajte preformulirati pitanje.'
  const limitContent: TextBlock[] = [{ type: 'text', text: limitMessage }]
  const { error: limitInsertError } = await ctx.serviceClient
    .from('ai_messages')
    .insert({
      session_id: sessionId,
      role: 'assistant',
      content: limitContent as unknown as Json,
      model,
      input_tokens: lastUsage.input_tokens,
      output_tokens: lastUsage.output_tokens,
      stop_reason: 'tool_limit_reached',
    })
  if (limitInsertError) {
    console.error('[ai-chat] limit message insert failed', {
      userId: ctx.userId,
      sessionId,
      code: limitInsertError.code,
    })
  }

  await sse.writeEvent('turn', {
    type: 'turn',
    role: 'assistant',
    text: limitMessage,
  })
  await sse.writeEvent('done', {
    type: 'done',
    stop_reason: 'tool_limit_reached',
    usage: lastUsage,
  })
  await backfillTitleIfNew(ctx, sessionId, userMessage, newlyCreatedSession)
}

// ---------------------------------------------------------------------------
// Stream response builder — flushes `: ready`, emits the session event,
// races the orchestration loop against the 90s request timeout, and cleans
// up timers + writer in finally. The async work runs in the background;
// this function returns the Response synchronously.
// ---------------------------------------------------------------------------

function streamChatResponse(ctx: AuthContext, prep: ChatStreamPrep): Response {
  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()
  const sse = new SSEWriter(writer)

  ;(async () => {
    let timeoutHandle: number | undefined
    let timedOut = false
    try {
      // Flush headers + signal liveness to any proxy. Must precede real work.
      await sse.writeComment('ready')

      // Always emit session first so the frontend learns the id immediately.
      await sse.writeEvent('session', {
        type: 'session',
        session_id: prep.sessionId,
      })

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          timedOut = true
          reject(new Error('request_timeout'))
        }, REQUEST_TIMEOUT_MS)
      })

      try {
        await Promise.race([
          runOrchestrationLoop(ctx, sse, prep),
          timeoutPromise,
        ])
      } catch (err) {
        if (timedOut) {
          console.error('[ai-chat] request timeout', {
            userId: ctx.userId,
            sessionId: prep.sessionId,
          })
          await sse.writeEvent('error', {
            type: 'error',
            code: 'request_timeout',
            message: 'Zahtjev je trajao predugo. Pokušajte ponovno.',
          })
        } else {
          throw err
        }
      }
    } catch (err) {
      console.error('[ai-chat] stream worker error', {
        userId: ctx.userId,
        sessionId: prep.sessionId,
        reason: err instanceof Error ? err.message : String(err),
      })
      // Best-effort: surface a generic error event so the client doesn't see
      // a silent close after `: ready`. writeEvent is a no-op if already closed.
      await sse.writeEvent('error', {
        type: 'error',
        code: 'internal_error',
        message: 'Interna greška u toku.',
      })
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle)
        timeoutHandle = undefined
      }
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
        const output = await dispatchTool(toolName, toolInput, auth)
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
    return streamChatResponse(auth, chatResult)
  } catch (err) {
    console.error('[ai-chat] unhandled error', {
      reason: err instanceof Error ? err.message : String(err),
    })
    return flatError('internal_error', 'Internal server error', 500)
  }
})
