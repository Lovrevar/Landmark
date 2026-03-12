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
