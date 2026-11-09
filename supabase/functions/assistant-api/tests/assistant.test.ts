// assistant-api end to end, in-process (harness.ts): who may call it, which
// user it speaks for, what each route answers, and what it refuses. After every
// scenario the harness checks that no log line carries an email, an assertion,
// a token or a link hash.

import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1'
import { DOMAIN_RULES_HR } from '../../_shared/prompts.ts'
import { CT_LAND, P_TIC, PH_TIC_1, SC_BUILDER, USERS } from '../../ai-chat/tests/fixtures.ts'
import { call, db, errorCode, logs, NO_LOGIN, rateLimiter, scenario, sign, TOOL_TIMEOUT_MS, tool, UNDERSCORE, unsigned } from './harness.ts'

const VOICE_TWELVE = [
  'search_projects', 'get_project_details', 'list_project_phases',
  'search_subcontractors', 'list_cost_classifications', 'list_contracts',
  'get_subcontractor_payment_status', 'list_unpaid_invoices',
  'list_payments_for_subcontractor', 'get_invoice_summary',
  'get_project_financial_summary', 'search_help',
]
const now = () => Math.floor(Date.now() / 1000)

// ---------------------------------------------------------------------------
// Who is calling
// ---------------------------------------------------------------------------

scenario('A01 every bad assertion is 401 bad_assertion, before any database work', async () => {
  const cases: Array<[string, string | null]> = [
    ['no header', null],
    ['bad signature', await sign({}, 'some-other-secret')],
    ['wrong aud', await sign({ aud: 'someone-else' })],
    ['wrong iss', await sign({ iss: 'not-va' })],
    ['expired', await sign({ iat: now() - 120, exp: now() - 60 })],
    ['exp - iat over 60 s', await sign({ iat: now(), exp: now() + 61 })],
    ['iat an hour ahead', await sign({ iat: now() + 3600, exp: now() + 3630 })],
    ['alg none', unsigned()],
    ['sub not an email', await sign({ sub: 'direktor' })],
    ['sub with a wildcard', await sign({ sub: 'dir*@test.hr' })],
    ['garbage', 'not.a.jwt'],
  ]
  for (const [label, assertion] of cases) {
    const res = await call({ path: '/me', assertion })
    assertEquals(res.status, 401, label)
    assertEquals(errorCode(res.body), 'bad_assertion', label)
  }
  assertEquals(db.requests.length, 0)
  assert(logs.some((l) => l.includes('bad_assertion') && l.includes('reason')))
  assert(logs.some((l) => l.includes('iat_in_future')))
})

scenario('A02 an assertion is accepted once: its jti cannot be replayed', async () => {
  const assertion = await sign()
  assertEquals((await call({ path: '/me', assertion })).status, 200)
  const replay = await call({ path: '/me', assertion })
  assertEquals(replay.status, 401)
  assertEquals(errorCode(replay.body), 'bad_assertion')
  assert(logs.some((l) => l.includes('jti_replayed')))
})

// ---------------------------------------------------------------------------
// Which Landmark user
// ---------------------------------------------------------------------------

scenario('A03 an email with no user row, or a row without a login, is 403 not_mapped', async () => {
  for (const sub of ['nepoznat@test.hr', NO_LOGIN.email]) {
    const res = await call({ path: '/me', assertion: await sign({ sub }) })
    assertEquals(res.status, 403, sub)
    assertEquals(errorCode(res.body), 'not_mapped', sub)
  }
  assertEquals(db.requestsTo('admin/generate_link').length, 0)
})

scenario('A04 the email matches in any case, and an underscore matches only itself', async () => {
  const mixed = await call({ path: '/me', assertion: await sign({ sub: 'Direktor@Test.HR' }) })
  assertEquals(mixed.status, 200)
  assertEquals(mixed.body.role, 'Director')
  // No username on the row: the display name is the email's local part, as on profiles.
  assertEquals(mixed.body.display_name, 'direktor')

  // `_` is an ilike wildcard: unescaped, anaxb@ would find ana_b@.
  const wild = await call({ path: '/me', assertion: await sign({ sub: 'anaxb@test.hr' }) })
  assertEquals(wild.status, 403)
  const exact = await call({ path: '/me', assertion: await sign({ sub: UNDERSCORE.email }) })
  assertEquals(exact.status, 200)
  assertEquals(exact.body.display_name, 'Ana B.')
})

scenario('A05 the session is minted for the mapped user, used, and signed out after the request', async () => {
  const res = await tool('search_projects', { query: 'Funt' })
  assertEquals(res.status, 200)
  assertEquals(db.revokedTokens.length, 1)
  assertMatch(db.revokedTokens[0], /^tok-session-/)
  assertEquals(db.authUsers[db.revokedTokens[0]], undefined)
  // The handler read with that session, not with the service role.
  const read = db.requestsTo('projects', 'GET')[0]
  assertEquals(read.headers.get('authorization'), `Bearer ${db.revokedTokens[0]}`)
})

