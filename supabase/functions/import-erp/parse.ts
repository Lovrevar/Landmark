// Parsing for ERP feed files. Both transports — the on-prem agent and the
// in-app upload — go through this one code path, so there is a single place
// where delimiters, encodings and date coercion are decided.
//
// See docs/erp-integration/SPEC.md §3 for the conventions this enforces.

export type Row = Record<string, string>

export interface ParseResult {
  headers: string[]
  rows: Row[]
}

const BOM = '﻿'

/**
 * RFC 4180 CSV, with the delimiter sniffed from the header line.
 *
 * Croatian exports normally use `;` because Excel does in a comma-decimal
 * locale, but we ask for `.` decimals (SPEC §3) and cannot assume the
 * generator honoured that, so guessing per file is safer than hardcoding.
 */
export function parseCsv(text: string): ParseResult {
  if (text.startsWith(BOM)) text = text.slice(1)
  const delimiter = sniffDelimiter(text)

  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }  // escaped quote
        else inQuotes = false
      } else {
        field += c
      }
      continue
    }

    if (c === '"') { inQuotes = true; continue }
    if (c === delimiter) { record.push(field); field = ''; continue }
    if (c === '\r') continue                       // CRLF and lone CR both fine
    if (c === '\n') { record.push(field); records.push(record); record = []; field = ''; continue }
    field += c
  }
  // Trailing record with no newline.
  if (field !== '' || record.length > 0) { record.push(field); records.push(record) }

  return toResult(records)
}

function sniffDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const counts = [';', ',', '\t'].map(d => [d, firstLine.split(d).length - 1] as const)
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][1] > 0 ? counts[0][0] : ';'
}

/**
 * XLSX/XLS. Cells are read as formatted text rather than raw values: Excel
 * stores dates as serial numbers and coerces them through the local timezone,
 * which in the sample export shifted every date back a day. Reading the
 * displayed string and parsing it ourselves avoids inheriting that bug.
 */
export async function parseXlsx(bytes: Uint8Array): Promise<ParseResult> {
  const XLSX = await import('npm:@e965/xlsx@0.20.3')
  const wb = XLSX.read(bytes, { type: 'array', raw: false, cellDates: false, cellText: true })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { headers: [], rows: [] }

  const grid = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  })
  return toResult(grid.map(r => r.map(c => (c ?? '').toString())))
}

function toResult(records: string[][]): ParseResult {
  const nonEmpty = records.filter(r => r.some(c => c.trim() !== ''))
  if (nonEmpty.length === 0) return { headers: [], rows: [] }

  const headers = nonEmpty[0].map(h => normaliseHeader(h))
  const rows: Row[] = []
  for (const rec of nonEmpty.slice(1)) {
    const row: Row = {}
    headers.forEach((h, i) => { if (h) row[h] = (rec[i] ?? '').trim() })
    rows.push(row)
  }
  return { headers, rows }
}

/** Tolerate case, spacing and punctuation drift in column names. */
function normaliseHeader(h: string): string {
  return h.replace(BOM, '').trim().toLowerCase().replace(/[\s.-]+/g, '_')
}

export type FileKind = 'csv' | 'xlsx'

export function detectFileKind(fileName: string, contentType: string | null): FileKind | null {
  const name = fileName.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt')) return 'csv'
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'xlsx'
  if (contentType?.includes('csv') || contentType?.includes('text/plain')) return 'csv'
  if (contentType?.includes('spreadsheet') || contentType?.includes('ms-excel')) return 'xlsx'
  return null
}

export async function parseFile(bytes: Uint8Array, kind: FileKind): Promise<ParseResult> {
  if (kind === 'xlsx') return parseXlsx(bytes)
  return parseCsv(decodeText(bytes))
}

/**
 * UTF-8, falling back to CP1250 when the bytes are not valid UTF-8 — the usual
 * shape of a Croatian export that did not honour the encoding request. Getting
 * this wrong corrupts every š, č and ć in a partner name, which then fails to
 * match anything.
 */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1250').decode(bytes)
  }
}
