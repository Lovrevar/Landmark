/**
 * What a unit and everything sold with it comes to — the figure every Sales screen puts beside
 * "paid".
 *
 * An apartment is sold as a package with its linked garages and storage units, but the sale
 * records one price, and that price is the apartment's: the sale form pre-fills it with the
 * apartment's list price and the linked units are marked sold alongside. So, as decided on
 * 2026-10-08 (SALES-6):
 *
 * - **sold:** the recorded sale price, plus the list prices of the linked units;
 * - **not sold yet:** list prices throughout.
 *
 * The screens each added list prices up for themselves and none read the sale price, so a unit
 * sold above or below its list price showed a total — and a remaining amount — nobody had agreed.
 */
export interface PackageParts {
  /** The unit's own list price. */
  listPrice: number | null | undefined
  /** The price on its `sales` row; absent, null or 0 when the unit is not sold. */
  salePrice?: number | null
  /** List prices of the garages and storage units linked to it. */
  linkedPrices?: ReadonlyArray<number | null | undefined>
}

const amount = (value: number | null | undefined): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function packageTotal({ listPrice, salePrice, linkedPrices = [] }: PackageParts): number {
  const own = amount(salePrice) > 0 ? amount(salePrice) : amount(listPrice)
  return own + linkedPrices.reduce<number>((sum, price) => sum + amount(price), 0)
}

/** A buyer's purchased unit, as the Customers screens hold it, with everything linked to it. */
export interface PurchasedUnit {
  price?: number | null
  sale_price?: number | null
  garages?: ReadonlyArray<{ price: number }>
  repositories?: ReadonlyArray<{ price: number }>
}

/** `packageTotal` for a purchased unit on the Customers card, its detail modal and their per-project sums. */
export const unitPackageTotal = (unit: PurchasedUnit): number =>
  packageTotal({
    listPrice: unit.price,
    salePrice: unit.sale_price,
    linkedPrices: [...(unit.garages ?? []), ...(unit.repositories ?? [])].map(linked => linked.price),
  })
