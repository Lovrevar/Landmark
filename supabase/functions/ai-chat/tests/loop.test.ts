// Characterisation: the orchestration loop and everything after the stream
// opens — wire format, tool round trips, persistence, failure paths,
// cancellation, timeouts, history, summaries and compaction.
//
// Scenario ids (L01…) match the coverage table in docs/voice/03-characterisation-tests.md.
// Tests tagged [PHASE 2] pin behaviour the plan deliberately changes in phase 2
// (streaming, parallel dispatch); they are expected to be updated then, and the
// change must be visible in that PR's diff.
// Tests tagged [OQ-n] pin behaviour logged for review in docs/voice/open-questions.md.

import { assert, assertEquals, assertMatch, assertStringIncludes } from 'jsr:@std/assert@1'
import { FakeTime } from 'jsr:@std/testing@1/time'
import { answer, callTools, text, toolUse } from './fake-anthropic.ts'
import {
  anthropic,
  blocksOf,
  call,
  chat,
  clientOf,
  db,
  type Json,
  logs,
  readSSE,
  scenario,
  sessionMessages,
  toolResultSentToModel,
} from './harness.ts'
import { P_TIC, TOKENS, USERS } from './fixtures.ts'

const D = USERS.director
const byCreated = (rows: Json[]) => [...rows].sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
const ask = (message: string, extra: Record<string, unknown> = {}, token?: string) =>
  chat({ session_id: null, message, ...extra }, token ? { token } : {})
const onlySession = () => db.rows('ai_sessions').filter((s) => s.user_id === D.id)[0]
/** What the stop button does: write now() into the session's cancel beacon.
 * (+1 ms so it is strictly later than a loop that started this millisecond.) */
const setBeacon = (sessionId: string) => {
  const s = db.rows('ai_sessions').find((r) => r.id === sessionId)!
  s.cancel_requested_at = new Date(Date.now() + 1).toISOString()
}
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// Wire format and request shape
// ---------------------------------------------------------------------------

scenario('L01 wire format: ": ready" first, then session; every event: line equals its data.type', async () => {
  anthropic.script(answer('Bok!'))
  const sse = await ask('Pozdrav')
  assert(sse.raw.startsWith(': ready\n\n'))
  assertEquals(sse.types, ['session', 'turn', 'done'])
  assertEquals(sse.events[0].data, { type: 'session', session_id: onlySession().id })
  for (const e of sse.events) assertEquals(e.event, e.data.type)
  assertEquals(sse.events[1].data, { type: 'turn', role: 'assistant', text: 'Bok!' })
  assertEquals(sse.events[2].data, { type: 'done', stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 20 } })
})

scenario('L02 a plain answer persists session, user row and assistant row, all through the service role', async () => {
  anthropic.script(answer('Funtana je u izgradnji.', { input_tokens: 555, output_tokens: 66 }))
  await ask('Kakvo je stanje projekta Funtana i što se trenutno radi na gradilištu uz obalu?')
  const s = onlySession()
  assertEquals(s.title, 'Kakvo je stanje projekta Funtana i što se trenutno radi na g') // first 60 chars, trimmed
  const [u, a] = byCreated(sessionMessages(s.id as string))
  assertEquals(u.role, 'user')
  assertEquals(u.parent_id, null)
  assertEquals(u.content, [{ type: 'text', text: 'Kakvo je stanje projekta Funtana i što se trenutno radi na gradilištu uz obalu?' }])
  assertEquals(a.role, 'assistant')
  assertEquals(a.parent_id, u.id)
  assertEquals(a.content, [{ type: 'text', text: 'Funtana je u izgradnji.' }])
  assertEquals([a.model, a.input_tokens, a.output_tokens, a.stop_reason], ['claude-sonnet-4-6', 555, 66, 'end_turn'])
  const persistence = db.requests.filter((r) => r.table === 'ai_sessions' || r.table === 'ai_messages')
  assert(persistence.length > 0 && persistence.every((r) => clientOf(r) === 'service'))
})

scenario('L03 the model request: default model, max_tokens 8192, two-block system, role-filtered tools, cache breakpoints', async () => {
  anthropic.script(answer('ok'))
  await ask('x')
  const body = anthropic.calls[0].body
  assertEquals(body.model, 'claude-sonnet-4-6')
  assertEquals(body.max_tokens, 8192)
  assertEquals(body.stream, undefined) // [PHASE 2] messages.create today; the refactor switches to stream
  const system = body.system as Json[]
  assertEquals(system.length, 2)
  assertEquals(system[0].cache_control, { type: 'ephemeral' })
  assertEquals(system[1].cache_control, undefined)
  assertEquals(system[1].text, '## Korisnik\nKorisnik: direktor@test.hr, uloga: Director.')
  const tools = body.tools!
  assertEquals(tools.length, 15) // Director sees every tool
  assertEquals(tools.map((t) => Object.keys(t).filter((k) => k !== 'cache_control').sort()), tools.map(() => ['description', 'input_schema', 'name']))
  assertEquals(tools.filter((t) => t.cache_control).length, 1)
  assertEquals(tools.at(-1)!.cache_control, { type: 'ephemeral' })
  const last = body.messages.at(-1)!
  assertEquals((last.content as Json[]).at(-1).cache_control, { type: 'ephemeral' })
})

