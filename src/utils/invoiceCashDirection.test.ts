import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  COST_INVOICE_TYPES, INVOICE_CASH_DIRECTION, carriesInputVat, carriesOutputVat,
  invoiceCashDirection, isCashIn, isCashOut, isCostInvoiceType,
} from './invoiceCashDirection'
import { getTypeColor, paymentDirection } from '../components/Cashflow/services/invoiceHelpers'

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')

/** accounting_invoices_invoice_type_check, from the baseline schema. */
const DB_INVOICE_TYPES = [
  'INCOMING_SUPPLIER', 'INCOMING_INVESTMENT', 'OUTGOING_SUPPLIER', 'OUTGOING_SALES', 'INCOMING_OFFICE',
  'OUTGOING_OFFICE', 'INCOMING_BANK', 'OUTGOING_BANK', 'INCOMING_BANK_EXPENSES',
]

const quoted = (sql: string): string[] => [...sql.matchAll(/'([A-Z_]+)'/g)].map(match => match[1])

describe('the direction map', () => {
  it('covers exactly the invoice types the database allows', () => {
    expect(Object.keys(INVOICE_CASH_DIRECTION).sort()).toEqual([...DB_INVOICE_TYPES].sort())
    const check = read('supabase/migrations/00000000000000_baseline_schema.sql')
      .match(/CONSTRAINT accounting_invoices_invoice_type_check CHECK \(([^\n]*)/)
    expect(check, 'invoice type CHECK not found in the baseline').toBeTruthy()
    expect([...new Set(quoted(check![1]))].sort()).toEqual([...DB_INVOICE_TYPES].sort())
  })

  it('follows the prefix with no exception: a received invoice is money out, an issued one money in', () => {
    for (const type of DB_INVOICE_TYPES) {
      expect(invoiceCashDirection(type), type).toBe(type.startsWith('INCOMING_') ? 'OUT' : 'IN')
    }
  })

  it('puts ULAZNI (INV) on the money-out side — the CASH-7 decision', () => {
    expect(invoiceCashDirection('INCOMING_INVESTMENT')).toBe('OUT')
    expect(isCashOut('INCOMING_INVESTMENT')).toBe(true)
    expect(isCashIn('INCOMING_INVESTMENT')).toBe(false)
  })

  it('treats a credit drawdown as money in and its repayment as money out', () => {
    expect(invoiceCashDirection('OUTGOING_BANK')).toBe('IN')
    expect(invoiceCashDirection('INCOMING_BANK')).toBe('OUT')
  })

  it('follows the prefix for an unlisted type and gives null for anything else', () => {
    expect(invoiceCashDirection('OUTGOING_RETAIL_DEVELOPMENT')).toBe('IN')
    expect(invoiceCashDirection('SOMETHING_ELSE')).toBeNull()
    expect(invoiceCashDirection(null)).toBeNull()
    expect(invoiceCashDirection(undefined)).toBeNull()
  })
})

describe('costs and VAT', () => {
  it('counts supplier, office and financier bills as costs, and nothing else', () => {
    expect([...COST_INVOICE_TYPES].sort()).toEqual(['INCOMING_INVESTMENT', 'INCOMING_OFFICE', 'INCOMING_SUPPLIER'])
    expect(isCostInvoiceType('INCOMING_INVESTMENT')).toBe(true)
    // Cash moves, but a repayment is not an expense and credit fees are reported with the credit.
    expect(isCostInvoiceType('INCOMING_BANK')).toBe(false)
    expect(isCostInvoiceType('INCOMING_BANK_EXPENSES')).toBe(false)
    expect(isCostInvoiceType('OUTGOING_SALES')).toBe(false)
  })

  it('every cost is money out', () => {
    for (const type of COST_INVOICE_TYPES) expect(isCashOut(type), type).toBe(true)
  })

  it('takes input VAT from every received invoice, ULAZNI (INV) included, and output VAT from issued ones', () => {
    expect(carriesInputVat('INCOMING_INVESTMENT')).toBe(true)
    expect(carriesInputVat('INCOMING_SUPPLIER')).toBe(true)
    expect(carriesInputVat('OUTGOING_SALES')).toBe(false)
    expect(carriesOutputVat('OUTGOING_SALES')).toBe(true)
    expect(carriesOutputVat('INCOMING_INVESTMENT')).toBe(false)
  })
})

describe('screens that read the map', () => {
  it('the payments register uses it directly', () => {
    expect(paymentDirection).toBe(invoiceCashDirection)
  })

  it('colours a type label by direction, so ULAZNI (INV) is red like every other received invoice', () => {
    for (const type of DB_INVOICE_TYPES) {
      expect(getTypeColor(type), type).toBe(invoiceCashDirection(type) === 'OUT' ? 'text-red-600' : 'text-green-600')
    }
    expect(getTypeColor('INCOMING_INVESTMENT')).toBe('text-red-600')
  })

  it('no dashboard or report service keeps a type list of its own', () => {
    for (const file of [
      'src/components/dashboards/services/accountingDashboardService.ts',
      'src/components/dashboards/services/directorService.ts',
      'src/components/Reports/services/generalReportService.ts',
    ]) {
      const source = read(file)
      expect(source, file).toContain('utils/invoiceCashDirection')
      expect(source, file).not.toMatch(/'(INCOMING|OUTGOING)_(SUPPLIER|OFFICE|INVESTMENT|SALES)'/)
    }
  })

  it('the Cashflow calendar sums each type it lists on the side the map gives it', () => {
    const source = read('src/components/Cashflow/Calendar/hooks/useCalendar.ts')
    const block = (name: string) => {
      const start = source.indexOf(`const ${name} = monthInvoices.filter`)
      expect(start, name).toBeGreaterThan(-1)
      return quoted(source.slice(start, source.indexOf(')\n', start)))
    }
    const paidByUs = block('incomingInvoices')
    const paidToUs = block('outgoingInvoices')
    expect(paidByUs).toContain('INCOMING_INVESTMENT')
    for (const type of paidByUs) expect(invoiceCashDirection(type), type).toBe('OUT')
    for (const type of paidToUs) expect(invoiceCashDirection(type), type).toBe('IN')
  })
})

describe('the database agrees', () => {
  it('the bank-balance function adds and subtracts the same types', () => {
    // The newest definition; 20260917100000 (the one production runs) has the same two lists.
    for (const file of [
      'supabase/migrations/20260930100300_cashflow_balances_and_stats.sql',
      'supabase/migrations/20260917100000_payment_update_balance_triggers.sql',
    ]) {
      const sql = read(file)
      const body = sql.slice(sql.indexOf('FUNCTION public.recalc_company_bank_account_balance'))
      const added = body.match(/WHEN ai\.invoice_type IN \(([^)]*)\)\s*THEN ap\.amount/)
      const subtracted = body.match(/WHEN ai\.invoice_type IN \(([^)]*)\)\s*THEN -ap\.amount/)
      expect(added && subtracted, file).toBeTruthy()
      for (const type of quoted(added![1])) expect(invoiceCashDirection(type), `${file} +${type}`).toBe('IN')
      for (const type of quoted(subtracted![1])) expect(invoiceCashDirection(type), `${file} -${type}`).toBe('OUT')
      // Every type the map knows moves the balance one way or the other.
      const moved = new Set([...quoted(added![1]), ...quoted(subtracted![1])])
      for (const type of DB_INVOICE_TYPES) expect(moved.has(type), `${file} ${type}`).toBe(true)
    }
  })

  it('company_statistics counts ULAZNI (INV) as an expense and never as income', () => {
    const sql = read('supabase/migrations/20261005110000_company_statistics_incoming_investment_expense.sql')
    const view = sql.slice(sql.indexOf('CREATE OR REPLACE VIEW public.company_statistics'))
    const lists = [...view.matchAll(/ANY \(ARRAY\[([^\]]*)\]\)\) THEN [^\n]*\n\s*ELSE [^\n]*\n\s*END\)[^\n]*AS (total_\w+)/g)]
    // The paid-expense column closes with the cesija addition, so it is matched separately below.
    const byColumn = new Map(lists.map(match => [match[2], quoted(match[1])]))
    for (const column of ['total_income_invoices', 'total_income_amount', 'total_income_paid', 'total_income_unpaid']) {
      expect(byColumn.get(column), column).toBeTruthy()
      expect(byColumn.get(column), column).not.toContain('INCOMING_INVESTMENT')
      for (const type of byColumn.get(column)!) expect(invoiceCashDirection(type), `${column} ${type}`).toBe('IN')
    }
    for (const column of ['total_expense_invoices', 'total_expense_amount', 'total_expense_unpaid']) {
      expect(byColumn.get(column), column).toContain('INCOMING_INVESTMENT')
    }
    // All eight CASE lists: four without the type, four with it.
    const all = [...view.matchAll(/ARRAY\[([^\]]*)\]/g)].map(match => quoted(match[1]))
    expect(all).toHaveLength(8)
    expect(all.filter(list => list.includes('INCOMING_INVESTMENT'))).toHaveLength(4)
  })
})
