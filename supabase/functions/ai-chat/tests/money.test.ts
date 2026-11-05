// Characterisation: the money-question correctness rules — the reason this
// suite exists. What the model is told (system prompt, tool descriptions) and
// what the tools actually hand it for budget, spend, phase and classification
// questions.
//
// Every tool scenario runs through the real orchestration loop: the scripted
// model calls the tool, and the assertions are on the tool_result the model was
// sent (which is also asserted equal to what the user's UI received).
//
// Scenario ids (M01…) match docs/voice/03-characterisation-tests.md.
// [OQ-n] tags point at docs/voice/open-questions.md.

import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import { answer, callTools, toolUse } from './fake-anthropic.ts'
import { anthropic, chat, db, type Json, scenario, toolResultSentToModel } from './harness.ts'
import {
  CC_BUILD,
  CC_LAND,
  CT_BUILD,
  CT_LAND,
  INV_BUILD,
  INV_LAND,
  INV_UNPLANNED,
  P_LEGACY,
  P_TIC,
  P_UNPLANNED,
  PH_TIC_1,
  SC_BUILDER,
  SC_ELECTRIC,
  STALE_BUDGET_USED,
  TOKENS,
} from './fixtures.ts'

async function runTool(name: string, input: unknown, token: string = TOKENS.director) {
  const tu = toolUse(name, input)
  anthropic.script(callTools(tu), answer('ok'))
  const sse = await chat({ session_id: null, message: 'pitanje' }, { token })
  const event = sse.events.find((e) => e.data.type === 'tool_result')!.data
  // UI and model see the same payload (the tool_result rides in the latest model call).
  assertEquals(toolResultSentToModel(anthropic.calls.length - 1, tu.id), event.output)
  return { output: event.output as Json, isError: event.is_error as boolean }
}

const ids = (rows: Json[]) => rows.map((r) => r.id)

// ---------------------------------------------------------------------------
// What the model is told
// ---------------------------------------------------------------------------

scenario('M01 the cached system prompt carries the money rules, byte-identical across users', async () => {
  anthropic.script(answer('ok'), answer('ok'))
  await chat({ session_id: null, message: 'x' })
  await chat({ session_id: null, message: 'x' }, { token: TOKENS.sales })
  const [director, sales] = anthropic.calls.map((c) => c.body.system as Json[])
  const rules = director[0].text as string
  for (const rule of [
    '**TIC je jedini izvor planiranog budžeta.**',
    'Ako projekt nema TIC (ili je TIC prazan), on **nema planirani budžet** — recite "budžet nije postavljen"',
    'Nemojte navoditi `projects.budget` kao plan za takav projekt čak i ako alat vrati neku brojku',
    '**Faza i klasifikacija troška su dvije različite osi.**',
    'filtrirajte ugovore po klasifikaciji, nikada po fazi',
    '`project_phases.budget_used` je zastario i nepouzdan; alati ga ne vraćaju.',
    '`accounting_invoices.supplier_id` referencira tablicu `subcontractors`',
    '`is_cesija: true` na plaćanju znači',
    '`has_contract: false` na ugovoru znači',
    'Koristite onaj zapis koji alati stvarno vrate; ne normalizirajte.',
  ]) {
    assertStringIncludes(rules, rule)
  }
  assertEquals(sales[0].text, director[0].text) // shared cache prefix
  assertEquals(director[0].cache_control, { type: 'ephemeral' })
  assert(director[1].text !== sales[1].text) // only the per-user block differs
})

scenario('M02 the tool descriptions repeat the budget rules where the model chooses tools', async () => {
  anthropic.script(answer('ok'))
  await chat({ session_id: null, message: 'x' })
  const desc = Object.fromEntries(anthropic.calls[0].body.tools!.map((t) => [t.name, t.description]))
  assertStringIncludes(desc.get_project_financial_summary, 'A project with no TIC has no planned budget')
  assertStringIncludes(desc.get_project_financial_summary, '"remaining budget" is then meaningless')
  assertStringIncludes(desc.list_project_phases, '`budget_allocated` is derived from the project TIC')
  assertStringIncludes(desc.list_contracts, 'The `budget_realized` field is automatically maintained from payments')
  assertStringIncludes(desc.list_cost_classifications, 'resolve a cost category the user named into a classification_id')
})

// ---------------------------------------------------------------------------
// Stale budget_used never reaches the model
// ---------------------------------------------------------------------------

