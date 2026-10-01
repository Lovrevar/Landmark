import { yieldToUI } from '../../../utils/yieldToUI'
import { formatDate, formatDateTime, formatMonthYear } from '../../../utils/formatters'
import { loadUnicodeFont, PDF_FONT_FAMILY, type PdfFontStyle } from '../../../utils/pdfFont'
import { exportT, EXPORT_LANGUAGE } from '../../../utils/exportLanguage'
import { exportFileName } from '../../../utils/downloadFile'
import { pdfMoney } from './pdfText'
import { PROJECT_STATUS, UNIT_STATUS, CUSTOMER_STATUS, statusLabel } from '../../../utils/statusDisplay'
import { logActivity } from '../../../lib/activityLog'
import type { ProjectSalesReport, CustomerReport } from '../types'

export async function generateSalesReportPDF(
  reportType: 'project' | 'customer',
  projectReport: ProjectSalesReport | null,
  customerReport: CustomerReport | null,
  dateRange: { start: string; end: string }
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF('p', 'mm', 'a4')

  // No fallback. jsPDF's built-in faces cannot encode č/ć/đ and answer one unmapped character by
  // re-encoding the whole string as UCS-2BE, so a Croatian customer name came out as noise. A
  // failure here means the font asset did not ship; let it reach `useAsyncExport`.
  await loadUnicodeFont(pdf)

  // Exports are Croatian whatever the UI language is set to (docs/REPORTS.md) — these documents
  // go to buyers, banks and the accountant, not to whoever clicked Export.
  const t = exportT()
  const lang = EXPORT_LANGUAGE

  /**
   * A row label with exactly one colon. Some of these keys were written for a screen that draws
   * its own colon ("Lokacija:") and some for a stat tile that does not ("Ukupno kupaca"); the PDF
   * wants the same shape from both.
   */
  const rowLabel = (key: string): string => `${t(key).replace(/\s*:\s*$/, '')}:`

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - (margin * 2)
  let yPosition = margin

  const footerHeight = 15

  const addFooter = () => {
    const reportTitle = reportType === 'project'
      ? t('reports.sales.project_sales_report')
      : t('reports.sales.customer_report')
    const totalPages = pdf.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i)
      pdf.setFontSize(8)
      pdf.setFont(PDF_FONT_FAMILY, 'normal')
      pdf.setTextColor(107, 114, 128)
      pdf.text(`${t('reports.general.landmark_group')} — ${reportTitle}`, margin, pageHeight - 10)
      pdf.text(
        t('pagination.page_info', { current: i, total: totalPages }),
        pageWidth - margin,
        pageHeight - 10,
        { align: 'right' }
      )
    }
  }

  const checkPageBreak = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - footerHeight - margin) {
      pdf.addPage()
      yPosition = margin
      return true
    }
    return false
  }

  const addText = (text: string, x: number, y: number, options: { fontSize?: number; maxWidth?: number; lineHeight?: number; style?: PdfFontStyle; color?: number[] } = {}) => {
    const fontSize = options.fontSize || 10
    const maxWidth = options.maxWidth || contentWidth
    const lineHeight = options.lineHeight || fontSize * 0.35

    pdf.setFontSize(fontSize)
    if (options.style) pdf.setFont(PDF_FONT_FAMILY, options.style)
    if (options.color) pdf.setTextColor(options.color[0], options.color[1], options.color[2])

    const lines = pdf.splitTextToSize(text, maxWidth)
    for (let i = 0; i < lines.length; i++) {
      checkPageBreak(lineHeight)
      pdf.text(lines[i], x, y + (i * lineHeight))
    }
    return y + (lines.length * lineHeight)
  }

  /** The two-column label/value grid both report types open with. */
  const printRows = (rows: Array<[string, string]>) => {
    rows.forEach(([label, value]) => {
      checkPageBreak(6)
      pdf.setFont(PDF_FONT_FAMILY, 'bold')
      pdf.text(label, margin + 5, yPosition)
      pdf.setFont(PDF_FONT_FAMILY, 'normal')
      pdf.text(value, margin + 60, yPosition)
      yPosition += 6
    })
  }

  const period = `${formatDate(dateRange.start, lang)} – ${formatDate(dateRange.end, lang)}`

  if (reportType === 'project' && projectReport) {
    pdf.setFillColor(37, 99, 235)
    pdf.rect(0, 0, pageWidth, 35, 'F')

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(20)
    pdf.setFont(PDF_FONT_FAMILY, 'bold')
    pdf.text(t('reports.general.landmark_group'), margin, 20)

    pdf.setFontSize(12)
    pdf.setFont(PDF_FONT_FAMILY, 'normal')
    pdf.text(`${t('reports.sales.project_sales_report')} · ${projectReport.project.name}`, margin, 28)

    pdf.setTextColor(0, 0, 0)
    yPosition = 45

    pdf.setFontSize(10)
    pdf.text(`${rowLabel('reports.general.generated')} ${formatDateTime(new Date(), lang)}`, margin, yPosition)
    pdf.text(`${rowLabel('reports.sales.report_period')} ${period}`, margin, yPosition + 5)
    yPosition += 20

    yPosition = addText(t('reports.sales.project_overview'), margin, yPosition, { fontSize: 14, style: 'bold', color: [37, 99, 235] })
    yPosition += 5

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)
    pdf.setFont(PDF_FONT_FAMILY, 'normal')

    printRows([
      [rowLabel('reports.sales.location'), projectReport.project.location],
      [rowLabel('common.status'), statusLabel(PROJECT_STATUS, projectReport.project.status, t)],
      [rowLabel('reports.sales.start_date_label'), formatDate(projectReport.project.start_date, lang)],
      [rowLabel('reports.sales.budget'), pdfMoney(projectReport.project.budget)],
      [rowLabel('reports.sales.total_units_stat'), projectReport.total_units.toString()],
      [rowLabel('reports.sales.units_sold_label'), `${projectReport.sold_units} (${projectReport.sales_rate.toFixed(1)}%)`],
      [rowLabel('reports.general.available_units'), projectReport.available_units.toString()],
      [rowLabel('reports.general.reserved_units'), projectReport.reserved_units.toString()],
      [rowLabel('reports.sales.total_revenue'), pdfMoney(projectReport.total_revenue)],
      [rowLabel('reports.sales.average_price'), pdfMoney(projectReport.average_price)],
    ])

    yPosition += 15

    checkPageBreak(40)
    yPosition = addText(t('reports.sales.monthly_trend'), margin, yPosition, { fontSize: 14, style: 'bold', color: [37, 99, 235] })
    yPosition += 10

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)

    // A header row, because "12 units sold" does not survive translation as glue between a number
    // and a noun — Croatian declines the noun with the count. The three column keys already exist.
    checkPageBreak(6)
    pdf.setFont(PDF_FONT_FAMILY, 'bold')
    pdf.text(t('reports.sales.month_col'), margin + 5, yPosition)
    pdf.text(t('reports.sales.units_sold_col'), margin + 40, yPosition)
    pdf.text(t('reports.sales.revenue_col'), margin + 100, yPosition)
    yPosition += 6
    pdf.setFont(PDF_FONT_FAMILY, 'normal')

    projectReport.monthly_sales.forEach((month) => {
      checkPageBreak(6)
      pdf.text(formatMonthYear(month.month_key, lang), margin + 5, yPosition)
      pdf.text(month.units_sold.toString(), margin + 40, yPosition)
      pdf.text(pdfMoney(month.revenue), margin + 100, yPosition)
      yPosition += 6
    })

    yPosition += 15

    checkPageBreak(40)
    yPosition = addText(t('reports.sales.apartment_details'), margin, yPosition, { fontSize: 14, style: 'bold', color: [37, 99, 235] })
    yPosition += 10

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(9)
    pdf.setFont(PDF_FONT_FAMILY, 'normal')

    for (let i = 0; i < projectReport.apartments.length; i++) {
      const apt = projectReport.apartments[i]
      checkPageBreak(8)
      // The comparison stays on the English database value — only the label is translated.
      const statusColor = apt.status === 'Sold' ? [34, 197, 94] : apt.status === 'Reserved' ? [245, 158, 11] : [59, 130, 246]

      pdf.text(`${t('common.apartment')} ${apt.number} (${t('common.floor')} ${apt.floor}):`, margin + 5, yPosition)
      pdf.text(`${apt.size_m2} m²`, margin + 50, yPosition)
      pdf.text(pdfMoney(apt.price), margin + 80, yPosition)

      pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2])
      pdf.setFont(PDF_FONT_FAMILY, 'bold')
      pdf.text(statusLabel(UNIT_STATUS, apt.status, t), margin + 120, yPosition)
      pdf.setTextColor(0, 0, 0)
      pdf.setFont(PDF_FONT_FAMILY, 'normal')

      if (apt.buyer_name) {
        pdf.text(`(${apt.buyer_name})`, margin + 145, yPosition)
      }
      yPosition += 8

      if ((i + 1) % 25 === 0) await yieldToUI()
    }

  } else if (reportType === 'customer' && customerReport) {
    pdf.setFillColor(37, 99, 235)
    pdf.rect(0, 0, pageWidth, 35, 'F')

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(20)
    pdf.setFont(PDF_FONT_FAMILY, 'bold')
    pdf.text(t('reports.general.landmark_group'), margin, 20)

    pdf.setFontSize(12)
    pdf.setFont(PDF_FONT_FAMILY, 'normal')
    pdf.text(t('reports.sales.customer_report'), margin, 28)

    pdf.setTextColor(0, 0, 0)
    yPosition = 45

    pdf.setFontSize(10)
    pdf.text(`${rowLabel('reports.general.generated')} ${formatDateTime(new Date(), lang)}`, margin, yPosition)
    pdf.text(`${rowLabel('reports.sales.report_period')} ${period}`, margin, yPosition + 5)
    yPosition += 20

    yPosition = addText(t('reports.sales.customer_overview'), margin, yPosition, { fontSize: 14, style: 'bold', color: [37, 99, 235] })
    yPosition += 5

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)
    pdf.setFont(PDF_FONT_FAMILY, 'normal')

    const conversionRate = customerReport.total_customers > 0
      ? ((customerReport.buyers / customerReport.total_customers) * 100).toFixed(1)
      : '0'

    printRows([
      [rowLabel('reports.sales.total_customers_stat'), customerReport.total_customers.toString()],
      [rowLabel('reports.sales.buyers_label'), `${customerReport.buyers} (${conversionRate}%)`],
      [rowLabel('reports.sales.interested_label'), customerReport.interested.toString()],
      [rowLabel('reports.sales.leads_label'), customerReport.leads.toString()],
      [rowLabel('reports.sales.total_revenue'), pdfMoney(customerReport.total_revenue)],
      [rowLabel('reports.sales.avg_purchase_stat'), pdfMoney(customerReport.average_purchase)],
      [rowLabel('reports.general.conversion_rate_label'), `${conversionRate}%`],
    ])

    yPosition += 15

    checkPageBreak(20)
    yPosition = addText(t('reports.sales.customer_details'), margin, yPosition, { fontSize: 14, style: 'bold', color: [37, 99, 235] })
    yPosition += 10

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(9)
    pdf.setFont(PDF_FONT_FAMILY, 'normal')

    customerReport.customers.forEach((customer) => {
      checkPageBreak(8)
      // Same rule as the unit status above: compare the stored English value, render the label.
      const statusColor = customer.status === 'buyer' ? [34, 197, 94] : customer.status === 'interested' ? [59, 130, 246] : [245, 158, 11]

      // The columns sit further left than they did in English: "Potencijalni kupac" is twice the
      // width of "LEAD" and ran off the right edge where the status used to start.
      pdf.text(`${customer.name} ${customer.surname}`, margin + 5, yPosition)
      pdf.text(customer.email || t('reports.sales.no_email'), margin + 55, yPosition)
      pdf.text(customer.phone || t('reports.sales.no_phone'), margin + 112, yPosition)

      pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2])
      pdf.setFont(PDF_FONT_FAMILY, 'bold')
      pdf.text(statusLabel(CUSTOMER_STATUS, customer.status, t), pageWidth - margin, yPosition, { align: 'right' })
      pdf.setTextColor(0, 0, 0)
      pdf.setFont(PDF_FONT_FAMILY, 'normal')
      yPosition += 8
    })
  }

  addFooter()

  pdf.save(exportFileName(reportType === 'project' ? 'izvjestaj-prodaja' : 'izvjestaj-kupci', 'pdf'))

  logActivity({
    action: reportType === 'project' ? 'export.sales_pdf' : 'export.customer_pdf',
    entity: 'report',
    projectId: reportType === 'project' ? (projectReport?.project.id ?? null) : null,
    metadata: {
      severity: 'low',
      format: 'pdf',
      row_count: reportType === 'project'
        ? (projectReport?.apartments.length ?? 0)
        : (customerReport?.customers.length ?? 0),
      period_start: dateRange.start,
      period_end: dateRange.end,
    },
  })
}
