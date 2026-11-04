// assistant-api: Landmark's AI-chat tools for the company assistant, on behalf
// of one employee (docs/ASSISTANT_API.md). No query of its own: identity and
// role come from _shared/auth.ts, the role and channel gate and the handlers
// from _shared/orchestrator.ts and _shared/tools.ts, exactly as in chat.
//
//   Authorization: Bearer <HS256 assertion, ASSISTANT_API_SECRET; sub = email>
//
//   POST /functions/v1/assistant-api/me             {}
//   POST /functions/v1/assistant-api/manifest       {}
//   POST /functions/v1/assistant-api/tools/<name>   { "input": {…}, "channel": "chat" | "voice" }
//
// Every request: the assertion, then (except /manifest) the employee's
// public.users row by email, then a real session for that user so every
// handler reads under their RLS. The session is signed out after the request.
//
// Failures are { "error": { "code", "message" } } with a real status. A
// handler's own { error } result is an answer, not a failure: it comes back as
// 200 { data: { error } }, as chat's model would see it.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { type AuthContext, authenticateToken } from '../_shared/auth.ts'
import type { Database } from '../_shared/database.ts'
import { dispatchTool } from '../_shared/orchestrator.ts'
import { DOMAIN_RULES_HR } from '../_shared/prompts.ts'
import { type Channel, findAvailableTool, selectAvailableTools, TOOL_ALLOWLIST, TOOLS, type ToolHandlerExtras } from '../_shared/tools.ts'
import { verifyAssertion } from './assertion.ts'
import { RateLimiter } from './rateLimit.ts'
import { closeSession, type MappedUser, mapUser, openSession } from './session.ts'
import { assertSupported, validate } from './validate.ts'
import { clampForVoice } from './voice.ts'

const MAX_BODY_BYTES = 64 * 1024

/** How long a handler may run, per channel: the assistant's own tool timeouts.
 * Mutable only so the tests need not wait them out. */
export const TOOL_TIMEOUT_MS: Record<Channel, number> = { chat: 15_000, voice: 6_000 }

export const rateLimiter = new RateLimiter()

// The v1 voice list (voice plan §5), on both channels. The document tools are
// not exposed: their results are UI cards, and create_document writes.
const EXPOSED = TOOLS.filter((t) => TOOL_ALLOWLIST.voice.includes(t.name))
const EXPOSED_NAMES = new Set(EXPOSED.map((t) => t.name))
for (const t of EXPOSED) assertSupported(t.input_schema, t.name)

const EXTRAS: ToolHandlerExtras = { helpSearch: { currentRoutePattern: null, currentRouteRaw: null } }

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const fail = (status: number, code: string, message: string) => json(status, { error: { code, message } })

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function serviceClient() {
  return createClient<Database>(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

let manifest: Promise<Record<string, unknown>> | null = null

/** The exposed tools and the domain rules, versioned by the hash of exactly
 * that JSON. Built once per isolate; the key order is fixed, so is the hash. */
function buildManifest(): Promise<Record<string, unknown>> {
  manifest ??= (async () => {
    const body = {
      tools: EXPOSED.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
        roles: t.requiredRoles,
        voice: TOOL_ALLOWLIST.voice.includes(t.name),
      })),
      domain_rules_hr: DOMAIN_RULES_HR,
    }
    return { version: await sha256Hex(JSON.stringify(body)), ...body }
  })()
  return manifest
}

type Route = { kind: 'me' } | { kind: 'manifest' } | { kind: 'tool'; name: string }

function parseRoute(pathname: string): Route | null {
  const m = pathname.match(/\/assistant-api(\/.*)?$/)
  const sub = m?.[1] ?? ''
  if (sub === '/me') return { kind: 'me' }
  if (sub === '/manifest') return { kind: 'manifest' }
  const tool = sub.match(/^\/tools\/([^/]+)$/)
  return tool ? { kind: 'tool', name: tool[1] } : null
}

/** What the request log line carries: never input, output, email, assertion or token. */
interface RequestLog {
  route: string | null
  tool: string | null
  channel: Channel | null
  userId: string | null
  auth_ms: number | null
  session_ms: number | null
  tool_ms: number | null
}

