// Feed definitions: what each ERP export must contain, how its text becomes
// typed values, and what makes a row invalid.
//
// Contract: docs/erp-integration/SPEC.md §§4-6.

import type { Row } from './parse.ts'

export type FeedName =
  | 'invoices' | 'payments' | 'partners' | 'accounts' | 'cost_centers' | 'bank_balances'

export const FEED_NAMES: FeedName[] = [
  'invoices', 'payments', 'partners', 'accounts', 'cost_centers', 'bank_balances',
]

export interface Parsed<T> {
  value: T
  errors: string[]
}

// ---------------------------------------------------------------------------
// Coercion
// ---------------------------------------------------------------------------

const str = (r: Row, k: string): string | null => {
  const v = r[k]
  return v === undefined || v.trim() === '' ? null : v.trim()
}

/**
 * Accepts `1234.56` (what we ask for) and `1.234,56` / `1234,56` (what Excel in
 * a Croatian locale produces anyway). The ambiguous case is a single separator
 * with exactly three trailing digits — `1,234` — which is read as a thousands
 * separator only when a decimal comma is also present elsewhere in the number.
 */
export function num(r: Row, k: string): number | null {
  const raw = str(r, k)
  if (raw === null) return null
  let s = raw.replace(/\s/g, '')

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    // Whichever comes last is the decimal separator; the other is grouping.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (lastComma >= 0) {
    const decimals = s.length - lastComma - 1
    s = decimals === 3 && /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.')
  }

  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** ISO `YYYY-MM-DD` preferred; `DD.MM.YYYY` and `DD/MM/YYYY` accepted. */
export function date(r: Row, k: string): string | null {
  const raw = str(r, k)
  if (raw === null) return null

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const eu = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/)
  if (eu) return `${eu[3]}-${eu[2].padStart(2, '0')}-${eu[1].padStart(2, '0')}`

  return null
}

export function timestamp(r: Row, k: string): string | null {
  const raw = str(r, k)
  if (raw === null) return null
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return d.toISOString()
  const only = date(r, k)
  return only ? `${only}T00:00:00Z` : null
}

const upper = (r: Row, k: string): string | null => str(r, k)?.toUpperCase() ?? null

