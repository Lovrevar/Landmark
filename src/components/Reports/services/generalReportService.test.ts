import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Characterization tests: they record what `fetchGeneralReportData` returns today, figure by
 * figure, before its calculations move into shared functions (docs/REGRESSION_PREVENTION.md,
 * Step 7, "pin before you move"). They are not a statement that every figure is right. Where a
 * pinned figure is known to be wrong, the comment names the backlog id; the fix changes the
 * expectation in its own commit.
 *
 * Do not edit an expectation to get a refactor green. If one moves, the refactor changed a figure.
 */

// A fake Supabase client: `from(table).select()` resolves to that table's rows, its `.in()`
// filters them by id, and `.order().range()` pages them (the linked garage and storage prices,
// read through fetchAllRows). A table listed in `failing` or `failingLookup` answers the way
// supabase-js reports a failed request: `{ data: null, error }`.
let tables: Record<string, unknown[]> = {}
let failing: Record<string, string> = {}
let failingLookup: Record<string, string> = {}

vi.mock('../../../lib/supabase', () => {
  const response = (rows: unknown[], message: string | undefined) =>
    message ? { data: null, error: { message } } : { data: rows, error: null }
  return {
    supabase: {
      from: (table: string) => ({
        select: () => ({
          then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve(response(tables[table] ?? [], failing[table])).then(resolve, reject),
          in: (_column: string, ids: string[]) =>
            Promise.resolve(response(
              (tables[table] ?? []).filter(row => ids.includes((row as { id: string }).id)),
              failingLookup[table],
            )),
          order: () => ({
            range: (from: number, to: number) => {
              const page = Promise.resolve(response((tables[table] ?? []).slice(from, to + 1), failing[table]))
              return { returns: () => page, then: page.then.bind(page) }
            },
          }),
        }),
      }),
    },
  }
})

import { fetchGeneralReportData } from './generalReportService'
import type { ComprehensiveReport } from '../types'

// Mid-afternoon on 20 October 2026, local time. The six-month range is what the hook asks for.
// The cash-flow months hold in every time zone: monthlyCashFlow buckets by local date.
const NOW = new Date(2026, 9, 20, 15, 30, 0)
const RANGE = { start: '2026-05-01', end: '2026-10-20' }

/** Float summing order is not a figure: compare to six decimals, and never tell -0 from 0. */
const roundDeep = <T>(value: T): T => {
  if (typeof value === 'number') return ((Math.round(value * 1e6) / 1e6) || 0) as T
  if (Array.isArray(value)) return value.map(roundDeep) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, roundDeep(inner)])) as T
  }
  return value
}

const report = async (selectedProject = 'all'): Promise<ComprehensiveReport> =>
  roundDeep(await fetchGeneralReportData(selectedProject, RANGE))

const pct = (part: number, whole: number) => (part / whole) * 100

// ── A realistic portfolio ──────────────────────────────────────────────────────────────────────
// Four projects: Zelena Dolina (in progress, with a TIC), Precko Zapad (completed, sold out, a
// stale `projects.budget` and an empty TIC), Sveta Nedelja (planning, no units yet) and Lučko
// (on hold, half sold, costs above its revenue).

