import { describe, it, expect } from 'vitest'
import { parseSheet, parseTICWorkbook, type SheetRow } from './ticImport'

/**
 * Mirrors the "Struktura troškova investicije i građenja" workbook: blank spacer rows,
 * trailing spaces on some names, percentages as fractions, and a UKUPNO row at the end.
 */
const investmentRows: SheetRow[] = [
  ['INVESTITOR: ', 'PANNONIA D.O.O.', null, null, null, null],
  [null, null, null, null, null, null],
  ['STRUKTURA TROŠKOVA INVESTICIJE (bez PDV-a)', null, null, null, null, null],
  [null, null, null, null, null, null],
  ['NAMJENA', 'VLASTITA SREDSTVA', null, 'KREDITNA SREDSTVA', null, 'UKUPNA INVESTICIJA'],
  [null, 'EUR', '(%)', 'EUR', '(%)', 'EUR'],
  [null, null, null, null, null, null],
  ['Priprema projekta', 17526, 0.0061, null, 0, 17526],
  ['Vrijednost zemljišta', 380750, 0.1336, null, 0, 380750],
  [null, null, null, null, null, null],
  ['Priključci', null, 0, 78500, 0.0275, 78500],
  ['Stručni nadzor ', null, 0, 46253.4, 0.0162, 46253.4],
  [null, null, null, null, null, null],
  ['UKUPNO:', 398276, 0.1397, 124753.4, 0.0437, 523029.4],
  [null, null, null, null, null, null],
  [null, null, null, null, 'Za investitora:', null],
  ['Datum: ', '20.08.2026.', null, null, '_________________', null],
]

/** The construction sheet shifts every money column one to the right. */
const constructionRows: SheetRow[] = [
  ['INVESTITOR: ', 'PANNONIA D.O.O.', null, null, null, null, null],
  [null, null, null, null, null, null, null],
  ['STRUKTURA TROŠKOVA GRAĐENJA (bez PDV-a)', null, null, null, null, null, null],
  [null, null, null, null, null, null, null],
  ['NAMJENA', null, 'VLASTITA SREDSTVA', null, 'KREDITNA SREDSTVA', null, 'UKUPNA INVESTICIJA'],
  [null, null, 'EUR', '(%)', 'EUR', '(%)', 'EUR'],
  [null, null, null, null, null, null, null],
  ['A)', 'GRAĐEVINSKI RADOVI', null, null, null, null, null],
  ['I.', 'Pripremni radovi', null, 0, 20715.75, 0.0097, 20715.75],
  ['II.', 'Zemljani radovi', 100, 0, 13362, 0.0062, 13462],
  [null, 'Ukupno', 100, 0, 34077.75, 0.016, 34177.75],
  [null, null, null, null, null, null, null],
  ['B)', 'OBRTNIČKI RADOVI ', null, null, null, null, null],
  ['I.', 'Asfalterski radovi', null, 0, 5500, 0.0025, 5500],
  [null, 'Ukupno', 0, 0, 5500, 0.0025, 5500],
  [null, null, null, null, null, null, null],
  ['SVEUKUPNO:', null, 100, 0, 39577.75, 0.0186, 39677.75],
  [null, null, null, null, 'Za investitora:', null, null],
  ['Datum: ', '20.08.2026.', null, null, '_________________', null, null],
]

describe('parseSheet — investment layout', () => {
  const sheet = parseSheet('INVESTICIJA', investmentRows)

  it('detects the flat investment shape', () => {
    expect(sheet.kind).toBe('investment')
  })

  it('skips blank spacer rows and stops at UKUPNO', () => {
    if (sheet.kind !== 'investment') throw new Error('wrong kind')
    expect(sheet.lineItems.map((i) => i.name)).toEqual([
      'Priprema projekta',
      'Vrijednost zemljišta',
      'Priključci',
      'Stručni nadzor',
    ])
  })

  it('reads EUR columns and ignores the percentage columns', () => {
    if (sheet.kind !== 'investment') throw new Error('wrong kind')
    expect(sheet.lineItems[0]).toEqual({ name: 'Priprema projekta', vlastita: 17526, kreditna: 0 })
    expect(sheet.lineItems[2]).toEqual({ name: 'Priključci', vlastita: 0, kreditna: 78500 })
  })

  it('trims trailing whitespace from names', () => {
    if (sheet.kind !== 'investment') throw new Error('wrong kind')
    expect(sheet.lineItems[3].name).toBe('Stručni nadzor')
  })
})

