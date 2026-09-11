import { parseNumber, parseDate } from '../../../../utils/excelParsers'
import type { LineItem, ConstructionItem, ConstructionSection } from '../utils/ticFormatters'

export type SheetRow = unknown[]

export type TICSheetKind = 'investment' | 'construction'

export interface ParsedInvestmentSheet {
  kind: 'investment'
  sheetName: string
  lineItems: LineItem[]
  /** Phase ordinals found in the sheet, ascending. Empty for an unphased TIC. */
  phaseNumbers: number[]
  /**
   * Names of rows whose money is not attributed to any phase because every phase column
   * repeated the row's full total — land, project preparation. Surfaced in the preview: taking
   * these as phased would have overstated the Osijek plan by €8.087.207.
   */
  unphasedRows: string[]
  /**
   * Rows whose phase columns neither sum to the total nor repeat it. Imported with the split as
   * given and listed for review — never silently reconciled.
   */
  inconsistentRows: string[]
}

export interface ParsedConstructionSheet {
  kind: 'construction'
  sheetName: string
  sections: ConstructionSection[]
}

export type ParsedSheet = ParsedInvestmentSheet | ParsedConstructionSheet

export interface SheetError {
  sheetName: string
  error: string
}

export interface ParsedWorkbook {
  investment: ParsedInvestmentSheet | null
  construction: ParsedConstructionSheet | null
  investorName: string | null
  documentDate: string | null
  errors: SheetError[]
}

const NAME_HEADER = 'NAMJENA'
const OWN_FUNDS_HEADER = 'VLASTITA SREDSTVA'
const SECTION_CODE_RE = /^[A-Z]{1,2}\)$/
const ROMAN_NUMERAL_RE = /^[IVXLCDM]+\.?$/
const SUBTOTAL_RE = /^UKUPNO:?$/i
const GRAND_TOTAL_RE = /^SVEUKUPNO:?$/i

/** Uppercase, strip diacritics and collapse whitespace — for tolerant header/sheet matching. */
const normalize = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()

const cellText = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim()

const isBlank = (value: unknown): boolean => value === null || value === undefined || cellText(value) === ''

/**
 * Money, to the cent.
 *
 * The source workbooks are full of formula results, and a spreadsheet that allocates a total
 * across categories leaves the remainder in the last digits: 1908_TIC_Osijek.xlsx carries
 * `937136.966971929` for Komunalni i vodni doprinos and `708560.125` for Projektna
 * dokumentacija. Stored unrounded, those reach `projects.budget` — Zona 31 synced to
 * 41.446.111,46 off seven such rows — and show in full in every editable cell, because an
 * `<input type="number">` has no formatter while every read-only figure goes through
 * `formatNumber` at zero decimals.
 *
 * A plan denominated in euros has no meaning below the cent, so the precision is dropped where
 * it enters rather than hidden at each of the places it would otherwise surface. The shift is
 * at most half a cent per line, well inside the 0,02 the phase-split reconciliation allows.
 */
const toCents = (value: number): number => Math.round(value * 100) / 100

/**
 * Real .xlsx files give us real numbers; hand-edited or CSV-ish files give European
 * strings ("3.000,00"), which parseNumber handles. Never run a real number through
 * parseNumber — it would strip the decimal point as a thousands separator.
 */
const cellNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? toCents(value) : 0
  if (isBlank(value)) return 0
  return toCents(parseNumber(value))
}

interface SheetLayout {
  headerRow: number
  nameCol: number
  ownFundsCol: number
  hierarchical: boolean
}

/**
 * The two sheets are offset by one column (GRAĐENJE has a leading code column), so we
 * locate the columns from the header row rather than hardcoding indexes.
 */
function detectLayout(rows: SheetRow[]): SheetLayout | null {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    if (!Array.isArray(row)) continue

    const nameCol = row.findIndex((cell) => normalize(cell) === NAME_HEADER)
    if (nameCol === -1) continue

    const ownFundsCol = row.findIndex((cell) => normalize(cell) === OWN_FUNDS_HEADER)
    if (ownFundsCol === -1 || ownFundsCol <= nameCol) continue

    return {
      headerRow: r,
      nameCol,
      ownFundsCol,
      // A gap between the name header and the money block means col A holds section
      // codes and the names sit one column to the right.
      hierarchical: ownFundsCol - nameCol >= 2,
    }
  }
  return null
}

interface PhaseColumn {
  phaseNumber: number
  ownFundsCol: number
}

/**
 * Locate the per-phase column groups.
 *
 * A phased TIC labels each group `FAZA n` on a header line above the data, with the same
 * shape the project columns use: own funds, a % column, then credit. So credit sits at +2,
 * exactly as it does for the project block.
 */
