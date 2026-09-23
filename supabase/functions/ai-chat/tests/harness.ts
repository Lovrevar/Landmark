// Runs the real ai-chat edge function in-process, against the two fakes.
//
// Nothing in index.ts is changed or stubbed. Three things happen, in order,
// before it is imported:
//
//   1. Environment: SUPABASE_URL and ANTHROPIC_BASE_URL point at fake hosts.
//   2. fetch: the global is routed so those hosts are answered by
//      FakeSupabase / FakeAnthropic. The Anthropic SDK captures `fetch` when
//      its client is constructed (at module load), so this must come first.
//   3. Deno.serve: index.ts calls it at load. It is swapped for the duration of
//      the import so the request handler is captured instead of a port being
//      bound; tests then call the handler with ordinary Request objects.
//
// Console output from the function is captured into `logs` (the loop logs on
// every request). Set AI_CHAT_TEST_LOGS=1 to see it live.

import { FakeAnthropic } from './fake-anthropic.ts'
import { FakeSupabase, type RecordedRequest } from './fake-supabase.ts'
import { SERVICE_ROLE_KEY, seedWorld, TOKENS } from './fixtures.ts'

export const anthropic = new FakeAnthropic()
export const db = new FakeSupabase()

Deno.env.set('SUPABASE_URL', 'http://fake-supabase.test')
Deno.env.set('SUPABASE_ANON_KEY', 'fake-anon-key')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', SERVICE_ROLE_KEY)
Deno.env.set('ANTHROPIC_API_KEY', 'sk-ant-fake')
Deno.env.set('ANTHROPIC_BASE_URL', 'http://fake-anthropic.test')
for (const k of ['AI_CHAT_MODEL', 'AI_CHAT_SUMMARY_MODEL', 'AI_CHAT_DEBUG_ENABLED']) Deno.env.delete(k)

const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input, init)
  const host = new URL(req.url).host
  if (host === 'fake-anthropic.test') return await anthropic.handle(req)
  if (host === 'fake-supabase.test') return await db.handle(req)
  return await realFetch(input, init)
}) as typeof fetch

export const logs: Array<{ level: string; line: string }> = []
const passthrough = Deno.env.get('AI_CHAT_TEST_LOGS') === '1'
for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
  const original = console[level].bind(console)
  console[level] = (...args: unknown[]) => {
    logs.push({ level, line: args.map((a) => (typeof a === 'string' ? a : Deno.inspect(a, { depth: 5 }))).join(' ') })
    if (passthrough) original(...args)
  }
}

type Handler = (req: Request) => Response | Promise<Response>
let handler: Handler | null = null
const realServe = Deno.serve
;(Deno as unknown as { serve: unknown }).serve = (h: Handler) => {
  handler = h
  return {
    finished: new Promise<void>(() => {}),
    shutdown: () => Promise.resolve(),
    ref() {},
    unref() {},
    addr: { transport: 'tcp', hostname: 'in-process', port: 0 },
  }
}
await import('../index.ts')
;(Deno as unknown as { serve: unknown }).serve = realServe
if (!handler) throw new Error('harness: ai-chat/index.ts did not register a Deno.serve handler')

/**
 * Declare a characterisation scenario. Every scenario starts from a freshly
 * seeded world and must consume exactly the model turns it scripted: an
 * unscripted call, or a scripted turn left unused, fails the test.
 *
 * Op/resource sanitizers are off because the function under test leaves
 * timers running by design: each tool dispatch races a 15 s timeout that is
 * never cleared (see docs/voice/open-questions.md).
 */
export function scenario(name: string, fn: () => Promise<void>, opts: { allowLeftoverTurns?: boolean } = {}): void {
  Deno.test({
    name,
    sanitizeOps: false,
    sanitizeResources: false,
    fn: async () => {
      reset()
      await fn()
      if (anthropic.unexpectedCalls > 0) throw new Error(`${anthropic.unexpectedCalls} unscripted Anthropic call(s)`)
      if (!opts.allowLeftoverTurns && anthropic.remaining > 0) {
        throw new Error(`${anthropic.remaining} scripted Anthropic turn(s) never requested`)
      }
    },
  })
}

/** Fresh fakes, seeded world. Call at the start of every test. */
export function reset(): void {
  anthropic.reset()
  db.reset()
  logs.length = 0
  Deno.env.delete('AI_CHAT_DEBUG_ENABLED')
  seedWorld(db)
}

