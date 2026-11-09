// The caller's signed assertion (docs/ASSISTANT_API.md, "Who is calling").
//
// The company assistant signs a short HS256 JWT per request with
// ASSISTANT_API_SECRET: iss "va", aud "landmark-assistant-api", sub the
// employee's email, a jti, and at most 60 s between iat and exp. A jti is
// remembered for 120 s so a captured assertion cannot be replayed. The memory
// is per isolate: a cold start forgets it, which a 60 s token makes acceptable
// only while iat is honest: an iat minted an hour ahead would pass every other
// check and outlive the memory, so an iat more than 30 s ahead is refused too.

import { errors, jwtVerify } from 'npm:jose@5.10.0'

export const ISSUER = 'va'
export const AUDIENCE = 'landmark-assistant-api'
const MAX_LIFETIME_S = 60
const MAX_IAT_AHEAD_S = 30
const JTI_MEMORY_MS = 120_000

// No `*` or `%`: PostgREST reads both as wildcards in the ilike that maps the
// email to a user, so an address carrying one could match someone else.
const EMAIL = /^[^\s@*%\\]+@[^\s@*%\\]+\.[^\s@*%\\]+$/

const seenJti = new Map<string, number>()

export type AssertionResult =
  | { ok: true; email: string }
  | { ok: false; reason: string }

/** The employee's email from a valid assertion; otherwise only the reason,
 * which names the failed check and never a claim's value. */
export async function verifyAssertion(token: string, secret: string, now = Date.now()): Promise<AssertionResult> {
  let payload
  try {
    ;({ payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
      requiredClaims: ['exp', 'iat', 'jti', 'sub'],
      currentDate: new Date(now),
    }))
  } catch (err) {
    if (err instanceof errors.JWTClaimValidationFailed) return { ok: false, reason: `claim:${err.claim}:${err.reason}` }
    if (err instanceof errors.JOSEError) return { ok: false, reason: err.code }
    return { ok: false, reason: 'malformed' }
  }

  const { exp, iat, jti, sub } = payload
  if (typeof exp !== 'number' || typeof iat !== 'number' || exp - iat > MAX_LIFETIME_S) {
    return { ok: false, reason: 'lifetime_too_long' }
  }
  if (iat > Math.floor(now / 1000) + MAX_IAT_AHEAD_S) return { ok: false, reason: 'iat_in_future' }
  if (typeof jti !== 'string' || jti.length === 0) return { ok: false, reason: 'jti_missing' }
  if (typeof sub !== 'string' || !EMAIL.test(sub)) return { ok: false, reason: 'sub_not_email' }

  for (const [seen, forgetAt] of seenJti) if (forgetAt <= now) seenJti.delete(seen)
  if (seenJti.has(jti)) return { ok: false, reason: 'jti_replayed' }
  seenJti.set(jti, now + JTI_MEMORY_MS)

  return { ok: true, email: sub }
}