scenario('L04 AI_CHAT_MODEL overrides the model', async () => {
  Deno.env.set('AI_CHAT_MODEL', 'claude-sonnet-5')
  try {
    anthropic.script(answer('ok'))
    await ask('x')
    assertEquals(anthropic.calls[0].body.model, 'claude-sonnet-5')
    assertEquals(sessionMessages(onlySession().id as string).find((m) => m.role === 'assistant')!.model, 'claude-sonnet-5')
  } finally {
    Deno.env.delete('AI_CHAT_MODEL')
  }
})

// ---------------------------------------------------------------------------
// Tool round trips
// ---------------------------------------------------------------------------

scenario('L05 one tool round trip: events, four chained rows, JSON-string tool_result, tool read through the user JWT', async () => {
  const tu = toolUse('search_projects', { query: 'Funtana' })
  anthropic.script(callTools(tu), answer('Pronašao sam projekt Funtana.'))
  const sse = await ask('Nađi Funtanu')
  assertEquals(sse.types, ['session', 'tool_call', 'tool_result', 'turn', 'done'])
  assertEquals(sse.events[1].data, { type: 'tool_call', tool: 'search_projects', input: { query: 'Funtana' }, tool_use_id: tu.id })
  const result = sse.events[2].data
  assertEquals([result.tool, result.tool_use_id, result.is_error], ['search_projects', tu.id, false])
  assertEquals(result.output.data.projects.map((p: Json) => p.id), [P_TIC])

  const [u, a1, tr, a2] = byCreated(sessionMessages(onlySession().id as string))
  assertEquals([u.role, a1.role, tr.role, a2.role], ['user', 'assistant', 'user', 'assistant'])
  assertEquals([a1.parent_id, tr.parent_id, a2.parent_id], [u.id, a1.id, tr.id])
  assertEquals(a1.stop_reason, 'tool_use')
  assertEquals(tr.content, [{ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result.output), is_error: false }])
  assertEquals([tr.model, tr.stop_reason], [null, null])

  assertEquals(toolResultSentToModel(1, tu.id), result.output)
  const projectReads = db.requestsTo('projects', 'GET')
  assert(projectReads.length > 0 && projectReads.every((r) => clientOf(r) === 'user'))
})

scenario('L06 the prompt-cache breakpoint slides to the last block of the last message on every call', async () => {
  const tu = toolUse('search_projects', { query: 'Funtana' })
  anthropic.script(callTools(tu), answer('ok'))
  await ask('x')
  const flagged = (i: number) =>
    anthropic.calls[i].body.messages.flatMap((m, mi) => (m.content as Json[]).map((b, bi) => (b.cache_control ? `${mi}.${bi}` : null))).filter(Boolean)
  assertEquals(flagged(0), ['0.0'])
  assertEquals(flagged(1), ['2.0'])
  // Breakpoints are wire-only: nothing persisted carries cache_control.
  assert(!JSON.stringify(db.rows('ai_messages')).includes('cache_control'))
})

scenario('L07 text and tool_use in one turn are emitted in content-block order', async () => {
  const tu = toolUse('list_cost_classifications', {})
  anthropic.script(callTools(text('Dohvaćam klasifikacije.'), tu), answer('Imate dvije.'))
  const sse = await ask('x')
  assertEquals(sse.types, ['session', 'turn', 'tool_call', 'tool_result', 'turn', 'done'])
  assertEquals(sse.events[1].data.text, 'Dohvaćam klasifikacije.')
})

scenario('L08 two tools in one turn: one tool_result row, blocks in tool_use order', async () => {
  const a = toolUse('search_projects', { query: 'Funtana' })
  const b = toolUse('list_cost_classifications', {})
  anthropic.script(callTools(a, b), answer('ok'))
  const sse = await ask('x')
  assertEquals(sse.types, ['session', 'tool_call', 'tool_call', 'tool_result', 'tool_result', 'turn', 'done'])
  assertEquals(sse.events.filter((e) => e.data.type === 'tool_result').map((e) => e.data.tool_use_id), [a.id, b.id])
  const tr = sessionMessages(onlySession().id as string).filter((m) => m.role === 'user' && blocksOf(m.content, 'tool_result').length)
  assertEquals(tr.length, 1)
  assertEquals(blocksOf(tr[0].content, 'tool_result').map((x) => x.tool_use_id), [a.id, b.id])
})

scenario('L09 [PHASE 2] tools within a turn are dispatched sequentially: the second starts after the first finishes', async () => {
  let firstFinishedWhenSecondStarted: boolean | null = null
  db.onRequest((r) => {
    if (r.table === 'cost_classifications') {
      // The first tool's request must already exist AND be finished. (An empty
      // list would pass vacuously: under parallel dispatch the second tool's
      // query can reach the DB first.)
      const first = db.requestsTo('projects')
      firstFinishedWhenSecondStarted = first.length > 0 && first.every((p) => p.finished)
    }
  })
  anthropic.script(callTools(toolUse('search_projects', { query: 'Funtana' }), toolUse('list_cost_classifications', {})), answer('ok'))
  await ask('x')
  assertEquals(firstFinishedWhenSecondStarted, true)
})

