// Real handler implementations for AI chat tools.
//
// Each exported `handle*` function corresponds to one entry in TOOLS
// (see ./tools.ts). Handlers use the JWT-scoped userClient on `ctx`
// so RLS does the right thing for the caller's role; no service-role
// reads are needed for the tools in this file.
//
// Handlers do NOT throw on Supabase errors — they return
//   { error: 'descriptive string' }
// so the debug endpoint and (later) the streaming chat layer can surface
// a clean message. Unhandled exceptions are caught one level up by the
// debug branch's try/catch in ai-chat/index.ts.
//
// Phase 3.2a covers tools 1-4: search_projects, get_project_details,
// list_project_phases, search_subcontractors.
//
// Phase 3.2b covers tools 5-6: list_contracts, get_subcontractor_payment_status.
//
// Phase 3.2c covers tools 7-10: list_unpaid_invoices, list_payments_for_subcontractor,
// get_invoice_summary, get_project_financial_summary.

import type { AuthContext } from './auth.ts'

// ---------------------------------------------------------------------------
// Input shapes (mirror the JSON schemas in tools.ts).
// ---------------------------------------------------------------------------

export interface SearchProjectsInput {
  query: string
  limit?: number
}

export interface GetProjectDetailsInput {
  project_id: string
}

export interface ListProjectPhasesInput {
  project_id: string
}

export interface SearchSubcontractorsInput {
  query: string
  limit?: number
}

export interface ListContractsInput {
  project_id?: string
  phase_id?: string
  subcontractor_id?: string
  status?: 'draft' | 'active' | 'completed' | 'terminated'
  limit?: number
}

export interface GetSubcontractorPaymentStatusInput {
  subcontractor_id: string
}

export interface ListUnpaidInvoicesInput {
  subcontractor_id?: string
  project_id?: string
  limit?: number
}

export interface ListPaymentsForSubcontractorInput {
  subcontractor_id: string
  limit?: number
}

export interface GetInvoiceSummaryInput {
  invoice_type?: string
  status?: 'ALL' | 'UNPAID' | 'PAID' | 'PARTIALLY_PAID' | 'UNPAID_AND_PARTIAL'
  company_id?: string
  search_term?: string
}

export interface GetProjectFinancialSummaryInput {
  project_id: string
}

// ---------------------------------------------------------------------------
// Output shapes.
// ---------------------------------------------------------------------------

interface ProjectSummary {
  id: string
  name: string
  location: string
  status: string
}

interface PhaseSummary {
  id: string
  phase_name: string
  phase_number: number
  start_date: string | null
  end_date: string | null
  status: string | null
  budget_allocated: number | null
}

interface SubcontractorSummary {
  id: string
  name: string
  contact: string
  active_contracts_count: number | null
}

export type SearchProjectsOutput =
  | { data: { projects: ProjectSummary[]; count: number } }
  | { error: string }

export type GetProjectDetailsOutput =
  | {
      data: {
        project: Record<string, unknown>
        phase_count: number
        contract_count: number
        milestone_count: number
      }
    }
  | { error: string }

export type ListProjectPhasesOutput =
  | { data: { phases: PhaseSummary[] } }
  | { error: string }

export type SearchSubcontractorsOutput =
  | { data: { subcontractors: SubcontractorSummary[]; count: number } }
  | { error: string }

export type ListContractsOutput =
  | { data: { contracts: Record<string, unknown>[]; count: number } }
  | { error: string }

export type ListUnpaidInvoicesOutput =
  | { data: { invoices: Record<string, unknown>[]; count: number } }
  | { error: string }

export type ListPaymentsForSubcontractorOutput =
  | { data: { payments: Record<string, unknown>[]; count: number } }
  | { error: string }

export type GetInvoiceSummaryOutput =
  | { data: { filtered_count: number; filtered_unpaid_sum: number; total_unpaid_sum: number } }
  | { error: string }

