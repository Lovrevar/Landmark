import { downloadBlob, exportFileName } from '../utils/downloadFile'
import { parseLocalDate } from '../utils/dateOnly'
import { NO_VALUE } from '../utils/formatters'

/**
 * One way to write a spreadsheet, shared by every "Export Excel" button outside TIC.
 *
 * Six screens used to hand-roll a CSV, and five of them quoted nothing at all: a supplier named
 * `PANNONIA, d.o.o.` shifted every column after it, a newline in a note split the record, a value
 * starting `=` was a formula waiting for whoever opened the file, none of them wrote a BOM (so the
 * one export with Croatian headers was mojibake in Excel), and every amount was a dot decimal that
 * Croatian Excel reads as text and refuses to sum. A real `.xlsx` removes all five at once rather
 * than patching them one at a time — a string cell is a string cell whatever is inside it, and
 * `aoa_to_sheet` only ever produces formulas from an explicit `{ f }`, never from text.
 *
 * Two conventions hold across every sheet built here, and they are the whole point of the file:
 *
 * - **Money is a number**, carrying the `#,##0.00 €` *format*. The number is locale-free in the
 *   file; Excel renders `1.234,56 €` for a Croatian user and `1,234.56 €` for an English one, and
 *   either way `SUM()` works on the column.
 * - **A date is a date**, carrying the `dd.mm.yyyy.` format, so the column sorts and filters as
 *   dates instead of as text that happens to start with a number.
 */

/** A date cell is a `Date`; money and counts are `number`; everything else is text. */
export type SheetCell = string | number | Date | null

export type SheetRows = SheetCell[][]

export interface WorkbookSheet {
  /** Tab name. Excel caps these at 31 characters and forbids `[]:*?/\`. */
  name: string
  rows: SheetRows
  /** Column widths in characters, left to right. */
  columnWidths?: number[]
  /** Zero-based indices of the columns holding money, which get the euro format. */
  moneyColumns?: number[]
}

const DATE_FORMAT = 'dd.mm.yyyy.'
const MONEY_FORMAT = '#,##0.00" €"'
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * A `Date` at local midnight for a cell, or `null` for a missing or unparseable value.
 *
 * A Postgres `date` arrives as 'YYYY-MM-DD', and `new Date('2026-01-05')` is UTC midnight, which
 * east of UTC is the 4th — three of the six exports wrote the previous day. A full timestamp is a
 * real instant, so its *local* calendar day is the right one; only date-only strings go through
 * `parseLocalDate`. Either way the time of day is dropped, so the serial Excel stores is a whole
 * number and the cell cannot render a stray 01:00.
 */
export function toDateCell(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const parsed =
    value instanceof Date
      ? value
      : /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? parseLocalDate(value)
        : new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

/**
 * Text for a cell, with the screen's placeholders stripped.
 *
 * `—`, `-` and `'N/A'` are how a table says "nothing here" to a reader; in a spreadsheet column
 * they are values, and they break filtering and any formula over the column. An empty cell is the
 * spreadsheet's own way of saying the same thing.
 */
export function textCell(value: string | null | undefined): string {
  if (!value) return ''
  return value === NO_VALUE || value === '-' || value === 'N/A' ? '' : value
}

/** Builds the workbook without touching the DOM, so the layout is testable in node. */
export async function buildWorkbook(sheets: WorkbookSheet[]) {
  const XLSX = await import('@e965/xlsx')
  const workbook = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows, { cellDates: true })
    const money = new Set(sheet.moneyColumns ?? [])

    for (const ref of Object.keys(worksheet)) {
      if (ref.startsWith('!')) continue
      const cell = worksheet[ref]
      if (cell.t === 'd') cell.z = DATE_FORMAT
      else if (cell.t === 'n' && money.has(XLSX.utils.decode_cell(ref).c)) cell.z = MONEY_FORMAT
    }

    if (sheet.columnWidths) worksheet['!cols'] = sheet.columnWidths.map(wch => ({ wch }))
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  }

  return workbook
}

/**
 * Writes the workbook and hands it to the browser as `prefix-2026-09-23.xlsx`.
 *
 * `@e965/xlsx` is imported dynamically: it is ~900 KB and only a handful of screens export, so it
 * has no business in the initial bundle.
 */
export async function downloadWorkbook(sheets: WorkbookSheet[], fileNamePrefix: string): Promise<void> {
  const XLSX = await import('@e965/xlsx')
  const workbook = await buildWorkbook(sheets)
  const out = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  downloadBlob(new Blob([out], { type: XLSX_MIME }), exportFileName(fileNamePrefix, 'xlsx'))
}
