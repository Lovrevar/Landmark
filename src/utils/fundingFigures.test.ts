import { describe, expect, it } from 'vitest'
import {
  activeFunderCount,
  allocationTotals,
  creditLineTotals,
  debtToEquity,
  isLiveDebt,
  liveDebtFigures,
  loanTotals,
  projectFunding,
  totalEquity,
  type CreditRow,
} from './fundingFigures'

const credit = (over: CreditRow): CreditRow => ({
  credit_type: 'construction_loan', status: 'active', amount: 0, used_amount: 0, outstanding_balance: 0,
  interest_rate: 0, monthly_payment: 0, ...over,
})

const CREDITS: CreditRow[] = [
  credit({ id: 'cr1', bank_id: 'b1', project_id: 'p1', amount: 1_000_000, used_amount: 600_000, outstanding_balance: 580_000, interest_rate: 4.5, monthly_payment: 12_000 }),
  credit({ id: 'cr2', bank_id: 'b2', project_id: 'p1', credit_type: 'equity', amount: 400_000, used_amount: 400_000 }),
  credit({ id: 'cr3', bank_id: 'b1', project_id: 'p2', credit_type: 'term_loan', status: 'paid', amount: 500_000, used_amount: 500_000, interest_rate: 5 }),
  credit({ id: 'cr4', bank_id: 'b3', credit_type: 'line_of_credit', status: 'defaulted', amount: 200_000, used_amount: 150_000, outstanding_balance: 150_000, interest_rate: 7, monthly_payment: 3_000 }),
  credit({ id: 'cr5', bank_id: 'b2', project_id: 'p2', amount: 300_000, used_amount: 100_000, outstanding_balance: 100_000, interest_rate: 6, monthly_payment: 4_000 }),
]

describe('isLiveDebt', () => {
  it('is a live, non-equity credit', () => {
    expect(CREDITS.map(isLiveDebt)).toEqual([true, false, false, false, true])
  })
})

describe('liveDebtFigures', () => {
  // GEN-2: debt is what is still owed on live debt, not the face value of every credit, and the
  // rate is weighted by facility size.
  it('sums what is still owed on live debt and weights the rate by facility amount', () => {
    const figures = liveDebtFigures(CREDITS)
    expect(figures).toMatchObject({ outstanding: 680_000, facilityAmount: 1_300_000, used: 700_000, monthlyDebtService: 16_000 })
    expect(figures.avgInterestRate).toBeCloseTo((4.5 * 1_000_000 + 6 * 300_000) / 1_300_000, 10)
  })

  it('reads numeric strings', () => {
    expect(liveDebtFigures([credit({ amount: '200000', outstanding_balance: '150000.5', interest_rate: '3' })]))
      .toMatchObject({ outstanding: 150_000.5, facilityAmount: 200_000, avgInterestRate: 3 })
  })

  it('is all zeros with no live debt, not NaN', () => {
    expect(liveDebtFigures([CREDITS[1], CREDITS[2]])).toEqual({ outstanding: 0, facilityAmount: 0, used: 0, avgInterestRate: 0, monthlyDebtService: 0 })
    expect(liveDebtFigures([])).toEqual({ outstanding: 0, facilityAmount: 0, used: 0, avgInterestRate: 0, monthlyDebtService: 0 })
  })
})

describe('totalEquity and debtToEquity', () => {
  it('is the equity facilities, and debt over it', () => {
    expect(totalEquity(CREDITS)).toBe(400_000)
    expect(debtToEquity(680_000, 400_000)).toBe(1.7)
  })

  it('D/E is 0 with no equity', () => {
    expect(debtToEquity(680_000, 0)).toBe(0)
  })
})

describe('creditLineTotals', () => {
  // GEN-1: available credit read two columns bank_credits does not have and was always €0.
  it('covers every credit, and headroom is amount minus used', () => {
    expect(creditLineTotals(CREDITS)).toEqual({ count: 5, total: 2_400_000, used: 1_750_000, available: 650_000 })
  })

  it('lets an overdrawn credit reduce the headroom', () => {
    expect(creditLineTotals([credit({ amount: 100, used_amount: 150 }), credit({ amount: 100, used_amount: 0 })]).available).toBe(50)
  })
})

describe('allocations and funders', () => {
  const allocations = [
    { credit_id: 'cr1', project_id: 'p1', allocated_amount: 500_000 },
    { credit_id: 'cr2', project_id: 'p1', allocated_amount: 400_000 },
    { credit_id: 'cr5', project_id: 'p2', allocated_amount: 200_000 },
    { credit_id: 'cr-unknown', project_id: 'p2', allocated_amount: 1 },
  ]

  it('totals the allocations', () => {
    expect(allocationTotals(allocations)).toEqual({ count: 4, allocated: 1_100_001 })
  })

  it('counts each bank behind an allocated credit once, and ignores allocations to unknown credits', () => {
    expect(activeFunderCount(allocations, CREDITS)).toBe(2)
    expect(activeFunderCount([], CREDITS)).toBe(0)
  })

})

describe('projectFunding', () => {
  // GEN-27, changed on purpose: it was Σ allocations as equity (900.000 for p1) and the face value
  // of every credit of the project as debt, equity and repaid ones included (1.400.000 for p1,
  // 800.000 for p2). Now the portfolio's definitions over the project's own credits.
  it('GEN-27: the equity facilities as equity, what is still owed on live debt as debt', () => {
    // cr1 owes 580.000; cr2 is the equity facility.
    expect(projectFunding('p1', CREDITS)).toEqual({ equity: 400_000, debt: 580_000 })
    // cr3 is repaid, so only cr5's 100.000 is owed.
    expect(projectFunding('p2', CREDITS)).toEqual({ equity: 0, debt: 100_000 })
    expect(projectFunding('p9', CREDITS)).toEqual({ equity: 0, debt: 0 })
  })

  it('adds up to the portfolio figures, apart from credits with no project', () => {
    const unassignedLive = credit({ id: 'cr6', amount: 90_000, outstanding_balance: 70_000 })
    const credits = [...CREDITS, unassignedLive]
    const projects = ['p1', 'p2'].map(id => projectFunding(id, credits))
    expect(projects.reduce((sum, p) => sum + p.debt, 0)).toBe(liveDebtFigures(credits).outstanding - 70_000)
    expect(projects.reduce((sum, p) => sum + p.equity, 0)).toBe(totalEquity(credits))
  })
})

describe('loanTotals', () => {
  it('counts outstanding loans as active', () => {
    expect(loanTotals([{ amount: 50_000, current_balance: 20_000 }, { amount: 10_000, current_balance: 0 }]))
      .toEqual({ count: 2, amount: 60_000, outstanding: 20_000, active: 1 })
    expect(loanTotals([])).toEqual({ count: 0, amount: 0, outstanding: 0, active: 0 })
  })
})
