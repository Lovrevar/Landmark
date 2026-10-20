import { describe, it, expect } from 'vitest'
import hr from '../../../../locales/hr/translation.json'
import en from '../../../../locales/en/translation.json'
import { GARAGE_IMPORT_COLUMNS, GARAGE_IMPORT_FORMAT_KEYS, buildGarageImportTemplate } from './garageImportTemplate'

// The import reads cells by position (garageImportService: row[0], row[1], row[2]), from the
// second row down, so the template is only right while each header sits where the parser reads.
describe('garage import template', () => {
  it('puts label, size and price in columns A, B and C', () => {
    expect([...GARAGE_IMPORT_COLUMNS]).toEqual(['parking oznaka', 'parking m2', 'parking cijena'])
  })

  it('is one header row on the first sheet, with the instructions on the second', () => {
    const [data, notes] = buildGarageImportTemplate()
    expect(data.rows).toEqual([[...GARAGE_IMPORT_COLUMNS]])
    expect(notes.rows).toHaveLength(GARAGE_IMPORT_FORMAT_KEYS.length)
    expect(notes.rows.every(row => typeof row[0] === 'string' && row[0].length > 0)).toBe(true)
  })

  it('has every instruction line and both sheet names in both locales', () => {
    for (const locale of [hr, en]) {
      const strings = locale.sales_projects.excel_import as Record<string, unknown>
      for (const key of GARAGE_IMPORT_FORMAT_KEYS) {
        expect((strings.garage_format as Record<string, string>)[key]).toBeTruthy()
      }
      expect(strings.garage_template_sheet_data).toBeTruthy()
      expect(strings.template_sheet_notes).toBeTruthy()
    }
  })
})
