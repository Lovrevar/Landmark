// voice-llm: the assistant behind an OpenAI-compatible chat completions
// endpoint, for the voice agent (plan §4.3). One brain: the same loop, tool
// registry, role gate and domain rules as chat (_shared/orchestrator.ts), with
// the voice channel's settings. The agent never sees our tool calls; it gets
// only the text to speak.
//
//   POST /functions/v1/voice-llm/chat/completions
//   x-voice-secret:   VOICE_LLM_SECRET, which only our agent worker holds
//   x-voice-call-id:  the LiveKit room the call runs in
//   Authorization:    Bearer <opaque call token from voice-session/start>
//   { "messages": [...], "stream": true }
//
//   POST /functions/v1/voice-llm/warm      same headers, no body
//     Sent by the agent as the call starts, while the greeting plays: it wakes
//     the function, resolves the caller once, and writes the prompt cache with a
//     max_tokens: 0 request in the shape of a real one, so the first question
//     pays neither a cold start nor a cache miss.
//
// Identity: the call token resolves to the caller's JWT through voice_calls,
// only for the room it was issued for and only while the call is live (§4.4).
// The identity is then built by the same code as chat, so role and assigned
// projects are re-read on every request.
//
// Persistence is off the critical path (§7): the turn's rows are written after
// the answer, with ids chosen here so the loop can chain them meanwhile.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { authenticateToken } from '../_shared/auth.ts'
import type { Json } from '../_shared/database.ts'
import type { AuthContext } from '../_shared/auth.ts'
import {
  anthropic,
  type LoopConfig,
  type MessageRow,
  type MessageStore,
  runOrchestrationLoop,
} from '../_shared/orchestrator.ts'
import { buildStaticSystemPrompt, buildUserContext } from '../_shared/prompts.ts'
import { selectAvailableTools } from '../_shared/tools.ts'
import { toAnthropicMessages } from './messages.ts'
import { OpenAiChunkSink } from './sink.ts'

const MAX_BODY_BYTES = 64 * 1024
// The voice channel's settings (plan §4.2): short answers, few tool rounds,
// tight timeouts. A caller will not wait 90 seconds.
const REQUEST_TIMEOUT_MS = 25_000
const IDLE_MS = 3 * 60_000

const json = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json' },
  })

function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  if (ea.length !== eb.length) return false
  let diff = 0
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i]
  return diff === 0
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Untyped until the voice_calls migration is applied and /db-types regenerates
// _shared/database.ts.
function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type Service = ReturnType<typeof serviceClient>

/** The live call this token belongs to, in this room; null if there is none. */
async function resolveCall(service: Service, token: string, callId: string) {
  const now = Date.now()
  const { data, error } = await service
    .from('voice_calls')
    .select('id, session_id, user_id, access_token')
    .eq('call_token_hash', await sha256Hex(token))
    .eq('platform_call_id', callId)
    .gt('expires_at', new Date(now).toISOString())
    .gt('last_seen_at', new Date(now - IDLE_MS).toISOString())
    .maybeSingle()
  if (error) throw new Error(`voice_calls lookup failed: ${error.code}`)
  return data
}

/** Rows kept in memory and written after the answer, chained by ids chosen here. */
class DeferredStore implements MessageStore {
  readonly rows: Array<MessageRow & { id: string }> = []
  async insert(row: MessageRow) {
    const id = crypto.randomUUID()
    this.rows.push({ ...row, id })
    return { id }
  }
}

async function persistTurn(service: Service, sessionId: string, userRowId: string, userText: string, store: DeferredStore) {
  // The new user row hangs off the session's newest row.
  const { data: leaf, error: leafError } = await service
    .from('ai_messages')
    .select('id')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (leafError) {
    console.error('[voice-llm] persist: leaf lookup failed', { sessionId, code: leafError.code })
    return
  }
  // Explicit, increasing created_at: the rows go in one insert, and the next
  // turn finds its parent as the newest row.
  const base = Date.now()
  const rows = [
    { id: userRowId, role: 'user' as const, content: [{ type: 'text', text: userText }] as unknown as Json, parent_id: leaf?.id ?? null },
    ...store.rows,
  ].map((r, i) => ({ ...r, session_id: sessionId, created_at: new Date(base + i).toISOString() }))
  const { error } = await service.from('ai_messages').insert(rows)
  if (error) console.error('[voice-llm] persist failed', { sessionId, code: error.code, rows: rows.length })
}

