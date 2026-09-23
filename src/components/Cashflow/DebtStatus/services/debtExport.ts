import type { TFunction } from 'i18next'
import { DebtSummary } from '../types'
import { logActivity } from '../../../../lib/activityLog'
import { downloadWorkbook, textCell, type SheetRows } from '../../../../lib/xlsxExport'
import { exportFileName } from '../../../../utils/downloadFile'
import { exportT } from '../../../../utils/exportLanguage'
import { formatDate } from '../../../../utils/formatters'
import { loadUnicodeFont, PDF_FONT_FAMILY } from '../../../../utils/pdfFont'
import { pdfMoney } from '../../../Reports/pdf/pdfText'

/**
 * The supplier debt register, as a spreadsheet and as a PDF.
 *
 * Both halves used to describe the same table differently. The "Excel" was an HTML `<table>` served
 * as `application/vnd.ms-excel` and saved as `.xls`, so Excel warned on every open, and
 * `supplier_name` was interpolated into that HTML **unescaped** — an `&`, a `<` or a stray `</td>`
 * in a company name corrupted or restructured the sheet. The PDF transliterated its own headings to
 * ASCII (`Racuni`, `Neisplaceno`) because jsPDF's built-in fonts cannot spell `č`, and wrote `EUR`
 * where the spreadsheet wrote `€`. Now the spreadsheet is a real `.xlsx`, the PDF embeds Noto Sans,
 * and both read their labels from the same keys as the screen.
 */

const SHEET_NAME = 'Stanje duga'
const COLUMN_WIDTHS = [36, 12, 10, 18, 18, 18]
const MONEY_COLUMNS = [3, 4, 5]

/** `supplier_type` is computed in `debtService`, not a stored enum: 'mixed' when a supplier
 *  appears under more than one register, otherwise whichever register it came from. */
const supplierTypeLabel = (type: string, t: TFunction): string => {
  switch (type) {
    case 'retail_supplier': return t('debt_status.supplier_types.retail')
    case 'office_supplier': return t('debt_status.supplier_types.office')
    case 'mixed': return t('debt_status.supplier_types.mixed')
    default: return t('debt_status.supplier_types.site')
  }
}

const fileNamePrefix = (projectName?: string | null): string =>
  projectName ? `stanje-duga-${projectName}` : 'stanje-duga'

export function buildDebtSheet(
  sortedData: DebtSummary[],
  totalUnpaid: number,
  totalPaid: number,
  t: TFunction
): SheetRows {
  const header = [
    t('debt_status.table.supplier'),
    t('debt_status.table.type'),
    t('debt_status.table.invoices'),
    t('debt_status.table.unpaid'),
    t('debt_status.table.paid'),
    t('debt_status.table.total'),
  ]

  return [
    header,
    ...sortedData.map(debt => [
      textCell(debt.supplier_name),
      supplierTypeLabel(debt.supplier_type, t),
      debt.invoice_count,
      debt.total_unpaid,
      debt.total_paid,
      debt.total_unpaid + debt.total_paid,
    ]),
    [t('debt_status.table.grand_total'), '', null, totalUnpaid, totalPaid, totalUnpaid + totalPaid],
  ]
}

export const exportToExcel = async (
  sortedData: DebtSummary[],
  totalUnpaid: number,
  totalPaid: number,
  projectName?: string | null
): Promise<void> => {
  const t = exportT()
  await downloadWorkbook(
    [{
      name: SHEET_NAME,
      rows: buildDebtSheet(sortedData, totalUnpaid, totalPaid, t),
      columnWidths: COLUMN_WIDTHS,
      moneyColumns: MONEY_COLUMNS,
    }],
    fileNamePrefix(projectName)
  )

  logActivity({
    action: 'export.debt_excel',
    entity: 'report',
    // The project filter is the difference between one project's debt register and the whole
    // portfolio's leaving the building, so it is part of what was exported.
    metadata: { severity: 'low', format: 'excel', row_count: sortedData.length, project: projectName ?? null },
  })
}

// --- PDF ---------------------------------------------------------------------

const TABLE_START_X = 14
const TABLE_WIDTH = 182
const COL_WIDTHS = [70, 20, 20, 24, 24, 24]
const ROW_HEIGHT = 8

