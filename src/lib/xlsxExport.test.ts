import { describe, it, expect } from 'vitest'
import { buildWorkbook, textCell, toDateCell } from './xlsxExport'

describe('toDateCell', () => {
  it('keeps the day a date-only column says, east of UTC', () => {
    const date = toDateCell('2026-01-05')!
    expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 1, 5])
  })

  it('takes the local calendar day of a real timestamp', () => {
    const date = toDateCell(new Date(2026, 8, 23, 14, 30))!
    expect([date.getMonth() + 1, date.getDate(), date.getHours()]).toEqual([9, 23, 0])
  })

  it('is null for a missing or unparseable value', () => {
    expect(toDateCell(null)).toBeNull()
    expect(toDateCell('')).toBeNull()
    expect(toDateCell('not a date')).toBeNull()
  })
})

describe('textCell', () => {
  it('empties the placeholders a table shows a reader', () => {
    expect(textCell('—')).toBe('')
    expect(textCell('-')).toBe('')
    expect(textCell('N/A')).toBe('')
    expect(textCell(null)).toBe('')
  })

  it('leaves real text alone', () => {
    expect(textCell('PANNONIA, d.o.o.')).toBe('PANNONIA, d.o.o.')
  })
})

describe('buildWorkbook', () => {
  const rows = [
    ['Firma', 'Datum', 'Iznos'],
    ['PANNONIA, d.o.o.', toDateCell('2026-01-05'), 1234.56],
    ['Loš\nunos; "citat"', toDateCell('2026-09-23'), -987.5],
    ['=SUM(A1:A2)', null, 0],
  ]

  const sheet = async () => {
    const workbook = await buildWorkbook([
      { name: 'Test', rows, columnWidths: [30, 14, 16], moneyColumns: [2] },
    ])
    return workbook.Sheets['Test']
  }

  it('keeps a comma, a newline and a quote inside one cell', async () => {
    const ws = await sheet()
    expect(ws['A2'].v).toBe('PANNONIA, d.o.o.')
    expect(ws['A3'].v).toBe('Loš\nunos; "citat"')
  })

  it('writes a leading "=" as text, never as a formula', async () => {
    const ws = await sheet()
    expect(ws['A4'].t).toBe('s')
    expect(ws['A4'].f).toBeUndefined()
    expect(ws['A4'].v).toBe('=SUM(A1:A2)')
  })

  it('writes money as a number with the euro format, not as a string', async () => {
    const ws = await sheet()
    expect(ws['C2'].t).toBe('n')
    expect(ws['C2'].v).toBe(1234.56)
    expect(ws['C2'].z).toBe('#,##0.00" €"')
    // An over-payment is negative and must stay a number.
    expect(ws['C3'].v).toBe(-987.5)
  })

  it('writes dates as date cells in the Croatian format', async () => {
    const ws = await sheet()
    expect(ws['B2'].t).toBe('d')
    expect(ws['B2'].z).toBe('dd.mm.yyyy.')
    // A null date leaves the cell empty rather than writing "Invalid Date".
    expect(ws['B4']).toBeUndefined()
  })

  it('leaves a header cell unformatted and carries the column widths', async () => {
    const ws = await sheet()
    expect(ws['C1'].z).toBeUndefined()
    expect(ws['!cols']).toEqual([{ wch: 30 }, { wch: 14 }, { wch: 16 }])
  })
})
