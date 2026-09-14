// Unit tests for feeds.ts — number/date coercion and the validation rules that
// decide whether a row may be promoted.
//
// Run: `deno test` from supabase/functions/ (or `deno test import-erp/`).

import { assert, assertEquals } from 'jsr:@std/assert@1'
import {
  date, num,
  parseInvoiceRow, parsePartnerRow, parsePaymentRow,
  validateInvoiceDocuments, validatePaymentGroups,
} from './feeds.ts'

// ===========================================================================
// Coercion
// ===========================================================================

Deno.test('num: parses the dot decimals we ask for', () => {
  assertEquals(num({ x: '1234.56' }, 'x'), 1234.56)
  assertEquals(num({ x: '-24.76' }, 'x'), -24.76)
  assertEquals(num({ x: '0' }, 'x'), 0)
})

Deno.test('num: tolerates the comma decimals Excel produces anyway', () => {
  assertEquals(num({ x: '1234,56' }, 'x'), 1234.56)
  assertEquals(num({ x: '1.234,56' }, 'x'), 1234.56)
  assertEquals(num({ x: '1,234.56' }, 'x'), 1234.56)
})

Deno.test('num: a lone comma with three decimals is read as grouping', () => {
  // "1,234" is far more likely to be 1234 than 1.234 in a financial export.
  assertEquals(num({ x: '1,234' }, 'x'), 1234)
  // ...but two decimals is unambiguously a decimal comma.
  assertEquals(num({ x: '1,23' }, 'x'), 1.23)
})

Deno.test('num: empty and non-numeric become null rather than 0', () => {
  assertEquals(num({ x: '' }, 'x'), null)
  assertEquals(num({}, 'x'), null)
  assertEquals(num({ x: 'n/a' }, 'x'), null)
})

Deno.test('date: ISO preferred, European accepted, junk rejected', () => {
  assertEquals(date({ d: '2026-08-31' }, 'd'), '2026-08-31')
  assertEquals(date({ d: '2026-08-31T10:00:00Z' }, 'd'), '2026-08-31')
  assertEquals(date({ d: '31.08.2026' }, 'd'), '2026-08-31')
  assertEquals(date({ d: '1.8.2026' }, 'd'), '2026-08-01')
  assertEquals(date({ d: 'yesterday' }, 'd'), null)
  assertEquals(date({ d: '' }, 'd'), null)
})

// ===========================================================================
// Invoice rows
// ===========================================================================

const invoiceRow = (over: Record<string, string> = {}) => ({
  erp_id: 'INV-1', line_no: '1', direction: 'INCOMING', document_type: 'INVOICE',
  company_oib: '12345678901', partner_erp_id: 'P-7', partner_name: 'VODOVOD-OSIJEK d.o.o.',
  invoice_number: '33130/702/1', issue_date: '2026-08-05', due_date: '2026-08-19',
  cost_center_code: 'MT-01', account_code: '0572',
  base_amount: '100.00', vat_rate: '25', vat_amount: '25.00',
  line_total: '125.00', invoice_total: '125.00', currency: 'EUR', ...over,
})

Deno.test('parseInvoiceRow: a complete row is valid', () => {
  const { value, errors } = parseInvoiceRow(invoiceRow())
  assertEquals(errors, [])
  assertEquals(value.erp_id, 'INV-1')
  assertEquals(value.base_amount, 100)
  assertEquals(value.direction, 'INCOMING')
})

Deno.test('parseInvoiceRow: every required field is reported when missing', () => {
  const { errors } = parseInvoiceRow({})
  assert(errors.some(e => e.includes('erp_id')))
  assert(errors.some(e => e.includes('cost_center_code')))
  assert(errors.some(e => e.includes('account_code')))
})

