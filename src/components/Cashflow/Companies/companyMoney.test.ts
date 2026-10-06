import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatEuro } from '../../../utils/formatters'

const read = (file: string) => readFileSync(join(process.cwd(), 'src/components/Cashflow/Companies', file), 'utf8')

// Every amount on the Companies cards and in the company details goes through `formatEuro`, which
// always prints two decimals. They used to be `value.toLocaleString('hr-HR')` with no options,
// which drops trailing zeros: €2.715.147,70 read "€2.715.147,7" and €190.000,00 read "€190.000",
// side by side on the same card (CASH-18).
describe('money on the Companies screens', () => {
  it('formats to exactly two decimals, whatever the value', () => {
    expect(formatEuro(2715147.7)).toBe('€2.715.147,70')
    expect(formatEuro(190000)).toBe('€190.000,00')
    expect(formatEuro(262806.25)).toBe('€262.806,25')
    expect(formatEuro(0)).toBe('€0,00')
    expect(formatEuro(-7088981.45)).toBe('\u2212€7.088.981,45')
    expect(formatEuro(93062.5)).toBe('€93.062,50')
  })

  it.each(['index.tsx', 'modals/CompanyDetailsModal.tsx'])('%s renders no amount by hand', file => {
    const source = read(file)
    expect(source).not.toContain('toLocaleString(')
    // A euro sign in the markup means an amount was assembled in place instead of formatted.
    expect(source).not.toMatch(/€\{|€\$\{/)
    expect(source).toContain('formatEuro(')
  })

  it('formats every figure the card shows', () => {
    const card = read('index.tsx')
    for (const figure of [
      'totalBalance', 'totalRevenue', 'totalProfit', 'company.current_balance', 'company.total_income_paid',
      'company.total_expense_paid', 'company.revenue', 'company.profit', 'company.total_income_unpaid',
      'company.total_expense_unpaid',
    ]) {
      expect(card, figure).toContain(`formatEuro(${figure})`)
    }
  })
})
