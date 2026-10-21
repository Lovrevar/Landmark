import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyFakeDb, type FakeDb } from '../../../test/fakeSupabase'

/**
 * Characterization tests: they record what `fetchDirectorDashboard` returns today, before its
 * sales figures move into shared functions (docs/REGRESSION_PREVENTION.md, Step 7 item 2). They
 * also pin the construction and funding sections, which items 3 and 5 will move. They are not a
 * statement that every figure is right: where a pinned figure is known to be wrong or to differ
 * from another screen, the comment names the backlog id.
 *
 * Do not edit an expectation to get a refactor green. If one moves, the refactor changed a figure.
 */

const db = vi.hoisted((): FakeDb => ({ tables: {}, failing: {}, failingIn: {} }))
vi.mock('../../../lib/supabase', async () => {
  const { fakeSupabase } = await import('../../../test/fakeSupabase')
  return { supabase: fakeSupabase(db) }
})

import { fetchDirectorDashboard } from './directorService'

// Mid-afternoon on 20 October 2026, local time.
const NOW = new Date(2026, 9, 20, 15, 30, 0)

/** Float summing order is not a figure: compare to six decimals, and never tell -0 from 0. */
const roundDeep = <T>(value: T): T => {
  if (typeof value === 'number') return ((Math.round(value * 1e6) / 1e6) || 0) as T
  if (Array.isArray(value)) return value.map(roundDeep) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, roundDeep(inner)])) as T
  }
  return value
}

const dashboard = async () => roundDeep(await fetchDirectorDashboard())
const pct = (part: number, whole: number) => (part / whole) * 100

// ── A realistic portfolio ──────────────────────────────────────────────────────────────────────
// Zelena Dolina (in progress, with a TIC), Precko Zapad (completed, sold out, a stale
// `projects.budget` and an empty TIC) and Lučko (on hold, one apartment marked Sold with no sale
// row, as on LandmarkDemo — SALES-22).

