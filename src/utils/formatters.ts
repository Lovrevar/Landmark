export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const formatEuropean = (value: number): string => {
  return value.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const formatEuro = (value: number): string => {
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
export const formatEuroRounded = (value: number): string =>
  `€${value.toLocaleString('hr-HR', { maximumFractionDigits: 0 })}`
