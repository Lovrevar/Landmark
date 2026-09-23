// Characterisation: everything ai-chat decides BEFORE it opens the stream.
//
// These failures come back as flat JSON with a real HTTP status (analysis §1).
// Scenario ids (P01…) match the coverage table in docs/voice/03-characterisation-tests.md.

import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1'
import { answer } from './fake-anthropic.ts'
import { anthropic, call, chat, clientOf, db, flatError, logs, scenario } from './harness.ts'
import { P_TIC, TOKENS, USERS } from './fixtures.ts'

const D = USERS.director

function seedSession(userId: string, id = crypto.randomUUID()): string {
  db.seed('ai_sessions', [{ id, user_id: userId, title: 'postojeći razgovor' }])
  return id
}

/** Seed `n` rows with role='user' in one of the user's sessions, `ageMs` old. */
function seedUserRows(n: number, ageMs: number, content: unknown[] = [{ type: 'text', text: 'pitanje' }]): void {
  const sid = seedSession(D.id)
  const at = new Date(Date.now() - ageMs).toISOString()
  db.seed('ai_messages', Array.from({ length: n }, () => ({ session_id: sid, role: 'user', content, created_at: at })))
}

// ---------------------------------------------------------------------------
// Transport and authentication
// ---------------------------------------------------------------------------

scenario('P01 OPTIONS preflight returns 200 with CORS headers', async () => {
  const res = await call(null, { method: 'OPTIONS', token: null })
  assertEquals(res.status, 200)
  assertEquals(res.headers.get('access-control-allow-origin'), '*')
  assertMatch(res.headers.get('access-control-allow-headers') ?? '', /authorization/)
})

scenario('P02 non-POST is rejected with 405 method_not_allowed', async () => {
  const res = await call(null, { method: 'GET' })
  assertEquals(await flatError(res), { status: 405, code: 'method_not_allowed', message: 'Only POST is supported' })
})

scenario('P03 missing Authorization header is 401, before any DB or model access', async () => {
  const res = await call({ message: 'x' }, { token: null })
  assertEquals((await flatError(res)).status, 401)
  assertEquals(db.requests.length, 0)
  assertEquals(anthropic.calls.length, 0)
})

scenario('P04 a token GoTrue rejects is 401 unauthorized', async () => {
  const res = await call({ message: 'x' }, { token: 'tok-forged' })
  assertEquals(await flatError(res), { status: 401, code: 'unauthorized', message: 'Invalid or expired token' })
})

scenario('P05 a valid auth user with no public.users profile is 403 no_profile', async () => {
  const res = await call({ message: 'x' }, { token: TOKENS.orphan })
  assertEquals((await flatError(res)).code, 'no_profile')
})

scenario('P06 role and Supervision project assignments are re-read from the DB with the service role on every request', async () => {
  anthropic.script(answer('ok'))
  await chat({ session_id: null, message: 'x' }, { token: TOKENS.supervision })
  const users = db.requestsTo('users', 'GET')
  const pm = db.requestsTo('project_managers', 'GET')
  assertEquals(users.length, 1)
  assertEquals(users[0].params.get('auth_user_id'), `eq.${USERS.supervision.authId}`)
  assertEquals(pm.length, 1)
  assert([...users, ...pm].every((r) => clientOf(r) === 'service'))
  // ...and the assignment reaches the prompt as an RLS scope note.
  const system = anthropic.calls[0].body.system as Array<{ text: string }>
  assertMatch(system[1].text, /uloga: Supervision\. Korisnikov pristup podacima ograničen je na projekte koje nadzire/)
})

scenario('P07 non-Supervision roles do not query project_managers', async () => {
  anthropic.script(answer('ok'))
  await chat({ session_id: null, message: 'x' }, { token: TOKENS.accounting })
  assertEquals(db.requestsTo('project_managers').length, 0)
})

// ---------------------------------------------------------------------------
// Body validation
// ---------------------------------------------------------------------------

scenario('P08 a malformed JSON body is 400 bad_request', async () => {
  const res = await call(null, { raw: '{"message": ' })
  assertEquals(await flatError(res), { status: 400, code: 'bad_request', message: 'Request body must be valid JSON.' })
})