scenario('L10 a handler that returns { error } becomes an is_error tool_result, and the loop continues', async () => {
  const tu = toolUse('get_project_details', { project_id: crypto.randomUUID() })
  anthropic.script(callTools(tu), answer('Projekt nije pronađen.'))
  const sse = await ask('x')
  const result = sse.events.find((e) => e.data.type === 'tool_result')!.data
  assertEquals([result.is_error, result.output], [true, { error: 'Project not found or not accessible' }])
  assertEquals(sse.types.at(-1), 'done')
  assertEquals(toolResultSentToModel(1, tu.id), { error: 'Project not found or not accessible' })
})

scenario('L11 a tool the role may not use is not advertised, and is refused at dispatch if named anyway', async () => {
  const tu = toolUse('get_project_financial_summary', { project_id: P_TIC })
  anthropic.script(callTools(tu), answer('Nemate pristup.'))
  const sse = await ask('Koliki je budžet?', {}, TOKENS.sales)
  const advertised = anthropic.calls[0].body.tools!.map((t) => t.name)
  for (const finance of ['get_subcontractor_payment_status', 'list_unpaid_invoices', 'list_payments_for_subcontractor', 'get_invoice_summary', 'get_project_financial_summary']) {
    assert(!advertised.includes(finance), finance)
  }
  const result = sse.events.find((e) => e.data.type === 'tool_result')!.data
  assertEquals(result.is_error, true)
  assertEquals(result.output, { error: 'tool execution failed: tool not permitted for role: get_project_financial_summary' })
  assertEquals(db.requestsTo('projects').length, 0) // the handler never ran
  assert(logs.some((l) => l.line.includes('[ai-chat] tool refused at dispatch') && l.line.includes('not_permitted_for_role')))
})

scenario('L12 an unknown tool name is refused at dispatch as unknown_tool', async () => {
  const tu = toolUse('execute_sql', { sql: 'drop table projects' })
  anthropic.script(callTools(tu), answer('ok'))
  const sse = await ask('x')
  assertEquals(sse.events.find((e) => e.data.type === 'tool_result')!.data.output, { error: 'tool execution failed: unknown tool: execute_sql' })
})

scenario('L13 thinking blocks are persisted in the assistant row but never emitted as events', async () => {
  anthropic.script({ content: [{ type: 'thinking', thinking: 'razmišljam', signature: 's' }, text('Odgovor.')], stop_reason: 'end_turn' })
  const sse = await ask('x')
  assertEquals(sse.types, ['session', 'turn', 'done'])
  const a = sessionMessages(onlySession().id as string).find((m) => m.role === 'assistant')!
  assertEquals((a.content as Json[]).map((b) => b.type), ['thinking', 'text'])
})

scenario('L14 stop_reason tool_use with no tool_use block ends the turn: done, no dispatch, no tool_result row', async () => {
  anthropic.script({ content: [text('Hm.')], stop_reason: 'tool_use' })
  const sse = await ask('x')
  assertEquals(sse.types, ['session', 'turn', 'done'])
  assertEquals(sse.events.at(-1)!.data.stop_reason, 'tool_use')
  assertEquals(sessionMessages(onlySession().id as string).length, 2)
})

scenario('L15 a terminal max_tokens on a plain answer passes the raw stop_reason through, with no synthetic text', async () => {
  anthropic.script({ content: [text('Odgovor je predug i prekinut je u sre')], stop_reason: 'max_tokens' })
  const sse = await ask('x')
  assertEquals(sse.types, ['session', 'turn', 'done'])
  assertEquals(sse.events.at(-1)!.data.stop_reason, 'max_tokens')
})

// ---------------------------------------------------------------------------
// Truncation guard and iteration cap
// ---------------------------------------------------------------------------

scenario('L16 truncation mid tool_use (max_tokens): error tool_result, persisted, then a Croatian explanation', async () => {
  const tu = toolUse('create_document', { title: 'Izvještaj', format: 'pdf' })
  anthropic.script({ content: [tu], stop_reason: 'max_tokens', usage: { input_tokens: 10, output_tokens: 8192 } })
  const sse = await ask('Napravi PDF izvještaj')
  assertEquals(sse.types, ['session', 'tool_call', 'tool_result', 'turn', 'done'])
  const result = sse.events[2].data
  assertEquals([result.is_error, result.output], [true, { error: 'response truncated before the tool call completed' }])
  assertEquals(sse.events[3].data.text, 'Dokument je prevelik da bi stao u jedan odgovor. Zatražite kraći dokument ili ga podijelite na više manjih.')
  assertEquals(sse.events[4].data.stop_reason, 'max_tokens')

  const [, a1, tr, synth] = byCreated(sessionMessages(onlySession().id as string))
  assertEquals(a1.stop_reason, 'max_tokens')
  assertEquals(blocksOf(tr.content, 'tool_result')[0].is_error, true)
  assertEquals(synth.parent_id, tr.id)
  assertEquals([synth.stop_reason, synth.input_tokens, synth.output_tokens], ['max_tokens', null, null])
  assertEquals(anthropic.calls.length, 1)
})