scenario('M03 list_project_phases never selects or returns budget_used, even when the row holds a value', async () => {
  const { output } = await runTool('list_project_phases', { project_id: P_TIC })
  const [phase] = output.data.phases
  assertEquals(phase.id, PH_TIC_1)
  assertEquals(phase.budget_allocated, 1_200_000)
  assert(!('budget_used' in phase))
  assert(!JSON.stringify(output).includes(String(STALE_BUDGET_USED)))
  const select = db.requestsTo('project_phases', 'GET')[0].params.get('select')!
  assert(!select.includes('budget_used'), select)
})

// ---------------------------------------------------------------------------
// The financial rollup
// ---------------------------------------------------------------------------

scenario('M04 financial summary (TIC project): spent = Σ contracts.budget_realized; invoices deduped across both paths', async () => {
  const { output } = await runTool('get_project_financial_summary', { project_id: P_TIC })
  assertEquals(output.data, {
    project: { id: P_TIC, name: 'Funtana' },
    project_budget: 1_200_000,
    contracts: { count: 2, total_amount: 1_000_000, total_realized: 500_000 },
    // INV_LAND matches by project_id AND via CT_LAND; it is counted once.
    invoices: { count: 2, unpaid_count: 1, total_amount: 150_000, total_paid: 120_000, total_remaining: 30_000 },
    summary: {
      budget: 1_200_000,
      committed: 1_000_000,
      spent: 500_000, // not the phase's stale budget_used (999,999), not invoice paid (120,000)
      unpaid: 30_000,
      remaining_to_commit: 200_000,
      remaining_to_spend: 700_000,
      over_budget: false,
    },
  })
  const inv = db.requestsTo('accounting_invoices', 'GET')[0]
  assertEquals(inv.params.get('or'), `(project_id.eq.${P_TIC},contract_id.in.(${CT_LAND},${CT_BUILD}))`)
})

scenario('M05 [OQ-2] no TIC but a legacy projects.budget: the stale number is returned as the budget, unflagged', async () => {
  const { output } = await runTool('get_project_financial_summary', { project_id: P_LEGACY })
  assertEquals(output.data.project_budget, 500_000)
  assertEquals(output.data.summary, {
    budget: 500_000,
    committed: 0,
    spent: 0,
    unpaid: 0,
    remaining_to_commit: 500_000,
    remaining_to_spend: 500_000,
    over_budget: false,
  })
  // Nothing in the payload says whether a TIC exists, and no tool looked.
  assert(!JSON.stringify(output).toLowerCase().includes('tic'))
  assertEquals(db.requestsTo('tic_cost_structures').length, 0)
})

scenario('M06 [OQ-2] no TIC and no budget: budget reads 0, remaining goes negative, and over_budget is true', async () => {
  const { output } = await runTool('get_project_financial_summary', { project_id: P_UNPLANNED })
  assertEquals(output.data.project_budget, 0)
  assertEquals(output.data.summary, {
    budget: 0,
    committed: 80_000,
    spent: 20_000,
    unpaid: 20_000,
    remaining_to_commit: -80_000,
    remaining_to_spend: -20_000,
    over_budget: true, // "over budget" for a project that has no plan at all
  })
  assertEquals(output.data.invoices.count, 1) // INV_UNPLANNED matched both paths, counted once
})

scenario('M07 [OQ-2] get_project_details returns every projects column, legacy budget included, and no TIC indicator', async () => {
  const { output } = await runTool('get_project_details', { project_id: P_LEGACY })
  assertEquals(output.data.project.budget, 500_000)
  assertEquals(Object.keys(output.data.project).sort(), ['budget', 'created_at', 'id', 'location', 'name', 'status'])
  assertEquals([output.data.phase_count, output.data.contract_count, output.data.milestone_count], [0, 0, 0])
  assertEquals(db.requestsTo('projects', 'GET')[0].params.get('select'), '*')
})

scenario('M08 a malformed project_id is refused before any query (the .or() filter-injection guard)', async () => {
  for (const project_id of ['not-a-uuid', `${P_TIC},project_id.neq.0`]) {
    const { output, isError } = await runTool('get_project_financial_summary', { project_id })
    assertEquals([output, isError], [{ error: 'Invalid project_id' }, true])
  }
  for (const table of ['projects', 'contracts', 'accounting_invoices']) assertEquals(db.requestsTo(table).length, 0, table)
})