/** The voice channel's loop settings for this caller (plan §4.2). */
function voiceLoopConfig(ctx: AuthContext): LoopConfig {
  const tools: Array<Record<string, unknown>> = selectAvailableTools(ctx, 'voice').map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }))
  if (tools.length > 0) tools[tools.length - 1].cache_control = { type: 'ephemeral' }
  const today = new Date().toLocaleDateString('hr-HR', { timeZone: 'Europe/Zagreb', day: 'numeric', month: 'long', year: 'numeric' })
  const model = Deno.env.get('AI_CHAT_VOICE_MODEL') ?? 'claude-sonnet-5-5'
  // Sonnet 5.5 thinks by default, which a caller hears as a pause: between_tools
  // turns it off (accepted at effort high or below). The server-side fallback
  // re-runs a request the model declines on another model, in the same call.
  // Other models reject between_tools, so these go to Sonnet 5.5 only.
  const sonnet55 = model === 'claude-sonnet-5-5'
  return {
    channel: 'voice',
    model,
    // Room for a few parallel tool calls; the prompt keeps answers to 1-3 sentences.
    // (384, the plan's figure, cut off a turn of tool calls on the first dev call.)
    maxTokens: 1024,
    maxIterations: 4,
    toolTimeoutMs: 6000,
    system: [
      { type: 'text', text: buildStaticSystemPrompt('voice'), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `${buildUserContext(ctx)}\nDanas je ${today}.` },
    ],
    tools,
    logTag: '[voice-llm]',
    ...(sonnet55
      ? {
        extra: {
          thinking: { type: 'between_tools' },
          // low: on the phase 0 questions (2026-10-27) the whole answer took a
          // median 4.5 s against 7.3 s at medium, in fewer model rounds.
          output_config: { effort: Deno.env.get('AI_CHAT_VOICE_EFFORT') ?? 'low' },
          fallbacks: 'default',
        },
        betas: ['server-side-fallback-2026-07-01'],
      }
      : {}),
  }
}

type Authorized = { service: Service; call: { id: string; session_id: string }; ctx: AuthContext }

/** The checks every route runs: the agent's secret, then the call token, bound
 * to its room and live, then the caller's identity from the stored JWT. */
async function authorize(req: Request): Promise<Authorized | Response> {
  const expected = Deno.env.get('VOICE_LLM_SECRET')
  if (!expected) {
    console.error('[voice-llm] VOICE_LLM_SECRET is not set')
    return json(500, 'internal_error', 'Server misconfigured')
  }
  if (!safeEqual(req.headers.get('x-voice-secret') ?? '', expected)) {
    return json(401, 'unauthorized', 'Invalid or missing secret')
  }
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : ''
  const callId = req.headers.get('x-voice-call-id') ?? ''
  if (!token || !callId) return json(401, 'unauthorized', 'Missing call token or call id')

  const service = serviceClient()
  let call
  try {
    call = await resolveCall(service, token, callId)
  } catch (err) {
    console.error('[voice-llm] call lookup failed', { reason: err instanceof Error ? err.message : String(err) })
    return json(500, 'internal_error', 'Call lookup failed')
  }
  if (!call) return json(401, 'unauthorized', 'No live call for this token')

  // Idle expiry counts from the last request; off the critical path. (A
  // supabase-js query runs only once it is then-ed, so `void query` would not.)
  service.from('voice_calls').update({ last_seen_at: new Date().toISOString() }).eq('id', call.id)
    .then(({ error }) => {
      if (error) console.error('[voice-llm] last_seen_at bump failed', { callId: call.id, code: error.code })
    })

  const ctx = await authenticateToken(call.access_token)
  if ('error' in ctx) return json(ctx.status, ctx.error.code, ctx.error.message)
  if (ctx.userId !== call.user_id) return json(401, 'unauthorized', 'Call does not belong to this user')
  return { service, call, ctx }
}

/** Writes the prompt cache for this caller's settings: a max_tokens: 0 request
 * with the same tools, system prompt, thinking and effort as a real one (they
 * are all part of the cached prefix), answered without generating anything. */