export interface CallOptions {
  /** Bearer token; defaults to the Director. `null` sends no Authorization header. */
  token?: string | null
  method?: string
  /** Raw body, bypassing JSON.stringify (for malformed-JSON cases). */
  raw?: string
}

export async function call(body: unknown, opts: CallOptions = {}): Promise<Response> {
  const headers = new Headers({ 'content-type': 'application/json' })
  const token = opts.token === undefined ? TOKENS.director : opts.token
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const method = opts.method ?? 'POST'
  const hasBody = method !== 'GET' && method !== 'OPTIONS' && method !== 'HEAD'
  const payload = hasBody ? (opts.raw ?? JSON.stringify(body)) : undefined
  if (payload !== undefined) headers.set('content-length', String(new TextEncoder().encode(payload).byteLength))
  return await handler!(new Request('http://in-process/functions/v1/ai-chat', { method, headers, body: payload }))
}

// deno-lint-ignore no-explicit-any
export type Json = any
export interface SSE {
  raw: string
  comments: string[]
  /** `event:` line and parsed `data:` payload, in wire order. */
  events: Array<{ event: string; data: Json }>
  /** Shorthand: the `type` of every data event, in order. */
  types: string[]
}

/** Read an SSE response to end of stream. The worker closes the stream only
 * after its post-turn work (title backfill, compaction), so once this returns
 * every DB write of the request has happened. Pass `timeoutMs: 0` under
 * FakeTime, where a guard timer would itself be faked. */
export async function readSSE(res: Response, timeoutMs = 10_000): Promise<SSE> {
  let timer: number | undefined
  const raw = timeoutMs <= 0 ? await res.text() : await Promise.race([
    res.text(),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`harness: SSE stream still open after ${timeoutMs} ms`)), timeoutMs)
    }),
  ]).finally(() => clearTimeout(timer))
  const comments: string[] = []
  const events: SSE['events'] = []
  for (const frame of raw.split('\n\n')) {
    if (!frame.trim()) continue
    const lines = frame.split('\n')
    if (lines.every((l) => l.startsWith(':'))) {
      comments.push(...lines.map((l) => l.slice(1).trim()))
      continue
    }
    const event = lines.find((l) => l.startsWith('event:'))?.slice(6).trim() ?? 'message'
    const data = lines.filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n')
    events.push({ event, data: JSON.parse(data) })
  }
  return { raw, comments, events, types: events.map((e) => e.data.type) }
}

/** POST a chat request and read the whole stream. Fails if it is not an SSE response. */
export async function chat(body: Record<string, unknown>, opts: CallOptions = {}): Promise<SSE> {
  const res = await call(body, opts)
  if (!(res.headers.get('content-type') ?? '').startsWith('text/event-stream')) {
    throw new Error(`harness: expected an SSE response, got ${res.status}: ${await res.text()}`)
  }
  return await readSSE(res)
}

export async function flatError(res: Response): Promise<{ status: number; code: string; message: string }> {
  const body = await res.json()
  return { status: res.status, code: body.error?.code, message: body.error?.message }
}

/** Which Supabase client made a request: the service role, or a user's JWT. */
export function clientOf(r: RecordedRequest): 'service' | 'user' | 'anon' {
  const auth = (r.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (auth === SERVICE_ROLE_KEY) return 'service'
  if (auth === 'fake-anon-key' || !auth) return 'anon'
  return 'user'
}

export function sessionMessages(sessionId: string) {
  return db.rows('ai_messages').filter((m) => m.session_id === sessionId)
}

/** The text of every block of a given type across content arrays. */
export function blocksOf(content: unknown, type: string): Json[] {
  return Array.isArray(content) ? content.filter((b: Json) => b?.type === type) : []
}

/** The `tool_result` payload the model was sent for a given tool, parsed. */
export function toolResultSentToModel(callIndex: number, toolUseId: string): Json {
  const msgs = anthropic.calls[callIndex].body.messages
  for (const m of msgs) {
    for (const b of blocksOf(m.content, 'tool_result')) {
      if (b.tool_use_id === toolUseId) return JSON.parse(b.content)
    }
  }
  throw new Error(`harness: no tool_result for ${toolUseId} in call ${callIndex}`)
}