scenario('P09 missing, empty and whitespace-only messages are 400 bad_request', async () => {
  for (const body of [{}, { message: '' }, { message: '   \n ' }, { message: 42 }]) {
    const res = await call(body)
    assertEquals((await flatError(res)).code, 'bad_request', JSON.stringify(body))
  }
})

scenario('P10 the 4000-character cap counts the raw string: 4000 passes, 4001 is message_too_long', async () => {
  const tooLong = await call({ message: 'a'.repeat(4001) })
  assertEquals(await flatError(tooLong), { status: 400, code: 'message_too_long', message: 'Message exceeds 4000 character limit.' })
  // Leading whitespace counts too: the cap is applied before trim().
  const padded = await call({ message: ' '.repeat(3990) + 'b'.repeat(11) })
  assertEquals((await flatError(padded)).code, 'message_too_long')
  anthropic.script(answer('ok'))
  const sse = await chat({ session_id: null, message: 'a'.repeat(4000) })
  assertEquals(sse.types.at(-1), 'done')
})

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

scenario('P11 burst limit: 19 user rows in the last 5 minutes pass, 20 are 429 rate_limited', async () => {
  seedUserRows(19, 60_000)
  anthropic.script(answer('ok'))
  const ok = await chat({ session_id: null, message: 'x' })
  assertEquals(ok.types.at(-1), 'done')

  // That request itself added the 20th user row.
  const blocked = await call({ session_id: null, message: 'y' })
  assertEquals(await flatError(blocked), {
    status: 429,
    code: 'rate_limited',
    message: 'Previše zahtjeva. Pokušajte ponovno za nekoliko minuta.',
  })
})

scenario('P12 daily limit: 200 user rows older than the burst window are 429', async () => {
  seedUserRows(200, 60 * 60 * 1000)
  const res = await call({ session_id: null, message: 'x' })
  assertEquals((await flatError(res)).code, 'rate_limited')
})

scenario('P13 a rate-limited request creates no session and writes nothing', async () => {
  seedUserRows(20, 60_000)
  const before = db.rows('ai_sessions').length
  await call({ session_id: null, message: 'x' })
  assertEquals(db.rows('ai_sessions').length, before)
  assertEquals(db.requestsTo('ai_messages', 'POST').length, 0)
})

scenario('P14 [OQ-3] tool_result rows count toward the per-user message limits', async () => {
  // Tool results are persisted as role='user' (the Anthropic wire contract),
  // and the limiter counts role='user' rows. So 20 tool round trips exhaust
  // the "20 user messages per 5 minutes" burst limit with no user message at all.
  seedUserRows(20, 60_000, [{ type: 'tool_result', tool_use_id: 'toolu_x', content: '{}', is_error: false }])
  const res = await call({ session_id: null, message: 'x' })
  assertEquals((await flatError(res)).code, 'rate_limited')
})

scenario('P15 the limiter counts through ai_sessions!inner with the service role, filtered to this user', async () => {
  anthropic.script(answer('ok'))
  await chat({ session_id: null, message: 'x' })
  const counts = db.requestsTo('ai_messages', 'HEAD')
  assertEquals(counts.length, 2) // burst + daily, issued together
  for (const c of counts) {
    assertEquals(clientOf(c), 'service')
    assertEquals(c.params.get('select'), 'id,ai_sessions!inner(user_id)')
    assertEquals(c.params.get('role'), 'eq.user')
    assertEquals(c.params.get('ai_sessions.user_id'), `eq.${D.id}`)
    assertMatch(c.headers.get('Prefer') ?? '', /count=exact/)
  }
})

scenario('P16 a failing count query fails OPEN: the request proceeds and the failure is logged', async () => {
  db.fault((r) => r.table === 'ai_messages' && r.method === 'HEAD', { status: 500 }, 2)
  anthropic.script(answer('ok'))
  const sse = await chat({ session_id: null, message: 'x' })
  assertEquals(sse.types.at(-1), 'done')
  assert(logs.some((l) => l.level === 'error' && l.line.includes('[rateLimit] count query failed; allowing request')))
})

// ---------------------------------------------------------------------------
// Session and parent resolution
// ---------------------------------------------------------------------------

