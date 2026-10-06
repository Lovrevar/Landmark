import { describe, it, expect } from 'vitest'
import hr from '../../../../locales/hr/translation.json'
import en from '../../../../locales/en/translation.json'
import { APARTMENT_IMPORT_COLUMNS, APARTMENT_IMPORT_FORMAT_KEYS } from './apartmentImportTemplate'

// The import reads cells by position (ExcelImportApartmentsModal: row[0], row[3], row[9] …), so
// the template is only correct while each header sits at the index the parser reads.
describe('apartment import template', () => {
  it('has the 26 columns A–Z', () => {
    expect(APARTMENT_IMPORT_COLUMNS).toHaveLength(26)
  })

  it('puts each header at the index the parser reads', () => {
    const at = (index: number) => APARTMENT_IMPORT_COLUMNS[index]
    expect(at(0)).toBe('zgrada')
    expect(at(3)).toBe('oznaka stana')
    expect(at(9)).toBe('stan m2 prodajno')
    expect(at(11)).toBe('cijena stana')
    expect([at(12), at(13), at(14)]).toEqual(['parking oznaka', 'parking m2', 'parking cijena'])
    expect([at(15), at(16), at(17)]).toEqual(['repozitorij oznaka', 'repozitorij m2', 'repozitorij cijena'])
    expect(at(19)).toBe('datum potpisa predugovora')
    expect(at(20)).toBe('kapara 10%')
    // V–Y are instalment amounts and Z the loan amount — the columns the old instructions
    // described as dates (SALES-12).
    expect([at(21), at(22), at(23), at(24)].every(header => header.includes('rata'))).toBe(true)
    expect(at(25)).toBe('kredit etažiranje 90%')
  })

  it('has every instruction line in both locales', () => {
    for (const key of APARTMENT_IMPORT_FORMAT_KEYS) {
      expect(hr.sales_projects.excel_import.format[key], `hr ${key}`).toBeTruthy()
      expect(en.sales_projects.excel_import.format[key], `en ${key}`).toBeTruthy()
    }
  })

  it('tells the reader V–Y hold amounts, not dates', () => {
    expect(hr.sales_projects.excel_import.format.amounts).toMatch(/V–Y.*iznosi u EUR, a ne datumi/)
  })
})
