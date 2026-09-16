export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * What every money helper below shows for a value that isn't a number.
 *
 * A nullable column (a budget that was never set, a rate that doesn't apply) must not read as
 * "€0" — see the budget invariant in docs/CODEBASE_INDEX.md. Before, a null threw inside
 * `toLocaleString` and took the screen down with it, and a NaN printed "€NaN".
 */
export const NO_VALUE = '—'

type Money = number | null | undefined

const isRenderable = (value: Money): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export const formatEuropean = (value: Money): string => {
  if (!isRenderable(value)) return NO_VALUE
  return value.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const formatEuro = (value: Money): string => {
  if (!isRenderable(value)) return NO_VALUE
  return `€${formatEuropean(value)}`
}

/**
 * Euro rounded to whole units, for budget-scale summary figures (phase and group rollups).
 *
 * `toLocaleString('hr-HR')` with no options is ragged — a whole number renders "73.125" but a
 * fractional one renders "1.425.597,5", a single stray decimal. Use `formatEuro` where exact
 * cents matter (an invoice, a contract amount); use this where the number is an aggregate and
 * the cents are noise.
 */
export const formatEuroRounded = (value: Money): string => {
  if (!isRenderable(value)) return NO_VALUE
  return `€${value.toLocaleString('hr-HR', { maximumFractionDigits: 0 })}`
}

/**
 * Euro shortened for dashboard tiles and chart axes, where a full figure doesn't fit.
 *
 * The rule is fixed here so a tile can't invent its own: every screen used to divide by a
 * million and call `.toFixed(1)` or `.toFixed(2)` itself, which rendered €45.000 as "€0.0M" —
 * a real figure shown as nothing — and put different precision on neighbouring tiles.
 *
 *   1.234.567 → €1,2M     45.000 → €45K     9.500 → €9.500     0 → €0
 *
 * Thousands only kick in at 10.000, so a five-figure amount keeps its digits rather than
 * collapsing to a vague "€9K". M and K are left as-is in both languages: they read the same to
 * Croatian and English users, and this helper is also called from services and PDF generators
 * that have no translator to hand. Where exact cents matter, use `formatEuro`.
 */
export const formatEuroCompact = (value: Money): string => {
  if (!isRenderable(value)) return NO_VALUE
  const magnitude = Math.abs(value)
  if (magnitude >= 1_000_000) {
    return `€${(value / 1_000_000).toLocaleString('hr-HR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  }
  if (magnitude >= 10_000) {
    return `€${(value / 1_000).toLocaleString('hr-HR', { maximumFractionDigits: 0 })}K`
  }
  return formatEuroRounded(value)
}