scenario('P17 an unknown session_id, or another user\'s session, is 404 session_not_found', async () => {
  const theirs = seedSession(USERS.sales.id)
  for (const session_id of [crypto.randomUUID(), theirs]) {
    const res = await call({ session_id, message: 'x' })
    assertEquals(await flatError(res), { status: 404, code: 'session_not_found', message: 'Session not found' })
  }
  const lookups = db.requestsTo('ai_sessions', 'GET')
  assertEquals(lookups.length, 2)
  assert(lookups.every((r) => r.params.get('user_id') === `eq.${D.id}`))
})

scenario('P18 proposed_session_id: honoured when free, replaced when taken, ignored when not a UUID', async () => {
  const free = crypto.randomUUID()
  anthropic.script(answer('a'), answer('b'), answer('c'))
  const a = await chat({ session_id: null, message: 'x', proposed_session_id: free })
  assertEquals(a.events[0].data, { type: 'session', session_id: free })

  const taken = seedSession(USERS.sales.id) // exists, and belongs to someone else
  const b = await chat({ session_id: null, message: 'x', proposed_session_id: taken })
  assert(b.events[0].data.session_id !== taken)

  const c = await chat({ session_id: null, message: 'x', proposed_session_id: 'not-a-uuid' })
  assertMatch(c.events[0].data.session_id, /^[0-9a-f-]{36}$/)
})

scenario('P19 a parent_message_id outside the session is 404 not_found', async () => {
  const sid = seedSession(D.id)
  const res = await call({ session_id: sid, message: 'x', parent_message_id: crypto.randomUUID() })
  assertEquals(await flatError(res), { status: 404, code: 'not_found', message: 'Parent message not found.' })
})

scenario('P20 edits: rejected on a new session, on an unknown target, and on an assistant row', async () => {
  const onNew = await call({ session_id: null, message: 'x', edit_message_id: crypto.randomUUID() })
  assertEquals((await flatError(onNew)).code, 'invalid_request')

  const sid = seedSession(D.id)
  const missing = await call({ session_id: sid, message: 'x', edit_message_id: crypto.randomUUID() })
  assertEquals(await flatError(missing), { status: 404, code: 'not_found', message: 'Message not found.' })

  db.seed('ai_messages', [{ id: crypto.randomUUID(), session_id: sid, role: 'assistant', content: [] }])
  const assistantId = db.rows('ai_messages').at(-1)!.id
  const onAssistant = await call({ session_id: sid, message: 'x', edit_message_id: assistantId })
  assertEquals(await flatError(onAssistant), { status: 400, code: 'invalid_request', message: 'Only user messages can be edited.' })
})

scenario('P21 a cycle in the parent chain is 500 "Conversation tree is corrupted."', async () => {
  const sid = seedSession(D.id)
  const a = crypto.randomUUID()
  const b = crypto.randomUUID()
  db.seed('ai_messages', [
    { id: a, session_id: sid, role: 'user', content: [{ type: 'text', text: 'a' }], parent_id: b },
    { id: b, session_id: sid, role: 'assistant', content: [{ type: 'text', text: 'b' }], parent_id: a },
  ])
  const res = await call({ session_id: sid, message: 'x', parent_message_id: b })
  assertEquals(await flatError(res), { status: 500, code: 'internal_error', message: 'Conversation tree is corrupted.' })
})

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

const att = (over: Record<string, unknown> = {}) => ({
  storage_path: `${D.authId}/s/f.txt`,
  file_name: 'f.txt',
  file_size: 10,
  mime_type: 'text/plain',
  kind: 'text',
  extracted_text: 'sadržaj',
  ...over,
})