scenario('A06 a failed sign-out is logged and does not fail the request', async () => {
  db.fault((r) => r.service === 'auth' && r.table === 'logout', { status: 500, body: { code: 500, msg: 'boom' } })
  const res = await call({ path: '/me' })
  assertEquals(res.status, 200)
  assert(logs.some((l) => l.includes('session sign-out failed')))
})

scenario('A07 a failure to mint the session is 500 internal_error, and the tool never runs', async () => {
  db.fault((r) => r.service === 'auth' && r.table === 'admin/generate_link', { status: 500, body: { code: 500, msg: 'boom' } })
  const res = await tool('search_projects', { query: 'Funt' })
  assertEquals(res.status, 500)
  assertEquals(errorCode(res.body), 'internal_error')
  assertEquals(db.requestsTo('projects').length, 0)
})

// ---------------------------------------------------------------------------
// /me and /manifest
// ---------------------------------------------------------------------------

scenario('A08 /me: a Director has the twelve on both channels; Sales has seven', async () => {
  const director = await call({ path: '/me' })
  assertEquals(director.status, 200)
  assertEquals(director.body.role, 'Director')
  const dTools = director.body.tools as { chat: string[]; voice: string[] }
  assertEquals([...dTools.voice].sort(), [...VOICE_TWELVE].sort())
  assertEquals([...dTools.chat].sort(), [...VOICE_TWELVE].sort())

  const sales = await call({ path: '/me', as: 'sales' })
  const sTools = sales.body.tools as { chat: string[]; voice: string[] }
  assertEquals(sales.body.role, 'Sales')
  assertEquals(sTools.voice.length, 7)
  assertEquals(sTools.chat.length, 7)
  for (const list of [dTools.chat, dTools.voice, sTools.chat, sTools.voice]) {
    assert(!list.includes('create_document'))
    assert(!list.includes('list_documents_for_entity'))
  }
})

scenario('A09 /manifest is stable, lists the twelve with their roles, and carries the domain rules', async () => {
  const a = await call({ path: '/manifest' })
  const b = await call({ path: '/manifest' })
  assertEquals(a.status, 200)
  assertMatch(a.body.version as string, /^[0-9a-f]{64}$/)
  assertEquals(a.body.version, b.body.version)
  const tools = a.body.tools as Array<{ name: string; roles: string[]; voice: boolean; input_schema: unknown }>
  assertEquals(tools.map((t) => t.name).sort(), [...VOICE_TWELVE].sort())
  assert(tools.every((t) => t.voice === true && t.input_schema))
  assertEquals(tools.find((t) => t.name === 'get_invoice_summary')!.roles, ['Director', 'Accounting'])
  assertEquals(a.body.domain_rules_hr, DOMAIN_RULES_HR)
  // No user is needed for the manifest.
  assertEquals(db.requests.length, 0)
})

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

scenario('A10 a tool answers with exactly what dispatch returned, nested under data', async () => {
  const res = await tool('search_projects', { query: 'Funt' })
  assertEquals(res.status, 200)
  const out = res.body.data as { data: { projects: Array<{ id: string }>; count: number } }
  assertEquals(out.data.count, 1)
  assertEquals(out.data.projects[0].id, P_TIC)
})

scenario('A11 a handler\'s own { error } is an answer: 200 with the envelope', async () => {
  const res = await tool('get_project_details', { project_id: '00000000-0000-4000-8000-00000000dead' })
  assertEquals(res.status, 200)
  assertEquals(typeof (res.body.data as { error?: unknown }).error, 'string')
})

scenario('A12 a finance tool called by Sales is 403 forbidden_tool on both channels, and no handler runs', async () => {
  for (const channel of ['chat', 'voice']) {
    const res = await tool('get_invoice_summary', {}, channel, { as: 'sales' })
    assertEquals(res.status, 403, channel)
    assertEquals(errorCode(res.body), 'forbidden_tool', channel)
  }
  assertEquals(db.requestsTo('get_invoice_statistics').length, 0)
})

scenario('A13 a tool outside the twelve is 404 unknown_tool on both channels, before any database work', async () => {
  for (const name of ['create_document', 'list_documents_for_entity', 'get_document_download_link', 'drop_everything']) {
    for (const channel of ['chat', 'voice']) {
      const res = await tool(name, {}, channel)
      assertEquals(res.status, 404, `${name} ${channel}`)
      assertEquals(errorCode(res.body), 'unknown_tool', `${name} ${channel}`)
    }
  }
  assertEquals(db.requests.length, 0)
})

