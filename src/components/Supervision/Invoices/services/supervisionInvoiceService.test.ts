import { describe, it, expect } from 'vitest'
import { buildSupervisionInvoicesSheet, type InvoiceWithDetails } from './supervisionInvoiceService'
import { exportT } from '../../../../utils/exportLanguage'

const t = exportT()

const invoice = (over: Partial<InvoiceWithDetails> = {}): InvoiceWithDetails => ({
  id: 'i1',
  invoice_number: 'R-2026-001',
  invoice_type: 'INCOMING_SUPPLIER',
  invoice_category: 'SUBCONTRACTOR',
  issue_date: '2026-01-05',
  due_date: '2026-02-04',
  total_amount: 125000.4,
  base_amount: 100000,
  vat_amount: 25000.4,
  status: 'PARTIALLY_PAID',
  created_at: '2026-01-06T09:00:00.000Z',
  approved: true,
  supplier_name: 'PANNONIA, d.o.o.',
  company_name: 'Landmark d.o.o.',
  project_name: 'Savska Opatovina',
  phase_name: 'Faza 1',
  contract_number: 'U-001',
  ...over,
})

describe('buildSupervisionInvoicesSheet', () => {
  it('writes Croatian headers in the screen\'s column order', () => {
    expect(buildSupervisionInvoicesSheet([], t)[0]).toEqual([
      'Broj računa', 'Datum', 'Dobavljač', 'Projekt', 'Faza', 'Firma', 'Iznos', 'Status',
    ])
  })

  it('writes the amount as a number and the date as the day the column says', () => {
    const [, row] = buildSupervisionInvoicesSheet([invoice()], t)
    expect(row[6]).toBe(125000.4)
    const date = row[1] as Date
    expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 1, 5])
  })

  it('translates the status rather than writing the enum', () => {
    expect(buildSupervisionInvoicesSheet([invoice()], t)[1][7]).toBe('Djelomično')
    expect(buildSupervisionInvoicesSheet([invoice({ status: 'UNPAID' })], t)[1][7]).toBe('Neplaćeno')
  })

  it('shows a status the vocabulary does not know rather than hiding it', () => {
    expect(buildSupervisionInvoicesSheet([invoice({ status: 'WRITTEN_OFF' })], t)[1][7]).toBe('WRITTEN_OFF')
  })

  it('keeps a comma in a supplier name in one cell', () => {
    expect(buildSupervisionInvoicesSheet([invoice()], t)[1][2]).toBe('PANNONIA, d.o.o.')
  })
})
