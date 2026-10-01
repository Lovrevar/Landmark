import { describe, it, expect } from 'vitest'
import { weightedAverageInterestRate } from './weightedInterestRate'

describe('weightedAverageInterestRate', () => {
  it('weights by allocated amount, not by row count', () => {
    // The plain mean of 3% and 5% is 4%; weighted by €1M and €3M it is 4,5%.
    expect(weightedAverageInterestRate([
      { allocated_amount: 1_000_000, credit: { interest_rate: 3 } },
      { allocated_amount: 3_000_000, credit: { interest_rate: 5 } },
    ])).toBeCloseTo(4.5, 10)
  })

  it('returns the single rate when there is one allocation', () => {
    expect(weightedAverageInterestRate([
      { allocated_amount: 250_000, credit: { interest_rate: 4.25 } },
    ])).toBeCloseTo(4.25, 10)
  })

  it('returns 0 for an empty list rather than NaN', () => {
    expect(weightedAverageInterestRate([])).toBe(0)
  })

  it('returns 0 when every allocation has a zero amount rather than dividing by zero', () => {
    const result = weightedAverageInterestRate([
      { allocated_amount: 0, credit: { interest_rate: 5 } },
      { allocated_amount: 0, credit: { interest_rate: 7 } },
    ])
    expect(result).toBe(0)
    expect(Number.isNaN(result)).toBe(false)
  })

  it('ignores zero-amount rows instead of letting them dilute the average', () => {
    expect(weightedAverageInterestRate([
      { allocated_amount: 1_000_000, credit: { interest_rate: 5 } },
      { allocated_amount: 0, credit: { interest_rate: 0 } },
    ])).toBeCloseTo(5, 10)
  })

  it('treats a missing credit or rate as 0% but still counts its weight', () => {
    // A €1M allocation whose credit row failed to join really is 0% of known interest.
    expect(weightedAverageInterestRate([
      { allocated_amount: 1_000_000, credit: { interest_rate: 6 } },
      { allocated_amount: 1_000_000, credit: null },
      { allocated_amount: 1_000_000 },
      { allocated_amount: 1_000_000, credit: { interest_rate: null } },
    ])).toBeCloseTo(1.5, 10)
  })

  it('tolerates a null allocated_amount', () => {
    expect(weightedAverageInterestRate([
      { allocated_amount: null, credit: { interest_rate: 9 } },
      { allocated_amount: 500_000, credit: { interest_rate: 3 } },
    ])).toBeCloseTo(3, 10)
  })
})
