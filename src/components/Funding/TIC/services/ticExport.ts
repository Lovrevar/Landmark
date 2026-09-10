import jsPDF from 'jspdf'
import { logActivity } from '../../../../lib/activityLog'
import {
  calculateSectionTotals,
  type LineItem,
  type ConstructionSection,
  type TICTotals,
} from '../utils/ticFormatters'

export interface TICExportData {
  lineItems: LineItem[]
  constructionSections: ConstructionSection[]
  investorName: string
  documentDate: string
  totals: TICTotals
  grandTotal: number
  constructionTotals: TICTotals
  constructionGrandTotal: number
  projectName?: string
}

const INVESTMENT_SHEET = 'INVESTICIJA'
const CONSTRUCTION_SHEET = 'GRAĐENJE'

const formatNumberForExport = (num: number): string =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num)

const formatPercentageForExport = (num: number): string =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)

const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0
  return (value / total) * 100
}

const baseFileName = (projectName: string | undefined, documentDate: string): string =>
  projectName
    ? `TIC_${projectName.replace(/\s+/g, '_')}_${documentDate}`
    : `TIC_Struktura_Troskova_${documentDate}`

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

type Cell = string | number | null
type SheetRows = Cell[][]

/**
 * Percentages are written as fractions so Excel's own "%" formatting matches the source
 * workbook, which stores 0.0061… rather than 0,61.
 */
const percentFraction = (value: number, total: number): number => (total === 0 ? 0 : value / total)

/** Lays the INVESTICIJA sheet out in the source workbook's shape, so exports re-import cleanly. */
export function buildInvestmentSheet(data: TICExportData): SheetRows {
  const rows: SheetRows = [
    ['INVESTITOR:', data.investorName, null, null, null, null],
    [null, null, null, null, null, null],
    ['STRUKTURA TROŠKOVA INVESTICIJE (bez PDV-a)', null, null, null, null, null],
    [null, null, null, null, null, null],
    ['NAMJENA', 'VLASTITA SREDSTVA', null, 'KREDITNA SREDSTVA', null, 'UKUPNA INVESTICIJA'],
    [null, 'EUR', '(%)', 'EUR', '(%)', 'EUR'],
    [null, null, null, null, null, null],
  ]

  for (const item of data.lineItems) {
    rows.push([
      item.name,
      item.vlastita,
      percentFraction(item.vlastita, data.grandTotal),
      item.kreditna,
      percentFraction(item.kreditna, data.grandTotal),
      item.vlastita + item.kreditna,
    ])
  }

  rows.push([
    'UKUPNO:',
    data.totals.vlastita,
    percentFraction(data.totals.vlastita, data.grandTotal),
    data.totals.kreditna,
    percentFraction(data.totals.kreditna, data.grandTotal),
    data.grandTotal,
  ])
  rows.push([null, null, null, null, null, null])
  rows.push([null, null, null, null, 'Za investitora:', null])
  rows.push([null, null, null, null, null, null])
  rows.push(['Datum:', data.documentDate, null, null, '_________________', null])

  return rows
}

/** The GRAĐENJE sheet carries a leading code column, shifting the money columns right by one. */
export function buildConstructionSheet(data: TICExportData): SheetRows {
  const total = data.constructionGrandTotal
  const rows: SheetRows = [
    ['INVESTITOR:', data.investorName, null, null, null, null, null],
    [null, null, null, null, null, null, null],
    ['STRUKTURA TROŠKOVA GRAĐENJA (bez PDV-a)', null, null, null, null, null, null],
    [null, null, null, null, null, null, null],
    ['NAMJENA', null, 'VLASTITA SREDSTVA', null, 'KREDITNA SREDSTVA', null, 'UKUPNA INVESTICIJA'],
    [null, null, 'EUR', '(%)', 'EUR', '(%)', 'EUR'],
    [null, null, null, null, null, null, null],
  ]

  for (const section of data.constructionSections) {
    rows.push([section.code, section.name, null, null, null, null, null])

    for (const item of section.items) {
      rows.push([
        item.numeral,
        item.name,
        item.vlastita,
        percentFraction(item.vlastita, total),
        item.kreditna,
        percentFraction(item.kreditna, total),
        item.vlastita + item.kreditna,
      ])
    }

    const sectionTotals = calculateSectionTotals(section)
    rows.push([
      null,
      'Ukupno',
      sectionTotals.vlastita,
      percentFraction(sectionTotals.vlastita, total),
      sectionTotals.kreditna,
      percentFraction(sectionTotals.kreditna, total),
      sectionTotals.vlastita + sectionTotals.kreditna,
    ])
    rows.push([null, null, null, null, null, null, null])
  }

  rows.push([
    'SVEUKUPNO:',
    null,
    data.constructionTotals.vlastita,
    percentFraction(data.constructionTotals.vlastita, total),
    data.constructionTotals.kreditna,
    percentFraction(data.constructionTotals.kreditna, total),
    total,
  ])
  rows.push([null, null, null, null, null, null, null])
  rows.push([null, null, null, null, 'Za investitora:', null, null])
  rows.push([null, null, null, null, null, null, null])
  rows.push(['Datum:', data.documentDate, null, null, '_________________', null, null])

  return rows
}

