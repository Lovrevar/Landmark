// Croatian VAT rates by position:
//   slot 1 = 25% (standard)
//   slot 2 = 13% (reduced)
//   slot 3 = 0%
//   slot 4 = 5% (super-reduced)
// These are tax rates, not config. Do not change without legal sign-off.
export const CROATIAN_VAT_RATES = {
  slot1: 0.25,
  slot2: 0.13,
  slot3: 0,
  slot4: 0.05,
} as const

export interface VatBreakdown {
  vat1: number
  vat2: number
  vat3: number
  vat4: number
  subtotal1: number
  subtotal2: number
  subtotal3: number
  subtotal4: number
  total: number
}

export function calculateVatBreakdown(
  base1: number | undefined | null,
  base2: number | undefined | null,
  base3: number | undefined | null,
  base4: number | undefined | null,
): VatBreakdown {
  const b1 = base1 || 0
  const b2 = base2 || 0
  const b3 = base3 || 0
  const b4 = base4 || 0

  const vat1 = b1 * CROATIAN_VAT_RATES.slot1
  const vat2 = b2 * CROATIAN_VAT_RATES.slot2
  const vat3 = 0
  const vat4 = b4 * CROATIAN_VAT_RATES.slot4

  return {
    vat1,
    vat2,
    vat3,
    vat4,
    subtotal1: b1 + vat1,
    subtotal2: b2 + vat2,
    subtotal3: b3,
    subtotal4: b4 + vat4,
    total: (b1 + vat1) + (b2 + vat2) + b3 + (b4 + vat4),
  }
}