describe('parseSheet — construction layout', () => {
  const sheet = parseSheet('GRAĐENJE', constructionRows)

  it('detects the hierarchical shape from the offset columns', () => {
    expect(sheet.kind).toBe('construction')
  })

  it('groups items under their sections', () => {
    if (sheet.kind !== 'construction') throw new Error('wrong kind')
    expect(sheet.sections.map((s) => [s.code, s.name, s.items.length])).toEqual([
      ['A)', 'GRAĐEVINSKI RADOVI', 2],
      ['B)', 'OBRTNIČKI RADOVI', 1],
    ])
  })

  it('reads the money columns from their shifted positions', () => {
    if (sheet.kind !== 'construction') throw new Error('wrong kind')
    expect(sheet.sections[0].items[0]).toEqual({
      numeral: 'I.',
      name: 'Pripremni radovi',
      vlastita: 0,
      kreditna: 20715.75,
    })
    expect(sheet.sections[0].items[1].vlastita).toBe(100)
  })

  it('discards the per-section Ukupno rows — subtotals are always derived', () => {
    if (sheet.kind !== 'construction') throw new Error('wrong kind')
    const names = sheet.sections.flatMap((s) => s.items.map((i) => i.name))
    expect(names).not.toContain('Ukupno')
  })

  it('stops at SVEUKUPNO', () => {
    if (sheet.kind !== 'construction') throw new Error('wrong kind')
    expect(sheet.sections).toHaveLength(2)
  })
})

describe('parseSheet — failures', () => {
  it('rejects a sheet with no recognisable header', () => {
    expect(() => parseSheet('Sheet1', [['foo', 'bar'], [1, 2]])).toThrow('missing_header')
  })

  it('rejects a header with no data rows', () => {
    expect(() =>
      parseSheet('Prazno', [
        ['NAMJENA', 'VLASTITA SREDSTVA', null, 'KREDITNA SREDSTVA', null, 'UKUPNA INVESTICIJA'],
      ])
    ).toThrow('no_rows')
  })

  it('parses European number strings from hand-edited files', () => {
    const sheet = parseSheet('INVESTICIJA', [
      ['NAMJENA', 'VLASTITA SREDSTVA', null, 'KREDITNA SREDSTVA', null, 'UKUPNA INVESTICIJA'],
      ['Priprema projekta', '17.526,50', '0,61', '1.000,00', '0,03', '18.526,50'],
    ])
    if (sheet.kind !== 'investment') throw new Error('wrong kind')
    expect(sheet.lineItems[0]).toEqual({ name: 'Priprema projekta', vlastita: 17526.5, kreditna: 1000 })
  })
})

describe('parseTICWorkbook', () => {
  it('maps the two sheets onto the two tabs and reads the document header', () => {
    const result = parseTICWorkbook([
      { name: 'INVESTICIJA', rows: investmentRows },
      { name: 'GRAĐENJE', rows: constructionRows },
    ])

    expect(result.investment?.lineItems).toHaveLength(4)
    expect(result.construction?.sections).toHaveLength(2)
    expect(result.investorName).toBe('PANNONIA D.O.O.')
    expect(result.documentDate).toBe('2026-08-20')
    expect(result.errors).toEqual([])
  })

  it('falls back to the detected shape when sheets are renamed', () => {
    const result = parseTICWorkbook([
      { name: 'Sheet2', rows: constructionRows },
      { name: 'Sheet1', rows: investmentRows },
    ])

    expect(result.investment?.sheetName).toBe('Sheet1')
    expect(result.construction?.sheetName).toBe('Sheet2')
  })

  it('imports a single-sheet file into just the matching tab', () => {
    const result = parseTICWorkbook([{ name: 'INVESTICIJA', rows: investmentRows }])

    expect(result.investment?.lineItems).toHaveLength(4)
    expect(result.construction).toBeNull()
  })

  it('reports unparseable sheets instead of failing the whole import', () => {
    const result = parseTICWorkbook([
      { name: 'INVESTICIJA', rows: investmentRows },
      { name: 'Bilješke', rows: [['nešto drugo']] },
    ])

    expect(result.investment?.lineItems).toHaveLength(4)
    expect(result.errors).toEqual([{ sheetName: 'Bilješke', error: 'missing_header' }])
  })
})