export const exportToExcel = async (data: TICExportData): Promise<void> => {
  const XLSX = await import('@e965/xlsx')

  const workbook = XLSX.utils.book_new()

  const investmentSheet = XLSX.utils.aoa_to_sheet(buildInvestmentSheet(data))
  investmentSheet['!cols'] = [{ wch: 42 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 10 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(workbook, investmentSheet, INVESTMENT_SHEET)

  const constructionSheet = XLSX.utils.aoa_to_sheet(buildConstructionSheet(data))
  constructionSheet['!cols'] = [
    { wch: 8 }, { wch: 42 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 10 }, { wch: 18 },
  ]
  XLSX.utils.book_append_sheet(workbook, constructionSheet, CONSTRUCTION_SHEET)

  const out = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  downloadBlob(blob, `${baseFileName(data.projectName, data.documentDate)}.xlsx`)

  logActivity({ action: 'export.tic_excel', entity: 'report', metadata: { severity: 'low', format: 'excel' } })
}

// --- PDF ---------------------------------------------------------------------

const PAGE_WIDTH = 297
const PAGE_HEIGHT = 210
const CANVAS_SCALE = 12
const MARGIN_X = 20

interface PdfRow {
  label: string
  vlastita: number
  kreditna: number
  /** Section headers span the whole width and carry no figures. */
  variant: 'item' | 'section' | 'subtotal' | 'total'
}

/**
 * Renders one table onto an off-screen canvas. Row height is derived from the row count
 * so a long GRAĐENJE breakdown still fits on a single A4 landscape page.
 */
function renderPage(title: string, investorName: string, documentDate: string, projectName: string | undefined, rows: PdfRow[], grandTotal: number): string {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  canvas.width = PAGE_WIDTH * CANVAS_SCALE
  canvas.height = PAGE_HEIGHT * CANVAS_SCALE

  ctx.scale(CANVAS_SCALE, CANVAS_SCALE)
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)

  ctx.fillStyle = 'black'
  ctx.font = 'bold 7px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(title, PAGE_WIDTH / 2, 18)

  let headerY = 28
  if (projectName) {
    ctx.font = 'bold 5px Arial, sans-serif'
    ctx.fillText(`Projekt: ${projectName}`, PAGE_WIDTH / 2, headerY)
    headerY += 8
  }

  ctx.font = 'bold 5px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`INVESTITOR: ${investorName}`, MARGIN_X, headerY + 5)

  const startY = projectName ? 52 : 48
  const footerHeight = 24
  const colWidths = [75, 30, 22, 30, 22, 30]
  const tableWidth = colWidths.reduce((a, b) => a + b, 0)

  // Two header rows plus every data row must fit between startY and the signature block.
  const available = PAGE_HEIGHT - startY - footerHeight
  const rowHeight = Math.min(7, available / (rows.length + 2))
  const fontScale = rowHeight / 7

  let currentY = startY
  ctx.strokeStyle = 'black'
  ctx.lineWidth = 0.3

  ctx.strokeRect(MARGIN_X, currentY, colWidths[0], rowHeight * 2)
  ctx.font = `bold ${4.5 * fontScale}px Arial, sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText('NAMJENA', MARGIN_X + 2, currentY + rowHeight * 1.3)

  let xPos = MARGIN_X + colWidths[0]
  ctx.textAlign = 'center'
  for (const col of [
    { width: colWidths[1] + colWidths[2], text: 'VLASTITA SREDSTVA' },
    { width: colWidths[3] + colWidths[4], text: 'KREDITNA SREDSTVA' },
    { width: colWidths[5], text: 'UKUPNO' },
  ]) {
    ctx.strokeRect(xPos, currentY, col.width, rowHeight)
    ctx.fillText(col.text, xPos + col.width / 2, currentY + rowHeight * 0.65)
    xPos += col.width
  }

  currentY += rowHeight

  xPos = MARGIN_X + colWidths[0]
  for (let i = 1; i < colWidths.length; i++) {
    ctx.strokeRect(xPos, currentY, colWidths[i], rowHeight)
    ctx.fillText(i === 2 || i === 4 ? '(%)' : 'EUR', xPos + colWidths[i] / 2, currentY + rowHeight * 0.65)
    xPos += colWidths[i]
  }

  currentY += rowHeight

  const maxNameChars = Math.floor(45 / Math.max(fontScale, 0.5))

  for (const row of rows) {
    const isEmphasised = row.variant !== 'item'
    ctx.font = `${isEmphasised ? 'bold' : 'normal'} ${(isEmphasised ? 3.5 : 3) * fontScale}px Arial, sans-serif`

    if (row.variant === 'total') {
      ctx.fillStyle = 'rgba(227, 242, 253, 1)'
      ctx.fillRect(MARGIN_X, currentY, tableWidth, rowHeight)
      ctx.fillStyle = 'black'
    } else if (row.variant === 'section') {
      ctx.fillStyle = 'rgba(238, 238, 238, 1)'
      ctx.fillRect(MARGIN_X, currentY, tableWidth, rowHeight)
      ctx.fillStyle = 'black'
    }

    xPos = MARGIN_X
    ctx.strokeRect(xPos, currentY, colWidths[0], rowHeight)
    ctx.textAlign = 'left'
    const label = row.label.length > maxNameChars ? `${row.label.substring(0, maxNameChars - 3)}...` : row.label
    ctx.fillText(label, xPos + 1.5, currentY + rowHeight * 0.72)
    xPos += colWidths[0]

    if (row.variant === 'section') {
      // Section headers carry no figures — draw one empty cell across the money columns.
      ctx.strokeRect(xPos, currentY, tableWidth - colWidths[0], rowHeight)
      currentY += rowHeight
      continue
    }

    const rowTotal = row.vlastita + row.kreditna
    const values = [
      formatNumberForExport(row.vlastita),
      `${formatPercentageForExport(calculatePercentage(row.vlastita, grandTotal))}%`,
      formatNumberForExport(row.kreditna),
      `${formatPercentageForExport(calculatePercentage(row.kreditna, grandTotal))}%`,
      formatNumberForExport(rowTotal),
    ]

    ctx.textAlign = 'right'
    values.forEach((value, i) => {
      const width = colWidths[i + 1]
      ctx.strokeRect(xPos, currentY, width, rowHeight)
      ctx.fillText(value, xPos + width - 1.5, currentY + rowHeight * 0.72)
      xPos += width
    })

    currentY += rowHeight
  }

  currentY += 10
  ctx.font = 'normal 4px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('Za investitora: _________________________', MARGIN_X, currentY)
  ctx.fillText(`Datum: ${documentDate}`, MARGIN_X, currentY + 8)

  return canvas.toDataURL('image/png')
}

export const exportToPDF = (data: TICExportData): void => {
  const investmentRows: PdfRow[] = data.lineItems.map((item) => ({
    label: item.name,
    vlastita: item.vlastita,
    kreditna: item.kreditna,
    variant: 'item',
  }))
  investmentRows.push({
    label: 'UKUPNO:',
    vlastita: data.totals.vlastita,
    kreditna: data.totals.kreditna,
    variant: 'total',
  })

  const constructionRows: PdfRow[] = []
  for (const section of data.constructionSections) {
    constructionRows.push({
      label: `${section.code} ${section.name}`.trim(),
      vlastita: 0,
      kreditna: 0,
      variant: 'section',
    })
    for (const item of section.items) {
      constructionRows.push({
        label: `${item.numeral} ${item.name}`.trim(),
        vlastita: item.vlastita,
        kreditna: item.kreditna,
        variant: 'item',
      })
    }
    const sectionTotals = calculateSectionTotals(section)
    constructionRows.push({
      label: 'Ukupno',
      vlastita: sectionTotals.vlastita,
      kreditna: sectionTotals.kreditna,
      variant: 'subtotal',
    })
  }
  constructionRows.push({
    label: 'SVEUKUPNO:',
    vlastita: data.constructionTotals.vlastita,
    kreditna: data.constructionTotals.kreditna,
    variant: 'total',
  })

  const pdf = new jsPDF('landscape', 'mm', 'a4')

  pdf.addImage(
    renderPage(
      'STRUKTURA TROŠKOVA INVESTICIJE (bez PDV-a)',
      data.investorName,
      data.documentDate,
      data.projectName,
      investmentRows,
      data.grandTotal
    ),
    'PNG',
    0,
    0,
    PAGE_WIDTH,
    PAGE_HEIGHT,
    '',
    'FAST'
  )

  if (constructionRows.length > 1) {
    pdf.addPage()
    pdf.addImage(
      renderPage(
        'STRUKTURA TROŠKOVA GRAĐENJA (bez PDV-a)',
        data.investorName,
        data.documentDate,
        data.projectName,
        constructionRows,
        data.constructionGrandTotal
      ),
      'PNG',
      0,
      0,
      PAGE_WIDTH,
      PAGE_HEIGHT,
      '',
      'FAST'
    )
  }

  pdf.save(`${baseFileName(data.projectName, data.documentDate)}.pdf`)

  logActivity({ action: 'export.tic_pdf', entity: 'report', metadata: { severity: 'low', format: 'pdf' } })
}