function detectPhaseColumns(rows: SheetRow[], layout: SheetLayout): PhaseColumn[] {
  const found = new Map<number, number>()

  // Only the header block — a data row mentioning "faza" must not be mistaken for a label.
  for (let r = 0; r <= layout.headerRow + 3 && r < rows.length; r++) {
    const row = rows[r]
    if (!Array.isArray(row)) continue

    row.forEach((cell, col) => {
      const match = /^FAZA\s*(\d+)$/.exec(normalize(cell))
      if (!match) return
      const phaseNumber = Number(match[1])
      // Left-most wins: the label sits over the first column of its group.
      if (col > layout.ownFundsCol && !found.has(phaseNumber)) found.set(phaseNumber, col)
    })
  }

  return [...found.entries()]
    .map(([phaseNumber, ownFundsCol]) => ({ phaseNumber, ownFundsCol }))
    .sort((a, b) => a.phaseNumber - b.phaseNumber)
}

/** Cent-level tolerance: the source rounds each phase cell independently. */
const RECONCILE_TOLERANCE = 0.05

export interface InvestmentParseResult {
  lineItems: LineItem[]
  phaseNumbers: number[]
  unphasedRows: string[]
  inconsistentRows: string[]
}

function parseInvestmentRows(rows: SheetRow[], layout: SheetLayout): InvestmentParseResult {
  const { nameCol, ownFundsCol } = layout
  const phaseColumns = detectPhaseColumns(rows, layout)
  const lineItems: LineItem[] = []
  const unphasedRows: string[] = []
  const inconsistentRows: string[] = []

  for (let r = layout.headerRow + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!Array.isArray(row)) continue

    const name = cellText(row[nameCol])
    if (!name) continue
    // The header block's second line ("EUR" / "(%)") has no name cell, so it is skipped above.
    if (SUBTOTAL_RE.test(name) || GRAND_TOTAL_RE.test(name)) break
    if (/^DATUM:?$/i.test(name)) break

    const vlastita = cellNumber(row[ownFundsCol])
    const kreditna = cellNumber(row[ownFundsCol + 2])
    const item: LineItem = { name, vlastita, kreditna }

    if (phaseColumns.length > 0) {
      const phases = phaseColumns.map(({ phaseNumber, ownFundsCol: col }) => ({
        phase_number: phaseNumber,
        vlastita: cellNumber(row[col]),
        kreditna: cellNumber(row[col + 2]),
      }))

      const rowTotal = vlastita + kreditna
      const phaseSum = phases.reduce((sum, p) => sum + p.vlastita + p.kreditna, 0)
      const everyPhaseRepeatsTheTotal =
        rowTotal > 0 &&
        phases.length > 1 &&
        phases.every(p => Math.abs(p.vlastita + p.kreditna - rowTotal) < RECONCILE_TOLERANCE)

      if (everyPhaseRepeatsTheTotal) {
        // Not phased. The cost is incurred once and each phase's column restates it in full —
        // land is bought once. Attributing it to phases would multiply it by the phase count.
        unphasedRows.push(name)
      } else if (Math.abs(phaseSum - rowTotal) < RECONCILE_TOLERANCE) {
        item.phases = phases
      } else if (phaseSum === 0) {
        // Nothing in the phase columns: a project-level cost on an otherwise phased sheet.
        unphasedRows.push(name)
      } else {
        // Neither splits nor repeats. Keep the author's split, but say so — reconciling it
        // ourselves would be inventing figures.
        item.phases = phases
        inconsistentRows.push(name)
      }
    }

    lineItems.push(item)
  }

  return {
    lineItems,
    phaseNumbers: phaseColumns.map(p => p.phaseNumber),
    unphasedRows,
    inconsistentRows,
  }
}

function parseConstructionRows(rows: SheetRow[], layout: SheetLayout): ConstructionSection[] {
  const codeCol = layout.nameCol
  const nameCol = layout.nameCol + 1
  const { ownFundsCol } = layout

  const sections: ConstructionSection[] = []
  let current: ConstructionSection | null = null

  const ensureSection = (): ConstructionSection => {
    if (!current) {
      current = { code: '', name: '', items: [] }
      sections.push(current)
    }
    return current
  }

  for (let r = layout.headerRow + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!Array.isArray(row)) continue

    const code = cellText(row[codeCol])
    const name = cellText(row[nameCol])

    if (GRAND_TOTAL_RE.test(code) || GRAND_TOTAL_RE.test(name)) break
    if (!code && !name) continue
    // Per-section "Ukupno" rows are recomputed from the items, never imported.
    if (!code && SUBTOTAL_RE.test(name)) continue
    if (/^DATUM:?$/i.test(code)) break

    if (SECTION_CODE_RE.test(code)) {
      current = { code, name, items: [] }
      sections.push(current)
      continue
    }

    if (!name) continue

    const item: ConstructionItem = {
      numeral: ROMAN_NUMERAL_RE.test(code) ? code : '',
      name,
      vlastita: cellNumber(row[ownFundsCol]),
      kreditna: cellNumber(row[ownFundsCol + 2]),
    }
    ensureSection().items.push(item)
  }

  return sections.filter((section) => section.items.length > 0 || section.name !== '')
}

