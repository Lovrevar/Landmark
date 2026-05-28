import { describe, it, expect } from 'vitest'
import { calculateVatBreakdown, CROATIAN_VAT_RATES } from './vatCalculations'

describe('CROATIAN_VAT_RATES', () => {
  it('encodes the four legally-defined slot rates', () => {
    expect(CROATIAN_VAT_RATES.slot1).toBe(0.25)
    expect(CROATIAN_VAT_RATES.slot2).toBe(0.13)
    expect(CROATIAN_VAT_RATES.slot3).toBe(0)
    expect(CROATIAN_VAT_RATES.slot4).toBe(0.05)
  })
})

describe('calculateVatBreakdown', () => {
  it('returns all zeros for all-zero input', () => {
    expect(calculateVatBreakdown(0, 0, 0, 0)).toEqual({
      vat1: 0, vat2: 0, vat3: 0, vat4: 0,
      subtotal1: 0, subtotal2: 0, subtotal3: 0, subtotal4: 0,
      total: 0,
    })
  })

  it('treats undefined and null bases as zero (does not produce NaN)', () => {
    expect(calculateVatBreakdown(undefined, null, undefined, null)).toEqual({
      vat1: 0, vat2: 0, vat3: 0, vat4: 0,
      subtotal1: 0, subtotal2: 0, subtotal3: 0, subtotal4: 0,
      total: 0,
    })
  })

  it('computes slot 1 (25%) correctly when only slot 1 has a base', () => {
    const result = calculateVatBreakdown(100, 0, 0, 0)
    expect(result.vat1).toBe(25)
    expect(result.subtotal1).toBe(125)
    expect(result.subtotal2).toBe(0)
    expect(result.subtotal3).toBe(0)
    expect(result.subtotal4).toBe(0)
    expect(result.total).toBe(125)
  })

  it('computes slot 2 (13%) correctly', () => {
    const result = calculateVatBreakdown(0, 100, 0, 0)
    expect(result.vat2).toBe(13)
    expect(result.subtotal2).toBe(113)
    expect(result.total).toBe(113)
  })

  it('slot 3 has no VAT and passes the base through unchanged', () => {
    const result = calculateVatBreakdown(0, 0, 100, 0)
    expect(result.vat3).toBe(0)
    expect(result.subtotal3).toBe(100)
    expect(result.total).toBe(100)
  })

  it('computes slot 4 (5%) correctly', () => {
    const result = calculateVatBreakdown(0, 0, 0, 100)
    expect(result.vat4).toBe(5)
    expect(result.subtotal4).toBe(105)
    expect(result.total).toBe(105)
  })

  it('sums all four slots into the grand total when all have non-zero bases', () => {
    // 1000 @ 25% = 1250
    //  500 @ 13% = 565
    //  200 @  0% = 200
    //  100 @  5% = 105
    // total: 2120
    const result = calculateVatBreakdown(1000, 500, 200, 100)
    expect(result.vat1).toBe(250)
    expect(result.vat2).toBe(65)
    expect(result.vat3).toBe(0)
    expect(result.vat4).toBe(5)
    expect(result.subtotal1).toBe(1250)
    expect(result.subtotal2).toBe(565)
    expect(result.subtotal3).toBe(200)
    expect(result.subtotal4).toBe(105)
    expect(result.total).toBe(2120)
  })

  it('handles fractional bases without losing precision beyond float epsilon', () => {
    // 123.45 @ 25% = 30.8625; subtotal = 154.3125
    const result = calculateVatBreakdown(123.45, 0, 0, 0)
    expect(result.vat1).toBeCloseTo(30.8625, 4)
    expect(result.subtotal1).toBeCloseTo(154.3125, 4)
    expect(result.total).toBeCloseTo(154.3125, 4)
  })

  it('handles a real-world multi-VAT mix without NaN or absurd rounding', () => {
    // Mixed invoice: building materials (5%), labor (13%), incidentals (25%), exempt (0%)
    const result = calculateVatBreakdown(2_499.99, 1_250, 350, 4_800)
    expect(result.total).toBeGreaterThan(0)
    // Verify total = sum of all subtotals (the invariant the function promises)
    const sumOfSubtotals =
      result.subtotal1 + result.subtotal2 + result.subtotal3 + result.subtotal4
    expect(result.total).toBeCloseTo(sumOfSubtotals, 6)
  })

  it('handles very large amounts without float blowup', () => {
    const big = 1_000_000_000
    const result = calculateVatBreakdown(big, 0, 0, 0)
    expect(result.vat1).toBe(big * 0.25)
    expect(result.total).toBe(big * 1.25)
    expect(Number.isFinite(result.total)).toBe(true)
  })

  it('subtotal of each slot always equals base + vat for that slot', () => {
    const result = calculateVatBreakdown(1000, 500, 200, 100)
    expect(result.subtotal1).toBe(1000 + result.vat1)
    expect(result.subtotal2).toBe(500 + result.vat2)
    expect(result.subtotal3).toBe(200 + result.vat3)
    expect(result.subtotal4).toBe(100 + result.vat4)
  })
})
