export interface PriceRange {
  min: number
  max: number
}

export const calculateAdjustedPriceRange = (
  range: PriceRange,
  adjustmentType: 'increase' | 'decrease',
  amount: number
): PriceRange => {
  if (adjustmentType === 'increase') {
    return {
      min: range.min + amount,
      max: range.max + amount
    }
  }
  return {
    min: Math.max(0, range.min - amount),
    max: Math.max(0, range.max - amount)
  }
}

/**
 * The unit's price per m², falling back to price ÷ size when the stored value is missing or 0.
 * Units created before the price_per_m2 trigger (migration 20260930100200) were stored with 0,
 * and treating that as €0/m² made a bulk adjustment overwrite their whole price.
 */
export const effectivePricePerM2 = (unit: { price?: number | null; size_m2?: number | null; price_per_m2?: number | null }): number => {
  const stored = Number(unit.price_per_m2) || 0
  if (stored > 0) return stored
  const size = Number(unit.size_m2) || 0
  const price = Number(unit.price) || 0
  return size > 0 ? price / size : 0
}