async function dispatchWithTimeout(name: string, input: unknown, ctx: AuthContext, channel: Channel): Promise<unknown> {
  let timer: number | undefined
  try {
    return await Promise.race([
      dispatchTool(name, input, ctx, EXTRAS, channel),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error('tool_timeout'), { code: 'tool_timeout' })), TOOL_TIMEOUT_MS[channel])
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function handle(req: Request, log: RequestLog, t0: number): Promise<Response> {
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Only POST is supported')
  const route = parseRoute(new URL(req.url).pathname)
  if (!route) return fail(404, 'not_found', 'Not found')
  log.route = route.kind
  if (route.kind === 'tool') log.tool = route.name

  // 1. Who is calling.
  const secret = Deno.env.get('ASSISTANT_API_SECRET')
  if (!secret) {
    console.error('[assistant-api] ASSISTANT_API_SECRET is not set')
    return fail(500, 'internal_error', 'Server misconfigured')
  }
  const header = req.headers.get('authorization') ?? ''
  const assertion = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  const verdict = assertion ? await verifyAssertion(assertion, secret) : { ok: false as const, reason: 'missing_header' }
  log.auth_ms = Math.round(performance.now() - t0)
  if (!verdict.ok) {
    console.warn('[assistant-api] bad_assertion', { reason: verdict.reason })
    return fail(401, 'bad_assertion', 'Invalid or missing assertion')
  }

  if (route.kind === 'manifest') return json(200, await buildManifest())

  // 2. What is asked, checked before any database work.
  if (route.kind === 'tool' && !EXPOSED_NAMES.has(route.name)) return fail(404, 'unknown_tool', `Unknown tool: ${route.name}`)
  const raw = await req.text()
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return fail(413, 'payload_too_large', 'Request too large')
  let body: Record<string, unknown>
  try {
    body = raw.trim() === '' ? {} : JSON.parse(raw)
  } catch {
    return fail(400, 'bad_request', 'Request body must be valid JSON')
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'bad_request', 'Request body must be a JSON object')

  let channel: Channel = 'chat'
  let input: Record<string, unknown> = {}
  if (route.kind === 'tool') {
    if (body.channel !== 'chat' && body.channel !== 'voice') return fail(400, 'bad_request', 'channel must be "chat" or "voice"')
    channel = body.channel
    log.channel = channel
    if (body.input === null || typeof body.input !== 'object' || Array.isArray(body.input)) {
      return fail(400, 'bad_request', 'input must be a JSON object')
    }
    input = body.input as Record<string, unknown>
    const problem = validate(input, EXPOSED.find((t) => t.name === route.name)!.input_schema)
    if (problem) return fail(400, 'bad_request', problem)
  }

  // 3. Which Landmark user.
  const service = serviceClient()
  let user: MappedUser | null
  try {
    user = await mapUser(service, verdict.email)
  } catch (err) {
    console.error('[assistant-api] mapping failed', { reason: err instanceof Error ? err.message : String(err) })
    return fail(500, 'internal_error', 'User lookup failed')
  }
  if (!user) return fail(403, 'not_mapped', 'No Landmark user for this caller')
  log.userId = user.id

  if (route.kind === 'tool' && !rateLimiter.allow(user.id)) {
    console.warn('[assistant-api] rate limited', { userId: user.id })
    return fail(429, 'rate_limited', 'Too many tool calls; try again in a minute')
  }

  const tSession = performance.now()
  let accessToken: string
  try {
    accessToken = await openSession(service, user)
  } catch (err) {
    console.error('[assistant-api] session failed', { userId: user.id, reason: err instanceof Error ? err.message : String(err) })
    return fail(500, 'internal_error', 'Could not open a session')
  }

  try {
    const ctx = await authenticateToken(accessToken)
    log.session_ms = Math.round(performance.now() - tSession)
    if ('error' in ctx) {
      console.error('[assistant-api] identity failed', { userId: user.id, code: ctx.error.code })
      return fail(500, 'internal_error', 'Could not resolve the user')
    }
    if (ctx.userId !== user.id) {
      console.error('[assistant-api] session user mismatch', { userId: user.id, sessionUserId: ctx.userId })
      return fail(500, 'internal_error', 'Could not resolve the user')
    }

    if (route.kind === 'me') {
      const names = (ch: Channel) => selectAvailableTools(ctx, ch).filter((t) => EXPOSED_NAMES.has(t.name)).map((t) => t.name)
      return json(200, {
        role: ctx.role,
        display_name: user.username,
        tools: { chat: names('chat'), voice: names('voice') },
      })
    }

    // 4. The tool, through chat's own gate and handler.
    if (!findAvailableTool(ctx, route.name, channel)) {
      console.warn('[assistant-api] forbidden_tool', { userId: user.id, role: ctx.role, tool: route.name, channel })
      return fail(403, 'forbidden_tool', `Tool not available to this user on ${channel}: ${route.name}`)
    }
    const tTool = performance.now()
    let data: unknown
    try {
      data = await dispatchWithTimeout(route.name, input, ctx, channel)
    } catch (err) {
      console.error('[assistant-api] tool failed', {
        userId: user.id,
        tool: route.name,
        errorClass: err instanceof Error ? err.constructor.name : typeof err,
        code: (err as { code?: unknown })?.code ?? null,
      })
      return fail(500, 'internal_error', 'The tool failed')
    } finally {
      log.tool_ms = Math.round(performance.now() - tTool)
    }
    return json(200, { data: channel === 'voice' ? clampForVoice(data) : data })
  } finally {
    await closeSession(service, accessToken, user.id)
  }
}

Deno.serve(async (req) => {
  const t0 = performance.now()
  const log: RequestLog = { route: null, tool: null, channel: null, userId: null, auth_ms: null, session_ms: null, tool_ms: null }
  let res: Response
  try {
    res = await handle(req, log, t0)
  } catch (err) {
    console.error('[assistant-api] unhandled', { errorClass: err instanceof Error ? err.constructor.name : typeof err })
    res = fail(500, 'internal_error', 'Internal error')
  }
  console.log('[assistant-api] request', { ...log, status: res.status, total_ms: Math.round(performance.now() - t0) })
  return res
})