// ---------------------------------------------------------------------------
// Phase vs cost classification
// ---------------------------------------------------------------------------

scenario('M09 list_contracts by classification returns only that category, with the classification embedded', async () => {
  const { output } = await runTool('list_contracts', { project_id: P_TIC, classification_id: CC_LAND })
  assertEquals(ids(output.data.contracts), [CT_LAND])
  const [c] = output.data.contracts
  assertEquals(c.classification, { id: CC_LAND, name: 'Zemljište' })
  assertEquals(c.phase, { id: PH_TIC_1, phase_name: 'Faza 1', phase_number: 1 })
  assertEquals([c.contract_amount, c.budget_realized], [400_000, 350_000])
  const params = db.requestsTo('contracts', 'GET')[0].params
  assertEquals([params.get('project_id'), params.get('classification_id'), params.get('phase_id')], [`eq.${P_TIC}`, `eq.${CC_LAND}`, null])
})

scenario('M10 on a single-phase project, filtering by phase returns every contract: phase does not separate spend', async () => {
  const { output } = await runTool('list_contracts', { project_id: P_TIC, phase_id: PH_TIC_1 })
  assertEquals(ids(output.data.contracts), [CT_BUILD, CT_LAND]) // newest signed first
  assertEquals(output.data.contracts.map((c: Json) => c.classification.name), ['Izgradnja i uređenje', 'Zemljište'])
})

scenario('M11 list_cost_classifications: active ones by sort_order; include_inactive adds retired ones', async () => {
  const active = await runTool('list_cost_classifications', {})
  assertEquals(active.output.data.classifications.map((c: Json) => c.name), ['Zemljište', 'Izgradnja i uređenje'])
  const all = await runTool('list_cost_classifications', { include_inactive: true })
  assertEquals(all.output.data.classifications.map((c: Json) => c.id), [CC_LAND, CC_BUILD, all.output.data.classifications[2].id])
  assertEquals(all.output.data.classifications[2].is_active, false)
})

// ---------------------------------------------------------------------------
// Scoping, statuses, cesija, subcontractor rollups
// ---------------------------------------------------------------------------

scenario('M12 Supervision: list_contracts adds an explicit project scope; with no assignments it skips the query', async () => {
  await runTool('list_contracts', {}, TOKENS.supervision)
  assertEquals(db.requestsTo('contracts', 'GET')[0].params.get('project_id'), `in.(${P_TIC})`)

  db.tables.project_managers = []
  const before = db.requestsTo('contracts').length
  const { output } = await runTool('list_contracts', {}, TOKENS.supervision)
  assertEquals(output, { data: { contracts: [], count: 0 } })
  assertEquals(db.requestsTo('contracts').length, before)
})

scenario('M13 list_unpaid_invoices: raw SHOUTING_SNAKE statuses, due date first; Supervision scoping is left to RLS', async () => {
  const { output } = await runTool('list_unpaid_invoices', {})
  assertEquals(ids(output.data.invoices), [INV_BUILD, INV_UNPLANNED])
  assertEquals(output.data.invoices.map((i: Json) => i.status), ['PARTIALLY_PAID', 'UNPAID'])
  assertEquals(output.data.invoices[0].supplier, { id: SC_ELECTRIC, name: 'Elektro Horvat obrt' })
  const params = db.requestsTo('accounting_invoices', 'GET')[0].params
  assertEquals(params.get('status'), 'in.(UNPAID,PARTIALLY_PAID)')

  // For a Supervision caller the handler adds no project filter at all:
  // scoping depends entirely on RLS on accounting_invoices (not modelled here).
  await runTool('list_unpaid_invoices', {}, TOKENS.supervision)
  const sup = db.requestsTo('accounting_invoices', 'GET').at(-1)!.params
  assertEquals([...sup.keys()].sort(), ['limit', 'order', 'select', 'status'])
})