export type GetProjectFinancialSummaryOutput =
  | {
      data: {
        project: { id: string; name: string }
        project_budget: number
        contracts: { count: number; total_amount: number; total_realized: number }
        invoices: {
          count: number
          unpaid_count: number
          total_amount: number
          total_paid: number
          total_remaining: number
        }
        summary: {
          budget: number
          committed: number
          spent: number
          unpaid: number
          remaining_to_commit: number
          remaining_to_spend: number
          over_budget: boolean
        }
      }
    }
  | { error: string }

export type GetSubcontractorPaymentStatusOutput =
  | {
      data: {
        subcontractor: { id: string; name: string }
        contracts: {
          count: number
          with_contract_count: number
          without_contract_count: number
          total_amount: number
          total_realized: number
        }
        invoices: {
          count: number
          unpaid_count: number
          total_amount: number
          total_paid: number
          total_remaining: number
        }
        summary: {
          contracted: number
          paid: number
          outstanding: number
          is_fully_paid: boolean
        }
      }
    }
  | { error: string }

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

// Clamp a possibly-undefined limit to [1, 100], default 20. Defense in depth:
// the JSON schema also enforces this range, but never trust the model to
// respect the schema.
function clampLimit(raw: number | undefined): number {
  return Math.min(Math.max(raw ?? 20, 1), 100)
}

// Escape `%` and `_` in user input so they cannot widen the ilike pattern.
function escapeIlike(s: string): string {
  return s.replace(/[%_]/g, '\\$&')
}

// Strict canonical UUID format. Used to validate model-supplied UUIDs before
// they are interpolated into PostgREST filter strings (.or() in particular,
// which does not parameterize the way .eq() does).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---------------------------------------------------------------------------
// search_projects
// ---------------------------------------------------------------------------

export async function handleSearchProjects(
  input: SearchProjectsInput,
  ctx: AuthContext,
): Promise<SearchProjectsOutput> {
  const query = (input.query ?? '').trim()
  if (!query) return { data: { projects: [], count: 0 } }

  const limit = clampLimit(input.limit)
  const escaped = escapeIlike(query)

  const { data, error } = await ctx.userClient
    .from('projects')
    .select('id, name, location, status')
    .ilike('name', `%${escaped}%`)
    .order('name', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[ai-chat:tool] search_projects failed', {
      userId: ctx.userId,
      code: error.code,
    })
    return { error: 'Failed to search projects' }
  }

  const projects = data ?? []
  return { data: { projects, count: projects.length } }
}

// ---------------------------------------------------------------------------
// get_project_details
// ---------------------------------------------------------------------------

export async function handleGetProjectDetails(
  input: GetProjectDetailsInput,
  ctx: AuthContext,
): Promise<GetProjectDetailsOutput> {
  // Look up the project FIRST. RLS will hide it for Supervision users who
  // don't manage it; we want to return the not-found error before issuing
  // count queries that would otherwise leak phase/contract/milestone counts
  // for inaccessible projects (contracts and project_milestones are RLS
  // USING(true) and would return real counts even when the project itself
  // is hidden).
  const { data: project, error: projectError } = await ctx.userClient
    .from('projects')
    .select('*')
    .eq('id', input.project_id)
    .maybeSingle()

  if (projectError) {
    console.error('[ai-chat:tool] get_project_details project lookup failed', {
      userId: ctx.userId,
      code: projectError.code,
    })
    return { error: 'Failed to fetch project' }
  }

  if (!project) {
    return { error: 'Project not found or not accessible' }
  }

  const [phasesRes, contractsRes, milestonesRes] = await Promise.all([
    ctx.userClient
      .from('project_phases')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', input.project_id),
    ctx.userClient
      .from('contracts')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', input.project_id),
    ctx.userClient
      .from('project_milestones')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', input.project_id),
  ])

  if (phasesRes.error || contractsRes.error || milestonesRes.error) {
    console.error('[ai-chat:tool] get_project_details count queries failed', {
      userId: ctx.userId,
      phases: phasesRes.error?.code,
      contracts: contractsRes.error?.code,
      milestones: milestonesRes.error?.code,
    })
    return { error: 'Failed to fetch project counts' }
  }

  return {
    data: {
      project: project as Record<string, unknown>,
      phase_count: phasesRes.count ?? 0,
      contract_count: contractsRes.count ?? 0,
      milestone_count: milestonesRes.count ?? 0,
    },
  }
}

