import type { AuthContext } from './auth.ts'

// Limits are intentionally generous for v1. Tune in production based on
// observed usage. Both are per user across all sessions.
const BURST_WINDOW_MS = 5 * 60 * 1000          // 5 minutes
const BURST_LIMIT = 20
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000    // 24 hours
const DAILY_LIMIT = 200

export interface RateLimitOk {
  ok: true
}
export interface RateLimitBlocked {
  ok: false
  // Internal — for logging. Not surfaced to the user (we don't want to leak
  // which limit fired or what the threshold is).
  reason: 'burst' | 'daily'
  count: number
  limit: number
  windowMs: number
}
export type RateLimitVerdict = RateLimitOk | RateLimitBlocked

export async function checkRateLimit(ctx: AuthContext): Promise<RateLimitVerdict> {
  // NOTE: Race condition. If a user fires N concurrent requests within
  // milliseconds, all N queries observe count < limit and all N proceed.
  // Worst case is bounded by network round-trips per concurrent request,
  // not by the limit itself. Acceptable for v1; a real fix needs Postgres
  // advisory locks or a token-bucket store.

  const now = Date.now()
  const burstSince = new Date(now - BURST_WINDOW_MS).toISOString()
  const dailySince = new Date(now - DAILY_WINDOW_MS).toISOString()

  // Two parallel queries. Each counts ai_messages rows authored by this user
  // (role='user') whose session belongs to them (RLS-equivalent ownership
  // check via the join), within the respective window.
  //
  // We use the service client because:
  //   (a) the join from ai_messages -> ai_sessions requires reading
  //       ai_sessions.user_id to gate by it, and using the JWT-scoped
  //       client here gives us nothing extra (we explicitly filter on
  //       user_id == ctx.userId);
  //   (b) consistency with the rest of handleChat's persistence layer.
  //
  // PostgREST `count: 'exact'` returns the total rows matching; we don't
  // need the row data, just the count.

  const [burst, daily] = await Promise.all([
    ctx.serviceClient
      .from('ai_messages')
      .select('id, ai_sessions!inner(user_id)', { count: 'exact', head: true })
      .eq('role', 'user')
      .eq('ai_sessions.user_id', ctx.userId)
      .gte('created_at', burstSince),
    ctx.serviceClient
      .from('ai_messages')
      .select('id, ai_sessions!inner(user_id)', { count: 'exact', head: true })
      .eq('role', 'user')
      .eq('ai_sessions.user_id', ctx.userId)
      .gte('created_at', dailySince),
  ])

  if (burst.error || daily.error) {
    // Fail open on the rate-limit check itself. A flaky count query
    // shouldn't lock users out — the worst case is they get rate-limited
    // by Anthropic upstream instead. Log loudly.
    console.error('[rateLimit] count query failed; allowing request', {
      userId: ctx.userId,
      burstErr: burst.error?.message,
      dailyErr: daily.error?.message,
    })
    return { ok: true }
  }

  const burstCount = burst.count ?? 0
  const dailyCount = daily.count ?? 0

  if (burstCount >= BURST_LIMIT) {
    return {
      ok: false,
      reason: 'burst',
      count: burstCount,
      limit: BURST_LIMIT,
      windowMs: BURST_WINDOW_MS,
    }
  }
  if (dailyCount >= DAILY_LIMIT) {
    return {
      ok: false,
      reason: 'daily',
      count: dailyCount,
      limit: DAILY_LIMIT,
      windowMs: DAILY_WINDOW_MS,
    }
  }

  return { ok: true }
}