Deno.test('parseInvoiceRow: rejects unknown direction and document_type', () => {
  assert(parseInvoiceRow(invoiceRow({ direction: 'SIDEWAYS' })).errors
    .some(e => e.includes('direction must be one of')))
  assert(parseInvoiceRow(invoiceRow({ document_type: 'RECEIPT' })).errors
    .some(e => e.includes('document_type must be one of')))
})

Deno.test('parseInvoiceRow: line_total must equal base + vat', () => {
  const { errors } = parseInvoiceRow(invoiceRow({ line_total: '130.00' }))
  assert(errors.some(e => e.includes('line_total')))
})

Deno.test('parseInvoiceRow: vat_amount is NOT checked against the nominal rate', () => {
  // The sample posts 6.77 base against 0.81 VAT on a 13% account. That is a
  // real posting, not an error — see DECISIONS.md D8.
  const { errors } = parseInvoiceRow(invoiceRow({
    base_amount: '6.77', vat_rate: '13', vat_amount: '0.81',
    line_total: '7.58', invoice_total: '7.58',
  }))
  assertEquals(errors, [])
})

Deno.test('parseInvoiceRow: due_date before issue_date is an error', () => {
  const { errors } = parseInvoiceRow(invoiceRow({ due_date: '2026-08-01' }))
  assert(errors.some(e => e.includes('before issue_date')))
})

Deno.test('parseInvoiceRow: negative amounts are allowed — storna are negative', () => {
  const { errors } = parseInvoiceRow(invoiceRow({
    document_type: 'STORNO', base_amount: '-21.91', vat_rate: '13',
    vat_amount: '-2.85', line_total: '-24.76', invoice_total: '-24.76',
  }))
  assertEquals(errors, [])
})

// ===========================================================================
// Cross-row invoice checks
// ===========================================================================

const staged = (rows: Record<string, string>[]) =>
  rows.map((r, i) => ({ row_number: i + 2, value: parseInvoiceRow(r).value }))

Deno.test('validateInvoiceDocuments: lines must sum to invoice_total', () => {
  const errs = validateInvoiceDocuments(staged([
    invoiceRow({ line_no: '1', line_total: '125.00', invoice_total: '250.00' }),
    invoiceRow({ line_no: '2', line_total: '100.00', invoice_total: '250.00' }),
  ]))
  assertEquals(errs.size, 2)
  assert([...errs.values()][0][0].includes('invoice_total'))
})

Deno.test('validateInvoiceDocuments: a correctly split document passes', () => {
  const errs = validateInvoiceDocuments(staged([
    invoiceRow({ line_no: '1', line_total: '125.00', invoice_total: '225.00' }),
    invoiceRow({ line_no: '2', base_amount: '80', vat_rate: '25', vat_amount: '20', line_total: '100.00', invoice_total: '225.00' }),
  ]))
  assertEquals(errs.size, 0)
})

Deno.test('validateInvoiceDocuments: a fifth VAT rate is an error, not a truncation', () => {
  const rates = ['0', '5', '13', '25', '10']
  const errs = validateInvoiceDocuments(staged(rates.map((r, i) => invoiceRow({
    line_no: String(i + 1), vat_rate: r,
    base_amount: '100', vat_amount: '0', line_total: '100', invoice_total: '500',
  }))))
  assert([...errs.values()][0][0].includes('distinct VAT rates'))
})

Deno.test('validateInvoiceDocuments: duplicate line_no within a document is caught', () => {
  const errs = validateInvoiceDocuments(staged([
    invoiceRow({ line_no: '1', line_total: '125.00', invoice_total: '250.00' }),
    invoiceRow({ line_no: '1', line_total: '125.00', invoice_total: '250.00' }),
  ]))
  assert([...errs.values()][0].some(e => e.includes('duplicate line_no')))
})

// ===========================================================================
// Payments
// ===========================================================================

const paymentRow = (over: Record<string, string> = {}) => ({
  erp_id: 'PAY-1', allocation_no: '1', invoice_erp_id: 'INV-1',
  allocated_amount: '125.00', payment_total: '125.00', payment_date: '2026-08-20',
  payment_method: 'WIRE', settlement_type: 'BANK', company_iban: 'HR1234567890', ...over,
})