export function parseSheet(sheetName: string, rows: SheetRow[]): ParsedSheet {
  const layout = detectLayout(rows)
  if (!layout) {
    throw new Error('missing_header')
  }

  if (layout.hierarchical) {
    const sections = parseConstructionRows(rows, layout)
    if (sections.length === 0) throw new Error('no_rows')
    return { kind: 'construction', sheetName, sections }
  }

  const parsed = parseInvestmentRows(rows, layout)
  if (parsed.lineItems.length === 0) throw new Error('no_rows')
  return { kind: 'investment', sheetName, ...parsed }
}

/** Pull "INVESTITOR:" / "Datum:" from anywhere in the sheet — both are optional. */
function parseDocumentHeader(rows: SheetRow[]): { investorName: string | null; documentDate: string | null } {
  let investorName: string | null = null
  let documentDate: string | null = null

  for (const row of rows) {
    if (!Array.isArray(row)) continue
    for (let c = 0; c < row.length; c++) {
      const label = normalize(row[c])
      const next = row[c + 1]
      if (isBlank(next)) continue

      if (!investorName && /^INVESTITOR:?$/.test(label)) {
        investorName = cellText(next) || null
      } else if (!documentDate && /^DATUM:?$/.test(label)) {
        // Croatian dates carry a trailing period ("20.08.2026."), which the shared
        // parseDate would read as a fourth, empty component.
        documentDate = parseDate(typeof next === 'string' ? next.trim().replace(/\.$/, '') : next)
      }
    }
  }

  return { investorName, documentDate }
}

const looksLikeInvestment = (name: string) => normalize(name).startsWith('INVESTICIJ')
// `includes`, not `startsWith`: real workbooks prefix the sheet, e.g. "STR.TR. GRAĐENJA".
const looksLikeConstruction = (name: string) => normalize(name).includes('GRADENJ')

/**
 * Maps each sheet of a workbook onto the two TIC tabs. Sheets are matched by name first
 * (INVESTICIJA / GRAĐENJE); anything unmatched falls back to the shape the parser detected.
 */
export function parseTICWorkbook(sheets: { name: string; rows: SheetRow[] }[]): ParsedWorkbook {
  const result: ParsedWorkbook = {
    investment: null,
    construction: null,
    investorName: null,
    documentDate: null,
    errors: [],
  }

  const parsed: { sheetName: string; sheet: ParsedSheet }[] = []

  for (const { name, rows } of sheets) {
    const header = parseDocumentHeader(rows)
    result.investorName = result.investorName ?? header.investorName
    result.documentDate = result.documentDate ?? header.documentDate

    try {
      parsed.push({ sheetName: name, sheet: parseSheet(name, rows) })
    } catch (error) {
      result.errors.push({
        sheetName: name,
        error: error instanceof Error ? error.message : 'parse_failed',
      })
    }
  }

  // Pass 1: honour explicit sheet names, but only when the shape agrees.
  const unassigned: typeof parsed = []
  for (const entry of parsed) {
    if (!result.investment && entry.sheet.kind === 'investment' && looksLikeInvestment(entry.sheetName)) {
      result.investment = entry.sheet
    } else if (!result.construction && entry.sheet.kind === 'construction' && looksLikeConstruction(entry.sheetName)) {
      result.construction = entry.sheet
    } else {
      unassigned.push(entry)
    }
  }

  // Pass 2: fill the remaining slots by detected shape (handles renamed or single-sheet files).
  for (const entry of unassigned) {
    if (entry.sheet.kind === 'investment' && !result.investment) {
      result.investment = entry.sheet
    } else if (entry.sheet.kind === 'construction' && !result.construction) {
      result.construction = entry.sheet
    }
  }

  return result
}

/** Reads a File in the browser and hands the rows to the pure parser. */
export async function parseTICFile(file: File): Promise<ParsedWorkbook> {
  const XLSX = await import('@e965/xlsx')
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: 'array' })

  const sheets = workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[name], {
      header: 1,
      raw: true,
      defval: null,
    }),
  }))

  return parseTICWorkbook(sheets)
}
