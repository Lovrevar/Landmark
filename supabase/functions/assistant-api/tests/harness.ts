// Runs the real assistant-api edge function in-process, against the same
// Supabase fake as ai-chat's characterisation suite (ai-chat/tests/harness.ts
// explains the set-up order: environment, then fetch, then Deno.serve captured
// on import). No Anthropic call is made: this API dispatches tools only.

import { SignJWT } from 'npm:jose@5.10.0'
import { FakeSupabase } from '../../ai-chat/tests/fake-supabase.ts'
import { SERVICE_ROLE_KEY, seedWorld, TOKENS, USERS } from '../../ai-chat/tests/fixtures.ts'

export const db = new FakeSupabase()

export const SECRET = 'assistant-api-secret-for-tests'

Deno.env.set('SUPABASE_URL', 'http://fake-supabase.test')
Deno.env.set('SUPABASE_ANON_KEY', 'fake-anon-key')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', SERVICE_ROLE_KEY)
// orchestrator.ts builds the Anthropic client at import; it is never called here.
Deno.env.set('ANTHROPIC_API_KEY', 'sk-ant-fake')
Deno.env.set('ASSISTANT_API_SECRET', SECRET)

const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input, init)
  if (new URL(req.url).host === 'fake-supabase.test') return await db.handle(req)
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
const api = await import('../index.ts')
;(Deno as unknown as { serve: unknown }).serve = realServe
if (!handler) throw new Error('harness: assistant-api/index.ts did not register a Deno.serve handler')

export const { TOOL_TIMEOUT_MS, rateLimiter } = api

/** A user row whose email has an ilike wildcard in it, and one with no login. */
export const UNDERSCORE = { id: '00000000-0000-4000-8000-000000000106', authId: '00000000-0000-4000-8000-000000000206', email: 'ana_b@test.hr' }
export const NO_LOGIN = { id: '00000000-0000-4000-8000-000000000107', email: 'bez.prijave@test.hr' }

/** Everything that must never reach a log line, gathered per test. */
const secrets = new Set<string>()

export function scenario(name: string, fn: () => Promise<void>): void {
  Deno.test({
    name,
    sanitizeOps: false,
    sanitizeResources: false,
    fn: async () => {
      db.reset()
      logs.length = 0
      secrets.clear()
      rateLimiter.clear()
      seedWorld(db)
      db.authUsers['tok-underscore'] = { id: UNDERSCORE.authId, email: UNDERSCORE.email }
      db.seed('users', [
        { id: UNDERSCORE.id, auth_user_id: UNDERSCORE.authId, role: 'Sales', email: UNDERSCORE.email, username: 'Ana B.' },
        { id: NO_LOGIN.id, auth_user_id: null, role: 'Sales', email: NO_LOGIN.email, username: null },
      ])
      for (const u of [...Object.values(USERS), UNDERSCORE, NO_LOGIN]) secrets.add(u.email)
      for (const t of Object.values(TOKENS)) secrets.add(t)

      await fn()

      // Every token minted and every link hash issued during the test.
      for (const t of db.revokedTokens) secrets.add(t)
      for (const t of Object.keys(db.authUsers)) secrets.add(t)
      for (const h of Object.keys(db.linkHashes)) secrets.add(h)
      for (const line of logs) {
        for (const s of secrets) {
          if (line.toLowerCase().includes(s.toLowerCase())) throw new Error(`a log line carries a secret value: ${line.slice(0, 120)}`)
        }
        if (/tok-session-|hash-|refresh-/.test(line)) throw new Error(`a log line carries a session value: ${line.slice(0, 120)}`)
      }
    },
  })
}

export interface Claims {
  sub?: string
  iss?: string
  aud?: string
  iat?: number
  exp?: number
  jti?: string
}

/** A signed assertion; claims default to a valid one for the Director. */
export async function sign(claims: Claims = {}, secret = SECRET): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const c = { sub: USERS.director.email, iss: 'va', aud: 'landmark-assistant-api', iat: now, exp: now + 30, jti: crypto.randomUUID(), ...claims }
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(c.sub)
    .setIssuer(c.iss)
    .setAudience(c.aud)
    .setIssuedAt(c.iat)
    .setExpirationTime(c.exp)
    .setJti(c.jti)
    .sign(new TextEncoder().encode(secret))
  secrets.add(token)
  return token
}

/** An unsigned `alg: none` token with valid claims. */
export function unsigned(claims: Claims = {}): string {
  const now = Math.floor(Date.now() / 1000)
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: USERS.director.email, iss: 'va', aud: 'landmark-assistant-api', iat: now, exp: now + 30, jti: crypto.randomUUID(), ...claims })}.`
  secrets.add(token)
  return token
}

export interface Call {
  /** `/me`, `/manifest` or `/tools/<name>`. */
  path: string
  body?: unknown
  /** Raw body text, instead of `body`. */
  raw?: string
  /** The assertion; null sends no Authorization header. Defaults to a fresh one for the Director. */
  assertion?: string | null
  as?: keyof typeof USERS
  method?: string
}

export async function call(opts: Call): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers = new Headers({ 'content-type': 'application/json' })
  const assertion = opts.assertion === undefined ? await sign({ sub: USERS[opts.as ?? 'director'].email }) : opts.assertion
  if (assertion) headers.set('authorization', `Bearer ${assertion}`)
  const res = await handler!(new Request(`http://in-process/functions/v1/assistant-api${opts.path}`, {
    method: opts.method ?? 'POST',
    headers,
    body: (opts.method ?? 'POST') === 'POST' ? opts.raw ?? JSON.stringify(opts.body ?? {}) : undefined,
  }))
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : {} }
}

/** A tool call; `channel` defaults to chat. */
export function tool(name: string, input: unknown, channel: unknown = 'chat', extra: Partial<Call> = {}) {
  return call({ path: `/tools/${name}`, body: { input, channel }, ...extra })
}

export const errorCode = (body: Record<string, unknown>) => (body.error as { code?: string } | undefined)?.code