const PORTFOLIO: Record<string, unknown[]> = {
  projects: [
    { id: 'p1', name: 'Zelena Dolina', location: 'Zagreb', status: 'In Progress', category: 'stambeno', budget: 6_500_000 },
    { id: 'p2', name: 'Precko Zapad', location: 'Zagreb', status: 'Completed', category: null, budget: 1_000_000_000 },
    { id: 'p3', name: 'Sveta Nedelja', location: 'Sveta Nedelja', status: 'Planning', category: 'retail', budget: 0 },
    { id: 'p4', name: 'Lučko', location: 'Zagreb', status: 'On Hold', category: 'stambeno', budget: 0 },
  ],
  apartments: [
    // No garage_id / repository_id: the table has no such columns (GEN-26).
    { id: 'a1', project_id: 'p1', status: 'Sold', price: 200_000 },
    { id: 'a2', project_id: 'p1', status: 'Sold', price: 150_000.5 },
    { id: 'a3', project_id: 'p1', status: 'Reserved', price: 180_000 },
    { id: 'a4', project_id: 'p1', status: 'Available', price: 170_000 },
    { id: 'a5', project_id: 'p1', status: 'Available', price: 160_000 },
    { id: 'a6', project_id: 'p1', status: 'Available', price: 155_000 },
    { id: 'a7', project_id: 'p2', status: 'Sold', price: 300_000 },
    { id: 'a8', project_id: 'p2', status: 'Sold', price: 250_000 },
    { id: 'a9', project_id: 'p2', status: 'Sold', price: 220_000 },
    { id: 'a10', project_id: 'p4', status: 'Sold', price: 50_000 },
    { id: 'a11', project_id: 'p4', status: 'Reserved', price: 60_000 },
  ],
  // Fewer sale rows than sold apartments, so the count shows which one `total_sales` is.
  sales: [
    { apartment_id: 'a1', sale_price: 198_000 },
    { apartment_id: 'a7', sale_price: 295_000 },
    { apartment_id: 'a8', sale_price: 250_000 },
  ],
  customers: [
    { id: 'cu1', status: 'buyer' },
    { id: 'cu2', status: 'buyer' },
    { id: 'cu3', status: 'lead' },
    { id: 'cu4', status: 'lead' },
    { id: 'cu5', status: 'interested' },
  ],
  contracts: [
    { id: 'c1', project_id: 'p1', status: 'active', contract_amount: 100_000, budget_realized: 40_000, contract_types: { name: 'Građevinski radovi' } },
    { id: 'c2', project_id: 'p1', status: 'completed', contract_amount: 50_000, budget_realized: 50_000, contract_types: { name: 'Građevinski radovi' } },
    { id: 'c3', project_id: 'p2', status: 'terminated', contract_amount: 30_000, budget_realized: 10_000, contract_types: null },
    { id: 'c4', project_id: 'p1', status: 'draft', contract_amount: 20_000, budget_realized: 0, contract_types: { name: 'Projektiranje' } },
  ],
  subcontractors: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
  project_phases: [
    { id: 'ph1', project_id: 'p1', status: 'completed' },
    { id: 'ph2', project_id: 'p1', status: 'active' },
    { id: 'ph3', project_id: 'p2', status: 'completed' },
  ],
  work_logs: [
    { id: 'w1', date: '2026-10-20' }, // today
    { id: 'w2', date: '2026-10-14' }, // six days ago
    { id: 'w3', date: '2026-10-13' }, // seven days ago: out
    { id: 'w4', date: '2026-10-21' }, // tomorrow: out
    { id: 'w5', date: null },
  ],
  accounting_invoices: [
    { id: 'i1', invoice_type: 'OUTGOING_SALES', project_id: 'p1', status: 'PAID', total_amount: 60_000, remaining_amount: 0, due_date: '2026-06-30', invoice_category: 'APARTMENT' },
    // Four VAT rates on one invoice: 8.000 @25 %, 2.000 @13 %, 1.000 @0 %, 1.180 @5 %. The report
    // reads only the gross total.
    {
      id: 'i2', invoice_type: 'INCOMING_SUPPLIER', project_id: 'p1', status: 'PARTIALLY_PAID',
      base_amount_1: 8_000, vat_rate_1: 25, vat_amount_1: 2_000,
      base_amount_2: 2_000, vat_rate_2: 13, vat_amount_2: 260,
      base_amount_3: 1_000, vat_rate_3: 0, vat_amount_3: 0,
      base_amount_4: 1_180, vat_rate_4: 5, vat_amount_4: 59,
      total_amount: 14_499, remaining_amount: 5_999, due_date: '2026-09-30', invoice_category: 'SUBCONTRACTOR',
    },
    { id: 'i3', invoice_type: 'INCOMING_SUPPLIER', project_id: 'p2', status: 'UNPAID', total_amount: 6_000, remaining_amount: 6_000, due_date: '2026-11-15', invoice_category: 'SUBCONTRACTOR' },
    { id: 'i4', invoice_type: 'INCOMING_OFFICE', project_id: null, status: 'PAID', total_amount: 1_250, remaining_amount: 0, due_date: '2026-08-15', invoice_category: 'OFFICE' },
    { id: 'i5', invoice_type: 'INCOMING_INVESTMENT', project_id: 'p1', status: 'PAID', total_amount: 8_000, remaining_amount: 0, due_date: '2026-05-31', invoice_category: 'INVESTOR' },
    { id: 'i6', invoice_type: 'INCOMING_BANK', project_id: 'p1', status: 'PAID', total_amount: 20_000, remaining_amount: 0, due_date: '2026-09-10', invoice_category: 'BANK_CREDIT' },
    { id: 'i7', invoice_type: 'INCOMING_BANK_EXPENSES', project_id: 'p1', status: 'PAID', total_amount: 1_800.8, remaining_amount: 0, due_date: '2026-10-05', invoice_category: 'BANK_CREDIT' },
    { id: 'i8', invoice_type: 'OUTGOING_BANK', project_id: 'p1', status: 'PAID', total_amount: 600_000, remaining_amount: 0, due_date: '2026-05-10', invoice_category: 'BANK_CREDIT' },
    { id: 'i9', invoice_type: 'OUTGOING_SUPPLIER', project_id: 'p2', status: 'PAID', total_amount: 3_000, remaining_amount: 0, due_date: '2026-10-25', invoice_category: 'SUBCONTRACTOR' },
    { id: 'i11', invoice_type: 'INCOMING_SUPPLIER', project_id: 'p4', status: 'PAID', total_amount: 70_000, remaining_amount: 0, due_date: '2026-09-20', invoice_category: 'SUBCONTRACTOR' },
    { id: 'i10', invoice_type: 'OUTGOING_OFFICE', project_id: null, status: 'UNPAID', total_amount: 500, remaining_amount: 500, due_date: '2026-11-30', invoice_category: 'OFFICE' },
  ],
  accounting_payments: [
    { id: 'pay1', invoice_id: 'i1', amount: 50_000, payment_date: '2026-06-15', payment_source_type: 'bank_account' },
    { id: 'pay12', invoice_id: 'i1', amount: 10_000, payment_date: '2026-03-14', payment_source_type: 'bank_account' }, // before the range
    // i2 is settled partly by kompenzacija and partly by a cesija paid from another company's
    // bank account (no credit involved).
    { id: 'pay2', invoice_id: 'i2', amount: 5_000, payment_date: '2026-07-10', payment_source_type: 'kompenzacija' },
    { id: 'pay10', invoice_id: 'i2', amount: 3_500, payment_date: '2026-07-22', payment_source_type: 'bank_account', is_cesija: true, cesija_company_id: 'co2', cesija_bank_account_id: 'ba9', cesija_credit_id: null },
    { id: 'pay3', invoice_id: 'i4', amount: 1_250, payment_date: '2026-08-12', payment_source_type: 'bank_account' },
    // A cesija paid from a credit.
    { id: 'pay4', invoice_id: 'i5', amount: 8_000, payment_date: '2026-05-20', payment_source_type: 'credit', is_cesija: true, cesija_credit_id: 'cr2' },
    { id: 'pay5', invoice_id: 'i6', amount: 20_000, payment_date: '2026-09-05', payment_source_type: 'bank_account' },
    { id: 'pay6', invoice_id: 'i7', amount: 900.4, payment_date: '2026-10-03', payment_source_type: 'bank_account' },
    { id: 'pay11', invoice_id: 'i7', amount: 900.4, payment_date: '2026-04-03', payment_source_type: 'bank_account' }, // before the range
    { id: 'pay7', invoice_id: 'i8', amount: 600_000, payment_date: '2026-05-08', payment_source_type: 'bank_account' },
    { id: 'pay8', invoice_id: 'i9', amount: 3_000, payment_date: '2026-10-18', payment_source_type: 'bank_account' },
    { id: 'pay13', invoice_id: 'i11', amount: 70_000, payment_date: '2026-09-18', payment_source_type: 'bank_account' },
    { id: 'pay9', invoice_id: 'i-not-loaded', amount: 777, payment_date: '2026-08-01', payment_source_type: 'bank_account' },
  ],
  banks: [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }],
  company_bank_accounts: [
    { id: 'ba1', current_balance: 125_000.55 },
    { id: 'ba2', current_balance: -3_200 },
    { id: 'ba3', current_balance: 0 },
  ],
  tic_cost_structures: [
    { id: 't1', project_id: 'p1', line_items: [
      { name: 'Zemljište', vlastita: 2_000_000, kreditna: 0 },
      { name: 'Građenje', vlastita: 1_500_000, kreditna: 3_000_000 },
    ] },
    { id: 't2', project_id: 'p2', line_items: [] },
    // A TIC row not linked to any project (GEN-30).
    { id: 't3', project_id: null, line_items: [{ name: 'Studija', vlastita: 250_000, kreditna: 0 }] },
  ],
  office_suppliers: [{ id: 'o1' }, { id: 'o2' }],
  bank_credits: [
    { id: 'cr1', bank_id: 'b1', project_id: 'p1', credit_type: 'construction_loan', status: 'active', amount: 1_000_000, used_amount: 600_000, outstanding_balance: 580_000, interest_rate: 4.5, monthly_payment: 12_000 },
    { id: 'cr2', bank_id: 'b2', project_id: 'p1', credit_type: 'equity', status: 'active', amount: 400_000, used_amount: 400_000, outstanding_balance: 0, interest_rate: 0, monthly_payment: 0 },
    { id: 'cr3', bank_id: 'b1', project_id: 'p2', credit_type: 'term_loan', status: 'paid', amount: 500_000, used_amount: 500_000, outstanding_balance: 0, interest_rate: 5, monthly_payment: 0 },
    { id: 'cr4', bank_id: 'b3', project_id: null, credit_type: 'line_of_credit', status: 'defaulted', amount: 200_000, used_amount: 150_000, outstanding_balance: 150_000, interest_rate: 7, monthly_payment: 3_000 },
    { id: 'cr5', bank_id: 'b2', project_id: 'p2', credit_type: 'construction_loan', status: 'active', amount: 300_000, used_amount: 100_000, outstanding_balance: 100_000, interest_rate: 6, monthly_payment: 4_000 },
  ],
  company_loans: [
    { id: 'l1', amount: 50_000, current_balance: 20_000 },
    { id: 'l2', amount: 10_000, current_balance: 0 },
  ],
  credit_allocations: [
    { id: 'al1', credit_id: 'cr1', project_id: 'p1', allocated_amount: 500_000 },
    { id: 'al2', credit_id: 'cr2', project_id: 'p1', allocated_amount: 400_000 },
    { id: 'al3', credit_id: 'cr5', project_id: 'p2', allocated_amount: 200_000 },
  ],
  buildings: [{ id: 'bu1' }, { id: 'bu2' }],
  garages: [{ id: 'g1', price: 15_000 }, { id: 'g2', price: 12_000 }],
  repositories: [{ id: 'r1', price: 5_000 }],
  // a1 is sold with a garage and a storage unit, a7 with a garage. a10 is Sold with no sale, so its
  // garage counts nowhere.
  apartment_garages: [
    { id: 'ag1', apartment_id: 'a1', garages: { price: 15_000 } },
    { id: 'ag2', apartment_id: 'a7', garages: { price: 20_000 } },
    { id: 'ag3', apartment_id: 'a10', garages: { price: 10_000 } },
  ],
  apartment_repositories: [{ id: 'ar1', apartment_id: 'a1', repositories: { price: 5_000 } }],
  subcontractor_milestones: [
    { id: 'm1', status: 'paid' },
    { id: 'm4', status: 'paid' },
    { id: 'm2', status: 'completed' }, // partly paid
    { id: 'm3', status: 'pending' },
  ],
  retail_projects: [
    { id: 'rp1', status: 'In Progress' },
    { id: 'rp2', status: 'Completed' },
  ],
  // One supplier contract and one buyer contract (GEN-28).
  retail_contracts: [
    { id: 'rc1', supplier_id: 'rs1', customer_id: null, contract_amount: 80_000, budget_realized: 30_000 },
    { id: 'rc2', supplier_id: null, customer_id: 'rcu1', contract_amount: 120_000, budget_realized: 60_000 },
  ],
  retail_project_phases: [
    { id: 'rph1', status: 'Completed' },
    { id: 'rph2', status: 'In Progress' },
    { id: 'rph3', status: 'Pending' },
  ],
  retail_land_plots: [{ id: 'lp1' }, { id: 'lp2' }],
  retail_customers: [{ id: 'rcu1' }],
  retail_suppliers: [{ id: 'rs1' }, { id: 'rs2' }],
  organization_settings: [{ name: '  Adriatic Development  ' }],
}

