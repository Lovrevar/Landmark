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
  it('counts every operating invoice the company pays as a cost — credit fees included', () => {
    expect([...COST_INVOICE_TYPES].sort()).toEqual([
      'INCOMING_BANK_EXPENSES', 'INCOMING_INVESTMENT', 'INCOMING_OFFICE', 'INCOMING_SUPPLIER',
    ])
    expect(isCostInvoiceType('INCOMING_INVESTMENT')).toBe(true)
    expect(isCostInvoiceType('INCOMING_BANK_EXPENSES')).toBe(true)
    // The one money-out type that is not a cost: repaying principal only returns what was borrowed.
    expect(isCostInvoiceType('INCOMING_BANK')).toBe(false)
    expect(isCostInvoiceType('OUTGOING_SALES')).toBe(false)
    expect(isCostInvoiceType('OUTGOING_BANK')).toBe(false)
  })

  it('a cost is exactly an operating money-out type — the set is derived, not listed', () => {
    expect([...COST_INVOICE_TYPES].sort()).toEqual(invoiceTypesFor('OUT', 'operating').sort())
    for (const type of DB_INVOICE_TYPES) {
      expect(isCostInvoiceType(type), type)
        .toBe(invoiceCashDirection(type) === 'OUT' && invoiceCashCategory(type) === 'operating')
    }
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
    const source = read('src/components/Cashflow/Calendar/utils/monthStats.ts')
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
    const sql = read('supabase/migrations/20261006100000_company_statistics_final.sql')
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
    // …and the view's expense is the client's definition of a cost.
    expect(columns[6].types).toEqual([...COST_INVOICE_TYPES].sort())
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
    expect(files[files.length - 1]).toBe('20261006100000_company_statistics_final.sql')
  })

  it('the final view runs with the caller\'s rights, so RLS applies to it', () => {
    // CREATE OR REPLACE VIEW resets a view's options. The last migration to define the view must
    // therefore set security_invoker itself, after the CREATE — or the RLS fix from
    // 20261001100000 is silently undone.
    const sql = read('supabase/migrations/20261006100000_company_statistics_final.sql')
    const create = sql.indexOf('CREATE OR REPLACE VIEW public.company_statistics')
    const invoker = sql.indexOf('ALTER VIEW public.company_statistics SET (security_invoker = on)')
    expect(create).toBeGreaterThan(-1)
    expect(invoker).toBeGreaterThan(create)
  })

  it('the earlier view migration steps aside where the newer columns already exist', () => {
    // Production and LandmarkDev received 20261005* before 20261001100000. Without the guard that
    // migration fails there ("cannot drop columns from view") and blocks every later one.
    const sql = read('supabase/migrations/20261001100000_company_statistics_direction.sql')
    expect(sql).toMatch(/column_name = 'total_financing_received'[\s\S]*RETURN;[\s\S]*EXECUTE \$view\$/)
    expect(sql).toContain('ALTER VIEW public.company_statistics SET (security_invoker = on)')
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

  it('files only credit principal under financing: the drawdown and the repayment', () => {
    expect([...FINANCING_INVOICE_TYPES].sort()).toEqual(['INCOMING_BANK', 'OUTGOING_BANK'])
    expect(invoiceCashCategory('OUTGOING_BANK')).toBe('financing')
    expect(invoiceCashCategory('INCOMING_BANK')).toBe('financing')
    // What the credit costs is an operating cost, by decision.
    expect(invoiceCashCategory('INCOMING_BANK_EXPENSES')).toBe('operating')
    expect(invoiceCashCategory('INCOMING_INVESTMENT')).toBe('operating')
    expect(invoiceCashCategory('SOMETHING_ELSE')).toBe('operating')
    expect(invoiceCashCategory(null)).toBe('operating')
  })

  it('splits the nine types into four cells, each type in exactly one', () => {
    const cells = {
      operatingIn: invoiceTypesFor('IN', 'operating').sort(),
      operatingOut: invoiceTypesFor('OUT', 'operating').sort(),
      financingIn: invoiceTypesFor('IN', 'financing').sort(),
      financingOut: invoiceTypesFor('OUT', 'financing').sort(),
    }
    expect(cells).toEqual({
      operatingIn: ['OUTGOING_OFFICE', 'OUTGOING_SALES', 'OUTGOING_SUPPLIER'],
      operatingOut: ['INCOMING_BANK_EXPENSES', 'INCOMING_INVESTMENT', 'INCOMING_OFFICE', 'INCOMING_SUPPLIER'],
      financingIn: ['OUTGOING_BANK'],
      financingOut: ['INCOMING_BANK'],
    })
    expect(Object.values(cells).flat().sort()).toEqual([...DB_INVOICE_TYPES].sort())
  })

  it('every place that computes a cost asks the map, and none names a type', () => {
    const uses: [string, number][] = [
      // Director dashboard: contract costs, uncontracted project costs, portfolio expenses.
      ['src/components/dashboards/services/directorService.ts', 3],
      // General report: total expenses and per-project expenses.
      ['src/components/Reports/services/generalReportService.ts', 2],
    ]
    for (const [file, calls] of uses) {
      const source = read(file)
      expect((source.match(/isCostInvoiceType\(/g) || []).length, file).toBe(calls)
      expect(source, file).not.toMatch(/'(INCOMING|OUTGOING)_[A-Z_]+'/)
    }
    // The Companies cards take their expense figures from the view, checked against the map above.
    const companies = read('src/components/Cashflow/Companies/services/companyService.ts')
    expect(companies).toContain('profit: stats.total_income_paid - stats.total_expense_paid')
    expect(companies).not.toMatch(/'(INCOMING|OUTGOING)_[A-Z_]+'/)
  })

  it('is what the General report splits its cash-flow table by, with no list of its own', () => {
    const source = read('src/components/Reports/services/generalReportService.ts')
    expect(source).toContain("amounts('operating')")
    expect(source).toContain("amounts('financing')")
    expect(source).toContain('invoiceCashCategory(')
    expect(source).not.toMatch(/'(INCOMING|OUTGOING)_[A-Z_]+'/)
  })
})