scenario('P22 attachment validation rejects each malformed shape, before the rate limiter runs', async () => {
  const cases: Array<[unknown[], string]> = [
    [[att(), att(), att(), att(), att()], 'too_many_attachments'],
    [[att({ kind: 'video' })], 'invalid_attachment_kind'],
    [[att({ mime_type: 'application/zip' })], 'unsupported_attachment_type'],
    [[att({ file_name: 'f.exe' })], 'unsupported_attachment_type'],
    [[att({ file_size: 0 })], 'invalid_attachment'],
    [[att({ file_size: 3 * 1024 * 1024 })], 'attachment_too_large'],
    [[att({ storage_path: `${USERS.sales.authId}/s/f.txt` })], 'attachment_path_rejected'],
    [[att({ storage_path: `${D.authId}/../x/f.txt` })], 'attachment_path_rejected'],
    [[att({ extracted_text: '' })], 'invalid_attachment'],
    [[att({ extracted_text: 'x'.repeat(50 * 1024 + 1) })], 'attachment_too_large'],
    [[att({ kind: 'image', mime_type: 'image/png', file_name: 'a.png', extracted_text: 'x' })], 'invalid_attachment'],
  ]
  for (const [attachments, code] of cases) {
    const res = await call({ session_id: null, message: 'x', attachments })
    assertEquals((await flatError(res)).code, code, JSON.stringify(attachments).slice(0, 120))
  }
  assertEquals(db.requestsTo('ai_messages', 'HEAD').length, 0) // no rate-limit budget consumed
})

scenario('P23 attachments combined with an edit are 400 edit_with_attachments_unsupported', async () => {
  const sid = seedSession(D.id)
  const res = await call({ session_id: sid, message: 'x', edit_message_id: crypto.randomUUID(), attachments: [att()] })
  assertEquals((await flatError(res)).code, 'edit_with_attachments_unsupported')
})

// ---------------------------------------------------------------------------
// Pre-stream persistence failures
// ---------------------------------------------------------------------------

scenario('P24 [OQ-7] a failed user-row insert is 500, and leaves the just-created session behind, empty', async () => {
  db.fault((r) => r.table === 'ai_messages' && r.method === 'POST', { status: 500 })
  const res = await call({ session_id: null, message: 'x' })
  assertEquals(await flatError(res), { status: 500, code: 'internal_error', message: 'Failed to persist user message' })
  const mine = db.rows('ai_sessions').filter((s) => s.user_id === D.id)
  assertEquals(mine.length, 1)
  assertEquals(db.rows('ai_messages').filter((m) => m.session_id === mine[0].id).length, 0)
})

scenario('P25 a failed session insert is 500 "Failed to create session"', async () => {
  db.fault((r) => r.table === 'ai_sessions' && r.method === 'POST', { status: 500 })
  const res = await call({ session_id: null, message: 'x' })
  assertEquals(await flatError(res), { status: 500, code: 'internal_error', message: 'Failed to create session' })
})

scenario('P26 a failed history load is 500 "Failed to load history"', async () => {
  const sid = seedSession(D.id)
  const leaf = crypto.randomUUID()
  db.seed('ai_messages', [{ id: leaf, session_id: sid, role: 'user', content: [{ type: 'text', text: 'a' }] }])
  db.fault((r) => r.table === 'ai_messages' && r.method === 'GET' && r.params.get('select') === 'id,role,content,parent_id', { status: 500 })
  const res = await call({ session_id: sid, message: 'x', parent_message_id: leaf })
  assertEquals(await flatError(res), { status: 500, code: 'internal_error', message: 'Failed to load history' })
})

scenario('P27 a failed attachment side-table insert rolls back the user row and removes the stored files', async () => {
  db.fault((r) => r.table === 'ai_message_attachments' && r.method === 'POST', { status: 500 })
  const res = await call({ session_id: null, message: 'x', attachments: [att()] })
  assertEquals(await flatError(res), { status: 500, code: 'internal_error', message: 'Failed to persist attachments' })
  assertEquals(db.rows('ai_messages').filter((m) => JSON.stringify(m.content).includes('sadržaj')).length, 0)
  const removal = db.requests.find((r) => r.service === 'storage' && r.method === 'DELETE')
  assertEquals((removal?.body as { prefixes: string[] }).prefixes, [`${D.authId}/s/f.txt`])
})

scenario('P28 an image that cannot be downloaded is 500 attachment_processing_failed', async () => {
  const res = await call({
    session_id: null,
    message: 'x',
    attachments: [att({ kind: 'image', mime_type: 'image/png', file_name: 'a.png', storage_path: `${D.authId}/s/a.png`, extracted_text: null })],
  })
  assertEquals(await flatError(res), { status: 500, code: 'attachment_processing_failed', message: 'Greška pri obradi priloga.' })
})

