/**
 * Unit and customer figures: how many units are sold, reserved and available, the sales rate,
 * revenue from sold units, and the customer funnel. One definition each, for the General report,
 * the Sales report, the Director dashboard and Project details (REGRESSION_PREVENTION Step 7).
 *
 * What "revenue" means is not settled here. This file sums the **list price** of sold units, which
 * is what the General report and the Director dashboard's per-project table show. The Sales
 * report, the Sales dashboard and the buyer cards each use a different basis (sale price,
 * package with garages and storage, cash collected); GEN-38 lists them and GEN-9 decides.
 */

const num = (value: unknown): number => Number(value || 0)

/** An apartment, garage or storage unit row, narrowed to what these figures read. */
export interface UnitRow {
  status?: string | null
  price?: number | string | null
}

export interface UnitStatusCounts {
  total: number
  sold: number
  reserved: number
  available: number
}

/** Units by status. `total` counts every row, whatever its status. */
export function unitStatusCounts(units: readonly UnitRow[]): UnitStatusCounts {
  let sold = 0
  let reserved = 0
  let available = 0
  for (const unit of units) {
    if (unit.status === 'Sold') sold++
    else if (unit.status === 'Reserved') reserved++
    else if (unit.status === 'Available') available++
  }
  return { total: units.length, sold, reserved, available }
}

/** Sold units as a percentage of all units; 0 when there are none (GEN-32 asks whether it should be "—"). */
export const salesRate = (sold: number, total: number): number => (total > 0 ? (sold / total) * 100 : 0)

/** A total divided by a count, 0 when the count is 0 — the average sale price and the like. */
export const averagePer = (total: number, count: number): number => (count > 0 ? total / count : 0)

/**
 * Σ list price of the sold units, plus whatever `linkedPrice` adds per unit — the General report
 * passes its garage and storage lookup there for a project's revenue, and nothing for the
 * portfolio's (GEN-26).
 */
export function soldRevenue<T extends UnitRow>(units: readonly T[], linkedPrice: (unit: T) => number = () => 0): number {
  return units
    .filter(unit => unit.status === 'Sold')
    .reduce((sum, unit) => sum + num(unit.price) + linkedPrice(unit), 0)
}

/** A `customers` row, narrowed to its status. */
export interface CustomerRow {
  status?: string | null
}

export interface CustomerFunnel {
  total: number
  buyers: number
  interested: number
  leads: number
  /** Leads and interested together: everyone who has not bought yet. */
  activeLeads: number
  /** Buyers as a percentage of all customers. */
  conversionRate: number
}

/** Buyers as a percentage of all customers; 0 when there are none. */
export const conversionRate = (buyers: number, total: number): number => (total > 0 ? (buyers / total) * 100 : 0)

/** Customers by status. */
export function customerFunnel(customers: readonly CustomerRow[]): CustomerFunnel {
  const buyers = customers.filter(c => c.status === 'buyer').length
  const interested = customers.filter(c => c.status === 'interested').length
  const leads = customers.filter(c => c.status === 'lead').length
  return {
    total: customers.length,
    buyers,
    interested,
    leads,
    activeLeads: leads + interested,
    conversionRate: conversionRate(buyers, customers.length),
  }
}

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