scenario('M14 list_payments_for_subcontractor joins through invoices on supplier_id and passes is_cesija through', async () => {
  db.seed('accounting_payments', [
    { id: crypto.randomUUID(), invoice_id: INV_LAND, amount: 100_000, payment_date: '2026-02-20', payment_method: 'WIRE', reference_number: 'HR01', is_cesija: true },
    { id: crypto.randomUUID(), invoice_id: INV_BUILD, amount: 20_000, payment_date: '2026-03-20', payment_method: 'WIRE', reference_number: 'HR02', is_cesija: false },
  ])
  const { output } = await runTool('list_payments_for_subcontractor', { subcontractor_id: SC_BUILDER })
  assertEquals(output.data.count, 1)
  assertEquals(output.data.payments[0].is_cesija, true)
  assertEquals(output.data.payments[0].invoice.supplier_id, SC_BUILDER)
  const params = db.requestsTo('accounting_payments', 'GET')[0].params
  assertEquals(params.get('invoice.supplier_id'), `eq.${SC_BUILDER}`)
  assertStringIncludes(params.get('select')!, 'invoice:accounting_invoices!inner(')
})

scenario('M15 get_subcontractor_payment_status: "paid" comes from invoices, next to a different contract-realized figure', async () => {
  const { output } = await runTool('get_subcontractor_payment_status', { subcontractor_id: SC_BUILDER })
  assertEquals(output.data.contracts, { count: 2, with_contract_count: 2, without_contract_count: 0, total_amount: 480_000, total_realized: 370_000 })
  assertEquals(output.data.invoices, { count: 2, unpaid_count: 1, total_amount: 120_000, total_paid: 100_000, total_remaining: 20_000 })
  assertEquals(output.data.summary, { contracted: 480_000, paid: 100_000, outstanding: 20_000, is_fully_paid: false })
  assertEquals(db.requestsTo('accounting_invoices', 'GET')[0].params.get('supplier_id'), `eq.${SC_BUILDER}`)
})

scenario('M16 [OQ-6] a subcontractor with contracts but no invoices yet is reported is_fully_paid: true', async () => {
  const sc = crypto.randomUUID()
  db.seed('subcontractors', [{ id: sc, name: 'Novi izvođač j.d.o.o.', contact: null, active_contracts_count: 1 }])
  db.seed('contracts', [{
    id: crypto.randomUUID(), contract_number: 'UG-9', project_id: P_TIC, phase_id: PH_TIC_1, classification_id: CC_BUILD,
    subcontractor_id: sc, contract_amount: 250_000, budget_realized: 0, has_contract: false, status: 'active', signed_date: '2026-06-01',
  }])
  const { output } = await runTool('get_subcontractor_payment_status', { subcontractor_id: sc })
  assertEquals(output.data.contracts.without_contract_count, 1) // informal arrangement, flagged
  assertEquals(output.data.summary, { contracted: 250_000, paid: 0, outstanding: 0, is_fully_paid: true })
})

scenario('M17 get_invoice_summary coerces the RPC\'s string numerics and accepts a row or a one-row array', async () => {
  const calls: Json[] = []
  db.rpcs.get_invoice_statistics = (args) => {
    calls.push(args)
    return calls.length === 1
      ? [{ filtered_count: '3', filtered_unpaid_sum: '50000.00', total_unpaid_sum: '70000.50' }]
      : { filtered_count: 1, filtered_unpaid_sum: 5, total_unpaid_sum: 6 }
  }
  const a = await runTool('get_invoice_summary', {})
  assertEquals(a.output.data, { filtered_count: 3, filtered_unpaid_sum: 50_000, total_unpaid_sum: 70_000.5 })
  assertEquals(calls[0], { p_invoice_type: 'ALL', p_status: 'ALL' })
  const b = await runTool('get_invoice_summary', { status: 'UNPAID' })
  assertEquals(b.output.data, { filtered_count: 1, filtered_unpaid_sum: 5, total_unpaid_sum: 6 })
  assertEquals(calls[1].p_status, 'UNPAID')
})

scenario('M18 search_projects retries with a Croatian stem when the inflected form misses', async () => {
  const { output } = await runTool('search_projects', { query: 'Prečkom' })
  assertEquals(ids(output.data.projects), [P_LEGACY])
  const reqs = db.requestsTo('projects', 'GET')
  assertEquals(reqs.map((r) => r.params.get('name')), ['ilike.%Prečkom%', 'ilike.%Prečk%'])
  assertEquals(output.data.projects[0].status, 'Planning') // Title Case, raw
})

scenario('M19 search_projects escapes % and _ so user input cannot widen the match', async () => {
  const { output } = await runTool('search_projects', { query: 'Fun%' })
  assertEquals(output.data.projects, [])
  assertEquals(db.requestsTo('projects', 'GET')[0].params.get('name'), 'ilike.%Fun\\%%')
})