// ---------------------------------------------------------------------------
// list_project_phases
// ---------------------------------------------------------------------------

export async function handleListProjectPhases(
  input: ListProjectPhasesInput,
  ctx: AuthContext,
): Promise<ListProjectPhasesOutput> {
  // Note: budget_used is intentionally NOT selected. It's an unmaintained
  // column (recon §2); exposing it would let the model report stale numbers.
  const { data, error } = await ctx.userClient
    .from('project_phases')
    .select('id, phase_name, phase_number, start_date, end_date, status, budget_allocated')
    .eq('project_id', input.project_id)
    .order('phase_number', { ascending: true })

  if (error) {
    console.error('[ai-chat:tool] list_project_phases failed', {
      userId: ctx.userId,
      code: error.code,
    })
    return { error: 'Failed to list project phases' }
  }

  return { data: { phases: data ?? [] } }
}

// ---------------------------------------------------------------------------
// search_subcontractors
// ---------------------------------------------------------------------------

export async function handleSearchSubcontractors(
  input: SearchSubcontractorsInput,
  ctx: AuthContext,
): Promise<SearchSubcontractorsOutput> {
  const query = (input.query ?? '').trim()
  if (!query) return { data: { subcontractors: [], count: 0 } }

  const limit = clampLimit(input.limit)
  const escaped = escapeIlike(query)

  // RLS on subcontractors is USING(true) — Supervision users see all,
  // intentionally (per design decision in 3.2a spec).
  const { data, error } = await ctx.userClient
    .from('subcontractors')
    .select('id, name, contact, active_contracts_count')
    .ilike('name', `%${escaped}%`)
    .order('name', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[ai-chat:tool] search_subcontractors failed', {
      userId: ctx.userId,
      code: error.code,
    })
    return { error: 'Failed to search subcontractors' }
  }

  const subcontractors = data ?? []
  return { data: { subcontractors, count: subcontractors.length } }
}

// ---------------------------------------------------------------------------
// list_contracts
// ---------------------------------------------------------------------------

