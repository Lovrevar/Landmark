import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (file: string) => readFileSync(join(process.cwd(), 'src/components/Cashflow/Calendar', file), 'utf8')

// The calendar printed its ten amounts as `€{value.toLocaleString('hr-HR')}`: no fixed decimals,
// and a negative net as "€−2.141.590". All of them now go through `formatEuro`, the same as the
// budget-difference row beside them, so the screen has one money format.
describe('money on the Cashflow calendar', () => {
  it.each(['index.tsx', 'forms/BudgetModal.tsx'])('%s renders no amount by hand', file => {
    const source = read(file)
    expect(source).not.toContain('toLocaleString(')
    expect(source).not.toMatch(/€\{|€\$\{/)
    expect(source).toContain('formatEuro(')
  })

  it('formats every figure of the monthly summary and the invoice table', () => {
    const source = read('index.tsx')
    for (const figure of [
      'monthStats.outgoingPaid', 'monthStats.incomingPaid', 'monthStats.incomingUnpaid', 'monthStats.netAmount',
      'budget.budget_amount', 'invoice.base_amount', 'invoice.vat_amount', 'invoice.total_amount', 'invoice.paid_amount',
    ]) {
      expect(source, figure).toContain(`formatEuro(${figure})`)
    }
  })
})
