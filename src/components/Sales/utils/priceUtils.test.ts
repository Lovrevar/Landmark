import { describe, it, expect } from 'vitest'
import { calculateAdjustedPriceRange, effectivePricePerM2 } from './priceUtils'

describe('calculateAdjustedPriceRange', () => {
  const range = { min: 100, max: 200 }

  it('adds the amount to both bounds on increase', () => {
    expect(calculateAdjustedPriceRange(range, 'increase', 50)).toEqual({ min: 150, max: 250 })
  })

  it('subtracts the amount from both bounds on decrease', () => {
    expect(calculateAdjustedPriceRange(range, 'decrease', 50)).toEqual({ min: 50, max: 150 })
  })

  it('clamps decrease to zero, never producing negative prices', () => {
    expect(calculateAdjustedPriceRange({ min: 10, max: 30 }, 'decrease', 100)).toEqual({ min: 0, max: 0 })
  })

  it('clamps only the bound that would go negative', () => {
    expect(calculateAdjustedPriceRange({ min: 10, max: 100 }, 'decrease', 50)).toEqual({ min: 0, max: 50 })
  })

  it('is a no-op for zero amount', () => {
    expect(calculateAdjustedPriceRange(range, 'increase', 0)).toEqual(range)
    expect(calculateAdjustedPriceRange(range, 'decrease', 0)).toEqual(range)
  })

  it('increase never clamps, even if a bound was negative going in', () => {
    // Defensive: if upstream ever passes a negative bound, increase preserves it.
    expect(calculateAdjustedPriceRange({ min: -50, max: 10 }, 'increase', 20)).toEqual({ min: -30, max: 30 })
  })
})

describe('effectivePricePerM2', () => {
  it('uses the stored value when there is one', () => {
    expect(effectivePricePerM2({ price: 200000, size_m2: 80, price_per_m2: 2400 })).toBe(2400)
  })

  it('derives price ÷ size when the stored value is 0 or missing', () => {
    expect(effectivePricePerM2({ price: 200000, size_m2: 80, price_per_m2: 0 })).toBe(2500)
    expect(effectivePricePerM2({ price: 200000, size_m2: 80, price_per_m2: null })).toBe(2500)
  })

  it('is 0 when there is no size to divide by', () => {
    expect(effectivePricePerM2({ price: 200000, size_m2: 0, price_per_m2: 0 })).toBe(0)
  })
})
