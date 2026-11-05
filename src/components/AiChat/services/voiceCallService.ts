import { supabase } from '../../../lib/supabase'
import { logActivity } from '../../../lib/activityLog'

// The voice-session edge function (docs/voice/02-voice-implementation-plan.md §4.4): it creates the
// call's ai_sessions row, hands the caller's JWT to the voice agent by an opaque token, and dispatches
// the agent into a LiveKit room. The browser only ever gets a token to join that room.

export interface VoiceCallSession {
  url: string
  token: string
  room: string
  session_id: string
}

export class VoiceCallError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'VoiceCallError'
  }
}

async function callVoiceSession<T>(action: 'start' | 'refresh' | 'end', body: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  if (!accessToken) throw new VoiceCallError(401, 'Not authenticated')
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) throw new VoiceCallError(500, 'VITE_SUPABASE_URL is not configured')
  const response = await fetch(`${supabaseUrl}/functions/v1/voice-session/${action}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    let message = `voice-session/${action} failed`
    try {
      message = (await response.json())?.error?.message ?? message
    } catch {
      /* keep the generic message */
    }
    throw new VoiceCallError(response.status, message)
  }
  return (await response.json()) as T
}

export async function startVoiceCall(): Promise<VoiceCallSession> {
  const session = await callVoiceSession<VoiceCallSession>('start', {})
  void logActivity({
    action: 'voice_call.start',
    entity: 'voice_call',
    entityId: session.session_id,
    severity: 'medium',
    metadata: { entity_name: 'Glasovni poziv' },
  })
  return session
}

/** Hands the browser's refreshed JWT to the live call; the call's 15-minute cap does not move. */
export async function refreshVoiceCall(sessionId: string): Promise<void> {
  await callVoiceSession('refresh', { session_id: sessionId })
}

/** Deletes the call's stored credential. The ai_sessions row and its messages stay. */
export async function endVoiceCall(sessionId: string): Promise<void> {
  await callVoiceSession('end', { session_id: sessionId })
}

/** Calls back whenever supabase-js refreshes the access token; returns the unsubscribe. */
export function onAccessTokenRefreshed(callback: () => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'TOKEN_REFRESHED') callback()
  })
  return () => data.subscription.unsubscribe()
}
