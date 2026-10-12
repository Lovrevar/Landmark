import { describe, it, expect } from 'vitest'
import { buildInvestmentSheet, buildConstructionSheet, type TICExportData } from './ticExport'
import { parseTICWorkbook } from './ticImport'
import { applyImportedClassifications } from '../utils/ticClassificationMap'
import { calculateTotals, calculateConstructionTotals, type LineItem } from '../utils/ticFormatters'

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

describe('a phased TIC survives export → import', () => {
  // The export stopped at the project block, so a phased TIC came back unphased without a word
  // (FUND-13). The round-trip above never saw it: its fixture has no phases.
  const phased: LineItem[] = [
    // Split across both phases.
    { name: 'Građenje', vlastita: 100000, kreditna: 900000, phases: [
      { phase_number: 1, vlastita: 60000, kreditna: 500000 },
      { phase_number: 2, vlastita: 40000, kreditna: 400000 },
    ] },
    // Bought once: not phased, on a sheet that is.
    { name: 'Vrijednost zemljišta', vlastita: 4000000, kreditna: 0 },
    // All of it in the second phase.
    { name: 'Opremanje', vlastita: 0, kreditna: 250000.5, phases: [
      { phase_number: 1, vlastita: 0, kreditna: 0 },
      { phase_number: 2, vlastita: 0, kreditna: 250000.5 },
    ] },
  ]
  const phasedTotals = calculateTotals(phased)
  const phasedData: TICExportData = {
    ...data,
    lineItems: phased,
    totals: phasedTotals,
    grandTotal: phasedTotals.vlastita + phasedTotals.kreditna,
  }
  const sheet = buildInvestmentSheet(phasedData)
  const reparsed = parseTICWorkbook([{ name: 'INVESTICIJA', rows: sheet }])

  it('writes one FAZA group per phase beside the project block', () => {
    expect(sheet[4].filter(cell => typeof cell === 'string' && cell.startsWith('FAZA'))).toEqual(['FAZA 1', 'FAZA 2'])
    expect(new Set(sheet.map(row => row.length))).toEqual(new Set([14]))
  })

  it('brings every line back with the same split, and the unphased line unphased', () => {
    expect(reparsed.errors).toEqual([])
    expect(reparsed.investment?.phaseNumbers).toEqual([1, 2])
    expect(reparsed.investment?.lineItems).toEqual(phased)
    expect(reparsed.investment?.inconsistentRows).toEqual([])
  })

  it('totals each phase column on the UKUPNO row', () => {
    const totalRow = sheet.find(row => row[0] === 'UKUPNO:')!
    expect([totalRow[6], totalRow[8], totalRow[10], totalRow[12]]).toEqual([60000, 500000, 40000, 650000.5])
  })

  it('leaves an unphased TIC in the six-column layout it always had', () => {
    expect(new Set(buildInvestmentSheet(data).map(row => row.length))).toEqual(new Set([6]))
  })
})

describe('classifications survive export → import', () => {
  // The export wrote no classification, so on import every line was re-guessed from its name: a
  // mapping the user had chosen by hand for a renamed row came back as the default, or as none
  // (FUND-13).
  const classifications = [{ id: 7, code: 'CONSTRUCTION' }, { id: 9, code: 'LAND' }, { id: 12, code: null }]
  const mapped: LineItem[] = [
    { name: 'Radovi po ugovoru s izvođačem', vlastita: 0, kreditna: 1000, classification_id: 7 },
    { name: 'Vrijednost zemljišta', vlastita: 500, kreditna: 0, classification_id: 9 },
    { name: 'Nešto bez klasifikacije', vlastita: 10, kreditna: 0, classification_id: null },
  ]
  const mappedTotals = calculateTotals(mapped)
  const mappedData: TICExportData = {
    ...data,
    lineItems: mapped,
    totals: mappedTotals,
    grandTotal: mappedTotals.vlastita + mappedTotals.kreditna,
    classificationCodes: new Map([[7, 'CONSTRUCTION'], [9, 'LAND']]),
  }
  const sheet = buildInvestmentSheet(mappedData)
  const reparsed = parseTICWorkbook([{ name: 'INVESTICIJA', rows: sheet }])

  it('writes the code in a last column headed KLASIFIKACIJA', () => {
    expect(sheet[4][sheet[4].length - 1]).toBe('KLASIFIKACIJA')
    expect(new Set(sheet.map(row => row.length))).toEqual(new Set([7]))
    expect(sheet.filter(row => typeof row[1] === 'number' && row[0] !== 'UKUPNO:').map(row => row[6])).toEqual(['CONSTRUCTION', 'LAND', null])
  })

  it('reads the codes back, line for line, with the amounts untouched', () => {
    expect(reparsed.errors).toEqual([])
    expect(reparsed.investment?.classificationCodes).toEqual(['CONSTRUCTION', 'LAND', null])
    expect(reparsed.investment?.lineItems.map(item => [item.name, item.vlastita, item.kreditna]))
      .toEqual(mapped.map(item => [item.name, item.vlastita, item.kreditna]))
  })

  it('restores every mapping, and keeps an unmapped line unmapped rather than re-guessing it', () => {
    const restored = applyImportedClassifications(reparsed.investment!.lineItems, reparsed.investment!.classificationCodes, classifications)
    expect(restored.map(item => item.classification_id)).toEqual([7, 9, null])
  })

  it('leaves a line open to the name default when the code is unknown here, or the sheet has no column', () => {
    const lines: LineItem[] = [{ name: 'Građenje', vlastita: 1, kreditna: 0 }]
    expect(applyImportedClassifications(lines, ['NOT_IN_THIS_DB'], classifications)[0].classification_id).toBeUndefined()
    expect(applyImportedClassifications(lines, null, classifications)[0].classification_id).toBeUndefined()
    expect(parseTICWorkbook([{ name: 'INVESTICIJA', rows: buildInvestmentSheet(data) }]).investment?.classificationCodes).toBeNull()
  })

  it('sits after the phase groups on a phased sheet without disturbing them', () => {
    const phasedLine: LineItem = { name: 'Građenje', vlastita: 0, kreditna: 100, classification_id: 7, phases: [
      { phase_number: 1, vlastita: 0, kreditna: 60 }, { phase_number: 2, vlastita: 0, kreditna: 40 },
    ] }
    const rows = buildInvestmentSheet({ ...mappedData, lineItems: [phasedLine], totals: { vlastita: 0, kreditna: 100 }, grandTotal: 100 })
    const back = parseTICWorkbook([{ name: 'INVESTICIJA', rows }]).investment!
    expect(rows[4].length).toBe(15)
    expect(back.lineItems[0].phases).toEqual(phasedLine.phases)
    expect(back.classificationCodes).toEqual(['CONSTRUCTION'])
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
