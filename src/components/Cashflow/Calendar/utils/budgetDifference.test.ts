import { describe, it, expect } from 'vitest'
import { budgetDifference } from './budgetDifference'

const MINUS = '−' // hr-HR prints a real minus sign, not a hyphen

describe('budgetDifference', () => {
  it('shows an overrun as a negative amount — the figure that used to print as positive', () => {
    const result = budgetDifference(450000, 2141590)
    expect(result.difference).toBe(-1691590)
    expect(result.overBudget).toBe(true)
    expect(result.formatted).toBe(`${MINUS}€1.691.590,00`)
  })

  it('shows money left as a positive amount', () => {
    const result = budgetDifference(450000, 441590.5)
    expect(result.difference).toBe(8409.5)
    expect(result.overBudget).toBe(false)
    expect(result.formatted).toBe('€8.409,50')
  })

  it('treats a month paid exactly to budget as on budget, with no stray sign', () => {
    const result = budgetDifference(0.3, 0.1 + 0.2) // 0.1 + 0.2 is 0.30000000000000004
    expect(result.difference).toBe(0)
    expect(result.overBudget).toBe(false)
    expect(result.formatted).toBe('€0,00')
  })

  it('is over budget by a single cent', () => {
    expect(budgetDifference(100, 100.01)).toMatchObject({ difference: -0.01, overBudget: true, formatted: `${MINUS}€0,01` })
  })
})