scenario('L17 truncation with any other terminal stop_reason uses the generic message', async () => {
  anthropic.script({ content: [toolUse('search_projects', { query: 'F' })], stop_reason: 'stop_sequence' })
  const sse = await ask('x')
  assertEquals(sse.events.find((e) => e.data.type === 'turn')!.data.text, 'Odgovor nije dovršen. Pokušajte ponovno.')
})

scenario('L18 [OQ-4] truncation guard: if the synthetic tool_result insert fails, the explanation is still emitted, unpersisted', async () => {
  db.fault((r) => r.table === 'ai_messages' && r.method === 'POST' && JSON.stringify(r.body).includes('response truncated'), { status: 500 })
  anthropic.script({ content: [toolUse('create_document', {})], stop_reason: 'max_tokens' })
  const sse = await ask('x')
  assert(sse.types.includes('turn'))
  const rows = sessionMessages(onlySession().id as string)
  assertEquals(rows.filter((m) => JSON.stringify(m.content).includes('Dokument je prevelik')).length, 0)
})

scenario('L19 the 10-iteration cap: 10 model calls, then a synthetic tool_limit_reached answer chained off the last tool_result', async () => {
  for (let i = 0; i < 10; i++) anthropic.script(callTools(toolUse('list_cost_classifications', {})))
  const sse = await ask('Vrti se u krug')
  assertEquals(anthropic.calls.length, 10)
  assertEquals(sse.types.filter((t) => t === 'tool_call').length, 10)
  assertEquals(sse.types.slice(-2), ['turn', 'done'])
  assertEquals(sse.events.at(-2)!.data.text, 'Dostignut je limit poziva alata. Pokušajte preformulirati pitanje.')
  assertEquals(sse.events.at(-1)!.data.stop_reason, 'tool_limit_reached')
  const rows = byCreated(sessionMessages(onlySession().id as string))
  const synth = rows.at(-1)!
  assertEquals(synth.stop_reason, 'tool_limit_reached')
  assertEquals(synth.parent_id, rows.at(-2)!.id)
  assertEquals(blocksOf(rows.at(-2)!.content, 'tool_result').length, 1)
  assertEquals([synth.input_tokens, synth.output_tokens], [120, 30]) // the last turn's usage
  assertEquals(onlySession().title, 'Vrti se u krug')
})

scenario('L47 [OQ-4] if the iteration-cap row fails to insert, the limit message is still emitted (logged)', async () => {
  for (let i = 0; i < 10; i++) anthropic.script(callTools(toolUse('list_cost_classifications', {})))
  db.fault((r) => r.table === 'ai_messages' && r.method === 'POST' && (r.body as Json)?.stop_reason === 'tool_limit_reached', { status: 500 })
  const sse = await ask('x')
  assertEquals(sse.types.slice(-2), ['turn', 'done'])
  assertEquals(sessionMessages(onlySession().id as string).filter((m) => m.stop_reason === 'tool_limit_reached').length, 0)
  assert(logs.some((l) => l.line.includes('[ai-chat] limit message insert failed')))
})

// ---------------------------------------------------------------------------
// Mid-stream persistence failures
// ---------------------------------------------------------------------------

scenario('L20 a failed assistant insert emits persistence_error and nothing for that turn; no title backfill', async () => {
  db.fault((r) => r.table === 'ai_messages' && r.method === 'POST' && (r.body as Json)?.role === 'assistant', { status: 500 })
  anthropic.script(answer('Ovo nikad ne stigne.'))
  const sse = await ask('x')
  assertEquals(sse.types, ['session', 'error'])
  assertEquals(sse.events[1].data, { type: 'error', code: 'persistence_error', message: 'Greška pri spremanju odgovora.' })
  assertEquals(onlySession().title, null)
})

scenario('L21 [OQ-5] a failed tool_result insert: the tool_result EVENT was already sent, the row never exists', async () => {
  db.fault(
    (r) => r.table === 'ai_messages' && r.method === 'POST' && blocksOf((r.body as Json)?.content, 'tool_result').length > 0,
    { status: 500 },
  )
  anthropic.script(callTools(toolUse('search_projects', { query: 'Funtana' })))
  const sse = await ask('x')
  assertEquals(sse.types, ['session', 'tool_call', 'tool_result', 'error'])
  assertEquals(sse.events[3].data, { type: 'error', code: 'persistence_error', message: 'Greška pri spremanju rezultata alata.' })
  const rows = byCreated(sessionMessages(onlySession().id as string))
  assertEquals(rows.map((m) => m.role), ['user', 'assistant']) // assistant tool_use row, unanswered
})

// ---------------------------------------------------------------------------
// Model errors
// ---------------------------------------------------------------------------

scenario('L22 Anthropic errors map to a mid-stream error event with a fixed code and Croatian message', async () => {
  const cases: Array<[number, string, string, string]> = [
    [429, 'rate_limit_error', 'model_rate_limited', 'Model je trenutno preopterećen. Pokušajte ponovno za nekoliko trenutaka.'],
    [401, 'authentication_error', 'model_auth_failed', 'Greška u autentikaciji s modelom. Prijavite ovo administratoru.'],
    [400, 'invalid_request_error', 'model_bad_request', 'Interna greška pri pripremi upita. Prijavite ovo administratoru.'],
    [500, 'api_error', 'model_error', 'Greška pri pozivu modela. Pokušajte ponovno.'],
    [529, 'overloaded_error', 'model_error', 'Greška pri pozivu modela. Pokušajte ponovno.'],
  ]
  for (const [status, type, code, message] of cases) {
    anthropic.script({ error: { status, type, message: 'x' } })
    const sse = await ask('x')
    assertEquals(sse.types, ['session', 'error'], `${status}`)
    assertEquals(sse.events[1].data, { type: 'error', code, message }, `${status}`)
  }
  // No assistant rows were written for any of them.
  assertEquals(db.rows('ai_messages').filter((m) => m.role === 'assistant').length, 0)
})

