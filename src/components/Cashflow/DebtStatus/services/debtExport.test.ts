import { describe, it, expect } from 'vitest'
import { buildDebtSheet } from './debtExport'
import type { DebtSummary } from '../types'
import { exportT } from '../../../../utils/exportLanguage'

const t = exportT()

const debt = (over: Partial<DebtSummary> = {}): DebtSummary => ({
  supplier_id: 's1',
  supplier_name: 'PANNONIA, d.o.o. <Gradnja & Co>',
  supplier_type: 'mixed',
  total_unpaid: 125000.4,
  total_paid: 75000.6,
  invoice_count: 7,
  ...over,
})

describe('buildDebtSheet', () => {
  it('writes Croatian headers in the screen\'s column order', () => {
    expect(buildDebtSheet([], 0, 0, t)[0]).toEqual([
      'Firma', 'Tip', 'Računi', 'Neisplaćeno', 'Isplaćeno', 'Ukupno',
    ])
  })

  /**
   * The predecessor interpolated `supplier_name` into an HTML `<table>` unescaped, so an `&` or a
   * `<` in a company name corrupted the sheet and a `</td>` restructured it. A cell is a cell.
   */
  it('keeps an ampersand, an angle bracket and a comma inside one cell', () => {
    expect(buildDebtSheet([debt()], 0, 0, t)[1][0]).toBe('PANNONIA, d.o.o. <Gradnja & Co>')
  })

  it('writes every money column as a number, including the computed total', () => {
    const [, row] = buildDebtSheet([debt()], 0, 0, t)
    expect(row.slice(3)).toEqual([125000.4, 75000.6, 200001])
  })

  it('keeps a negative balance a number — an over-paid invoice makes one', () => {
    expect(buildDebtSheet([debt({ total_unpaid: -450.25 })], 0, 0, t)[1][3]).toBe(-450.25)
  })

  it('translates the supplier type', () => {
    expect(buildDebtSheet([debt()], 0, 0, t)[1][1]).toBe('Mixed')
    expect(buildDebtSheet([debt({ supplier_type: 'retail_supplier' })], 0, 0, t)[1][1]).toBe('Retail')
    expect(buildDebtSheet([debt({ supplier_type: 'subcontractor' })], 0, 0, t)[1][1]).toBe('Site')
  })

  it('closes with a totals row carrying numbers, not formatted strings', () => {
    const rows = buildDebtSheet([debt()], 125000.4, 75000.6, t)
    expect(rows[rows.length - 1]).toEqual(['UKUPNO', '', null, 125000.4, 75000.6, 200001])
  })
})
