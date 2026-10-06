import type { SheetRows } from '../../../../lib/xlsxExport'
import { exportT } from '../../../../utils/exportLanguage'

/**
 * The apartment import's column layout, in one place.
 *
 * `ExcelImportApartmentsModal` reads cells by position, not by header text, so these names are
 * documentation for whoever fills the sheet in — but the *order* is the contract. The on-screen
 * instructions used to describe it by hand and said columns V–Y held dates; the parser reads them
 * as euro amounts, so a date typed there became a number like 1022026 (SALES-12). The template
 * and the instructions are now both generated from this file.
 */
export const APARTMENT_IMPORT_COLUMNS = [
  'zgrada',                         // A — matched by name against the project's buildings
  'ulaz',                           // B
  'kat',                            // C
  'oznaka stana',                   // D — required
  'tip',                            // E
  'sobnost',                        // F
  'zatvorena površina m2',          // G — not imported
  'otvorena površina m2',           // H
  'otvorena površina s koef. m2',   // I
  'stan m2 prodajno',               // J — required
  'cijena po m2',                   // K
  'cijena stana',                   // L — required
  'parking oznaka',                 // M
  'parking m2',                     // N
  'parking cijena',                 // O
  'repozitorij oznaka',             // P
  'repozitorij m2',                 // Q
  'repozitorij cijena',             // R
  'ukupna cijena',                  // S — not imported
  'datum potpisa predugovora',      // T — the only date column
  'kapara 10%',                     // U — amount
  '1. rata AB konstrukcija 30%',    // V — amount
  '2. rata postava stolarije 20%',  // W — amount
  '3. rata obrtnički radovi 20%',   // X — amount
  '4. rata uporabna 20%',           // Y — amount
  'kredit etažiranje 90%',          // Z — amount
] as const

/**
 * The instruction lines, in display order: i18n keys under `sales_projects.excel_import.format`.
 * The modal lists them in the UI language; the template's second sheet prints them in Croatian.
 */
export const APARTMENT_IMPORT_FORMAT_KEYS = [
  'layout',
  'required',
  'details',
  'parking',
  'storage',
  'contract_date',
  'amounts',
  'payment_type',
  'not_imported',
  'numbers',
  'existing',
] as const

/** The two sheets of the template. Only the first is read back by the import. */
export function buildApartmentImportTemplate(): { name: string; rows: SheetRows; columnWidths: number[] }[] {
  const t = exportT()
  return [
    {
      name: t('sales_projects.excel_import.template_sheet_data'),
      rows: [[...APARTMENT_IMPORT_COLUMNS]],
      columnWidths: APARTMENT_IMPORT_COLUMNS.map(header => Math.max(12, header.length + 2)),
    },
    {
      name: t('sales_projects.excel_import.template_sheet_notes'),
      rows: APARTMENT_IMPORT_FORMAT_KEYS.map(key => [t(`sales_projects.excel_import.format.${key}`)]),
      columnWidths: [140],
    },
  ]
}

export async function downloadApartmentImportTemplate(): Promise<void> {
  const { downloadWorkbook } = await import('../../../../lib/xlsxExport')
  await downloadWorkbook(buildApartmentImportTemplate(), 'predlozak-uvoz-stanova')
}
