// The pure parts of assistant-api: the voice clamp, the input validator, the
// rate limiter and the assertion check.

import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1'
import { SignJWT } from 'npm:jose@5.10.0'
import { TOOL_ALLOWLIST, TOOLS } from '../../_shared/tools.ts'
import { verifyAssertion } from '../assertion.ts'
import { RateLimiter } from '../rateLimit.ts'
import { assertSupported, validate } from '../validate.ts'
import { clampForVoice } from '../voice.ts'

// ---------------------------------------------------------------------------
// clampForVoice
// ---------------------------------------------------------------------------

Deno.test('U01 a long array keeps five items and its total beside it; a short one is untouched', () => {
  const out = clampForVoice({ data: { rows: [1, 2, 3, 4, 5, 6, 7], count: 7 }, few: [1, 2] }) as {
    data: { rows: number[]; total: number; count: number }
    few: number[]
    total?: number
  }
  assertEquals(out.data.rows, [1, 2, 3, 4, 5])
  assertEquals(out.data.total, 7)
  assertEquals(out.data.count, 7)
  assertEquals(out.few, [1, 2])
  assertEquals(out.total, undefined)
})

Deno.test('U02 the total takes <key>_total when total is taken or several arrays are cut', () => {
  const taken = clampForVoice({ rows: [1, 2, 3, 4, 5, 6], total: 99 }) as Record<string, unknown>
  assertEquals(taken.total, 99)
  assertEquals(taken.rows_total, 6)
  const two = clampForVoice({ a: Array(6).fill(0), b: Array(9).fill(0) }) as Record<string, unknown>
  assertEquals(two.a_total, 6)
  assertEquals(two.b_total, 9)
  assertEquals(two.total, undefined)
})

Deno.test('U03 nested arrays are clamped, long strings clipped, ids and numbers kept', () => {
  const id = '00000000-0000-4000-8000-000000000001'
  const out = clampForVoice({ items: [{ id, notes: 'y'.repeat(250), lines: Array(8).fill('a'), n: 3 }] }) as {
    items: Array<{ id: string; notes: string; lines: string[]; total: number; n: number }>
  }
  assertEquals(out.items[0].id, id)
  assertEquals(out.items[0].notes, `${'y'.repeat(200)}…`)
  assertEquals(out.items[0].lines.length, 5)
  assertEquals(out.items[0].total, 8)
  assertEquals(out.items[0].n, 3)
  assertEquals(clampForVoice([1, 2, 3, 4, 5, 6]), { items: [1, 2, 3, 4, 5], total: 6 })
  assertEquals(clampForVoice(null), null)
})

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------

Deno.test('U04 every exposed tool schema uses only keywords the validator understands', () => {
  for (const name of TOOL_ALLOWLIST.voice) assertSupported(TOOLS.find((t) => t.name === name)!.input_schema, name)
  assertThrows(() => assertSupported({ type: 'object', properties: { x: { type: 'string', pattern: '^a' } } }))
})

Deno.test('U05 validate accepts good input and names the first problem with bad input', () => {
  const schema = TOOLS.find((t) => t.name === 'list_contracts')!.input_schema
  assertEquals(validate({}, schema), null)
  assertEquals(validate({ status: 'active', limit: 5, classification_id: 3 }, schema), null)
  assert(validate({ status: 'ACTIVE' }, schema)?.includes('input.status'))
  assert(validate({ limit: 0 }, schema)?.includes('input.limit'))
  assert(validate({ limit: 2.5 }, schema)?.includes('input.limit'))
  assert(validate({ project_id: 'nope' }, schema)?.includes('uuid'))
  assert(validate({ other: 1 }, schema)?.includes('not allowed'))
  assert(validate({ query: '' }, TOOLS.find((t) => t.name === 'search_projects')!.input_schema)?.includes('too short'))
})

// ---------------------------------------------------------------------------
// RateLimiter
// ---------------------------------------------------------------------------

Deno.test('U06 thirty calls a minute per user; the window slides; users are separate', () => {
  let t = 1_000_000
  const limiter = new RateLimiter(30, () => t)
  for (let i = 0; i < 30; i++) assert(limiter.allow('u1'))
  assert(!limiter.allow('u1'))
  assert(limiter.allow('u2'))
  t += 59_999
  assert(!limiter.allow('u1'))
  t += 2
  assert(limiter.allow('u1'))
})

// ---------------------------------------------------------------------------
// verifyAssertion
// ---------------------------------------------------------------------------

const SECRET = 'unit-secret'
async function token(claims: Record<string, unknown>): Promise<string> {
  return await new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode(SECRET))
}

Deno.test('U07 a valid assertion gives the email; a jti is refused the second time only', async () => {
  const now = Date.now()
  const iat = Math.floor(now / 1000)
  const t = await token({ iss: 'va', aud: 'landmark-assistant-api', sub: 'a@b.hr', iat, exp: iat + 60, jti: 'j-1' })
  assertEquals(await verifyAssertion(t, SECRET, now), { ok: true, email: 'a@b.hr' })
  assertEquals(await verifyAssertion(t, SECRET, now), { ok: false, reason: 'jti_replayed' })
})

Deno.test('U08 a jti is forgotten after 120 s', async () => {
  const now = Date.now()
  const iat = Math.floor(now / 1000)
  const first = await token({ iss: 'va', aud: 'landmark-assistant-api', sub: 'a@b.hr', iat, exp: iat + 60, jti: 'j-2' })
  assert((await verifyAssertion(first, SECRET, now)).ok)
  const later = now + 121_000
  const liat = Math.floor(later / 1000)
  const second = await token({ iss: 'va', aud: 'landmark-assistant-api', sub: 'a@b.hr', iat: liat, exp: liat + 60, jti: 'j-2' })
  assert((await verifyAssertion(second, SECRET, later)).ok)
})

Deno.test('U10 an iat more than 30 s ahead is refused; 30 s of skew is allowed', async () => {
  const now = Date.now()
  const claims = (iat: number) => ({ iss: 'va', aud: 'landmark-assistant-api', sub: 'a@b.hr', iat, exp: iat + 60, jti: crypto.randomUUID() })
  const sec = Math.floor(now / 1000)
  assertEquals(await verifyAssertion(await token(claims(sec + 31)), SECRET, now), { ok: false, reason: 'iat_in_future' })
  assertEquals(await verifyAssertion(await token(claims(sec + 30)), SECRET, now), { ok: true, email: 'a@b.hr' })
})

Deno.test('U09 a missing jti, sub or iat is refused, with the reason and no value', async () => {
  const iat = Math.floor(Date.now() / 1000)
  for (const drop of ['jti', 'sub', 'iat']) {
    const claims: Record<string, unknown> = { iss: 'va', aud: 'landmark-assistant-api', sub: 'secret@b.hr', iat, exp: iat + 30, jti: `j-${drop}` }
    delete claims[drop]
    const verdict = await verifyAssertion(await token(claims), SECRET)
    assert(!verdict.ok, drop)
    assert(!('reason' in verdict && verdict.reason.includes('secret@b.hr')), drop)
  }
})