// Figures the sections below share, spelled out once.
// Contracted sales: a1 with its garage and storage, a7 with its garage, and a8 (GEN-38, changed on
// purpose: the list prices of the six Sold apartments, 1.170.000,5).
const REVENUE = (198_000 + 15_000 + 5_000) + (295_000 + 20_000) + 250_000
// Paid on cost invoices, whenever paid: kompenzacija, both cesije, office, ULAZNI (INV), credit
// fees, Lučko's supplier.
const EXPENSES = 5_000 + 3_500 + 1_250 + 8_000 + 900.4 + 900.4 + 70_000
const PROFIT = REVENUE - EXPENSES
const EQUITY = 400_000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  tables = structuredClone(PORTFOLIO)
  failing = {}
  failingLookup = {}
})

afterEach(() => {
  vi.useRealTimers()
})

describe('fetchGeneralReportData: a realistic portfolio', () => {
  it('names the organisation, trimmed', async () => {
    expect((await report()).organization_name).toBe('Adriatic Development')
  })

  it('executive summary and KPIs', async () => {
    const r = await report()
    expect(r.executive_summary).toEqual(roundDeep({
      total_projects: 4,
      active_projects: 1,
      completed_projects: 1,
      total_revenue: REVENUE,
      total_expenses: EXPENSES,
      total_profit: PROFIT,
      profit_margin: pct(PROFIT, REVENUE),
      // The TIC of Zelena Dolina only: not Precko Zapad's stale budget, not the unlinked TIC.
      portfolio_value: 6_500_000,
      roi: pct(PROFIT, EQUITY),
    }))
    expect(r.kpis).toEqual(roundDeep({
      portfolio_value: 6_500_000,
      total_revenue: REVENUE,
      net_profit: PROFIT,
      roi: pct(PROFIT, EQUITY),
      sales_rate: pct(6, 11),
      debt_equity_ratio: 680_000 / EQUITY,
      active_projects: 1,
      total_customers: 5,
    }))
  })

  it('sales performance', async () => {
    expect((await report()).sales_performance).toEqual(roundDeep({
      total_units: 11,
      units_sold: 6,
      available_units: 3,
      reserved_units: 2,
      // Contracted sales, averaged over the three sales (GEN-38, changed on purpose: over the six
      // Sold apartments).
      total_revenue: REVENUE,
      avg_sale_price: REVENUE / 3,
      total_sales: 3,
      buyers: 2,
      active_leads: 3,
      conversion_rate: pct(2, 5),
    }))
  })

  it('funding structure', async () => {
    expect((await report()).funding_structure).toEqual(roundDeep({
      total_equity: EQUITY,
      // Outstanding on the live, non-equity credits cr1 and cr5.
      total_debt: 580_000 + 100_000,
      debt_equity_ratio: 680_000 / EQUITY,
      total_credit_lines: 2_400_000,
      available_credit: 2_400_000 - 1_750_000,
      // Banks of the credits that have an allocation: b1 (cr1) and b2 (cr2, cr5).
      active_investors: 2,
      active_banks: 3,
      bank_credits: 5,
      avg_interest_rate: (4.5 * 1_000_000 + 6 * 300_000) / 1_300_000,
      monthly_debt_service: 12_000 + 4_000,
    }))
  })

  it('construction status', async () => {
    expect((await report()).construction_status).toEqual(roundDeep({
      total_contracts: 4,
      active_contracts: 1,
      completed_contracts: 1,
      // Every status, terminated and draft included.
      contract_value: 200_000,
      budget_realized: 100_000,
      budget_utilization: 50,
      total_subcontractors: 3,
      total_phases: 3,
      completed_phases: 2,
      work_logs_7days: 2,
      total_milestones: 4,
      completed_milestones: 2,
    }))
  })

  it('accounting overview', async () => {
    expect((await report()).accounting_overview).toEqual(roundDeep({
      total_invoices: 11,
      total_invoice_value: 60_000 + 14_499 + 6_000 + 1_250 + 8_000 + 20_000 + 1_800.8 + 600_000 + 3_000 + 70_000 + 500,
      paid_invoices: 8,
      paid_value: 60_000 + 1_250 + 8_000 + 20_000 + 1_800.8 + 600_000 + 3_000 + 70_000,
      pending_invoices: 3,
      // Remaining, not total, and the overdue one is pending too.
      pending_value: 5_999 + 6_000 + 500,
      overdue_invoices: 1,
      overdue_value: 5_999,
      payment_completion_rate: pct(8, 11),
    }))
  })

  it('TIC cost management', async () => {
    expect((await report()).tic_cost_management).toEqual({
      // The unlinked TIC row counts in both of these, so the three projects with no plan come out
      // as two (GEN-30).
      total_tic_budget: 6_750_000,
      projects_with_tic: 2,
      projects_without_tic: 2,
    })
  })

  it('office expenses', async () => {
    // Every OFFICE-category invoice at its total: the unpaid one the company issued (i10, money
    // in) counts as spending alongside the paid bill (GEN-36).
    expect((await report()).office_expenses).toEqual({
      total_office_suppliers: 2,
      total_office_invoices: 2,
      total_office_spent: 1_750,
      avg_office_invoice: 875,
    })
  })

  it('company credits', async () => {
    expect((await report()).company_credits).toEqual({
      total_credits: 5,
      total_credit_value: 2_400_000,
      credits_available: 650_000,
      credits_used: 1_750_000,
      // Only the cesija paid from a credit; the one paid from a bank account is missed (GEN-29).
      cesija_payments: 1,
      cesija_value: 8_000,
      total_allocations: 3,
      allocated_amount: 1_100_000,
    })
  })

  it('company loans, bank accounts, buildings and units', async () => {
    const r = await report()
    expect(r.company_loans).toEqual({ total_loans: 2, total_loan_amount: 60_000, total_outstanding: 20_000, active_loans: 1 })
    expect(r.bank_accounts).toEqual({ total_accounts: 3, total_balance: 121_800.55, positive_balance_accounts: 1, negative_balance_accounts: 1 })
    expect(r.buildings_units).toEqual({
      total_buildings: 2, total_units: 11, sold_units: 6, reserved_units: 2, available_units: 3, total_garages: 2, total_repositories: 1,
    })
  })

  it('retail portfolio', async () => {
    expect((await report()).retail_portfolio).toEqual({
      total_retail_projects: 2,
      // 'active' and 'completed' are not statuses these tables allow, so both read 0, and the
      // contract figures add the buyer's contract to the supplier's (GEN-28).
      active_retail_projects: 0,
      total_land_plots: 2,
      total_retail_contracts: 2,
      retail_contract_value: 200_000,
      retail_budget_realized: 90_000,
      retail_phases: 3,
      completed_retail_phases: 0,
      total_retail_customers: 1,
      retail_suppliers: 2,
    })
  })

  it('contract types, in first-seen order, with a missing type as an empty name', async () => {
    expect((await report()).contract_types).toEqual([
      { name: 'Građevinski radovi', count: 2 },
      { name: '', count: 1 },
      { name: 'Projektiranje', count: 1 },
    ])
  })

  it('cash flow: six months, every payment on its side and in its activity', async () => {
    const zero = { inflow: 0, outflow: 0, net: 0 }
    const month = (month_key: string, operating = zero, financing = zero) => ({
      month_key,
      inflow: operating.inflow + financing.inflow,
      outflow: operating.outflow + financing.outflow,
      net: operating.net + financing.net,
      operating,
      financing,
    })
    const flow = (inflow: number, outflow: number) => ({ inflow, outflow, net: inflow - outflow })

    // The two April payments and March's are outside the range, and the payment whose invoice
    // was not loaded has no type, so it sits on neither side. The kompenzacija in July counts as
    // cash out like any other payment (GEN-33).
    expect((await report()).cash_flow).toEqual(roundDeep([
      month('2026-05-01', flow(0, 8_000), flow(600_000, 0)),
      month('2026-06-01', flow(50_000, 0)),
      month('2026-07-01', flow(0, 8_500)),
      month('2026-08-01', flow(0, 1_250)),
      month('2026-09-01', flow(0, 70_000), flow(0, 20_000)),
      month('2026-10-01', flow(3_000, 900.4)),
    ]))
  })

  it('projects', async () => {
    // a1's sale with its garage and storage; a2 is Sold with no sale (GEN-38 and GEN-26, changed on
    // purpose: the list prices of a1 and a2).
    const p1Revenue = 198_000 + 15_000 + 5_000
    const p1Expenses = 8_500 + 8_000 + 1_800.8
    expect((await report()).projects).toEqual(roundDeep([
      {
        id: 'p1', name: 'Zelena Dolina', location: 'Zagreb', status: 'In Progress', category: 'stambeno',
        budget: 6_500_000, has_budget: true,
        revenue: p1Revenue,
        // Paid on its cost invoices; the principal repayment i6 is not a cost.
        expenses: p1Expenses,
        units_sold: 2, total_units: 6, contracts: 3, phases_done: 1, total_phases: 2,
        // Σ allocations, debt and equity alike, and the face value of every credit, equity
        // included: not the portfolio's definitions (GEN-27).
        equity: 900_000,
        debt: 1_400_000,
        sales_rate: pct(2, 6),
        profit: p1Revenue - p1Expenses,
        profit_margin: pct(p1Revenue - p1Expenses, p1Revenue),
        risk_level: 'Medium',
      },
      {
        id: 'p2', name: 'Precko Zapad', location: 'Zagreb', status: 'Completed', category: null,
        budget: 0, has_budget: false,
        // a7 with its garage, and a8; a9 has no sale (GEN-38, changed on purpose: 770.000).
        revenue: 565_000, expenses: 0,
        units_sold: 3, total_units: 3, contracts: 1, phases_done: 1, total_phases: 1,
        // Includes the repaid term loan cr3 (GEN-27).
        equity: 200_000, debt: 800_000,
        sales_rate: 100, profit: 565_000, profit_margin: 100,
        risk_level: 'Low',
      },
      {
        id: 'p3', name: 'Sveta Nedelja', location: 'Sveta Nedelja', status: 'Planning', category: 'retail',
        budget: 0, has_budget: false,
        revenue: 0, expenses: 0,
        units_sold: 0, total_units: 0, contracts: 0, phases_done: 0, total_phases: 0,
        equity: 0, debt: 0,
        sales_rate: 0, profit: 0, profit_margin: 0,
        // No units yet reads as a 0 % sales rate, so a project still in planning is high risk (GEN-32).
        risk_level: 'High',
      },
      {
        id: 'p4', name: 'Lučko', location: 'Zagreb', status: 'On Hold', category: 'stambeno',
        budget: 0, has_budget: false,
        // a10 is Sold with no sale, so nothing is contracted (GEN-38, changed on purpose: its list
        // price, 50.000, a margin of -40 % and a High risk).
        revenue: 0, expenses: 70_000,
        units_sold: 1, total_units: 2, contracts: 0, phases_done: 0, total_phases: 0,
        equity: 0, debt: 0,
        // No revenue reads as a 0 % margin (GEN-32), which is Medium risk.
        sales_rate: 50, profit: -70_000, profit_margin: 0,
        risk_level: 'Medium',
      },
    ]))
  })

  it('risks and insights', async () => {
    const r = await report()
    // Zelena Dolina, below 40 % sold. Sveta Nedelja has no units, so it is not counted, and Lučko
    // is at 50 %.
    expect(r.risks).toEqual([{ kind: 'slow_sales', count: 1 }])
    expect(r.insights).toEqual(roundDeep({
      // By contracted sales (GEN-38, changed on purpose). Sveta Nedelja and Lučko both have none;
      // the sort keeps their order.
      top_projects: [
        { name: 'Precko Zapad', revenue: 565_000, sales_rate: 100 },
        { name: 'Zelena Dolina', revenue: 198_000 + 15_000 + 5_000, sales_rate: pct(2, 6) },
        { name: 'Sveta Nedelja', revenue: 0, sales_rate: 0 },
      ],
      // Sales rate above 50 % and fewer units available than sold: only the two standing ones.
      recommendation_keys: ['reports.general.recs.budgets', 'reports.general.recs.partners'],
    }))
  })

  it('narrows only the project list to the selected project', async () => {
    const all = await report()
    const one = await report('p2')
    expect(one.projects.map(p => p.id)).toEqual(['p2'])
    expect(one.projects[0]).toEqual(all.projects[1])
    expect({ ...one, projects: [], insights: { ...one.insights, top_projects: [] }, risks: [] })
      .toEqual({ ...all, projects: [], insights: { ...all.insights, top_projects: [] }, risks: [] })
    // Risks and top projects are drawn from the narrowed list.
    expect(one.risks).toEqual([])
    expect(one.insights.top_projects).toEqual([{ name: 'Precko Zapad', revenue: 565_000, sales_rate: 100 }])
  })
})

