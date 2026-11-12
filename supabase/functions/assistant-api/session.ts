// Which Landmark user an assertion speaks for, and a real session for them
// (docs/ASSISTANT_API.md, "Which Landmark user").
//
// The handlers read through the user's own RLS client, exactly as in chat, so
// the request needs that user's access token. There is no browser to hand one
// over: the service role mints a magic link and verifies it at once, which
// yields an ordinary session. SessionCache keeps it for a few minutes and
// reuses it for that user's next requests; it is signed out when dropped.
// Neither the link, its hash nor the token is ever logged.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from '../_shared/database.ts'

type Service = SupabaseClient<Database>

export interface MappedUser {
  id: string            // public.users.id
  authUserId: string    // auth.users.id
  username: string | null
  email: string         // public.users.email, as stored
}

/** `%`, `_` and `\` match literally in an ilike pattern only when escaped. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

/** The one public.users row with this email (any case) and a login; null if
 * there is none, or more than one. */
export async function mapUser(service: Service, email: string): Promise<MappedUser | null> {
  const { data, error } = await service
    .from('users')
    .select('id, auth_user_id, username, email')
    .ilike('email', escapeLike(email))
    .not('auth_user_id', 'is', null)
    .limit(2)
  if (error) throw new Error(`users lookup failed: ${error.code}`)
  if (!data || data.length === 0) return null
  if (data.length > 1) {
    console.warn('[assistant-api] not_mapped', { reason: 'ambiguous', rows: data.length })
    return null
  }
  return { id: data[0].id, authUserId: data[0].auth_user_id!, username: data[0].username, email: data[0].email! }
}

export interface MintedSession {
  accessToken: string
  /** When GoTrue says the access token expires, in ms since the epoch. */
  expiresAt: number
}

/** An access token for this user. The link is minted for the email on the
 * auth account the row points at, not the one on the row, so a drifted
 * public.users.email cannot sign in someone else. */
export async function openSession(service: Service, user: MappedUser): Promise<MintedSession> {
  const { data: found, error: getError } = await service.auth.admin.getUserById(user.authUserId)
  if (getError || !found.user?.email) throw new Error(`auth user lookup failed: ${getError?.code ?? 'no_email'}`)

  const { data: link, error: linkError } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: found.user.email,
  })
  if (linkError || !link.properties?.hashed_token) throw new Error(`generateLink failed: ${linkError?.code ?? 'no_hash'}`)

  const anon = createClient<Database>(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink',
  })
  if (verifyError || !verified.session?.access_token) throw new Error(`verifyOtp failed: ${verifyError?.code ?? 'no_session'}`)
  const { access_token, expires_at, expires_in } = verified.session
  const expiresAt = expires_at ? expires_at * 1000 : Date.now() + (expires_in ?? 0) * 1000
  return { accessToken: access_token, expiresAt }
}

/** Revoke a session. Best effort: a failure is logged, and the token still
 * expires on its own. */
export async function closeSession(service: Service, accessToken: string, userId: string): Promise<void> {
  const { error } = await service.auth.admin.signOut(accessToken, 'local')
  if (error) console.error('[assistant-api] session sign-out failed', { userId, code: error.code ?? error.status })
}

/** How long a minted session is reused: `ttlMs`, or until `marginMs` before
 * the token's own expiry, whichever comes first. Mutable only for the tests. */
export const SESSION_WINDOW = { ttlMs: 5 * 60_000, marginMs: 60_000 }

interface Entry {
  userId: string
  authUserId: string
  /** The mint, shared by every request that arrives while it runs. */
  mint: Promise<MintedSession>
  token: string | null
  /** Infinity while the mint is still running. */
  validUntil: number
  /** Requests holding the token right now; it is signed out only at zero. */
  inUse: number
  dropped: boolean
}

export interface Lease {
  token: string
  /** False when this request minted the session itself. */
  reused: boolean
  entry: Entry
}

/**
 * One session per public.users row, reused for SESSION_WINDOW (SEC-A14).
 * Minting is single-flight per user: GoTrue keeps one pending magic link per
 * user, so two mints at once would fail the first. In memory, per isolate,
 * best effort, like the jti memory: a cold start mints again. Role and
 * assigned projects are not cached; the caller still runs authenticateToken
 * on every request.
 */
export class SessionCache {
  private entries = new Map<string, Entry>()
  private signOuts = new Set<Promise<void>>()

  constructor(private service: () => Service) {}

  /** A token for this user: the cached one while it is valid, else a new one.
   * Every lease must be given back with `release`. */
  async acquire(user: MappedUser): Promise<Lease> {
    this.sweep()
    let entry = this.entries.get(user.id)
    if (entry && entry.authUserId !== user.authUserId) {
      this.drop(entry)
      entry = undefined
    }
    let reused = true
    if (!entry) {
      reused = false
      const e: Entry = {
        userId: user.id,
        authUserId: user.authUserId,
        mint: openSession(this.service(), user),
        token: null,
        validUntil: Infinity,
        inUse: 0,
        dropped: false,
      }
      // Registered before any caller awaits the mint, so it runs first.
      e.mint.then(
        (s) => {
          e.token = s.accessToken
          e.validUntil = Math.min(Date.now() + SESSION_WINDOW.ttlMs, s.expiresAt - SESSION_WINDOW.marginMs)
        },
        () => {
          // A failed mint is not cached: the next request tries again.
          if (this.entries.get(e.userId) === e) this.entries.delete(e.userId)
        },
      )
      this.entries.set(user.id, e)
      entry = e
    }
    entry.inUse++
    try {
      const s = await entry.mint
      return { token: s.accessToken, reused, entry }
    } catch (err) {
      entry.inUse--
      throw err
    }
  }

  release(lease: Lease): void {
    const e = lease.entry
    e.inUse--
    if (e.dropped && e.inUse === 0) this.signOut(e)
  }

  /** Stop reusing this session and sign it out once no request holds it.
   * Used when it expires, when GoTrue or PostgREST answer 401 for it, and
   * when the user's row now points at another auth account. */
  drop(entry: Entry): void {
    if (entry.dropped) return
    entry.dropped = true
    if (this.entries.get(entry.userId) === entry) this.entries.delete(entry.userId)
    if (entry.inUse === 0) this.signOut(entry)
  }

  /** Drop every session past its window. Runs at the start of each acquire. */
  sweep(now = Date.now()): void {
    for (const e of [...this.entries.values()]) if (e.validUntil <= now) this.drop(e)
  }

  /** Sign out everything, e.g. when the isolate shuts down. */
  dropAll(): void {
    for (const e of [...this.entries.values()]) this.drop(e)
  }

  /** Resolves when every sign-out started so far has finished (tests). */
  async idle(): Promise<void> {
    while (this.signOuts.size > 0) await Promise.all([...this.signOuts])
  }

  /** Forget everything without signing out (test reset). */
  clear(): void {
    this.entries.clear()
    this.signOuts.clear()
  }

  private signOut(e: Entry): void {
    if (!e.token) return
    const p = closeSession(this.service(), e.token, e.userId)
      .catch((err) => {
        console.error('[assistant-api] session sign-out failed', { userId: e.userId, errorClass: err instanceof Error ? err.constructor.name : typeof err })
      })
      .finally(() => this.signOuts.delete(p))
    this.signOuts.add(p)
    // Keep the isolate alive for it when the response has already gone out.
    ;(globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil?.(p)
  }
}