const PORTFOLIO: Record<string, unknown[]> = {
  projects: [
    { id: 'p1', name: 'Zelena Dolina', location: 'Zagreb', status: 'In Progress', category: 'stambeno', budget: 6_500_000, created_at: '2026-03-01T09:00:00Z' },
    { id: 'p2', name: 'Precko Zapad', location: 'Zagreb', status: 'Completed', category: null, budget: 1_000_000_000, created_at: '2025-01-10T09:00:00Z' },
    { id: 'p3', name: 'Lučko', location: null, status: 'On Hold', category: 'stambeno', budget: 0, created_at: '2026-06-01T09:00:00Z' },
  ],
  tic_cost_structures: [
    { project_id: 'p1', line_items: [{ name: 'Građenje', vlastita: 1_500_000, kreditna: 5_000_000 }] },
    { project_id: 'p2', line_items: [] },
  ],
  apartments: [
    { id: 'a1', project_id: 'p1', status: 'Sold', price: 200_000 },
    { id: 'a2', project_id: 'p1', status: 'Sold', price: 150_000.5 },
    { id: 'a3', project_id: 'p1', status: 'Reserved', price: 180_000 },
    { id: 'a4', project_id: 'p1', status: 'Available', price: 170_000 },
    { id: 'a5', project_id: 'p2', status: 'Sold', price: 300_000 },
    { id: 'a6', project_id: 'p2', status: 'Sold', price: 250_000 },
    { id: 'a7', project_id: 'p3', status: 'Sold', price: 50_000 }, // no sale row (SALES-22)
    { id: 'a8', project_id: 'p3', status: 'Available', price: 60_000 },
  ],
  // Garages and storage are sold with their apartment and have no sale row of their own. The
  // dashboard does not read these links today (GEN-38).
  apartment_garages: [
    { apartment_id: 'a1', garage_id: 'g1', garages: { id: 'g1', price: 15_000 } },
    { apartment_id: 'a5', garage_id: 'g2', garages: { id: 'g2', price: 20_000 } },
  ],
  apartment_repositories: [
    { apartment_id: 'a1', repository_id: 'r1', repositories: { id: 'r1', price: 5_000 } },
  ],
  // Sale prices differ from list prices on a1 and a5. Two sales fall in October, one of them on
  // its first day.
  sales: [
    { apartment_id: 'a1', sale_price: 198_000, sale_date: '2026-10-03' },
    { apartment_id: 'a2', sale_price: 150_000.5, sale_date: '2026-09-15' },
    { apartment_id: 'a5', sale_price: 295_000, sale_date: '2025-11-20' },
    { apartment_id: 'a6', sale_price: 250_000, sale_date: '2026-10-01' },
  ],
  contracts: [
    { id: 'c1', project_id: 'p1', status: 'active', total_amount: 100_000, contract_amount: 100_000, budget_realized: 40_000 },
    { id: 'c2', project_id: 'p1', status: 'completed', total_amount: 50_000, contract_amount: 50_000, budget_realized: 50_000 },
    { id: 'c3', project_id: 'p2', status: 'terminated', total_amount: 30_000, contract_amount: 30_000, budget_realized: 10_000 },
    { id: 'c4', project_id: 'p1', status: 'draft', total_amount: 20_000, contract_amount: 20_000, budget_realized: 0 },
  ],
  accounting_invoices: [
    { id: 'i1', contract_id: 'c1', project_id: 'p1', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', total_amount: 60_000, paid_amount: 40_000 },
    { id: 'i2', contract_id: 'c2', project_id: 'p1', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', total_amount: 50_000, paid_amount: 50_000 },
    { id: 'i3', contract_id: null, project_id: 'p2', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUPPLIER', total_amount: 6_000, paid_amount: 0 },
    { id: 'i4', contract_id: null, project_id: 'p1', invoice_type: 'OUTGOING_SALES', invoice_category: 'CUSTOMER', total_amount: 60_000, paid_amount: 45_000 },
    { id: 'i5', contract_id: null, project_id: 'p1', invoice_type: 'INCOMING_BANK', invoice_category: 'BANK_CREDIT', total_amount: 20_000, paid_amount: 20_000 },
    { id: 'i6', contract_id: null, project_id: 'p1', invoice_type: 'INCOMING_BANK_EXPENSES', invoice_category: 'BANK_CREDIT', total_amount: 1_800.8, paid_amount: 1_800.8 },
    { id: 'i7', contract_id: 'c3', project_id: 'p2', invoice_type: 'INCOMING_SUPPLIER', invoice_category: 'SUBCONTRACTOR', total_amount: 10_000, paid_amount: 10_000 },
    { id: 'i8', contract_id: null, project_id: 'p3', invoice_type: 'OUTGOING_SALES', invoice_category: 'CUSTOMER', total_amount: 20_000, paid_amount: 0 },
  ],
  accounting_payments: [
    { amount: 45_000, payment_date: '2026-10-05', invoice_id: 'i4' },
    { amount: 40_000, payment_date: '2026-08-10', invoice_id: 'i1' },
    { amount: 50_000, payment_date: '2026-10-02', invoice_id: 'i2' },
    { amount: 1_800.8, payment_date: '2026-10-01', invoice_id: 'i6' },
    { amount: 20_000, payment_date: '2026-09-30', invoice_id: 'i5' },
    { amount: 10_000, payment_date: '2026-07-01', invoice_id: 'i7' },
  ],
  credit_allocations: [
    { project_id: 'p1', allocated_amount: 500_000 },
    { project_id: 'p1', allocated_amount: 100_000 },
    { project_id: 'p3', allocated_amount: 50_000 },
    { project_id: null, allocated_amount: 70_000 },
  ],
  bank_credits: [
    { id: 'cr1', project_id: 'p1', bank_id: 'b1', amount: 1_000_000, used_amount: 600_000, repaid_amount: 20_000, outstanding_balance: 580_000, interest_rate: 4.5, monthly_payment: 12_000, credit_type: 'construction_loan', status: 'active', maturity_date: '2026-11-10', credit_name: 'Kredit ZD', company: { id: 'co1', name: 'Zelena Dolina d.o.o.' } },
    { id: 'cr2', project_id: null, bank_id: 'b2', amount: 400_000, used_amount: 400_000, repaid_amount: 0, outstanding_balance: 400_000, interest_rate: 8, monthly_payment: 0, credit_type: 'equity', status: 'active', maturity_date: null, credit_name: 'Equity A', company: null },
    { id: 'cr3', project_id: 'p2', bank_id: 'b3', amount: 500_000, used_amount: 500_000, repaid_amount: 500_000, outstanding_balance: 0, interest_rate: 5, monthly_payment: 0, credit_type: 'construction_loan', status: 'paid', maturity_date: '2026-10-25', credit_name: 'Stari kredit', company: null },
    { id: 'cr4', project_id: 'p3', bank_id: 'b1', amount: 300_000, used_amount: 100_000, repaid_amount: 0, outstanding_balance: 100_000, interest_rate: 6, monthly_payment: 2_500, credit_type: 'line_of_credit', status: 'active', maturity_date: '2027-06-30', credit_name: null, company: { id: 'co2', name: 'Lučko d.o.o.' } },
  ],
  subcontractors: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
  subcontractor_milestones: [
    { id: 'm1', milestone_name: 'Temelji', due_date: '2026-10-10', status: 'pending', contract_id: 'c1' },
    { id: 'm2', milestone_name: 'Krov', due_date: '2026-10-22', status: 'completed', contract_id: 'c1' }, // partly paid
    { id: 'm3', milestone_name: 'Fasada', due_date: '2026-10-15', status: 'paid', contract_id: 'c2' },
    { id: 'm4', milestone_name: 'Instalacije', due_date: '2026-10-27', status: 'pending', contract_id: 'c1' },
    { id: 'm5', milestone_name: 'Bez roka', due_date: null, status: 'pending', contract_id: 'c1' },
  ],
}

// Σ sale_price over the sale rows: a1, a2, a5, a6. Lučko's Sold apartment has none.
const SALE_PRICES = 198_000 + 150_000.5 + 295_000 + 250_000
// Paid on cost invoices: i1, i2, i6, i7 (i3 is unpaid; i5 is principal).
const EXPENSES = 40_000 + 50_000 + 1_800.8 + 10_000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  Object.assign(db, emptyFakeDb(), { tables: structuredClone(PORTFOLIO) })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('fetchDirectorDashboard: a realistic portfolio', () => {
  it('projects, newest first', async () => {
    const p1Expenses = 60_000 + 50_000 + 1_800.8 // invoiced on c1 and c2, plus credit fees without a contract
    expect((await dashboard()).projects).toEqual(roundDeep([
      {
        id: 'p3', name: 'Lučko', location: '', status: 'On Hold', category: 'stambeno', budget: 0, budget_set: false,
        total_expenses: 0,
        // List price of the Sold apartment, though it has no sale (GEN-38).
        apartment_sales: 50_000,
        total_investment: 50_000,
        total_debt: 100_000,
        profit_margin: 100,
        completion_percentage: 50,
      },
      {
        id: 'p1', name: 'Zelena Dolina', location: 'Zagreb', status: 'In Progress', category: 'stambeno', budget: 6_500_000, budget_set: true,
        total_expenses: p1Expenses,
        // List prices of a1 and a2, not their sale prices and not a1's garage and storage (GEN-38).
        apartment_sales: 350_000.5,
        total_investment: 600_000,
        // Outstanding on the project's credits, equity included (FUND-21).
        total_debt: 580_000,
        profit_margin: pct(350_000.5 - p1Expenses, 350_000.5),
        completion_percentage: 50,
      },
      {
        id: 'p2', name: 'Precko Zapad', location: 'Zagreb', status: 'Completed', category: null, budget: 1_000_000_000, budget_set: false,
        // c3's invoice and the supplier invoice without a contract.
        total_expenses: 10_000 + 6_000,
        apartment_sales: 550_000,
        total_investment: 0,
        total_debt: 0,
        profit_margin: pct(550_000 - 16_000, 550_000),
        completion_percentage: 100,
      },
    ]))
  })

  it('financial metrics', async () => {
    expect((await dashboard()).financial).toEqual(roundDeep({
      // Σ sale_price; linked garages and storage play no part (GEN-38).
      total_revenue: SALE_PRICES,
      total_expenses: EXPENSES,
      total_profit: SALE_PRICES - EXPENSES,
      profit_margin: pct(SALE_PRICES - EXPENSES, SALE_PRICES),
      // Outstanding on the live, non-equity credits cr1 and cr4.
      total_debt: 680_000,
      total_equity: 400_000,
      debt_to_equity_ratio: 680_000 / 400_000,
      // Paid this month on customer invoices.
      cash_flow_current_month: 45_000,
      outstanding_receivables: 15_000 + 20_000,
      outstanding_payables: 20_000 + 6_000,
    }))
  })

  it('sales metrics', async () => {
    expect((await dashboard()).sales).toEqual(roundDeep({
      total_units: 8,
      sold_units: 5,
      reserved_units: 1,
      available_units: 2,
      sales_rate: pct(5, 8),
      total_sales_revenue: SALE_PRICES,
      // Σ sale_price over four sale rows, divided by five Sold apartments (GEN-38).
      avg_price_per_unit: SALE_PRICES / 5,
      // a1 and a6, the latter on the month's first day.
      monthly_sales_count: 2,
      monthly_sales_revenue: 198_000 + 250_000,
    }))
  })

  it('construction metrics', async () => {
    expect((await dashboard()).construction).toEqual({
      total_subcontractors: 3,
      active_subcontractors: 1,
      completed_contracts: 1,
      // Active and completed contracts only (SUP-18).
      total_contract_value: 150_000,
      // Invoice paid amounts on SUBCONTRACTOR invoices, not budget_realized.
      total_paid: 100_000,
      pending_payments: 20_000,
      overdue_tasks: 1,
      critical_deadlines: 2,
    })
  })

  it('funding metrics', async () => {
    expect((await dashboard()).funding).toEqual(roundDeep({
      funded_projects: 2,
      // Banks of the credits that are not settled, equity included (FUND-21): b1 and b2.
      total_investors: 2,
      total_bank_credit: 1_300_000,
      outstanding_debt: 680_000,
      credit_utilization: pct(700_000, 1_300_000),
      avg_interest_rate: (4.5 * 1_000_000 + 6 * 300_000) / 1_300_000,
      monthly_debt_service: 14_500,
      upcoming_maturities: 1,
    }))
  })

  it('alerts', async () => {
    expect((await dashboard()).alerts).toEqual([
      { type: 'critical', kind: 'overdue_milestone', params: { name: 'Temelji', count: 10 }, date: '2026-10-10' },
      { type: 'warning', kind: 'urgent_deadline', params: { name: 'Krov', count: 2 }, date: '2026-10-22' },
      { type: 'warning', kind: 'credit_maturity', params: { name: 'Kredit ZD', amount: 1_000_000, count: 21 }, date: '2026-11-10' },
    ])
  })
})

describe('fetchDirectorDashboard: no rows at all', () => {
  it('is a dashboard of zeros and empty lists, not an error', async () => {
    db.tables = {}
    expect(await dashboard()).toEqual({
      projects: [],
      financial: {
        total_revenue: 0, total_expenses: 0, total_profit: 0, profit_margin: 0, total_debt: 0, total_equity: 0,
        debt_to_equity_ratio: 0, cash_flow_current_month: 0, outstanding_receivables: 0, outstanding_payables: 0,
      },
      sales: {
        total_units: 0, sold_units: 0, reserved_units: 0, available_units: 0, sales_rate: 0, total_sales_revenue: 0,
        avg_price_per_unit: 0, monthly_sales_count: 0, monthly_sales_revenue: 0,
      },
      construction: {
        total_subcontractors: 0, active_subcontractors: 0, completed_contracts: 0, total_contract_value: 0,
        total_paid: 0, pending_payments: 0, overdue_tasks: 0, critical_deadlines: 0,
      },
      funding: {
        funded_projects: 0, total_investors: 0, total_bank_credit: 0, outstanding_debt: 0, credit_utilization: 0,
        avg_interest_rate: 0, monthly_debt_service: 0, upcoming_maturities: 0,
      },
      alerts: [],
    })
  })
})

describe('fetchDirectorDashboard: a failed load', () => {
  it.each(['projects', 'apartments', 'sales', 'accounting_payments', 'bank_credits', 'tic_cost_structures'])(
    'rejects when the %s read fails, rather than showing zeros',
    async table => {
      db.failing = { [table]: `permission denied for table ${table}` }
      await expect(fetchDirectorDashboard()).rejects.toMatchObject({ message: `permission denied for table ${table}` })
    },
  )
})