async function warm(ctx: AuthContext, t0: number): Promise<Response> {
  const config = voiceLoopConfig(ctx)
  const params = {
    model: config.model,
    max_tokens: 0,
    system: config.system,
    tools: config.tools,
    messages: [{ role: 'user', content: 'warmup' }],
    ...config.extra,
  }
  try {
    const message = config.betas?.length
      ? await anthropic.beta.messages.create({ ...params, betas: config.betas } as never)
      : await anthropic.messages.create(params as never)
    const usage = (message as unknown as { usage?: Record<string, number> }).usage ?? {}
    const result = {
      ok: true,
      ms: Math.round(performance.now() - t0),
      cache_write: usage.cache_creation_input_tokens ?? 0,
      cache_read: usage.cache_read_input_tokens ?? 0,
    }
    console.log('[voice-llm] warm', { userId: ctx.userId, ...result })
    return new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (err) {
    // A failed warm-up costs only the latency it would have saved.
    console.error('[voice-llm] warm failed', { reason: err instanceof Error ? err.message.slice(0, 200) : String(err) })
    return json(502, 'warm_failed', 'Warm-up failed')
  }
}

Deno.serve(async (req) => {
  const t0 = performance.now()
  if (req.method !== 'POST') return json(405, 'method_not_allowed', 'Only POST is supported')
  const path = new URL(req.url).pathname
  const isWarm = path.endsWith('/warm')
  if (!isWarm && !path.endsWith('/chat/completions')) return json(404, 'not_found', 'Not found')

  const authorized = await authorize(req)
  if (authorized instanceof Response) return authorized
  const { service, call, ctx } = authorized
  if (isWarm) return await warm(ctx, t0)
  const authMs = Math.round(performance.now() - t0)

  const raw = await req.text()
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json(413, 'payload_too_large', 'Request too large')
  let body: { messages?: unknown; stream?: unknown }
  try {
    body = JSON.parse(raw)
  } catch {
    return json(400, 'bad_request', 'Request body must be valid JSON')
  }
  const messages = toAnthropicMessages(body.messages)
  if (!messages) return json(400, 'bad_request', 'No user message to answer')
  const userText = (messages[messages.length - 1].content as Array<{ text: string }>)[0].text
  const config = voiceLoopConfig(ctx)

  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  // The agent closes the request when the caller interrupts.
  req.signal.addEventListener('abort', () => controller.abort(), { once: true })

  const marks: string[] = [`auth=${authMs}`]
  const userRowId = crypto.randomUUID()
  const store = new DeferredStore()
  const run = async (sink: OpenAiChunkSink) => {
    await runOrchestrationLoop(
      ctx,
      config,
      {
        sessionId: call.session_id,
        messages,
        lastInsertedId: userRowId,
        extras: { helpSearch: { currentRoutePattern: null, currentRouteRaw: null } },
      },
      sink,
      store,
      {
        isCancelled: async () => controller.signal.aborted,
        onComplete: async () => {},
        mark: (event) => marks.push(`${event}=${Math.round(performance.now() - t0)}`),
        usage: (u) => marks.push(`tokens=${u.input}/${u.output}/cache_read=${u.cacheRead}/cache_write=${u.cacheWrite}`),
      },
      controller.signal,
    )
    // The loop ends silently on an abort; a caller who is still there hears why.
    if (timedOut) {
      console.error('[voice-llm] request timeout', { userId: ctx.userId, sessionId: call.session_id })
      await sink.error('request_timeout', 'Zahtjev je trajao predugo. Pokušajte ponovno.')
    }
  }
  const persist = (sink: OpenAiChunkSink) => {
    clearTimeout(timeout)
    // Where a request's time goes: the call lookup and identity, then the model
    // and tools until the first spoken text, then the rest of the answer.
    console.log('[voice-llm] timing', {
      sessionId: call.session_id,
      auth_ms: authMs,
      first_text_ms: sink.firstOutputAt === null ? null : Math.round(sink.firstOutputAt - t0),
      total_ms: Math.round(performance.now() - t0),
      marks: marks.join(' '),
    })
    const p = persistTurn(service, call.session_id, userRowId, userText, store)
    // Outlive the response on Supabase's runtime; elsewhere (tests) it just runs.
    ;(globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime?.waitUntil(p)
    return p
  }

  if (body.stream !== true) {
    const sink = new OpenAiChunkSink(async () => {}, 'cognilion-voice')
    await run(sink)
    void persist(sink)
    return new Response(JSON.stringify({
      id: `chatcmpl-${userRowId}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'cognilion-voice',
      choices: [{ index: 0, message: { role: 'assistant', content: sink.spoken.trim() }, finish_reason: 'stop' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()
  const encoder = new TextEncoder()
  const sink = new OpenAiChunkSink(async (chunk) => {
    try {
      await writer.write(encoder.encode(chunk))
    } catch {
      controller.abort() // the agent is gone: stop the loop
    }
  }, 'cognilion-voice')
  sink.timing = () => `${marks.join(' ')} first_text=${sink.firstOutputAt === null ? '-' : Math.round(sink.firstOutputAt - t0)}`
  ;(async () => {
    try {
      await run(sink)
    } catch (err) {
      console.error('[voice-llm] loop failed', { reason: err instanceof Error ? err.message : String(err) })
      await sink.error('internal_error', 'Došlo je do greške. Pokušajte ponovno.')
    } finally {
      void persist(sink)
      try {
        await writer.close()
      } catch {
        // already closed
      }
    }
  })()
  return new Response(stream.readable, {
    status: 200,
    headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' },
  })
})