scenario('L23 a connection failure is retried twice by the SDK, then maps to model_unreachable', async () => {
  anthropic.script({ connectionError: true }, { connectionError: true }, { connectionError: true })
  const sse = await ask('x')
  assertEquals(anthropic.calls.length, 3)
  assertEquals(sse.events[1].data, { type: 'error', code: 'model_unreachable', message: 'Greška u komunikaciji s modelom. Pokušajte ponovno.' })
})

// ---------------------------------------------------------------------------
// Cancellation (the DB beacon)
// ---------------------------------------------------------------------------

scenario('L24 a cancel beacon seen at an iteration boundary ends the stream silently; rows so far stay', async () => {
  db.onRequest((r) => {
    if (r.table === 'ai_messages' && r.method === 'POST' && blocksOf((r.body as Json)?.content, 'tool_result').length) {
      setBeacon((r.body as Json).session_id)
    }
  })
  anthropic.script(callTools(toolUse('search_projects', { query: 'Funtana' })))
  const sse = await ask('x')
  assertEquals(sse.types, ['session', 'tool_call', 'tool_result']) // no done, no error
  assertEquals(anthropic.calls.length, 1)
  assertEquals(sessionMessages(onlySession().id as string).map((m) => m.role), ['user', 'assistant', 'user'])
  assert(logs.some((l) => l.line.includes('client disconnect detected') && l.line.includes('db_cancel_beacon')))
})

scenario('L25 [OQ-1] a cancel during tool dispatch drops the result and leaves an unanswered tool_use row', async () => {
  db.onRequest((r) => {
    if (r.table === 'projects') setBeacon(onlySession().id as string)
  })
  anthropic.script(callTools(toolUse('search_projects', { query: 'Funtana' })))
  const sse = await ask('x')
  assertEquals(sse.types, ['session', 'tool_call'])
  const rows = byCreated(sessionMessages(onlySession().id as string))
  assertEquals(rows.map((m) => m.role), ['user', 'assistant'])
  assertEquals(blocksOf(rows[1].content, 'tool_use').length, 1)
})

scenario('L26 [OQ-1] after that cancel, every follow-up on the branch is rejected by the model API', async () => {
  db.onRequest((r) => {
    if (r.table === 'projects' && !onlySession().cancel_requested_at) setBeacon(onlySession().id as string)
  })
  anthropic.script(callTools(toolUse('search_projects', { query: 'Funtana' })))
  await ask('x')
  const sid = onlySession().id as string
  // The frontend's rule (computeMostRecentLeaf): the active leaf is the newest row,
  // which is the unanswered assistant tool_use row.
  const leaf = byCreated(sessionMessages(sid)).at(-1)!
  assertEquals(leaf.role, 'assistant')

  await tick(5) // a follow-up starts after the beacon, as it would in the UI
  for (const attempt of ['Nastavi', 'Pokušaj ponovno']) {
    const sse = await chat({ session_id: sid, message: attempt, parent_message_id: leaf.id })
    assertEquals(sse.events.at(-1)!.data.code, 'model_bad_request', attempt)
  }
  // Both were refused by the real API's pairing rule, not by a missing script.
  assertEquals(anthropic.calls.length, 3)
  assertEquals(anthropic.rejections.length, 2)
  for (const r of anthropic.rejections) assertMatch(r, /`tool_use` ids were found without `tool_result` blocks immediately after/)
})

scenario('L27 [OQ-1] a cancel requested during the model call still runs the tool, then drops its result', async () => {
  anthropic.script(
    () => {
      setBeacon(onlySession().id as string)
      return callTools(toolUse('search_projects', { query: 'Funtana' }))
    },
  )
  const sse = await ask('x')
  assertEquals(sse.types, ['session', 'tool_call'])
  assert(db.requestsTo('projects').length > 0) // the tool ran after the cancel was already requested
})

scenario('L28 a beacon older than the request does not cancel it', async () => {
  anthropic.script(answer('prvi'), answer('drugi'))
  await ask('x')
  const s = onlySession()
  s.cancel_requested_at = new Date(Date.now() - 60_000).toISOString()
  const leaf = byCreated(sessionMessages(s.id as string)).at(-1)!
  const sse = await chat({ session_id: s.id, message: 'y', parent_message_id: leaf.id })
  assertEquals(sse.types.at(-1), 'done')
})

scenario('L29 a failing beacon read fails open: the turn completes and the failure is logged', async () => {
  db.fault((r) => r.table === 'ai_sessions' && r.method === 'GET' && r.params.get('select') === 'cancel_requested_at', { status: 500 }, 5)
  anthropic.script(answer('ok'))
  const sse = await ask('x')
  assertEquals(sse.types.at(-1), 'done')
  assert(logs.some((l) => l.line.includes('[ai-chat] cancel beacon read failed')))
})