export async function handleListContracts(
  input: ListContractsInput,
  ctx: AuthContext,
): Promise<ListContractsOutput> {
  // Supervision short-circuit: if the user has no assigned projects, there
  // are no contracts they can see — skip the DB round-trip.
  if (ctx.role === 'Supervision' && ctx.assignedProjects.length === 0) {
    return { data: { contracts: [], count: 0 } }
  }

  const limit = clampLimit(input.limit)

  let query = ctx.userClient
    .from('contracts')
    .select(`
      id,
      contract_number,
      contract_amount,
      budget_realized,
      total_invoices_amount,
      status,
      signed,
      signed_date,
      start_date,
      end_date,
      has_contract,
      job_description,
      subcontractor:subcontractors!contracts_subcontractor_id_fkey(id, name),
      phase:project_phases!contracts_phase_id_fkey(id, phase_name, phase_number),
      project:projects!contracts_project_id_fkey(id, name)
    `)
    .order('signed_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (input.project_id) query = query.eq('project_id', input.project_id)
  if (input.phase_id) query = query.eq('phase_id', input.phase_id)
  if (input.subcontractor_id) query = query.eq('subcontractor_id', input.subcontractor_id)
  if (input.status) query = query.eq('status', input.status)

  if (ctx.role === 'Supervision') {
    query = query.in(
      'project_id',
      ctx.assignedProjects.map((p) => p.project_id),
    )
  }

  const { data, error } = await query

  if (error) {
    console.error('[ai-chat:tool] list_contracts failed', {
      userId: ctx.userId,
      code: error.code,
    })
    return { error: 'Failed to list contracts' }
  }

  const contracts = (data ?? []) as unknown as Record<string, unknown>[]
  return { data: { contracts, count: contracts.length } }
}

// ---------------------------------------------------------------------------
// get_subcontractor_payment_status
// ---------------------------------------------------------------------------

export async function handleGetSubcontractorPaymentStatus(
  input: GetSubcontractorPaymentStatusInput,
  ctx: AuthContext,
): Promise<GetSubcontractorPaymentStatusOutput> {
  // 1. Verify the subcontractor exists.
  const { data: subcontractor, error: subError } = await ctx.userClient
    .from('subcontractors')
    .select('id, name')
    .eq('id', input.subcontractor_id)
    .maybeSingle()

  if (subError) {
    console.error('[ai-chat:tool] get_subcontractor_payment_status sub lookup failed', {
      userId: ctx.userId,
      code: subError.code,
    })
    return { error: 'Failed to fetch payment status' }
  }
  if (!subcontractor) {
    return { error: 'Subcontractor not found' }
  }

  // 2. Aggregate contracts.
  // contracts.budget_realized is trigger-maintained from accounting_payments —
  // we read it directly, never re-aggregate from payment rows.
  const { data: contracts, error: contractsError } = await ctx.userClient
    .from('contracts')
    .select('contract_amount, budget_realized, has_contract, status')
    .eq('subcontractor_id', input.subcontractor_id)

  if (contractsError) {
    console.error('[ai-chat:tool] get_subcontractor_payment_status contracts failed', {
      userId: ctx.userId,
      code: contractsError.code,
    })
    return { error: 'Failed to fetch payment status' }
  }

  const contractRows = contracts ?? []
  const contracts_count = contractRows.length
  const with_contract_count = contractRows.filter((r) => r.has_contract === true).length
  const without_contract_count = contracts_count - with_contract_count
  const contracts_total_amount = contractRows.reduce(
    (sum, r) => sum + (Number(r.contract_amount) || 0),
    0,
  )
  const contracts_total_realized = contractRows.reduce(
    (sum, r) => sum + (Number(r.budget_realized) || 0),
    0,
  )

  // 3. Aggregate invoices.
  // LANDMINE: accounting_invoices.supplier_id FKs to subcontractors — there is
  // no separate "suppliers" table. This filter IS correct.
  // Cesija payments need no special handling: the trigger-maintained
  // paid_amount / remaining_amount columns already account for them.
  const { data: invoices, error: invoicesError } = await ctx.userClient
    .from('accounting_invoices')
    .select('total_amount, paid_amount, remaining_amount, status')
    .eq('supplier_id', input.subcontractor_id)

  if (invoicesError) {
    console.error('[ai-chat:tool] get_subcontractor_payment_status invoices failed', {
      userId: ctx.userId,
      code: invoicesError.code,
    })
    return { error: 'Failed to fetch payment status' }
  }

  const invoiceRows = invoices ?? []
  const invoices_count = invoiceRows.length
  const unpaid_count = invoiceRows.filter(
    (r) => r.status === 'UNPAID' || r.status === 'PARTIALLY_PAID',
  ).length
  const invoices_total_amount = invoiceRows.reduce(
    (sum, r) => sum + (Number(r.total_amount) || 0),
    0,
  )
  const invoices_total_paid = invoiceRows.reduce(
    (sum, r) => sum + (Number(r.paid_amount) || 0),
    0,
  )
  const invoices_total_remaining = invoiceRows.reduce(
    (sum, r) => sum + (Number(r.remaining_amount) || 0),
    0,
  )

  return {
    data: {
      subcontractor: { id: subcontractor.id, name: subcontractor.name },
      contracts: {
        count: contracts_count,
        with_contract_count,
        without_contract_count,
        total_amount: contracts_total_amount,
        total_realized: contracts_total_realized,
      },
      invoices: {
        count: invoices_count,
        unpaid_count,
        total_amount: invoices_total_amount,
        total_paid: invoices_total_paid,
        total_remaining: invoices_total_remaining,
      },
      summary: {
        // is_fully_paid is computed against the INVOICES side (caught up on
        // what's been billed), not contracts. When invoices_count === 0 this
        // surfaces as `true` — technically correct (nothing owed) but the
        // model should interpret it as "no billing yet" rather than "paid up".
        contracted: contracts_total_amount,
        paid: invoices_total_paid,
        outstanding: invoices_total_remaining,
        is_fully_paid: invoices_total_remaining === 0,
      },
    },
  }
}

// ---------------------------------------------------------------------------
// list_unpaid_invoices
// ---------------------------------------------------------------------------

export async function handleListUnpaidInvoices(
  input: ListUnpaidInvoicesInput,
  ctx: AuthContext,
): Promise<ListUnpaidInvoicesOutput> {
  const limit = clampLimit(input.limit)

  // RLS handles role/project scoping (Director/Accounting see all; Supervision
  // is scoped to assigned projects via the policy at full_schema.sql:12000).
  let query = ctx.userClient
    .from('accounting_invoices')
    .select(`
      id,
      invoice_number,
      issue_date,
      due_date,
      total_amount,
      paid_amount,
      remaining_amount,
      status,
      supplier:subcontractors!accounting_invoices_supplier_id_fkey(id, name),
      project:projects!accounting_invoices_project_id_fkey(id, name),
      company:accounting_companies!accounting_invoices_company_id_fkey(id, name)
    `)
    .in('status', ['UNPAID', 'PARTIALLY_PAID'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(limit)

  // LANDMINE: accounting_invoices.supplier_id FKs to subcontractors — there
  // is no separate "suppliers" table. This filter IS correct.
  if (input.subcontractor_id) query = query.eq('supplier_id', input.subcontractor_id)
  if (input.project_id) query = query.eq('project_id', input.project_id)

  const { data, error } = await query

  if (error) {
    console.error('[ai-chat:tool] list_unpaid_invoices failed', {
      userId: ctx.userId,
      code: error.code,
    })
    return { error: 'Failed to list unpaid invoices' }
  }

  const invoices = (data ?? []) as unknown as Record<string, unknown>[]
  return { data: { invoices, count: invoices.length } }
}

// ---------------------------------------------------------------------------
// list_payments_for_subcontractor
// ---------------------------------------------------------------------------

export async function handleListPaymentsForSubcontractor(
  input: ListPaymentsForSubcontractorInput,
  ctx: AuthContext,
): Promise<ListPaymentsForSubcontractorOutput> {
  const limit = clampLimit(input.limit)

  // accounting_payments has no direct FK to subcontractors. We join through
  // accounting_invoices and filter on the inner table's supplier_id.
  // LANDMINE: supplier_id is the FK to subcontractors (no "suppliers" table).
  //
  // is_cesija indicates the payment was a debt assignment (company A paying
  // company B's invoice). For payment-history purposes, the flag is enough —
  // the model can mention it. Cesija detail columns are intentionally omitted
  // to keep the payload small.
  const { data, error } = await ctx.userClient
    .from('accounting_payments')
    .select(`
      id,
      payment_date,
      amount,
      payment_method,
      reference_number,
      is_cesija,
      invoice:accounting_invoices!inner(id, invoice_number, supplier_id, total_amount)
    `)
    .eq('invoice.supplier_id', input.subcontractor_id)
    .order('payment_date', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[ai-chat:tool] list_payments_for_subcontractor failed', {
      userId: ctx.userId,
      code: error.code,
    })
    return { error: 'Failed to list payments' }
  }

  const payments = (data ?? []) as unknown as Record<string, unknown>[]
  return { data: { payments, count: payments.length } }
}

// ---------------------------------------------------------------------------
// get_invoice_summary
// ---------------------------------------------------------------------------

export async function handleGetInvoiceSummary(
  input: GetInvoiceSummaryInput,
  ctx: AuthContext,
): Promise<GetInvoiceSummaryOutput> {
  // get_invoice_statistics is SECURITY DEFINER: it bypasses RLS and returns
  // global totals. Access is gated solely by requiredRoles (Director / Accounting)
  // in the tool definition.
  const { data, error } = await ctx.userClient.rpc('get_invoice_statistics', {
    p_invoice_type: input.invoice_type ?? 'ALL',
    p_status: input.status ?? 'ALL',
    p_company_id: input.company_id ?? undefined,
    p_search_term: input.search_term ?? undefined,
  })

  if (error) {
    console.error('[ai-chat:tool] get_invoice_summary failed', {
      userId: ctx.userId,
      code: error.code,
    })
    return { error: 'Failed to fetch invoice summary' }
  }

  // PostgREST has been historically inconsistent for RETURNS TABLE with one
  // row: sometimes data is the row directly, sometimes an array of length 1.
  // Defensive parsing handles both shapes.
  let row: { filtered_count?: unknown; filtered_unpaid_sum?: unknown; total_unpaid_sum?: unknown } | null = null
  if (Array.isArray(data)) {
    row = data[0] ?? null
  } else if (data && typeof data === 'object') {
    row = data as typeof row
  }

  if (!row) {
    console.error('[ai-chat:tool] get_invoice_summary returned no rows', { userId: ctx.userId })
    return { error: 'Failed to fetch invoice summary' }
  }

  return {
    data: {
      // bigint may deserialize to number or string depending on PostgREST
      // version; numeric columns may also come through as strings.
      filtered_count: Number(row.filtered_count) || 0,
      filtered_unpaid_sum: Number(row.filtered_unpaid_sum) || 0,
      total_unpaid_sum: Number(row.total_unpaid_sum) || 0,
    },
  }
}

// ---------------------------------------------------------------------------
// get_project_financial_summary
// ---------------------------------------------------------------------------

export async function handleGetProjectFinancialSummary(
  input: GetProjectFinancialSummaryInput,
  ctx: AuthContext,
): Promise<GetProjectFinancialSummaryOutput> {
  // Validate the UUID format before any DB call. input.project_id is
  // interpolated into a PostgREST .or() filter string below; .or() does NOT
  // parameterize the way .eq() does, so a malformed value could inject
  // additional filter expressions.
  if (!UUID_RE.test(input.project_id)) {
    return { error: 'Invalid project_id' }
  }

  // 1. Look up the project. RLS will hide it for Supervision users who don't
  // manage it; we want to return the not-found error before issuing the
  // contract/invoice queries (contracts is RLS USING(true) and would
  // otherwise leak counts for inaccessible projects).
  const { data: project, error: projectError } = await ctx.userClient
    .from('projects')
    .select('id, name, budget')
    .eq('id', input.project_id)
    .maybeSingle()

  if (projectError) {
    console.error('[ai-chat:tool] get_project_financial_summary project lookup failed', {
      userId: ctx.userId,
      code: projectError.code,
    })
    return { error: 'Failed to fetch project financial summary' }
  }
  if (!project) {
    return { error: 'Project not found or not accessible' }
  }

  // 2. Aggregate contracts. budget_realized is trigger-maintained.
  const { data: contractsData, error: contractsError } = await ctx.userClient
    .from('contracts')
    .select('id, contract_amount, budget_realized')
    .eq('project_id', input.project_id)

  if (contractsError) {
    console.error('[ai-chat:tool] get_project_financial_summary contracts failed', {
      userId: ctx.userId,
      code: contractsError.code,
    })
    return { error: 'Failed to fetch project financial summary' }
  }

  const contractRows = (contractsData ?? []) as Array<{
    id: string
    contract_amount: number | null
    budget_realized: number | null
  }>
  const contractIds = contractRows.map((r) => r.id)
  const contracts_count = contractRows.length
  const contracts_total_amount = contractRows.reduce(
    (sum, r) => sum + (Number(r.contract_amount) || 0), 0,
  )
  const contracts_total_realized = contractRows.reduce(
    (sum, r) => sum + (Number(r.budget_realized) || 0), 0,
  )

  // 3. Fetch invoices via BOTH paths:
  //    - direct project_id FK on the invoice
  //    - transitive: contract_id where contracts.project_id matches
  //    Then dedupe by id (an invoice could match both predicates).
  let invoiceQuery = ctx.userClient
    .from('accounting_invoices')
    .select('id, total_amount, paid_amount, remaining_amount, status')
  if (contractIds.length > 0) {
    // contractIds come from a prior query result (DB-issued UUIDs), so they
    // don't need re-validation. input.project_id has been format-checked above.
    invoiceQuery = invoiceQuery.or(
      `project_id.eq.${input.project_id},contract_id.in.(${contractIds.join(',')})`,
    )
  } else {
    invoiceQuery = invoiceQuery.eq('project_id', input.project_id)
  }

  const { data: invoicesData, error: invoicesError } = await invoiceQuery

  if (invoicesError) {
    console.error('[ai-chat:tool] get_project_financial_summary invoices failed', {
      userId: ctx.userId,
      code: invoicesError.code,
    })
    return { error: 'Failed to fetch project financial summary' }
  }

  // 4. Dedupe by id (the OR predicate can match a single invoice twice).
  const seen = new Set<string>()
  const invoiceRows: NonNullable<typeof invoicesData> = []
  for (const row of invoicesData ?? []) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    invoiceRows.push(row)
  }

  // 5. Aggregate invoices.
  const invoices_count = invoiceRows.length
  const unpaid_count = invoiceRows.filter(
    (r) => r.status === 'UNPAID' || r.status === 'PARTIALLY_PAID',
  ).length
  const invoices_total_amount = invoiceRows.reduce(
    (sum, r) => sum + (Number(r.total_amount) || 0), 0,
  )
  const invoices_total_paid = invoiceRows.reduce(
    (sum, r) => sum + (Number(r.paid_amount) || 0), 0,
  )
  const invoices_total_remaining = invoiceRows.reduce(
    (sum, r) => sum + (Number(r.remaining_amount) || 0), 0,
  )

  const project_budget = Number(project.budget) || 0

  return {
    data: {
      project: { id: project.id, name: project.name },
      project_budget,
      contracts: {
        count: contracts_count,
        total_amount: contracts_total_amount,
        total_realized: contracts_total_realized,
      },
      invoices: {
        count: invoices_count,
        unpaid_count,
        total_amount: invoices_total_amount,
        total_paid: invoices_total_paid,
        total_remaining: invoices_total_remaining,
      },
      // remaining_to_commit answers "how much can we still spend?";
      // remaining_to_spend answers "how much of the budget have we actually
      // paid out?". Both can go negative when over budget.
      summary: {
        budget: project_budget,
        committed: contracts_total_amount,
        spent: contracts_total_realized,
        unpaid: invoices_total_remaining,
        remaining_to_commit: project_budget - contracts_total_amount,
        remaining_to_spend: project_budget - contracts_total_realized,
        over_budget: contracts_total_amount > project_budget,
      },
    },
  }
}

