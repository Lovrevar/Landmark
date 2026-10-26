// Runs the real voice-llm edge function in-process, against the same two fakes
// as ai-chat's characterisation suite (ai-chat/tests/harness.ts explains the
// set-up order: environment, then fetch, then Deno.serve captured on import).

import { FakeAnthropic } from '../../ai-chat/tests/fake-anthropic.ts'
import { FakeSupabase } from '../../ai-chat/tests/fake-supabase.ts'
import { SERVICE_ROLE_KEY, seedWorld, TOKENS, USERS } from '../../ai-chat/tests/fixtures.ts'

export const anthropic = new FakeAnthropic()
export const db = new FakeSupabase()

export const SECRET = 'voice-secret-for-tests'
export const CALL_TOKEN = 'opaque-call-token-1'
export const ROOM = 'voice-room-1'
export const VOICE_SESSION = '00000000-0000-0000-0000-00000000a001'
export const CALL_ID = '00000000-0000-0000-0000-0000000000c1'

Deno.env.set('SUPABASE_URL', 'http://fake-supabase.test')
Deno.env.set('SUPABASE_ANON_KEY', 'fake-anon-key')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', SERVICE_ROLE_KEY)
Deno.env.set('ANTHROPIC_API_KEY', 'sk-ant-fake')
Deno.env.set('ANTHROPIC_BASE_URL', 'http://fake-anthropic.test')
Deno.env.set('VOICE_LLM_SECRET', SECRET)
for (const k of ['AI_CHAT_MODEL', 'AI_CHAT_VOICE_MODEL']) Deno.env.delete(k)

const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input, init)
  const host = new URL(req.url).host
  if (host === 'fake-anthropic.test') return await anthropic.handle(req, init?.signal ?? req.signal)
  if (host === 'fake-supabase.test') return await db.handle(req)
  return await realFetch(input, init)
}) as typeof fetch

export const logs: string[] = []
const passthrough = Deno.env.get('AI_CHAT_TEST_LOGS') === '1'
for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
  const original = console[level].bind(console)
  console[level] = (...args: unknown[]) => {
    logs.push(args.map((a) => (typeof a === 'string' ? a : Deno.inspect(a, { depth: 5 }))).join(' '))
    if (passthrough) original(...args)
  }
}

type Handler = (req: Request) => Response | Promise<Response>
let handler: Handler | null = null
const realServe = Deno.serve
;(Deno as unknown as { serve: unknown }).serve = (h: Handler) => {
  handler = h
  return { finished: new Promise<void>(() => {}), shutdown: () => Promise.resolve(), ref() {}, unref() {}, addr: { transport: 'tcp', hostname: 'in-process', port: 0 } }
}
await import('../index.ts')
;(Deno as unknown as { serve: unknown }).serve = realServe
if (!handler) throw new Error('harness: voice-llm/index.ts did not register a Deno.serve handler')

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** A live call for `user`, as voice-session/start leaves it. */
export async function seedCall(
  user: keyof typeof USERS = 'director',
  overrides: Record<string, unknown> = {},
): Promise<void> {
  db.seed('ai_sessions', [{ id: VOICE_SESSION, user_id: USERS[user].id, channel: 'voice', external_call_id: ROOM, title: 'Glasovni poziv' }])
  db.seed('voice_calls', [{
    id: CALL_ID,
    session_id: VOICE_SESSION,
    user_id: USERS[user].id,
    call_token_hash: await sha256Hex(CALL_TOKEN),
    platform_call_id: ROOM,
    access_token: TOKENS[user],
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    last_seen_at: new Date(Date.now() - 10_000).toISOString(),
    created_at: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  }])
}

export function scenario(name: string, fn: () => Promise<void>): void {
  Deno.test({
    name,
    sanitizeOps: false,
    sanitizeResources: false,
    fn: async () => {
      anthropic.reset()
      db.reset()
      logs.length = 0
      seedWorld(db)
      await fn()
      if (anthropic.unexpectedCalls > 0) throw new Error(`${anthropic.unexpectedCalls} unscripted Anthropic call(s)`)
      if (anthropic.remaining > 0) throw new Error(`${anthropic.remaining} scripted Anthropic turn(s) never requested`)
    },
  })
}

export interface VoiceCall {
  messages?: unknown
  stream?: boolean
  secret?: string | null
  token?: string | null
  room?: string | null
  path?: string
}

export async function voice(opts: VoiceCall = {}): Promise<Response> {
  const headers = new Headers({ 'content-type': 'application/json' })
  const secret = opts.secret === undefined ? SECRET : opts.secret
  const token = opts.token === undefined ? CALL_TOKEN : opts.token
  const room = opts.room === undefined ? ROOM : opts.room
  if (secret) headers.set('x-voice-secret', secret)
  if (token) headers.set('authorization', `Bearer ${token}`)
  if (room) headers.set('x-voice-call-id', room)
  const body = JSON.stringify({
    model: 'cognilion-voice',
    stream: opts.stream ?? true,
    messages: opts.messages ?? [{ role: 'user', content: 'Kako stoji projekt Funtana?' }],
  })
  return await handler!(new Request(`http://in-process/functions/v1/voice-llm${opts.path ?? '/chat/completions'}`, { method: 'POST', headers, body }))
}

/** Read an OpenAI chunk stream: the spoken text, the finish reasons, and whether it ended with [DONE]. */
export async function readChunks(res: Response): Promise<{ text: string; finish: Array<string | null>; done: boolean; firstDelta: Record<string, unknown> | null }> {
  const raw = await res.text()
  let text = ''
  const finish: Array<string | null> = []
  let done = false
  let firstDelta: Record<string, unknown> | null = null
  for (const frame of raw.split('\n\n')) {
    const line = frame.trim()
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    if (data === '[DONE]') {
      done = true
      continue
    }
    const chunk = JSON.parse(data)
    const choice = chunk.choices[0]
    if (!firstDelta && choice.delta?.content) firstDelta = choice.delta
    text += choice.delta?.content ?? ''
    finish.push(choice.finish_reason)
  }
  return { text, finish, done, firstDelta }
}

/** Persistence runs after the response; wait for it. */
export async function waitFor(check: () => boolean, ms = 2000): Promise<void> {
  const t0 = Date.now()
  while (!check()) {
    if (Date.now() - t0 > ms) throw new Error('harness: condition not met in time')
    await new Promise((r) => setTimeout(r, 10))
  }
}