// ---------------------------------------------------------------------------
// Timeouts (fake time)
// ---------------------------------------------------------------------------

scenario('L30 the 90 s request timeout: keepalives every 15 s, then a request_timeout error event', async () => {
  const time = new FakeTime()
  try {
    anthropic.script({ hangUntilAborted: true })
    const res = await call({ session_id: null, message: 'x' })
    const reading = readSSE(res, 0)
    // One-second steps: the heartbeat re-arms itself only after each write
    // resolves, so a single 90 s jump would skip the re-armed timers.
    for (let s = 0; s < 90; s++) await time.tickAsync(1_000)
    const sse = await reading
    assertEquals(sse.types, ['session', 'error'])
    assertEquals(sse.events[1].data, { type: 'error', code: 'request_timeout', message: 'Zahtjev je trajao predugo. Pokušajte ponovno.' })
    assert(sse.comments.filter((c) => c === 'keepalive').length >= 5)
    assertEquals(db.rows('ai_messages').filter((m) => m.role === 'assistant').length, 0)
  } finally {
    time.restore()
  }
})

scenario('L31 the 15 s per-tool timeout becomes an is_error tool_result and the loop continues', async () => {
  const time = new FakeTime()
  try {
    db.fault((r) => r.table === 'projects', { hang: true })
    anthropic.script(callTools(toolUse('search_projects', { query: 'Funtana' })), answer('Alat nije odgovorio.'))
    const res = await call({ session_id: null, message: 'x' })
    const reading = readSSE(res, 0)
    await time.tickAsync(15_000)
    const sse = await reading
    const result = sse.events.find((e) => e.data.type === 'tool_result')!.data
    assertEquals([result.is_error, result.output], [true, { error: 'tool execution failed: tool_timeout' }])
    assertEquals(sse.types.at(-1), 'done')
  } finally {
    time.restore()
  }
})

// ---------------------------------------------------------------------------
// Route context
// ---------------------------------------------------------------------------

scenario('L32 route context is prepended to the latest user message in memory only, never persisted', async () => {
  anthropic.script(answer('ok'))
  await ask('Što je ovo?', { current_route: '/projects?tab=1#x' })
  const sent = anthropic.calls[0].body.messages.at(-1)!.content as Json[]
  assertEquals(sent[0].text, '[Kontekst: korisnik je trenutno na /projects — Projekti (popis)]\n\nŠto je ovo?')
  const persisted = sessionMessages(onlySession().id as string).find((m) => m.role === 'user')!
  assertEquals(persisted.content, [{ type: 'text', text: 'Što je ovo?' }])
})

