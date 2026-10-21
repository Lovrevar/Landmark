import { describe, expect, it } from 'vitest'
import { bankAccountTotals, cesijaFromCredit, costPaid } from './paymentFigures'

const INVOICES = [
  { id: 'sup', invoice_type: 'INCOMING_SUPPLIER', project_id: 'p1' },
  { id: 'office', invoice_type: 'INCOMING_OFFICE', project_id: null },
  { id: 'inv', invoice_type: 'INCOMING_INVESTMENT', project_id: 'p1' },
  { id: 'fees', invoice_type: 'INCOMING_BANK_EXPENSES', project_id: 'p2' },
  { id: 'principal', invoice_type: 'INCOMING_BANK', project_id: 'p1' },
  { id: 'sale', invoice_type: 'OUTGOING_SALES', project_id: 'p1' },
  { id: 'drawdown', invoice_type: 'OUTGOING_BANK', project_id: 'p1' },
]

const pay = (invoice_id: string | null, amount: number | string, over = {}) => ({ invoice_id, amount, ...over })

describe('costPaid', () => {
  // Credit fees and ULAZNI (INV) are costs; repaying principal moves cash but is not one (CASH-7).
  it('sums payments on cost invoices only', () => {
    const payments = [
      pay('sup', 5_000), pay('sup', 3_500), pay('office', 1_250), pay('inv', 8_000), pay('fees', 900.4),
      pay('principal', 20_000), pay('sale', 50_000), pay('drawdown', 600_000),
    ]
    expect(costPaid(payments, INVOICES)).toBeCloseTo(18_650.4, 6)
  })

  it('narrows to the invoices the filter keeps, a project for instance', () => {
    const payments = [pay('sup', 5_000), pay('inv', 8_000), pay('fees', 900.4), pay('principal', 20_000)]
    expect(costPaid(payments, INVOICES, invoice => invoice.project_id === 'p1')).toBe(13_000)
    expect(costPaid(payments, INVOICES, invoice => invoice.project_id === 'p9')).toBe(0)
  })

  it('leaves out a payment whose invoice was not loaded, and one with no invoice', () => {
    expect(costPaid([pay('not-loaded', 777), pay(null, 1), pay('sup', '100.5')], INVOICES)).toBe(100.5)
  })

  it('is 0 with nothing paid', () => {
    expect(costPaid([], INVOICES)).toBe(0)
    expect(costPaid([pay('sup', 1)], [])).toBe(0)
  })
})

describe('cesijaFromCredit', () => {
  // Pinned as the General report counts it: a cesija paid from a bank account is not in it (GEN-29).
  it('counts only the cesija paid from a credit', () => {
    const payments = [
      pay('inv', 8_000, { is_cesija: true, cesija_credit_id: 'cr2' }),
      pay('sup', 3_500, { is_cesija: true, cesija_credit_id: null }),
      pay('sup', 5_000),
    ]
    expect(cesijaFromCredit(payments)).toEqual({ count: 1, value: 8_000 })
    expect(cesijaFromCredit([])).toEqual({ count: 0, value: 0 })
  })
})

describe('bankAccountTotals', () => {
  it('sums the balances and counts accounts in credit and overdrawn; zero is neither', () => {
    expect(bankAccountTotals([{ current_balance: 125_000.55 }, { current_balance: -3_200 }, { current_balance: 0 }, { current_balance: null }]))
      .toEqual({ count: 4, balance: 121_800.55, positive: 1, negative: 1 })
    expect(bankAccountTotals([])).toEqual({ count: 0, balance: 0, positive: 0, negative: 0 })
  })
})
