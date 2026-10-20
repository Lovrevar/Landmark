import { APARTMENT_IMPORT_COLUMNS } from './apartmentImportTemplate'

/**
 * Catches a date typed into one of the money columns of the apartment import (U–Z: deposit, the
 * four instalments, the loan).
 *
 * `parseNumber` turns anything into a number, so a date did not fail — it imported as an amount.
 * Text "01.02.2026" lost its dots and became 1 022 026 €; a real Excel date cell arrived as its
 * serial and became some 46 000 €. Neither looks wrong enough in a preview to be noticed, and
 * both end up in the apartment's payment plan. The old on-screen instructions said these columns
 * held dates, so such files exist (SALES-12).
 */

/** Zero-based indexes of the columns that hold euro amounts in the payment plan: U … Z. */
export const AMOUNT_COLUMN_INDEXES = [20, 21, 22, 23, 24, 25] as const

/** `20` → `'U'`. The import has 26 columns, so a single letter always suffices. */
export const columnLetter = (index: number): string => String.fromCharCode(65 + index)

// 1.2.2026 / 01.02.2026. / 1/2/26 / 01-02-2026, and ISO 2026-02-01 (optionally with a time).
// A European amount cannot match: "3.000,00" has a comma, and "1.000.000" has three-digit groups
// where a date has one- or two-digit ones.
const DAY_FIRST_DATE = /^\d{1,2}[./-]\s?\d{1,2}[./-]\s?\d{2,4}\.?$/
const ISO_DATE = /^\d{4}-\d{1,2}-\d{1,2}([T ].*)?$/

/** Whether a cell's text reads as a calendar date rather than an amount. */
export function looksLikeDateText(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const text = value.trim()
  return DAY_FIRST_DATE.test(text) || ISO_DATE.test(text)
}

export interface AmountCell {
  /** The cell's value as the parser sees it. */
  value: unknown
  /** True when the spreadsheet itself stores the cell as a date (a number with a date format). */
  dateFormatted: boolean
}

/**
 * The amount columns of one row that hold a date, as zero-based column indexes. `cellAt` returns
 * what is in a column of this row; an empty cell is never an error — the columns are optional.
 */
export function dateCellsInAmountColumns(cellAt: (columnIndex: number) => AmountCell): number[] {
  return AMOUNT_COLUMN_INDEXES.filter(index => {
    const { value, dateFormatted } = cellAt(index)
    if (value === null || value === undefined || value === '') return false
    return dateFormatted || value instanceof Date || looksLikeDateText(value)
  })
}

/** The header the template gives a column, for naming it in an error. */
export const amountColumnName = (index: number): string => APARTMENT_IMPORT_COLUMNS[index]