// ---------------------------------------------------------------------------
// create_document — validation-only handler.
//
// Unlike every other tool, this one reads nothing: the model authors the
// whole document and passes the spec in `input`. The handler's only job is
// to validate that agent-supplied spec and hand back a clean confirmation.
// The actual PDF / xlsx / Markdown file is generated client-side when the
// user clicks Download — the spec rides in the persisted tool_use block, so
// no storage bucket is involved. See docs/AI_CHAT.md.
// ---------------------------------------------------------------------------

export type DocumentFormat = 'pdf' | 'xlsx' | 'markdown'

export interface DocumentSheetInput {
  name: string
  columns: string[]
  rows: Array<Array<string | number | boolean | null>>
}

export interface CreateDocumentInput {
  title: string
  format: DocumentFormat
  markdown?: string
  sheets?: DocumentSheetInput[]
}

export type CreateDocumentOutput =
  | { data: { ok: true; title: string; format: DocumentFormat; summary: string } }
  | { error: string }

// Size caps. The spec is persisted in the tool_use block and replayed to the
// model on every subsequent turn until the context-window compaction step
// ages it out — so these caps bound both the document and the replay cost.
const DOC_TITLE_MAX = 200
const DOC_MARKDOWN_MAX = 50_000
const DOC_MAX_SHEETS = 10
const DOC_SHEET_NAME_MAX = 31 // Excel's hard worksheet-name limit
const DOC_MAX_COLUMNS = 50
const DOC_MAX_ROWS = 5_000
const DOC_SPEC_BYTES_MAX = 60_000 // total serialized spec

