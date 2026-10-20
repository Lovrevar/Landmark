import type { SheetRows } from '../../../../lib/xlsxExport'
import { exportT } from '../../../../utils/exportLanguage'

/**
 * The garage import's column layout. `importGaragesFromExcel` reads `row[0]`, `row[1]` and
 * `row[2]` from the second row down, so the order here is the contract; the names are the ones
 * the apartment sheet uses for the same three cells. The apartment import has offered a template
 * since SALES-12; this one had only the on-screen description (SALES-18).
 */
export const GARAGE_IMPORT_COLUMNS = ['parking oznaka', 'parking m2', 'parking cijena'] as const

/** The instruction lines: i18n keys under `sales_projects.excel_import.garage_format`. */
export const GARAGE_IMPORT_FORMAT_KEYS = ['layout', 'label', 'size', 'price'] as const

/** The two sheets of the template. Only the first is read back by the import. */
export function buildGarageImportTemplate(): { name: string; rows: SheetRows; columnWidths: number[] }[] {
  const t = exportT()
  return [
    {
      name: t('sales_projects.excel_import.garage_template_sheet_data'),
      rows: [[...GARAGE_IMPORT_COLUMNS]],
      columnWidths: GARAGE_IMPORT_COLUMNS.map(header => Math.max(14, header.length + 2)),
    },
    {
      name: t('sales_projects.excel_import.template_sheet_notes'),
      rows: GARAGE_IMPORT_FORMAT_KEYS.map(key => [t(`sales_projects.excel_import.garage_format.${key}`)]),
      columnWidths: [80],
    },
  ]
}

export async function downloadGarageImportTemplate(): Promise<void> {
  const { downloadWorkbook } = await import('../../../../lib/xlsxExport')
  await downloadWorkbook(buildGarageImportTemplate(), 'predlozak-uvoz-garaza')
}