scenario('L33 unknown or malformed routes add no context line; history turns never carry it', async () => {
  anthropic.script(answer('a'), answer('b'), answer('c'))
  for (const current_route of ['/nepostoji', 'javascript:alert(1)']) {
    await ask('x', { current_route })
    assertEquals((anthropic.calls.at(-1)!.body.messages.at(-1)!.content as Json[])[0].text, 'x')
  }
  const sid = db.rows('ai_sessions').at(-1)!.id
  const leaf = byCreated(sessionMessages(sid as string)).at(-1)!
  await chat({ session_id: sid, message: 'y', parent_message_id: leaf.id, current_route: '/projects' })
  const msgs = anthropic.calls.at(-1)!.body.messages
  assertEquals((msgs[0].content as Json[])[0].text, 'x')
  assertMatch((msgs.at(-1)!.content as Json[])[0].text, /^\[Kontekst: /)
})

// ---------------------------------------------------------------------------
// Attachments on the happy path
// ---------------------------------------------------------------------------

scenario('L34 [OQ-8] with a text attachment, the route line lands on the attachment block, not the typed message', async () => {
  anthropic.script(answer('ok'))
  await ask('Sažmi ovo', {
    current_route: '/projects',
    attachments: [{ storage_path: `${D.authId}/s/n.txt`, file_name: 'n.txt', file_size: 5, mime_type: 'text/plain', kind: 'text', extracted_text: 'bilješke' }],
  })
  const sent = anthropic.calls[0].body.messages.at(-1)!.content as Json[]
  assertEquals(sent.map((b) => b.text), [
    '[Kontekst: korisnik je trenutno na /projects — Projekti (popis)]\n\n[Priložena datoteka: n.txt]\n\nbilješke',
    'Sažmi ovo',
  ])
  const persisted = sessionMessages(onlySession().id as string).find((m) => m.role === 'user')!
  assertEquals((persisted.content as Json[]).map((b) => b.text), ['[Priložena datoteka: n.txt]\n\nbilješke', 'Sažmi ovo'])
  assertEquals(db.rows('ai_message_attachments')[0].extracted_text, 'bilješke')
})

scenario('L35 an image attachment is downloaded, base64-encoded before the text, and persisted in the user row', async () => {
  const path = `${D.authId}/s/a.png`
  db.storage[`ai-chat-attachments/${path}`] = new Uint8Array([137, 80, 78, 71])
  anthropic.script(answer('To je PNG.'))
  await ask('Što je ovo?', { attachments: [{ storage_path: path, file_name: 'a.png', file_size: 4, mime_type: 'image/png', kind: 'image' }] })
  const persisted = sessionMessages(onlySession().id as string).find((m) => m.role === 'user')!
  assertEquals(persisted.content, [
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw==' } },
    { type: 'text', text: 'Što je ovo?' },
  ])
  const side = db.rows('ai_message_attachments')[0]
  assertEquals([side.message_id, side.kind, side.extracted_text], [persisted.id, 'image', null])
})

// ---------------------------------------------------------------------------
// History, branching, summaries
// ---------------------------------------------------------------------------

/** Seed a session holding a linear chain of [role, content] rows; returns their ids. */
function seedChain(rows: Array<['user' | 'assistant', Json[]]>, extra: Record<string, unknown> = {}): { sid: string; ids: string[] } {
  const sid = crypto.randomUUID()
  db.seed('ai_sessions', [{ id: sid, user_id: D.id, title: 'stari', ...extra }])
  const ids: string[] = []
  let parent: string | null = null
  for (const [role, content] of rows) {
    const id = crypto.randomUUID()
    db.seed('ai_messages', [{ id, session_id: sid, role, content, parent_id: parent }])
    ids.push(id)
    parent = id
  }
  return { sid, ids }
}
const t = (s: string) => [{ type: 'text', text: s }]

scenario('L36 a follow-up replays the ancestor chain root → parent and chains the new user row off the parent', async () => {
  const { sid, ids } = seedChain([['user', t('u1')], ['assistant', t('a1')]])
  anthropic.script(answer('a2'))
  await chat({ session_id: sid, message: 'u2', parent_message_id: ids[1] })
  assertEquals(anthropic.calls[0].body.messages.map((m) => (m.content as Json[])[0].text), ['u1', 'a1', 'u2'])
  const u2 = sessionMessages(sid).find((m) => JSON.stringify(m.content).includes('"u2"'))!
  assertEquals(u2.parent_id, ids[1])
  assertEquals(db.rows('ai_sessions').find((s) => s.id === sid)!.title, 'stari') // existing sessions keep their title
})

scenario('L37 an edit inserts a sibling under the target\'s parent and replays only the chain above it', async () => {
  const { sid, ids } = seedChain([['user', t('u1')], ['assistant', t('a1')], ['user', t('u2')], ['assistant', t('a2')]])
  anthropic.script(answer('a2-novi'))
  await chat({ session_id: sid, message: 'u2-izmijenjen', edit_message_id: ids[2] })
  assertEquals(anthropic.calls[0].body.messages.map((m) => (m.content as Json[])[0].text), ['u1', 'a1', 'u2-izmijenjen'])
  const edited = sessionMessages(sid).find((m) => JSON.stringify(m.content).includes('u2-izmijenjen'))!
  assertEquals(edited.parent_id, ids[1]) // sibling of the original u2
  assertEquals(sessionMessages(sid).filter((m) => ids.includes(m.id as string)).length, 4) // nothing deleted
})

scenario('L38 a stored summary whose boundary is on this branch replaces the turns up to it, as a banner', async () => {
  const { sid, ids } = seedChain([['user', t('u1')], ['assistant', t('a1')], ['user', t('u2')], ['assistant', t('a2')]])
  db.rows('ai_sessions').find((s) => s.id === sid)!.context_summary = 'SAŽETAK: razgovarali smo o Funtani.'
  db.rows('ai_sessions').find((s) => s.id === sid)!.summary_through_message_id = ids[1]
  anthropic.script(answer('a3'))
  await chat({ session_id: sid, message: 'u3', parent_message_id: ids[3] })
  const msgs = anthropic.calls[0].body.messages
  assertEquals(msgs.length, 3)
  const first = (msgs[0].content as Json[])[0].text as string
  assertStringIncludes(first, '[Sažetak ranijeg dijela ovog razgovora')
  assertStringIncludes(first, 'SAŽETAK: razgovarali smo o Funtani.')
  assert(first.endsWith('[Kraj sažetka. Slijedi nastavak razgovora.]\n\nu2'))
  assertEquals(sessionMessages(sid).find((m) => m.id === ids[2])!.content, t('u2')) // never persisted
})

scenario('L39 a summary whose boundary is not on this branch is ignored', async () => {
  const { sid, ids } = seedChain([['user', t('u1')], ['assistant', t('a1')]], {
    context_summary: 'SAŽETAK DRUGE GRANE',
    summary_through_message_id: crypto.randomUUID(),
  })
  anthropic.script(answer('a2'))
  await chat({ session_id: sid, message: 'u2', parent_message_id: ids[1] })
  assert(!JSON.stringify(anthropic.calls[0].body.messages).includes('SAŽETAK'))
  assertEquals(anthropic.calls[0].body.messages.length, 3)
})

scenario('L40 image/PDF blocks older than the 6 most recent history messages are replaced by placeholders', async () => {
  const img = [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } }, { type: 'text', text: 'slika' }]
  const { sid, ids } = seedChain([
    ['user', img], ['assistant', t('a1')], ['user', img], ['assistant', t('a2')],
    ['user', t('u3')], ['assistant', t('a3')], ['user', t('u4')], ['assistant', t('a4')],
  ])
  anthropic.script(answer('a5'))
  await chat({ session_id: sid, message: 'u5', parent_message_id: ids[7] })
  const msgs = anthropic.calls[0].body.messages
  assertEquals((msgs[0].content as Json[])[0], { type: 'text', text: '[Slika je bila priložena ranije u ovom razgovoru; uklonjena je iz konteksta radi uštede prostora.]' })
  assertEquals((msgs[2].content as Json[])[0].type, 'image')
})

