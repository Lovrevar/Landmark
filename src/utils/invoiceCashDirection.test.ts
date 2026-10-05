import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  COST_INVOICE_TYPES, FINANCING_INVOICE_TYPES, INVOICE_CASH_DIRECTION, INVOICE_CASH_MAP, carriesInputVat,
  carriesOutputVat, invoiceCashCategory, invoiceCashDirection, invoiceTypesFor, isCashIn, isCashOut,
  isCostInvoiceType,
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

  it('the Cashflow calendar takes both sides from the map, so no type is left out of its sums', () => {
    const source = read('src/components/Cashflow/Calendar/hooks/useCalendar.ts')
    expect(source).toContain('monthInvoices.filter(inv => isCashOut(inv.invoice_type))')
    expect(source).toContain('monthInvoices.filter(inv => isCashIn(inv.invoice_type))')
    // Its old lists named four types a side and missed credit fees.
    expect(source).not.toMatch(/'(INCOMING|OUTGOING)_[A-Z_]+'/)
    for (const type of DB_INVOICE_TYPES) expect(isCashIn(type) !== isCashOut(type), type).toBe(true)
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

  it('company_statistics, in its final form, matches the map on direction AND category', () => {
    const sql = read('supabase/migrations/20261005120000_company_statistics_operating_only.sql')
    const view = sql.slice(sql.indexOf('CREATE OR REPLACE VIEW public.company_statistics'))
    // Every "<type list> … AS <column>" pair, in the order the view writes them.
    const columns = [...view.matchAll(/ANY \(ARRAY\[([^\]]*)\]\)\) THEN[\s\S]*?AS (total_\w+)/g)]
      .map(match => ({ column: match[2], types: quoted(match[1]).sort() }))
    expect(columns.map(entry => entry.column)).toEqual([
      'total_income_invoices', 'total_income_amount', 'total_income_paid', 'total_income_unpaid',
      'total_expense_invoices', 'total_expense_amount', 'total_expense_paid', 'total_expense_unpaid',
      'total_financing_received', 'total_financing_repaid',
    ])

    const expected = (column: string): string[] => {
      if (column.startsWith('total_income_')) return invoiceTypesFor('IN', 'operating')
      if (column.startsWith('total_expense_')) return invoiceTypesFor('OUT', 'operating')
      return invoiceTypesFor(column === 'total_financing_received' ? 'IN' : 'OUT', 'financing')
    }
    for (const { column, types } of columns) expect(types, column).toEqual(expected(column).sort())

    // Financing never reaches turnover or result…
    for (const { column, types } of columns.slice(0, 8)) {
      for (const type of types) expect(invoiceCashCategory(type), `${column} ${type}`).toBe('operating')
    }
    // …and between the four groups every invoice type is counted exactly once.
    const counted = [
      ...expected('total_income_paid'), ...expected('total_expense_paid'),
      ...expected('total_financing_received'), ...expected('total_financing_repaid'),
    ]
    expect(counted.sort()).toEqual([...DB_INVOICE_TYPES].sort())
  })

  it('the newest company_statistics migration is the one tested above', () => {
    const files = readdirSync(join(process.cwd(), 'supabase/migrations'))
      .filter(file => read(`supabase/migrations/${file}`).includes('VIEW public.company_statistics'))
      .sort()
    expect(files[files.length - 1]).toBe('20261005120000_company_statistics_operating_only.sql')
  })
})

describe('operating and financing', () => {
  it('gives every invoice type both a direction and a category', () => {
    expect(Object.keys(INVOICE_CASH_MAP).sort()).toEqual([...DB_INVOICE_TYPES].sort())
    for (const type of DB_INVOICE_TYPES) {
      expect(INVOICE_CASH_MAP[type].direction, type).toBe(invoiceCashDirection(type))
      expect(INVOICE_CASH_MAP[type].category, type).toBe(invoiceCashCategory(type))
    }
  })

  it('files the three bank types under financing and everything else under operating', () => {
    expect([...FINANCING_INVOICE_TYPES].sort()).toEqual(['INCOMING_BANK', 'INCOMING_BANK_EXPENSES', 'OUTGOING_BANK'])
    for (const type of DB_INVOICE_TYPES) {
      expect(invoiceCashCategory(type), type).toBe(type.includes('_BANK') ? 'financing' : 'operating')
    }
    expect(invoiceCashCategory('INCOMING_INVESTMENT')).toBe('operating')
    expect(invoiceCashCategory('SOMETHING_ELSE')).toBe('operating')
    expect(invoiceCashCategory(null)).toBe('operating')
  })

  it('keeps the direction inside financing: a drawdown is in, a repayment and credit fees are out', () => {
    expect(invoiceTypesFor('IN', 'financing')).toEqual(['OUTGOING_BANK'])
    expect(invoiceTypesFor('OUT', 'financing').sort()).toEqual(['INCOMING_BANK', 'INCOMING_BANK_EXPENSES'])
    expect(invoiceTypesFor('IN', 'operating').sort()).toEqual(['OUTGOING_OFFICE', 'OUTGOING_SALES', 'OUTGOING_SUPPLIER'])
    expect(invoiceTypesFor('OUT', 'operating').sort()).toEqual(['INCOMING_INVESTMENT', 'INCOMING_OFFICE', 'INCOMING_SUPPLIER'])
  })

  it('today every operating money-out type is a cost — the open question is whether credit fees join them', () => {
    expect(invoiceTypesFor('OUT', 'operating').sort()).toEqual([...COST_INVOICE_TYPES].sort())
  })

  it('is what the General report splits its cash-flow table by, with no list of its own', () => {
    const source = read('src/components/Reports/services/generalReportService.ts')
    expect(source).toContain("amounts('operating')")
    expect(source).toContain("amounts('financing')")
    expect(source).toContain('invoiceCashCategory(')
    expect(source).not.toMatch(/'(INCOMING|OUTGOING)_[A-Z_]+'/)
  })
})