Deno.test('parsePaymentRow: a complete row is valid', () => {
  assertEquals(parsePaymentRow(paymentRow()).errors, [])
})

Deno.test('parsePaymentRow: BANK settlement requires our IBAN', () => {
  const { errors } = parsePaymentRow(paymentRow({ company_iban: '' }))
  assert(errors.some(e => e.includes('company_iban is required')))
})

Deno.test('parsePaymentRow: CESIJA requires the payer OIB', () => {
  const { errors } = parsePaymentRow(paymentRow({ settlement_type: 'CESIJA', company_iban: '' }))
  assert(errors.some(e => e.includes('cesija_payer_oib is required')))
})

Deno.test('parsePaymentRow: KOMPENZACIJA needs no IBAN', () => {
  assertEquals(parsePaymentRow(paymentRow({ settlement_type: 'KOMPENZACIJA', company_iban: '' })).errors, [])
})

Deno.test('parsePaymentRow: rejects a method the schema cannot store', () => {
  // kompenzacija is a settlement_type, never a payment_method — the CHECK on
  // accounting_payments allows only WIRE/CASH/CHECK/CARD.
  const { errors } = parsePaymentRow(paymentRow({ payment_method: 'KOMPENZACIJA' }))
  assert(errors.some(e => e.includes('payment_method must be one of')))
})

Deno.test('parsePaymentRow: a zero allocation is meaningless', () => {
  const { errors } = parsePaymentRow(paymentRow({ allocated_amount: '0' }))
  assert(errors.some(e => e.includes('must not be zero')))
})

Deno.test('validatePaymentGroups: one transfer settling several invoices is fine', () => {
  // The sample's 235.54 transfer clearing six invoices.
  const amounts = ['5.01', '5.01', '8.02', '10.00', '200.00', '7.50']
  const rows = amounts.map((a, i) => ({
    row_number: i + 2,
    value: parsePaymentRow(paymentRow({
      allocation_no: String(i + 1), invoice_erp_id: `INV-${i}`,
      allocated_amount: a, payment_total: '235.54',
    })).value,
  }))
  assertEquals(validatePaymentGroups(rows).size, 0)
})

Deno.test('validatePaymentGroups: allocations may not exceed the transfer', () => {
  const rows = ['100.00', '100.00'].map((a, i) => ({
    row_number: i + 2,
    value: parsePaymentRow(paymentRow({
      allocation_no: String(i + 1), allocated_amount: a, payment_total: '150.00',
    })).value,
  }))
  assert([...validatePaymentGroups(rows).values()][0][0].includes('exceeding payment_total'))
})

// ===========================================================================
// Partners
// ===========================================================================

Deno.test('parsePartnerRow: OIB must be 11 digits when present', () => {
  assertEquals(parsePartnerRow({ erp_id: 'P-1', name: 'ACME', oib: '12345678901' }).errors, [])
  assert(parsePartnerRow({ erp_id: 'P-1', name: 'ACME', oib: '123' }).errors
    .some(e => e.includes('not 11 digits')))
})

Deno.test('parsePartnerRow: a partner without an OIB is still valid', () => {
  // Private individuals and foreign partners legitimately have none, which is
  // why erp_id and not OIB is the join key.
  assertEquals(parsePartnerRow({ erp_id: 'P-2', name: 'Ivan Horvat' }).errors, [])
})

Deno.test('parsePartnerRow: active defaults to true and accepts Croatian "ne"', () => {
  assertEquals(parsePartnerRow({ erp_id: 'P-1', name: 'A' }).value.active, true)
  assertEquals(parsePartnerRow({ erp_id: 'P-1', name: 'A', active: 'ne' }).value.active, false)
  assertEquals(parsePartnerRow({ erp_id: 'P-1', name: 'A', active: '0' }).value.active, false)
})