scenario('L41 the 130K-token hard ceiling drops whole oldest turns', async () => {
  const { sid, ids } = seedChain([
    ['user', t('x'.repeat(400_000))], ['assistant', t('a1')],
    ['user', t('y'.repeat(200_000))], ['assistant', t('a2')],
  ])
  // The persisted chain is still over the compaction trigger, so a summary call follows.
  anthropic.script(answer('a3'), answer('SAŽETAK'))
  await chat({ session_id: sid, message: 'u3', parent_message_id: ids[3] })
  const msgs = anthropic.calls[0].body.messages
  assertEquals(msgs.length, 3)
  assert(((msgs[0].content as Json[])[0].text as string).startsWith('yyy'))
})

// ---------------------------------------------------------------------------
// Post-turn compaction
// ---------------------------------------------------------------------------

scenario('L42 past 60K estimated tokens, a summary call runs after done and stores the summary and boundary', async () => {
  const { sid, ids } = seedChain([['user', t('z'.repeat(300_000))], ['assistant', t('a1')]])
  anthropic.script(answer('a2'), answer('SAŽETAK RAZGOVORA'))
  const sse = await chat({ session_id: sid, message: 'u2', parent_message_id: ids[1] })
  assertEquals(sse.types, ['session', 'turn', 'done']) // compaction emits nothing
  const summaryCall = anthropic.calls[1].body
  assertEquals([summaryCall.model, summaryCall.max_tokens, typeof summaryCall.system], ['claude-sonnet-4-6', 2048, 'string'])
  assertEquals(summaryCall.tools, undefined)
  const s = db.rows('ai_sessions').find((r) => r.id === sid)!
  assertEquals([s.context_summary, s.summary_through_message_id], ['SAŽETAK RAZGOVORA', ids[1]])
})

scenario('L43 AI_CHAT_SUMMARY_MODEL overrides the summarisation model only', async () => {
  Deno.env.set('AI_CHAT_SUMMARY_MODEL', 'claude-haiku-4-5')
  try {
    const { sid, ids } = seedChain([['user', t('z'.repeat(300_000))], ['assistant', t('a1')]])
    anthropic.script(answer('a2'), answer('S'))
    await chat({ session_id: sid, message: 'u2', parent_message_id: ids[1] })
    assertEquals([anthropic.calls[0].body.model, anthropic.calls[1].body.model], ['claude-sonnet-4-6', 'claude-haiku-4-5'])
  } finally {
    Deno.env.delete('AI_CHAT_SUMMARY_MODEL')
  }
})

scenario('L44 a failed compaction is silent to the user and leaves the session unchanged', async () => {
  const { sid, ids } = seedChain([['user', t('z'.repeat(300_000))], ['assistant', t('a1')]])
  anthropic.script(answer('a2'), { error: { status: 500, type: 'api_error', message: 'x' } })
  const sse = await chat({ session_id: sid, message: 'u2', parent_message_id: ids[1] })
  assertEquals(sse.types, ['session', 'turn', 'done'])
  assertEquals(db.rows('ai_sessions').find((r) => r.id === sid)!.context_summary, null)
  assert(logs.some((l) => l.line.includes('[ai-chat] compaction failed (non-fatal)')))
})

scenario('L48 a failed summary write after compaction is logged; the stream is unaffected', async () => {
  const { sid, ids } = seedChain([['user', t('z'.repeat(300_000))], ['assistant', t('a1')]])
  db.fault((r) => r.table === 'ai_sessions' && r.method === 'PATCH' && JSON.stringify(r.body).includes('context_summary'), { status: 500 })
  anthropic.script(answer('a2'), answer('SAŽETAK'))
  const sse = await chat({ session_id: sid, message: 'u2', parent_message_id: ids[1] })
  assertEquals(sse.types, ['session', 'turn', 'done'])
  assertEquals(db.rows('ai_sessions').find((r) => r.id === sid)!.context_summary, null)
  assert(logs.some((l) => l.line.includes('[ai-chat] compaction persist failed')))
})

scenario('L45 short threads are never compacted: one model call per plain turn', async () => {
  anthropic.script(answer('ok'))
  await ask('x')
  assertEquals(anthropic.calls.length, 1)
})

// ---------------------------------------------------------------------------
// Session title
// ---------------------------------------------------------------------------

scenario('L46 a failed title backfill is logged and does not affect the stream', async () => {
  db.fault((r) => r.table === 'ai_sessions' && r.method === 'PATCH', { status: 500 })
  anthropic.script(answer('ok'))
  const sse = await ask('Naslov')
  assertEquals(sse.types, ['session', 'turn', 'done'])
  assertEquals(onlySession().title, null)
  assert(logs.some((l) => l.line.includes('[ai-chat] title backfill failed')))
})

