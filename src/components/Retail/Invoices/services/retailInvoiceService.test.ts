import { describe, it, expect } from 'vitest'
import { buildRetailInvoicesSheet, type RetailInvoiceWithDetails } from './retailInvoiceService'
import { exportT } from '../../../../utils/exportLanguage'

const t = exportT()

const invoice = (over: Partial<RetailInvoiceWithDetails> = {}): RetailInvoiceWithDetails => ({
  id: 'i1',
  invoice_number: 'R-2026-010',
  invoice_type: 'OUTGOING_SALES',
  issue_date: '2026-01-05',
  due_date: '2026-02-04',
  total_amount: 45000.25,
  base_amount: 36000.2,
  vat_amount: 9000.05,
  status: 'PAID',
  created_at: '2026-01-06T09:00:00.000Z',
  approved: true,
  supplier_name: null,
  customer_name: 'PANNONIA, d.o.o.',
  project_name: 'Zemljište Osijek',
  company_name: 'Landmark d.o.o.',
  ...over,
})

describe('buildRetailInvoicesSheet', () => {
  // These headers were already Croatian in the CSV and arrived in Excel as mojibake, because a
  // CSV blob carried no BOM. An .xlsx carries its own encoding.
  it('writes Croatian headers in the screen\'s column order', () => {
    expect(buildRetailInvoicesSheet([], t)[0]).toEqual([
      'Broj računa', 'Tip', 'Datum', 'Dospijeće', 'Projekt', 'Dobavljač / Kupac',
      'Tvrtka', 'Iznos', 'Status', 'Odobreno',
    ])
  })

  it('writes the amount as a number and both dates as dates', () => {
    const [, row] = buildRetailInvoicesSheet([invoice()], t)
    expect(row[7]).toBe(45000.25)
    const issued = row[2] as Date
    expect([issued.getFullYear(), issued.getMonth() + 1, issued.getDate()]).toEqual([2026, 1, 5])
    expect(row[3]).toBeInstanceOf(Date)
  })

  it('translates the invoice type and status rather than writing the enums', () => {
    const [, row] = buildRetailInvoicesSheet([invoice()], t)
    expect(row[1]).toBe('IZLAZNI (PROD)')
    expect(row[8]).toBe('Plaćeno')
  })

  it('writes the approval flag as a word', () => {
    expect(buildRetailInvoicesSheet([invoice()], t)[1][9]).toBe('Da')
    expect(buildRetailInvoicesSheet([invoice({ approved: false })], t)[1][9]).toBe('Ne')
  })

  it('falls back to the customer when there is no supplier, comma and all', () => {
    expect(buildRetailInvoicesSheet([invoice()], t)[1][5]).toBe('PANNONIA, d.o.o.')
  })
})