export const exportToPDF = async (
  sortedData: DebtSummary[],
  totalUnpaid: number,
  totalPaid: number,
  totalSuppliers: number,
  suppliersWithDebt: number,
  projectName?: string | null
) => {
  const t = exportT()
  const jsPDF = (await import('jspdf')).default
  const doc = new jsPDF()

  // Throws if the font is missing, which `useAsyncExport` turns into a toast. A debt register
  // spelled `Racuni` / `PANNONIA d.o.o.` with the `č` eaten is not worth emitting.
  await loadUnicodeFont(doc)

  const columnHeadings = [
    t('debt_status.table.supplier'),
    t('debt_status.table.type'),
    t('debt_status.table.invoices'),
    t('debt_status.table.unpaid'),
    t('debt_status.table.paid'),
    t('debt_status.table.total'),
  ]

  const drawTableHeader = (y: number) => {
    doc.setFillColor(75, 85, 99)
    doc.rect(TABLE_START_X, y, TABLE_WIDTH, ROW_HEIGHT, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFont(PDF_FONT_FAMILY, 'bold')
    doc.setFontSize(9)

    let xPos = TABLE_START_X + 2
    columnHeadings.forEach((heading, i) => {
      doc.text(heading, xPos, y + 5.5)
      xPos += COL_WIDTHS[i]
    })

    doc.setTextColor(0, 0, 0)
    doc.setFont(PDF_FONT_FAMILY, 'normal')
    doc.setFontSize(8)
  }

  doc.setFont(PDF_FONT_FAMILY, 'bold')
  doc.setFontSize(18)
  const title = projectName ? `${t('debt_status.title')} - ${projectName}` : t('debt_status.title')
  doc.text(title, 105, 20, { align: 'center' })

  doc.setFont(PDF_FONT_FAMILY, 'normal')
  doc.setFontSize(10)
  doc.text(`${t('reports.general.generated')} ${formatDate(new Date(), 'hr')}`, 105, 28, { align: 'center' })

  let yPosition = 40

  doc.text(`${t('debt_status.stats.total_suppliers')}: ${totalSuppliers}`, 20, yPosition)
  yPosition += 6
  doc.text(`${t('debt_status.stats.suppliers_with_debt')}: ${suppliersWithDebt}`, 20, yPosition)
  yPosition += 6
  doc.text(`${t('debt_status.stats.total_unpaid')}: ${pdfMoney(totalUnpaid)}`, 20, yPosition)
  yPosition += 6
  doc.text(`${t('debt_status.stats.total_paid')}: ${pdfMoney(totalPaid)}`, 20, yPosition)

  yPosition = 65
  drawTableHeader(yPosition)
  yPosition += ROW_HEIGHT

  let isEvenRow = false

  sortedData.forEach((debt) => {
    if (yPosition > 270) {
      doc.addPage()
      yPosition = 20
      drawTableHeader(yPosition)
      yPosition += ROW_HEIGHT
      isEvenRow = false
    }

    if (isEvenRow) {
      doc.setFillColor(249, 250, 251)
      doc.rect(TABLE_START_X, yPosition, TABLE_WIDTH, ROW_HEIGHT, 'F')
    }

    doc.setDrawColor(221, 221, 221)
    doc.rect(TABLE_START_X, yPosition, TABLE_WIDTH, ROW_HEIGHT, 'S')

    for (let i = 0; i < COL_WIDTHS.length - 1; i++) {
      const lineX = TABLE_START_X + COL_WIDTHS.slice(0, i + 1).reduce((a, b) => a + b, 0)
      doc.line(lineX, yPosition, lineX, yPosition + ROW_HEIGHT)
    }

    let xPos = TABLE_START_X + 2
    const firmName = debt.supplier_name ?? ''
    const truncatedName = firmName.length > 32 ? `${firmName.substring(0, 29)}...` : firmName
    doc.text(truncatedName, xPos, yPosition + 5.5)

    xPos += COL_WIDTHS[0]
    doc.text(supplierTypeLabel(debt.supplier_type, t), xPos, yPosition + 5.5)

    xPos += COL_WIDTHS[1]
    doc.text(debt.invoice_count.toString(), xPos + COL_WIDTHS[2] - 2, yPosition + 5.5, { align: 'right' })

    // Through `pdfMoney`, which swaps hr-HR's U+2212 minus for an ASCII hyphen: `remaining_amount`
    // accumulates into `total_unpaid` (debtService.ts) and an over-paid invoice makes it negative,
    // and one unmapped character re-encodes the whole line as noise.
    xPos += COL_WIDTHS[2]
    doc.text(pdfMoney(debt.total_unpaid), xPos + COL_WIDTHS[3] - 2, yPosition + 5.5, { align: 'right' })

    xPos += COL_WIDTHS[3]
    doc.text(pdfMoney(debt.total_paid), xPos + COL_WIDTHS[4] - 2, yPosition + 5.5, { align: 'right' })

    xPos += COL_WIDTHS[4]
    doc.text(pdfMoney(debt.total_unpaid + debt.total_paid), xPos + COL_WIDTHS[5] - 2, yPosition + 5.5, { align: 'right' })

    yPosition += ROW_HEIGHT
    isEvenRow = !isEvenRow
  })

  if (yPosition > 265) {
    doc.addPage()
    yPosition = 20
  }

  doc.setFillColor(229, 231, 235)
  doc.rect(TABLE_START_X, yPosition, TABLE_WIDTH, ROW_HEIGHT, 'F')
  doc.setDrawColor(221, 221, 221)
  doc.rect(TABLE_START_X, yPosition, TABLE_WIDTH, ROW_HEIGHT, 'S')

  for (let i = 0; i < COL_WIDTHS.length - 1; i++) {
    const lineX = TABLE_START_X + COL_WIDTHS.slice(0, i + 1).reduce((a, b) => a + b, 0)
    doc.line(lineX, yPosition, lineX, yPosition + ROW_HEIGHT)
  }

  doc.setFont(PDF_FONT_FAMILY, 'bold')
  doc.setFontSize(9)
  doc.text(t('debt_status.table.grand_total'), TABLE_START_X + 2, yPosition + 5.5)

  let totalXPos = TABLE_START_X + COL_WIDTHS[0] + COL_WIDTHS[1] + COL_WIDTHS[2]
  doc.text(pdfMoney(totalUnpaid), totalXPos + COL_WIDTHS[3] - 2, yPosition + 5.5, { align: 'right' })

  totalXPos += COL_WIDTHS[3]
  doc.text(pdfMoney(totalPaid), totalXPos + COL_WIDTHS[4] - 2, yPosition + 5.5, { align: 'right' })

  totalXPos += COL_WIDTHS[4]
  doc.text(pdfMoney(totalUnpaid + totalPaid), totalXPos + COL_WIDTHS[5] - 2, yPosition + 5.5, { align: 'right' })

  // `exportFileName` folds the Croatian letters to ASCII; the old sanitiser deleted them, so
  // "Savska Opatovina Č" became "Savska_Opatovina_".
  doc.save(exportFileName(fileNamePrefix(projectName), 'pdf'))

  logActivity({
    action: 'export.debt_pdf',
    entity: 'report',
    metadata: { severity: 'low', format: 'pdf', row_count: sortedData.length, project: projectName ?? null },
  })
}