export async function handleCreateDocument(
  input: CreateDocumentInput,
): Promise<CreateDocumentOutput> {
  const title = typeof input?.title === 'string' ? input.title.trim() : ''
  if (!title) return { error: 'Document title is required.' }
  if (title.length > DOC_TITLE_MAX) {
    return { error: `Document title exceeds ${DOC_TITLE_MAX} characters.` }
  }

  const format = input?.format
  if (format !== 'pdf' && format !== 'xlsx' && format !== 'markdown') {
    return { error: 'Document format must be one of: pdf, xlsx, markdown.' }
  }

  if (format === 'xlsx') {
    const sheets = input?.sheets
    if (!Array.isArray(sheets) || sheets.length === 0) {
      return { error: 'An xlsx document requires a non-empty `sheets` array.' }
    }
    if (sheets.length > DOC_MAX_SHEETS) {
      return { error: `An xlsx document allows at most ${DOC_MAX_SHEETS} sheets.` }
    }
    for (const sheet of sheets) {
      const name = typeof sheet?.name === 'string' ? sheet.name.trim() : ''
      if (!name) return { error: 'Every sheet needs a non-empty name.' }
      if (name.length > DOC_SHEET_NAME_MAX) {
        return { error: `Sheet name exceeds ${DOC_SHEET_NAME_MAX} characters.` }
      }
      if (!Array.isArray(sheet.columns) || sheet.columns.length === 0) {
        return { error: `Sheet "${name}" needs a non-empty \`columns\` array.` }
      }
      if (sheet.columns.length > DOC_MAX_COLUMNS) {
        return { error: `Sheet "${name}" exceeds ${DOC_MAX_COLUMNS} columns.` }
      }
      if (!Array.isArray(sheet.rows)) {
        return { error: `Sheet "${name}" needs a \`rows\` array.` }
      }
      if (sheet.rows.length > DOC_MAX_ROWS) {
        return { error: `Sheet "${name}" exceeds ${DOC_MAX_ROWS} rows.` }
      }
      for (const row of sheet.rows) {
        if (!Array.isArray(row)) {
          return { error: `Every row in sheet "${name}" must be an array of cells.` }
        }
      }
    }
  } else {
    // pdf | markdown — both carry the body in `markdown`.
    const markdown = typeof input?.markdown === 'string' ? input.markdown : ''
    if (!markdown.trim()) {
      return { error: `A ${format} document requires a non-empty \`markdown\` body.` }
    }
    if (markdown.length > DOC_MARKDOWN_MAX) {
      return { error: `Document body exceeds ${DOC_MARKDOWN_MAX} characters.` }
    }
  }

  if (JSON.stringify(input).length > DOC_SPEC_BYTES_MAX) {
    return { error: 'Document is too large; produce a smaller or more focused one.' }
  }

  const summary = format === 'xlsx'
    ? `Excel dokument "${title}" je spreman za preuzimanje.`
    : `Dokument "${title}" (${format}) je spreman za preuzimanje.`

  return { data: { ok: true, title, format, summary } }
}
