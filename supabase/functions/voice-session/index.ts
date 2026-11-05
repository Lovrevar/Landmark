// voice-session: starts, refreshes and ends an in-app voice call (plan §4.4).
// The browser calls it with its normal Supabase session, as it calls ai-chat.
//
//   POST /voice-session/start    → { url, token, room, session_id }
//     A voice ai_sessions row, an opaque call token (stored only as its
//     SHA-256, next to the caller's JWT, for at most 15 minutes), and our agent
//     dispatched into a new LiveKit room with that token. The dispatch is
//     server-side, so the call token never reaches the browser; the browser gets
//     only a LiveKit token to join the room.
//   POST /voice-session/refresh  { session_id }   the browser's new JWT replaces
//     the stored one; the 15-minute cap from the start never moves.
//   POST /voice-session/end      { session_id }   the stored JWT is deleted.
//
// One live call per user: starting a call ends the user's previous one.
//
// Env: LIVEKIT_URL (wss://…), LIVEKIT_API_KEY, LIVEKIT_API_SECRET,
// VOICE_AGENT_NAME (default cognilion-voice).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { AccessToken, AgentDispatchClient } from 'npm:livekit-server-sdk@2.19.1'
import { authenticate } from '../_shared/auth.ts'
import type { Database } from '../_shared/database.ts'
import { corsHeaders, handlePreflight } from '../_shared/cors.ts'

const CALL_CAP_MS = 15 * 60_000
const jsonHeaders = { ...corsHeaders, 'content-type': 'application/json' }

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: jsonHeaders })
const fail = (status: number, code: string, message: string) => reply(status, { error: { code, message } })

function serviceClient() {
  return createClient<Database>(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The JWT's expiry in ms. Already verified by authenticate(); only read here. */
function jwtExpiry(jwt: string): number {
  const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  return Number(payload.exp) * 1000
}

function bearer(req: Request): string {
  return (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Only POST is supported')
  const action = new URL(req.url).pathname.split('/').pop()

  const ctx = await authenticate(req)
  if ('error' in ctx) return reply(ctx.status, { error: ctx.error })
  const jwt = bearer(req)
  const service = serviceClient()
  let body: { session_id?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    // start has no body
  }

  try {
    if (action === 'start') {
      const livekitUrl = Deno.env.get('LIVEKIT_URL')
      const apiKey = Deno.env.get('LIVEKIT_API_KEY')
      const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')
      if (!livekitUrl || !apiKey || !apiSecret) {
        console.error('[voice-session] LiveKit env vars missing')
        return fail(500, 'internal_error', 'Server misconfigured')
      }

      // One live call per user: the previous call's credential goes.
      const { error: oldError } = await service.from('voice_calls').delete().eq('user_id', ctx.userId)
      if (oldError) throw new Error(`previous call cleanup failed: ${oldError.code}`)

      const room = `voice-${crypto.randomUUID()}`
      const now = Date.now()
      const { data: session, error: sessionError } = await service
        .from('ai_sessions')
        .insert({ user_id: ctx.userId, channel: 'voice', external_call_id: room, title: 'Glasovni poziv' })
        .select('id')
        .single()
      if (sessionError || !session) throw new Error(`session insert failed: ${sessionError?.code}`)

      const callToken = base64url(crypto.getRandomValues(new Uint8Array(32)))
      const { error: callError } = await service.from('voice_calls').insert({
        session_id: session.id,
        user_id: ctx.userId,
        call_token_hash: await sha256Hex(callToken),
        platform_call_id: room,
        access_token: jwt,
        expires_at: new Date(Math.min(jwtExpiry(jwt), now + CALL_CAP_MS)).toISOString(),
      })
      if (callError) throw new Error(`voice_calls insert failed: ${callError.code}`)

      const agentName = Deno.env.get('VOICE_AGENT_NAME') ?? 'cognilion-voice'
      await new AgentDispatchClient(livekitUrl.replace(/^ws/, 'http'), apiKey, apiSecret)
        .createDispatch(room, agentName, { metadata: JSON.stringify({ callToken, sessionId: session.id }) })

      const at = new AccessToken(apiKey, apiSecret, { identity: ctx.userId, name: ctx.email ?? undefined, ttl: '15m' })
      at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true })
      console.log('[voice-session] call started', { userId: ctx.userId, sessionId: session.id, room })
      return reply(200, { url: livekitUrl, token: await at.toJwt(), room, session_id: session.id })
    }

    const sessionId = typeof body.session_id === 'string' ? body.session_id : null
    if (!sessionId) return fail(400, 'bad_request', 'session_id is required')

    if (action === 'refresh') {
      const { data: call, error } = await service
        .from('voice_calls')
        .select('id, created_at')
        .eq('session_id', sessionId)
        .eq('user_id', ctx.userId)
        .maybeSingle()
      if (error) throw new Error(`voice_calls lookup failed: ${error.code}`)
      if (!call) return fail(404, 'not_found', 'No live call')
      const cap = Date.parse(call.created_at) + CALL_CAP_MS
      const { data: updated, error: updateError } = await service
        .from('voice_calls')
        .update({ access_token: jwt, expires_at: new Date(Math.min(jwtExpiry(jwt), cap)).toISOString() })
        .eq('id', call.id)
        .select('id')
      if (updateError || !updated?.length) throw new Error(`voice_calls refresh failed: ${updateError?.code ?? 'no row'}`)
      return reply(200, { ok: true })
    }

    if (action === 'end') {
      const { error } = await service.from('voice_calls').delete().eq('session_id', sessionId).eq('user_id', ctx.userId)
      if (error) throw new Error(`voice_calls delete failed: ${error.code}`)
      console.log('[voice-session] call ended', { userId: ctx.userId, sessionId })
      return reply(200, { ok: true })
    }

    return fail(404, 'not_found', 'Not found')
  } catch (err) {
    console.error('[voice-session] failed', { action, userId: ctx.userId, reason: err instanceof Error ? err.message : String(err) })
    return fail(500, 'internal_error', 'Glasovni poziv nije uspio. Pokušajte ponovno.')
  }
})
