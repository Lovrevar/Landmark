/**
 * Parses a number value from an Excel cell, supporting European format (e.g., "3.000,00").
 */
export const parseNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0
  const str = String(value).replace(/\./g, '').replace(',', '.')
  return parseFloat(str) || 0
}

/**
 * Parses a date value from an Excel cell.
 * Supports Excel serial numbers, DD.MM.YYYY strings, and ISO date strings.
 */
export const parseDate = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000))
    return date.toISOString().split('T')[0]
  }
  const str = String(value).trim()
  if (!str) return null
  const parts = str.split('.')
  if (parts.length === 3) {
    const [d, m, y] = parts
    return `${y.padStart(4, '20')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0]
  return null
}

/**
 * Detects the payment type for an apartment import row.
 * Columns 21-24 (V-Y) indicate installments; column 25 (Z) indicates credit.
 */
export const detectPaymentType = (row: unknown[]): 'credit' | 'installments' | null => {
  const hasInstallments = row[21] || row[22] || row[23] || row[24]
  const hasCredit = row[25]
  if (hasInstallments) return 'installments'
  if (hasCredit) return 'credit'
  return null
}
