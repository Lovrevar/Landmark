import { describe, it, expect } from 'vitest'
import { buildInvestmentSheet, buildConstructionSheet, type TICExportData } from './ticExport'
import { parseTICWorkbook } from './ticImport'
import { calculateTotals, calculateConstructionTotals } from '../utils/ticFormatters'

/**
 * Cent-precise on purpose. The import rounds money to the cent at the door (see `toCents` in
 * ticImport), so "exact round-trip" is a promise about money, not about arbitrary precision —
 * this row used to carry .855/.695 and would now come back rounded. The normalisation itself is
 * covered in ticImport.test.ts; the case that matters here is asserted below.
 */
const lineItems = [
  { name: 'Priprema projekta', vlastita: 17526, kreditna: 0 },
  { name: 'Vrijednost zemljišta', vlastita: 380750, kreditna: 0 },
  { name: 'Priključci', vlastita: 0, kreditna: 78500 },
  { name: 'Građenje', vlastita: 212586.86, kreditna: 1913281.7 },
]

const constructionSections = [
  {
    code: 'A)',
    name: 'GRAĐEVINSKI RADOVI',
    items: [
      { numeral: 'I.', name: 'Pripremni radovi', vlastita: 0, kreditna: 20715.75 },
      { numeral: 'II.', name: 'Zemljani radovi', vlastita: 100, kreditna: 13362 },
    ],
  },
  {
    code: 'B)',
    name: 'OBRTNIČKI RADOVI',
    items: [{ numeral: 'I.', name: 'Asfalterski radovi', vlastita: 0, kreditna: 5500 }],
  },
]

const totals = calculateTotals(lineItems)
const constructionTotals = calculateConstructionTotals(constructionSections)

const data: TICExportData = {
  lineItems,
  constructionSections,
  investorName: 'PANNONIA D.O.O.',
  documentDate: '2026-08-20',
  totals,
  grandTotal: totals.vlastita + totals.kreditna,
  constructionTotals,
  constructionGrandTotal: constructionTotals.vlastita + constructionTotals.kreditna,
  projectName: 'Savska Opatovina',
}

describe('TIC export → import round-trip', () => {
  const parsed = parseTICWorkbook([
    { name: 'INVESTICIJA', rows: buildInvestmentSheet(data) },
    { name: 'GRAĐENJE', rows: buildConstructionSheet(data) },
  ])

  it('re-imports without errors', () => {
    expect(parsed.errors).toEqual([])
  })

  it('preserves every investment row exactly', () => {
    expect(parsed.investment?.lineItems).toEqual(lineItems)
  })

  it('preserves the construction hierarchy exactly', () => {
    expect(parsed.construction?.sections).toEqual(constructionSections)
  })

  it('does not re-import the derived Ukupno / SVEUKUPNO rows as line items', () => {
    const names = parsed.construction?.sections.flatMap((s) => s.items.map((i) => i.name)) ?? []
    expect(names).not.toContain('Ukupno')
    expect(parsed.investment?.lineItems.map((i) => i.name)).not.toContain('UKUPNO:')
  })

  it('preserves the investor and date', () => {
    expect(parsed.investorName).toBe('PANNONIA D.O.O.')
    expect(parsed.documentDate).toBe('2026-08-20')
  })
})

describe('sub-cent values do not survive a round-trip', () => {
  it('comes back rounded, because the import normalises money to the cent', () => {
    const subCent: TICExportData = {
      ...data,
      lineItems: [{ name: 'Komunalni i vodni doprinos', vlastita: 937136.966971929, kreditna: 0 }],
    }
    const wb = parseTICWorkbook([
      { name: 'INVESTICIJA', rows: buildInvestmentSheet(subCent) as never },
    ])
    expect(wb.investment?.lineItems[0].vlastita).toBe(937136.97)
  })
})
