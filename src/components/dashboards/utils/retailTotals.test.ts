import { describe, it, expect } from 'vitest'
import { computeRetailTotals, EMPTY_RETAIL_TOTALS, type RetailTotalsInput } from './retailTotals'

const phases = [
  { id: 'p-dev', phase_type: 'development' },
  { id: 'p-con', phase_type: 'construction' },
  { id: 'p-sal', phase_type: 'sales' }
]

const input = (over: Partial<RetailTotalsInput> = {}): RetailTotalsInput => ({
  phases,
  contracts: [],
  landPlots: [],
  invoices: [],
  ...over
})

describe('computeRetailTotals', () => {
  it('returns all zeros for an empty portfolio', () => {
    expect(computeRetailTotals(input())).toEqual(EMPTY_RETAIL_TOTALS)
  })

  // The bug this function exists for: `retail_contracts` holds supplier *and* customer
  // contracts, so a flat sum of budget_realized put buyer money into costs and Profit
  // subtracted revenue from itself.
  it('keeps sales collections out of costs', () => {
    const totals = computeRetailTotals(input({
      contracts: [
        { id: 'c1', phase_id: 'p-dev', contract_amount: 200, budget_realized: 100 },
        { id: 'c2', phase_id: 'p-con', contract_amount: 600, budget_realized: 400 },
        { id: 'c3', phase_id: 'p-sal', contract_amount: 2000, budget_realized: 1500 }
      ],
      landPlots: [{ total_price: 250 }]
    }))

    expect(totals.development_cost).toBe(100)
    expect(totals.construction_cost).toBe(400)
    expect(totals.land_cost).toBe(250)
    // 100 + 400 + 250 — the 1500 collected from buyers is nowhere in it.
    expect(totals.total_costs).toBe(750)
    expect(totals.total_collected).toBe(1500)
    expect(totals.profit).toBe(750)
    // The old code's answer, for contrast: costs 2000, profit 1500 − 2000 = −500.
    expect(totals.profit).not.toBe(-500)
  })

  it('"Investirano" is development + construction only, never a second name for costs', () => {
    const totals = computeRetailTotals(input({
      contracts: [
        { id: 'c1', phase_id: 'p-dev', budget_realized: 100 },
        { id: 'c2', phase_id: 'p-con', budget_realized: 400 }
      ],
      landPlots: [{ total_price: 250 }]
    }))

    expect(totals.total_invested).toBe(500)
    expect(totals.total_costs).toBe(750)
    expect(totals.total_costs - totals.total_invested).toBe(totals.land_cost)
  })

  it('revenue is the contracted sales value, collected is what was paid', () => {
    const totals = computeRetailTotals(input({
      contracts: [{ id: 'c3', phase_id: 'p-sal', contract_amount: 2000, budget_realized: 800 }]
    }))

    expect(totals.total_revenue).toBe(2000)
    expect(totals.total_collected).toBe(800)
  })

  it('counts only invoices on sales contracts, and only unsettled ones as outstanding', () => {
    const totals = computeRetailTotals(input({
      contracts: [
        { id: 'sale', phase_id: 'p-sal', contract_amount: 1000, budget_realized: 400 },
        { id: 'supplier', phase_id: 'p-con', contract_amount: 500, budget_realized: 500 }
      ],
      invoices: [
        { retail_contract_id: 'sale', status: 'PAID', total_amount: 400, remaining_amount: 0 },
        { retail_contract_id: 'sale', status: 'PARTIALLY_PAID', total_amount: 600, remaining_amount: 250 },
        // A supplier invoice: neither invoiced nor "to collect" on a retail dashboard.
        { retail_contract_id: 'supplier', status: 'UNPAID', total_amount: 500, remaining_amount: 500 },
        // Not linked to any contract — outside the report's definition.
        { retail_contract_id: null, status: 'UNPAID', total_amount: 900, remaining_amount: 900 }
      ]
    }))

    expect(totals.total_invoiced).toBe(1000)
    expect(totals.total_remaining).toBe(250)
  })

  it('ignores contracts whose phase is unknown or missing rather than guessing', () => {
    const totals = computeRetailTotals(input({
      contracts: [
        { id: 'orphan', phase_id: null, contract_amount: 999, budget_realized: 999 },
        { id: 'ghost', phase_id: 'p-gone', contract_amount: 999, budget_realized: 999 },
        { id: 'untyped', phase_id: 'p-x', contract_amount: 999, budget_realized: 999 }
      ],
      phases: [...phases, { id: 'p-x', phase_type: null }]
    }))

    expect(totals).toEqual(EMPTY_RETAIL_TOTALS)
  })

  it('coerces the numeric strings Supabase returns for numeric columns', () => {
    const totals = computeRetailTotals(input({
      contracts: [
        { id: 'c1', phase_id: 'p-dev', budget_realized: '100.50' },
        { id: 'c3', phase_id: 'p-sal', contract_amount: '2000', budget_realized: '1500.25' }
      ],
      landPlots: [{ total_price: '99.50' }, { total_price: null }]
    }))

    expect(totals.total_costs).toBeCloseTo(200, 6)
    expect(totals.total_collected).toBeCloseTo(1500.25, 6)
    expect(totals.profit).toBeCloseTo(1300.25, 6)
  })

  it('reports a loss when nothing has been collected yet', () => {
    const totals = computeRetailTotals(input({
      contracts: [{ id: 'c2', phase_id: 'p-con', budget_realized: 400 }],
      landPlots: [{ total_price: 100 }]
    }))

    expect(totals.profit).toBe(-500)
  })
})