describe('fetchGeneralReportData: no rows at all', () => {
  it('is a report of zeros and empty lists, not an error', async () => {
    tables = {}
    const zero = { inflow: 0, outflow: 0, net: 0 }
    const month = (month_key: string) => ({ month_key, inflow: 0, outflow: 0, net: 0, operating: zero, financing: zero })

    expect(await report()).toEqual({
      organization_name: null,
      executive_summary: {
        total_projects: 0, active_projects: 0, completed_projects: 0, total_revenue: 0, total_expenses: 0,
        total_profit: 0, profit_margin: 0, portfolio_value: 0, roi: 0,
      },
      kpis: {
        portfolio_value: 0, total_revenue: 0, net_profit: 0, roi: 0, sales_rate: 0, debt_equity_ratio: 0,
        active_projects: 0, total_customers: 0,
      },
      sales_performance: {
        total_units: 0, units_sold: 0, available_units: 0, reserved_units: 0, total_revenue: 0, avg_sale_price: 0,
        total_sales: 0, buyers: 0, active_leads: 0, conversion_rate: 0,
      },
      funding_structure: {
        total_equity: 0, total_debt: 0, debt_equity_ratio: 0, total_credit_lines: 0, available_credit: 0,
        active_investors: 0, active_banks: 0, bank_credits: 0, avg_interest_rate: 0, monthly_debt_service: 0,
      },
      construction_status: {
        total_contracts: 0, active_contracts: 0, completed_contracts: 0, contract_value: 0, budget_realized: 0,
        budget_utilization: 0, total_subcontractors: 0, total_phases: 0, completed_phases: 0, work_logs_7days: 0,
        total_milestones: 0, completed_milestones: 0,
      },
      accounting_overview: {
        total_invoices: 0, total_invoice_value: 0, paid_invoices: 0, paid_value: 0, pending_invoices: 0,
        pending_value: 0, overdue_invoices: 0, overdue_value: 0, payment_completion_rate: 0,
      },
      tic_cost_management: { total_tic_budget: 0, projects_with_tic: 0, projects_without_tic: 0 },
      office_expenses: { total_office_suppliers: 0, total_office_invoices: 0, total_office_spent: 0, avg_office_invoice: 0 },
      company_credits: {
        total_credits: 0, total_credit_value: 0, credits_available: 0, credits_used: 0, cesija_payments: 0,
        cesija_value: 0, total_allocations: 0, allocated_amount: 0,
      },
      company_loans: { total_loans: 0, total_loan_amount: 0, total_outstanding: 0, active_loans: 0 },
      bank_accounts: { total_accounts: 0, total_balance: 0, positive_balance_accounts: 0, negative_balance_accounts: 0 },
      buildings_units: {
        total_buildings: 0, total_units: 0, sold_units: 0, reserved_units: 0, available_units: 0, total_garages: 0,
        total_repositories: 0,
      },
      retail_portfolio: {
        total_retail_projects: 0, active_retail_projects: 0, total_land_plots: 0, total_retail_contracts: 0,
        retail_contract_value: 0, retail_budget_realized: 0, retail_phases: 0, completed_retail_phases: 0,
        total_retail_customers: 0, retail_suppliers: 0,
      },
      contract_types: [],
      cash_flow: ['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'].map(month),
      projects: [],
      risks: [],
      insights: {
        top_projects: [],
        // A 0 % sales rate asks for marketing; 0 available is not more than 0 sold.
        recommendation_keys: ['reports.general.recs.marketing', 'reports.general.recs.budgets', 'reports.general.recs.partners'],
      },
    })
  })
})

describe('fetchGeneralReportData: a failed load', () => {
  it.each(['projects', 'accounting_payments', 'bank_credits', 'organization_settings'])(
    'rejects when the %s read fails, rather than reporting zeros',
    async table => {
      failing = { [table]: `permission denied for table ${table}` }
      await expect(fetchGeneralReportData('all', RANGE)).rejects.toThrow(`permission denied for table ${table}`)
    },
  )

  // GEN-26, changed on purpose: the lookup read garages by a garage_id apartments do not have.
  it('rejects when the linked garages read fails', async () => {
    failing = { apartment_garages: 'canceling statement due to statement timeout' }
    await expect(fetchGeneralReportData('all', RANGE)).rejects.toThrow('canceling statement due to statement timeout')
  })
})