const bool = (r: Row, k: string): boolean => {
  const v = str(r, k)?.toLowerCase()
  return v === null || v === undefined ? true : !['0', 'false', 'ne', 'no', 'n'].includes(v)
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function requireFields(v: Record<string, unknown>, keys: string[], errors: string[]) {
  for (const k of keys) {
    if (v[k] === null || v[k] === undefined) errors.push(`${k} is required`)
  }
}

function requireOneOf(value: string | null, allowed: string[], field: string, errors: string[]) {
  if (value !== null && !allowed.includes(value)) {
    errors.push(`${field} must be one of ${allowed.join(', ')} (got "${value}")`)
  }
}

const DIRECTIONS = ['INCOMING', 'OUTGOING']
const DOCUMENT_TYPES = ['INVOICE', 'CREDIT_NOTE', 'ADVANCE', 'STORNO']
const PAYMENT_METHODS = ['WIRE', 'CASH', 'CHECK', 'CARD']
const SETTLEMENT_TYPES = ['BANK', 'KOMPENZACIJA', 'CESIJA', 'GOTOVINA']

// ---------------------------------------------------------------------------
// invoices
// ---------------------------------------------------------------------------

export interface StagedInvoice {
  erp_id: string | null
  line_no: number | null
  direction: string | null
  document_type: string | null
  original_erp_id: string | null
  company_oib: string | null
  partner_erp_id: string | null
  partner_oib: string | null
  partner_name: string | null
  invoice_number: string | null
  reference_number: string | null
  issue_date: string | null
  due_date: string | null
  cost_center_code: string | null
  account_code: string | null
  base_amount: number | null
  vat_rate: number | null
  vat_amount: number | null
  line_total: number | null
  invoice_total: number | null
  currency: string | null
  description: string | null
  source_updated_at: string | null
}

export function parseInvoiceRow(r: Row): Parsed<StagedInvoice> {
  const v: StagedInvoice = {
    erp_id: str(r, 'erp_id'),
    line_no: num(r, 'line_no'),
    direction: upper(r, 'direction'),
    document_type: upper(r, 'document_type'),
    original_erp_id: str(r, 'original_erp_id'),
    company_oib: str(r, 'company_oib'),
    partner_erp_id: str(r, 'partner_erp_id'),
    partner_oib: str(r, 'partner_oib'),
    partner_name: str(r, 'partner_name'),
    invoice_number: str(r, 'invoice_number'),
    reference_number: str(r, 'reference_number'),
    issue_date: date(r, 'issue_date'),
    due_date: date(r, 'due_date'),
    cost_center_code: str(r, 'cost_center_code'),
    account_code: str(r, 'account_code'),
    base_amount: num(r, 'base_amount'),
    vat_rate: num(r, 'vat_rate'),
    vat_amount: num(r, 'vat_amount'),
    line_total: num(r, 'line_total'),
    invoice_total: num(r, 'invoice_total'),
    currency: upper(r, 'currency') ?? 'EUR',
    description: str(r, 'description'),
    source_updated_at: timestamp(r, 'updated_at'),
  }

  const errors: string[] = []
  requireFields(v as unknown as Record<string, unknown>, [
    'erp_id', 'line_no', 'direction', 'document_type', 'company_oib',
    'partner_erp_id', 'partner_name', 'invoice_number',
    'issue_date', 'due_date', 'cost_center_code', 'account_code',
    'base_amount', 'vat_rate', 'vat_amount', 'line_total', 'invoice_total',
  ], errors)

  requireOneOf(v.direction, DIRECTIONS, 'direction', errors)
  requireOneOf(v.document_type, DOCUMENT_TYPES, 'document_type', errors)

  // The line has to add up. Half a cent of tolerance for rounding in the ERP.
  if (v.base_amount !== null && v.vat_amount !== null && v.line_total !== null) {
    if (Math.abs(v.base_amount + v.vat_amount - v.line_total) > 0.005) {
      errors.push(`line_total ${v.line_total} != base_amount ${v.base_amount} + vat_amount ${v.vat_amount}`)
    }
  }
  // vat_amount is NOT checked against base_amount * vat_rate — the posted split
  // legitimately differs from the nominal rate. See DECISIONS.md D8.

  if (v.issue_date && v.due_date && v.due_date < v.issue_date) {
    errors.push(`due_date ${v.due_date} is before issue_date ${v.issue_date}`)
  }

  return { value: v, errors }
}

/**
 * Cross-row checks, once every line of a document is in hand.
 *
 * `invoice_total` is repeated on every line precisely so a truncated or
 * half-written file is caught here rather than promoted as a short invoice.
 */
export function validateInvoiceDocuments(
  rows: { row_number: number; value: StagedInvoice }[],
): Map<number, string[]> {
  const extra = new Map<number, string[]>()
  const byDoc = new Map<string, { row_number: number; value: StagedInvoice }[]>()

  for (const r of rows) {
    if (!r.value.erp_id) continue
    const list = byDoc.get(r.value.erp_id) ?? []
    list.push(r)
    byDoc.set(r.value.erp_id, list)
  }

  for (const [erpId, lines] of byDoc) {
    const add = (rowNo: number, msg: string) =>
      extra.set(rowNo, [...(extra.get(rowNo) ?? []), msg])

    const lineSum = lines.reduce((s, l) => s + (l.value.line_total ?? 0), 0)
    const declared = lines[0].value.invoice_total
    if (declared !== null && Math.abs(lineSum - declared) > 0.005) {
      for (const l of lines) {
        add(l.row_number, `document ${erpId}: lines sum to ${lineSum.toFixed(2)} but invoice_total is ${declared}`)
      }
    }

    // accounting_invoices has exactly four VAT slots. A fifth rate cannot be
    // stored, and silently dropping it would corrupt the total.
    const rates = new Set(lines.map(l => l.value.vat_rate).filter(x => x !== null))
    if (rates.size > 4) {
      for (const l of lines) {
        add(l.row_number, `document ${erpId} has ${rates.size} distinct VAT rates; the schema holds 4`)
      }
    }

    const dupes = new Set<number>()
    const seen = new Set<number>()
    for (const l of lines) {
      if (l.value.line_no === null) continue
      if (seen.has(l.value.line_no)) dupes.add(l.value.line_no)
      seen.add(l.value.line_no)
    }
    for (const l of lines) {
      if (l.value.line_no !== null && dupes.has(l.value.line_no)) {
        add(l.row_number, `document ${erpId} has duplicate line_no ${l.value.line_no}`)
      }
    }
  }

  return extra
}

// ---------------------------------------------------------------------------
// payments
// ---------------------------------------------------------------------------

export interface StagedPayment {
  erp_id: string | null
  allocation_no: number | null
  invoice_erp_id: string | null
  allocated_amount: number | null
  payment_total: number | null
  payment_date: string | null
  payment_method: string | null
  settlement_type: string | null
  company_iban: string | null
  counterparty_iban: string | null
  cesija_payer_oib: string | null
  kompenzacija_reference: string | null
  reference_number: string | null
  description: string | null
  source_updated_at: string | null
}

export function parsePaymentRow(r: Row): Parsed<StagedPayment> {
  const v: StagedPayment = {
    erp_id: str(r, 'erp_id'),
    allocation_no: num(r, 'allocation_no'),
    invoice_erp_id: str(r, 'invoice_erp_id'),
    allocated_amount: num(r, 'allocated_amount'),
    payment_total: num(r, 'payment_total'),
    payment_date: date(r, 'payment_date'),
    payment_method: upper(r, 'payment_method'),
    settlement_type: upper(r, 'settlement_type'),
    company_iban: str(r, 'company_iban'),
    counterparty_iban: str(r, 'counterparty_iban'),
    cesija_payer_oib: str(r, 'cesija_payer_oib'),
    kompenzacija_reference: str(r, 'kompenzacija_reference'),
    reference_number: str(r, 'reference_number'),
    description: str(r, 'description'),
    source_updated_at: timestamp(r, 'updated_at'),
  }

  const errors: string[] = []
  requireFields(v as unknown as Record<string, unknown>, [
    'erp_id', 'allocation_no', 'invoice_erp_id', 'allocated_amount',
    'payment_date', 'payment_method', 'settlement_type',
  ], errors)

  requireOneOf(v.payment_method, PAYMENT_METHODS, 'payment_method', errors)
  requireOneOf(v.settlement_type, SETTLEMENT_TYPES, 'settlement_type', errors)

  if (v.allocated_amount !== null && v.allocated_amount === 0) {
    errors.push('allocated_amount must not be zero')
  }
  // A cesija without its payer cannot fill cesija_company_id, which is what
  // makes cesija a first-class concept rather than an opaque note.
  if (v.settlement_type === 'CESIJA' && !v.cesija_payer_oib) {
    errors.push('cesija_payer_oib is required when settlement_type is CESIJA')
  }
  if (v.settlement_type === 'BANK' && !v.company_iban) {
    errors.push('company_iban is required when settlement_type is BANK')
  }

  return { value: v, errors }
}

/** Allocations must not exceed the transfer they belong to. */
export function validatePaymentGroups(
  rows: { row_number: number; value: StagedPayment }[],
): Map<number, string[]> {
  const extra = new Map<number, string[]>()
  const byPayment = new Map<string, { row_number: number; value: StagedPayment }[]>()

  for (const r of rows) {
    if (!r.value.erp_id) continue
    const list = byPayment.get(r.value.erp_id) ?? []
    list.push(r)
    byPayment.set(r.value.erp_id, list)
  }

  for (const [erpId, allocs] of byPayment) {
    const declared = allocs[0].value.payment_total
    if (declared === null) continue
    const sum = allocs.reduce((s, a) => s + (a.value.allocated_amount ?? 0), 0)
    if (sum - declared > 0.005) {
      for (const a of allocs) {
        extra.set(a.row_number, [
          ...(extra.get(a.row_number) ?? []),
          `payment ${erpId}: allocations sum to ${sum.toFixed(2)}, exceeding payment_total ${declared}`,
        ])
      }
    }
  }

  return extra
}

// ---------------------------------------------------------------------------
// Reference feeds — simple mirrors, replaced wholesale
// ---------------------------------------------------------------------------

export function parsePartnerRow(r: Row): Parsed<Record<string, unknown>> {
  const v = {
    erp_id: str(r, 'erp_id'),
    name: str(r, 'name'),
    oib: str(r, 'oib'),
    partner_type: str(r, 'partner_type'),
    address: str(r, 'address'),
    iban: str(r, 'iban'),
    email: str(r, 'email'),
    phone: str(r, 'phone'),
    active: bool(r, 'active'),
  }
  const errors: string[] = []
  requireFields(v, ['erp_id', 'name'], errors)
  if (v.oib && !/^\d{11}$/.test(v.oib)) errors.push(`oib "${v.oib}" is not 11 digits`)
  return { value: v, errors }
}

export function parseAccountRow(r: Row): Parsed<Record<string, unknown>> {
  const v = {
    account_code: str(r, 'account_code'),
    name: str(r, 'name'),
    active: bool(r, 'active'),
  }
  const errors: string[] = []
  requireFields(v, ['account_code', 'name'], errors)
  return { value: v, errors }
}

export function parseCostCenterRow(r: Row): Parsed<Record<string, unknown>> {
  const v = {
    code: str(r, 'code'),
    name: str(r, 'name'),
    active: bool(r, 'active'),
  }
  const errors: string[] = []
  requireFields(v, ['code', 'name'], errors)
  return { value: v, errors }
}

export function parseBankBalanceRow(r: Row): Parsed<Record<string, unknown>> {
  const v = {
    company_oib: str(r, 'company_oib'),
    iban: str(r, 'iban'),
    bank_name: str(r, 'bank_name'),
    currency: upper(r, 'currency') ?? 'EUR',
    balance: num(r, 'balance'),
    balance_as_of: date(r, 'balance_as_of'),
  }
  const errors: string[] = []
  requireFields(v, ['company_oib', 'iban', 'balance', 'balance_as_of'], errors)
  return { value: v, errors }
}