scenario('A14 input that fails the tool\'s schema, or a bad body, is 400 bad_request', async () => {
  const cases: Array<[string, () => ReturnType<typeof call>]> = [
    ['missing required', () => tool('search_projects', {})],
    ['not a uuid', () => tool('get_project_details', { project_id: 'Funtana' })],
    ['extra property', () => tool('search_projects', { query: 'Funt', drop: true })],
    ['wrong type', () => tool('search_projects', { query: 'Funt', limit: 'many' })],
    ['out of range', () => tool('search_projects', { query: 'Funt', limit: 1000 })],
    ['not in enum', () => tool('list_contracts', { status: 'ACTIVE' })],
    ['bad channel', () => tool('search_projects', { query: 'Funt' }, 'sms')],
    ['no input', () => call({ path: '/tools/search_projects', body: { channel: 'chat' } })],
    ['not JSON', () => call({ path: '/tools/search_projects', raw: '{nope' })],
  ]
  for (const [label, run] of cases) {
    const res = await run()
    assertEquals(res.status, 400, label)
    assertEquals(errorCode(res.body), 'bad_request', label)
  }
  assertEquals(db.requests.length, 0)
})

scenario('A15 on voice a list is cut to five with its total; on chat it is whole', async () => {
  const extra = Array.from({ length: 5 }, (_, i) => ({
    id: `00000000-0000-4000-8000-0000000004${String(i + 4).padStart(2, '0')}`,
    contract_number: `UG-${i + 4}`, project_id: P_TIC, phase_id: PH_TIC_1, classification_id: null,
    subcontractor_id: SC_BUILDER, contract_amount: 1000, budget_realized: 0, signed_date: '2026-05-01',
    status: 'active', signed: true, has_contract: true, start_date: null, end_date: null,
    total_invoices_amount: 0, job_description: 'x'.repeat(300),
  }))
  db.seed('contracts', extra)

  const voice = await tool('list_contracts', {}, 'voice')
  assertEquals(voice.status, 200)
  const v = (voice.body.data as { data: { contracts: Array<{ id: string; job_description: string | null }>; count: number; total: number } }).data
  assertEquals(v.contracts.length, 5)
  assertEquals(v.total, 8)
  assert(v.contracts.every((c) => typeof c.id === 'string'))
  const long = v.contracts.find((c) => c.job_description)!
  assertEquals(long.job_description!.length, 201) // 200 and the ellipsis

  const chat = await tool('list_contracts', {}, 'chat')
  const c = (chat.body.data as { data: { contracts: unknown[]; total?: number } }).data
  assertEquals(c.contracts.length, 8)
  assertEquals(c.total, undefined)
  assert((c.contracts as Array<{ id: string }>).some((x) => x.id === CT_LAND))
})

scenario('A16 a handler that does not answer in time is 500 internal_error', async () => {
  const saved = TOOL_TIMEOUT_MS.voice
  TOOL_TIMEOUT_MS.voice = 50
  try {
    db.fault((r) => r.table === 'projects', { hang: true })
    const res = await tool('search_projects', { query: 'Funt' }, 'voice')
    assertEquals(res.status, 500)
    assertEquals(errorCode(res.body), 'internal_error')
    assert(logs.some((l) => l.includes('tool failed') && l.includes('tool_timeout')))
    // The session is still signed out.
    assertEquals(db.revokedTokens.length, 1)
  } finally {
    TOOL_TIMEOUT_MS.voice = saved
  }
})

scenario('A17 the 31st tool call by one user within a minute is 429 rate_limited; others are not held back', async () => {
  for (let i = 0; i < 30; i++) {
    assertEquals((await tool('list_cost_classifications', {})).status, 200, `call ${i + 1}`)
  }
  const blocked = await tool('list_cost_classifications', {})
  assertEquals(blocked.status, 429)
  assertEquals(errorCode(blocked.body), 'rate_limited')
  assertEquals((await tool('list_cost_classifications', {}, 'chat', { as: 'accounting' })).status, 200)
  // /me is not a tool call.
  assertEquals((await call({ path: '/me' })).status, 200)
  rateLimiter.clear()
})

// ---------------------------------------------------------------------------
// Routing and logging
// ---------------------------------------------------------------------------

scenario('A18 only POST, and only the three routes', async () => {
  assertEquals((await call({ path: '/me', method: 'GET' })).status, 405)
  assertEquals((await call({ path: '/elsewhere' })).status, 404)
  assertEquals((await call({ path: '/tools' })).status, 404)
})

scenario('A19 one log line per request, with route, tool, channel, status and user, and nothing else', async () => {
  await tool('search_projects', { query: 'Funtana-secret-query' }, 'voice')
  const lines = logs.filter((l) => l.includes('[assistant-api] request'))
  assertEquals(lines.length, 1)
  const line = lines[0]
  for (const part of ['route: "tool"', 'tool: "search_projects"', 'channel: "voice"', 'status: 200', USERS.director.id, 'total_ms']) {
    assert(line.includes(part), `missing ${part}`)
  }
  assert(logs.every((l) => !l.includes('Funtana-secret-query')), 'the input reached a log line')
  assert(logs.every((l) => !l.includes(P_TIC)), 'the output reached a log line')
})