// ---------------------------------------------------------------------------
// Debug branch
// ---------------------------------------------------------------------------

scenario('P29 debug branch: 404 while AI_CHAT_DEBUG_ENABLED is anything but the literal "true"', async () => {
  for (const value of [undefined, '1', 'TRUE', 'yes']) {
    if (value === undefined) Deno.env.delete('AI_CHAT_DEBUG_ENABLED')
    else Deno.env.set('AI_CHAT_DEBUG_ENABLED', value)
    const res = await call({ debug_tool: 'search_projects', input: { query: 'Fun' } })
    assertEquals(await flatError(res), { status: 404, code: 'not_found', message: 'Not found' }, String(value))
  }
})

scenario('P30 debug branch, enabled: Director-only, 404 for unknown tools, runs the handler directly', async () => {
  Deno.env.set('AI_CHAT_DEBUG_ENABLED', 'true')
  const sales = await call({ debug_tool: 'search_projects', input: {} }, { token: TOKENS.sales })
  assertEquals((await flatError(sales)).code, 'debug_forbidden')

  const unknown = await call({ debug_tool: 'drop_everything' })
  assertEquals((await flatError(unknown)).code, 'tool_not_found')

  const ok = await call({ debug_tool: 'search_projects', input: { query: 'Fun' } })
  assertEquals(ok.status, 200)
  const body = await ok.json()
  assertEquals(body.ok, true)
  assertEquals(body.debug.output.data.projects.map((p: { id: string }) => p.id), [P_TIC])
  assertEquals(anthropic.calls.length, 0)
  assertEquals(db.rows('ai_sessions').length, 0) // no session, no rate limit
})

// ---------------------------------------------------------------------------
// Remaining pre-stream failure branches
// ---------------------------------------------------------------------------

scenario('P31 a missing Supabase secret is 500 "Server misconfigured"; an unusable URL reaches the outer catch', async () => {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const url = Deno.env.get('SUPABASE_URL')!
  try {
    Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY')
    assertEquals(await flatError(await call({ message: 'x' })), { status: 500, code: 'internal_error', message: 'Server misconfigured' })
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', key)
    Deno.env.set('SUPABASE_URL', 'not a url')
    assertEquals(await flatError(await call({ message: 'x' })), { status: 500, code: 'internal_error', message: 'Internal server error' })
    assert(logs.some((l) => l.line.includes('[ai-chat] unhandled error')))
  } finally {
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', key)
    Deno.env.set('SUPABASE_URL', url)
  }
})

scenario('P32 session-resolution query failures are 500s with distinct messages', async () => {
  db.fault((r) => r.table === 'ai_sessions' && r.method === 'GET', { status: 500 })
  const probe = await call({ session_id: null, message: 'x', proposed_session_id: crypto.randomUUID() })
  assertEquals(await flatError(probe), { status: 500, code: 'internal_error', message: 'Failed to check proposed session' })

  const sid = seedSession(D.id)
  db.fault((r) => r.table === 'ai_sessions' && r.method === 'GET', { status: 500 })
  const lookup = await call({ session_id: sid, message: 'x' })
  assertEquals(await flatError(lookup), { status: 500, code: 'internal_error', message: 'Failed to load session' })
})

scenario('P33 edit-target and parent lookup failures are 500s', async () => {
  const sid = seedSession(D.id)
  db.fault((r) => r.table === 'ai_messages' && r.method === 'GET' && r.params.get('select') === 'id,role,parent_id', { status: 500 })
  const edit = await call({ session_id: sid, message: 'x', edit_message_id: crypto.randomUUID() })
  assertEquals(await flatError(edit), { status: 500, code: 'internal_error', message: 'Failed to look up message to edit.' })

  db.fault((r) => r.table === 'ai_messages' && r.method === 'GET' && r.params.get('select') === 'id', { status: 500 })
  const parent = await call({ session_id: sid, message: 'x', parent_message_id: crypto.randomUUID() })
  assertEquals(await flatError(parent), { status: 500, code: 'internal_error', message: 'Failed to look up parent message.' })
})
