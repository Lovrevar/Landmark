import { describe, it, expect } from 'vitest'
import {
  AMOUNT_COLUMN_INDEXES, amountColumnName, columnLetter, dateCellsInAmountColumns, looksLikeDateText,
  type AmountCell,
} from './apartmentImportValidation'

describe('looksLikeDateText', () => {
  it.each(['01.02.2026', '1.2.2026.', '15.11.26', '01/02/2026', '01-02-2026', '2026-02-01', '2026-02-01T00:00:00'])(
    'treats %s as a date',
    text => expect(looksLikeDateText(text)).toBe(true),
  )

  it.each(['3.000,00', '15000', '15.000', '1.000.000', '12500,50', '30%', '', '  '])(
    'treats %s as not a date',
    text => expect(looksLikeDateText(text)).toBe(false),
  )

  it('never calls a number a date — that is what the cell format is for', () => {
    expect(looksLikeDateText(46054)).toBe(false)
  })
})

describe('dateCellsInAmountColumns', () => {
  const row = (cells: Record<number, Partial<AmountCell>>) => (index: number): AmountCell => ({
    value: undefined,
    dateFormatted: false,
    ...cells[index],
  })

  it('covers exactly U–Z', () => {
    expect(AMOUNT_COLUMN_INDEXES.map(columnLetter)).toEqual(['U', 'V', 'W', 'X', 'Y', 'Z'])
    expect(amountColumnName(20)).toBe('kapara 10%')
    expect(amountColumnName(25)).toBe('kredit etažiranje 90%')
  })

  it('accepts amounts and empty cells', () => {
    expect(dateCellsInAmountColumns(row({ 20: { value: 15000 }, 21: { value: '45.000,00' }, 22: { value: '' } }))).toEqual([])
  })

  it('flags date text — the value that used to import as 1022026', () => {
    expect(dateCellsInAmountColumns(row({ 21: { value: '01.02.2026' } }))).toEqual([21])
  })

  it('flags a real Excel date cell, which arrives as a plausible-looking serial number', () => {
    expect(dateCellsInAmountColumns(row({ 25: { value: 46054, dateFormatted: true } }))).toEqual([25])
  })

  it('reports every offending column of the row', () => {
    const cells = { 20: { value: 15000 }, 22: { value: '2026-03-01' }, 24: { value: new Date(2026, 4, 1) } }
    expect(dateCellsInAmountColumns(row(cells))).toEqual([22, 24])
  })

  it('ignores a date format on an empty cell', () => {
    expect(dateCellsInAmountColumns(row({ 23: { value: null, dateFormatted: true } }))).toEqual([])
  })
})
