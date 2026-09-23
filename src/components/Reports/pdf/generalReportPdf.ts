import type { TFunction } from 'i18next'
import {
  drawBarChart,
  drawPieChart,
  drawLineChart,
  drawHorizontalBarChart,
  drawProgressBar,
  hexToRgb
} from './pdfCharts'
import { pdfMoneyRounded, pdfMoneyCompact } from './pdfText'
import type { ComprehensiveReport } from '../types'
import { PROJECT_CATEGORY_LABELS } from '../../../lib/supabase'
import {
  formatDate,
  formatDateTime,
  formatMonthShort,
  formatMonthYear
} from '../../../utils/formatters'
import { loadUnicodeFont, PDF_FONT_FAMILY } from '../../../utils/pdfFont'
import { RISK_LEVEL, statusLabel } from '../../../utils/statusDisplay'
import { exportFileName } from '../../../utils/downloadFile'
import { logActivity } from '../../../lib/activityLog'

/** Whole euros, for the aggregate figures this report is made of. */
const money = pdfMoneyRounded

/** Abbreviated euros (€1,2M / €45K), for the summary lines, KPI boxes and chart axes. */
const moneyCompact = pdfMoneyCompact

/**
 * The executive portfolio report.
 *
 * `t` is the **export** translator (`exportT()`), which is pinned to Croatian whatever the UI
 * language is — this document goes to a bank, and the recipient's language has nothing to do with
 * the language of whoever clicked Export. `language` goes to the date helpers for the same reason.
 *
 * Almost every label here is a key the screen (`Reports/GeneralReports.tsx`) already renders, so
 * the two cannot drift apart; only the PDF's own chrome — cover, page furniture, chart titles —
 * is new. Two shapes of key meet here, which is what `withColon` / `bare` are for: the screen's
 * grid labels mostly end in a colon ("Ukupno jedinica:"), its card labels mostly do not
 * ("Budžet"), and a progress-bar caption appends its own separator.
 */
export async function generateGeneralReportPDF(
  report: ComprehensiveReport,
  t: TFunction,
  language: string
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF('p', 'mm', 'a4')

  // No fallback: the WinAnsi built-ins have no `č`, `ć` or `đ`, and jsPDF answers one unmapped
  // character by re-encoding the whole string into noise. A failure means the font asset did not
  // ship; let it reach `useAsyncExport`, which tells the user, rather than emitting a document
  // with a company letterhead and garbage under it.
  await loadUnicodeFont(pdf)
  const fontFamily = PDF_FONT_FAMILY

  /** The label with exactly one trailing colon, whichever shape the key was written in. */
  const withColon = (key: string): string => {
    const text = t(key)
    return text.endsWith(':') ? text : `${text}:`
  }

  /** The label with no trailing colon — chart titles and progress-bar captions add their own. */
  const bare = (key: string): string => t(key).replace(/\s*:\s*$/, '')

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  let yPosition = margin

  const checkPageBreak = (height: number) => {
    if (yPosition + height > pageHeight - margin) {
      pdf.addPage()
      yPosition = margin
      return true
    }
    return false
  }

  /**
   * Centre a line, shrinking it until it fits between the margins.
   *
   * The cover was laid out around English at a fixed point size; "Sveobuhvatni izvještaj za
   * rukovodstvo" is half as long again as "Executive Portfolio Report" and ran off the page.
   */
  const centered = (text: string, y: number, size: number) => {
    const maxWidth = pageWidth - 2 * margin
    let fontSize = size
    pdf.setFontSize(fontSize)
    while (fontSize > 8 && pdf.getTextWidth(text) > maxWidth) {
      fontSize -= 1
      pdf.setFontSize(fontSize)
    }
    pdf.text(text, pageWidth / 2 - pdf.getTextWidth(text) / 2, y)
  }

  /**
   * A block of `[label, value]` or `[label, value, label, value]` rows.
   *
   * The value columns used to sit at hard-coded offsets that differed per block
   * (`margin + 35 / 45 / 50 / 55 / 125 / 145`), tuned to English. Croatian labels run longer —
   * "Ukupno podugovaratelja:" against "Total Subcontractors:", "Ukupna vrijednost investicija:"
   * against "Investment Value:" — and several of them overran their value outright. Each column
   * is now measured: the block keeps its intended shape when the labels are short and widens
   * instead of colliding when they are not. Set the font size before calling — `getTextWidth`
   * measures at whatever size the document is on.
   */
  const labelValueRows = (
    rows: string[][],
    opts: { x: number; y: number; step: number; col2?: number }
  ) => {
    const gap = 2
    const gutter = 6

    pdf.setFont(fontFamily, 'bold')
    const label1Width = Math.max(0, ...rows.map(row => pdf.getTextWidth(row[0] || '')))
    const label2Width = Math.max(0, ...rows.map(row => pdf.getTextWidth(row[2] || '')))
    pdf.setFont(fontFamily, 'normal')
    const value1Width = Math.max(0, ...rows.map(row => pdf.getTextWidth(row[1] || '')))

    const value1X = opts.x + label1Width + gap
    const col2X = Math.max(opts.col2 ?? 0, value1X + value1Width + gutter)
    const value2X = col2X + label2Width + gap

    rows.forEach((row, index) => {
      const y = opts.y + index * opts.step
      pdf.setFont(fontFamily, 'bold')
      pdf.text(row[0], opts.x, y)
      pdf.setFont(fontFamily, 'normal')
      pdf.text(row[1], value1X, y)
      if (row[2]) {
        pdf.setFont(fontFamily, 'bold')
        pdf.text(row[2], col2X, y)
        pdf.setFont(fontFamily, 'normal')
        pdf.text(row[3], value2X, y)
      }
    })
  }

  // ── Cover page ───────────────────────────────────────────────────────────
  pdf.setFillColor(15, 23, 42)
  pdf.rect(0, 0, pageWidth, pageHeight, 'F')

  pdf.setFillColor(37, 99, 235)
  pdf.rect(0, 0, 10, pageHeight, 'F')

  pdf.setTextColor(255, 255, 255)
  pdf.setFont(fontFamily, 'bold')
  centered('LANDMARK', 80, 48)
  centered('GROUP', 95, 48)

  pdf.setFont(fontFamily, 'normal')
  centered(t('reports.general.exec_report'), 120, 24)

  pdf.setDrawColor(37, 99, 235)
  pdf.setLineWidth(1)
  pdf.line(pageWidth / 2 - 40, 125, pageWidth / 2 + 40, 125)

  pdf.setTextColor(200, 200, 200)
  centered(t('reports.general.pdf.period', { period: formatMonthYear(new Date(), language) }), 145, 14)
  centered(`${withColon('common.generated')} ${formatDate(new Date(), language)}`, 155, 14)

  const summaryStats = [
    t('reports.general.pdf.cover_projects', { count: report.executive_summary.total_projects }),
    t('reports.general.pdf.cover_revenue', { value: moneyCompact(report.executive_summary.total_revenue) }),
    t('reports.general.pdf.cover_roi', { value: report.kpis.roi.toFixed(1) })
  ]
  centered(summaryStats.join('  |  '), 180, 12)

  pdf.setTextColor(150, 150, 150)
  centered(t('common.pdf.confidential'), pageHeight - 30, 10)

  // ── Page 2: KPIs ─────────────────────────────────────────────────────────
  pdf.addPage()
  yPosition = margin

  pdf.setFillColor(15, 23, 42)
  pdf.rect(0, 0, pageWidth, 55, 'F')

  pdf.setFillColor(37, 99, 235)
  pdf.rect(0, 0, 8, 55, 'F')

  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(32)
  pdf.setFont(fontFamily, 'bold')
  pdf.text(t('reports.general.landmark_group'), margin, 22)

  pdf.setFontSize(16)
  pdf.setFont(fontFamily, 'normal')
  pdf.text(t('reports.general.exec_report'), margin, 33)

  pdf.setFontSize(10)
  pdf.setTextColor(200, 200, 200)
  pdf.text(`${withColon('common.generated')} ${formatDateTime(new Date(), language)}`, margin, 43)

  pdf.setTextColor(0, 0, 0)
  yPosition = 65

  pdf.setFillColor(240, 245, 250)
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'F')

  pdf.setFontSize(14)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text(t('reports.general.exec_summary'), margin + 5, yPosition + 10)

  pdf.setFontSize(9)
  pdf.setFont(fontFamily, 'normal')
  pdf.setTextColor(0, 0, 0)

  const salesRatePercent = report.sales_performance.total_units > 0
    ? (report.sales_performance.units_sold / report.sales_performance.total_units) * 100
    : 0

  // Whole sentences, not `t()` output with English glue welded on: Croatian word order differs,
  // so each line has to be translatable as a unit. The screen renders these same five keys.
  const summaryLines = [
    t('reports.general.summary_portfolio', {
      total: report.executive_summary.total_projects,
      active: report.executive_summary.active_projects,
      completed: report.executive_summary.completed_projects
    }),
    t('reports.general.summary_financial', {
      revenue: moneyCompact(report.executive_summary.total_revenue),
      expenses: moneyCompact(report.executive_summary.total_expenses),
      profit: moneyCompact(report.executive_summary.total_profit),
      margin: report.executive_summary.profit_margin.toFixed(1)
    }),
    t('reports.general.summary_capital', {
      equity: moneyCompact(report.funding_structure.total_equity),
      debt: moneyCompact(report.funding_structure.total_debt),
      ratio: report.funding_structure.debt_equity_ratio.toFixed(2)
    }),
    t('reports.general.summary_sales', {
      sold: report.sales_performance.units_sold,
      total: report.sales_performance.total_units,
      rate: salesRatePercent.toFixed(1),
      transactions: report.sales_performance.total_sales
    }),
    t('reports.general.summary_construction', {
      contracts: report.construction_status.total_contracts,
      subcontractors: report.construction_status.total_subcontractors,
      logs: report.construction_status.work_logs_7days
    })
  ]

  summaryLines.forEach((line, index) => {
    pdf.text(`• ${line}`, margin + 5, yPosition + 20 + (index * 6))
  })

  yPosition += 60

  checkPageBreak(40)
  pdf.setFontSize(14)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text(t('reports.general.kpi_title'), margin, yPosition)
  yPosition += 10

  const kpiData = [
    [moneyCompact(report.kpis.portfolio_value), bare('reports.general.portfolio_value')],
    [moneyCompact(report.kpis.total_revenue), bare('reports.general.total_revenue')],
    [moneyCompact(report.kpis.net_profit), bare('reports.general.net_profit')],
    [report.kpis.roi.toFixed(1) + '%', bare('reports.general.roi')],
    [report.kpis.sales_rate.toFixed(1) + '%', bare('reports.general.sales_rate')],
    [report.kpis.debt_equity_ratio.toFixed(2), bare('reports.general.de_ratio')],
    [report.kpis.active_projects.toString(), bare('reports.general.active_projects')],
    [report.kpis.total_customers.toString(), bare('reports.general.total_customers')]
  ]

  const kpiBoxWidth = 45
  const kpiBoxHeight = 20
  let xPos = margin

  kpiData.forEach((kpi, index) => {
    if (index > 0 && index % 4 === 0) {
      xPos = margin
      yPosition += kpiBoxHeight + 5
    }

    pdf.setFillColor(240, 245, 250)
    pdf.rect(xPos, yPosition, kpiBoxWidth, kpiBoxHeight, 'F')

    pdf.setFontSize(16)
    pdf.setFont(fontFamily, 'bold')
    pdf.setTextColor(37, 99, 235)
    let kpiTextWidth = pdf.getTextWidth(kpi[0])
    pdf.text(kpi[0], xPos + kpiBoxWidth / 2 - kpiTextWidth / 2, yPosition + 10)

    // The label is the longer half in Croatian ("Vrijednost portfelja" against "Portfolio
    // Value"), so it shrinks to the box rather than spilling into its neighbour.
    let labelSize = 8
    pdf.setFontSize(labelSize)
    pdf.setFont(fontFamily, 'normal')
    while (labelSize > 5 && pdf.getTextWidth(kpi[1]) > kpiBoxWidth - 4) {
      labelSize -= 0.5
      pdf.setFontSize(labelSize)
    }
    pdf.setTextColor(100, 100, 100)
    kpiTextWidth = pdf.getTextWidth(kpi[1])
    pdf.text(kpi[1], xPos + kpiBoxWidth / 2 - kpiTextWidth / 2, yPosition + 16)

    xPos += kpiBoxWidth + 2
  })

  yPosition += 30

  // ── Analytics page ────────────────────────────────────────────────────────
  pdf.addPage()
  yPosition = margin

  pdf.setFontSize(16)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text(t('reports.general.pdf.portfolio_analytics'), margin, yPosition)
  yPosition += 10

  const fundingChartData = [
    { label: t('reports.general.pdf.equity'), value: report.funding_structure.total_equity, color: '#22c55e' },
    { label: t('reports.general.pdf.debt'), value: report.funding_structure.total_debt, color: '#ef4444' }
  ]
  drawPieChart(pdf, margin + 30, yPosition + 30, 25, fundingChartData, {
    title: t('reports.general.pdf.chart_capital_structure'),
    showLegend: true,
    fontFamily
  })

  const salesChartData = [
    { label: t('status.sold'), value: report.sales_performance.units_sold, color: '#22c55e' },
    { label: t('status.reserved'), value: report.sales_performance.reserved_units, color: '#f59e0b' },
    { label: t('status.available'), value: report.sales_performance.available_units, color: '#6b7280' }
  ]
  drawPieChart(pdf, pageWidth - margin - 30, yPosition + 30, 25, salesChartData, {
    title: t('reports.general.pdf.chart_units_status'),
    showLegend: true,
    valueFormat: 'plain',
    fontFamily
  })

  yPosition += 85

  checkPageBreak(60)
  const cashFlowData = report.cash_flow.slice(0, 6).map(m => ({
    label: formatMonthShort(m.month_key, language),
    value: m.net / 1000
  }))
  drawBarChart(pdf, margin, yPosition, pageWidth - 2 * margin, 50, cashFlowData, {
    title: t('reports.general.pdf.chart_net_cash_flow'),
    color: '#2563eb',
    showValues: true,
    fontFamily
  })

  yPosition += 60

  checkPageBreak(60)
  const topProjectsChart = report.projects
    .slice()
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map(p => ({
      label: p.name.substring(0, 15),
      value: p.revenue / 1000000,
      color: p.profit_margin > 20 ? '#22c55e' : p.profit_margin > 10 ? '#f59e0b' : '#ef4444'
    }))

  if (topProjectsChart.length > 0) {
    drawHorizontalBarChart(pdf, margin + 50, yPosition, pageWidth - 2 * margin - 50, 50, topProjectsChart, {
      title: t('reports.general.pdf.chart_top_projects'),
      showValues: true,
      fontFamily
    })
    yPosition += 60
  }

  // ── Sales Performance page ────────────────────────────────────────────────
  pdf.addPage()
  yPosition = margin

  pdf.setFillColor(22, 163, 74)
  pdf.rect(0, 0, pageWidth, 45, 'F')
  pdf.setFillColor(21, 128, 61)
  pdf.rect(0, 0, 8, 45, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(20)
  pdf.setFont(fontFamily, 'bold')
  pdf.text(t('reports.general.sales_performance'), margin, 25)
  pdf.setTextColor(0, 0, 0)
  yPosition = 55

  pdf.setFillColor(220, 252, 231)
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 40, 'F')
  pdf.setFontSize(14)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(22, 163, 74)
  pdf.text(t('reports.general.pdf.sales_overview'), margin + 5, yPosition + 10)
  pdf.setFontSize(9)
  pdf.setFont(fontFamily, 'normal')
  pdf.setTextColor(0, 0, 0)

  const salesData = [
    [withColon('reports.general.total_units_label'), report.sales_performance.total_units.toString(), withColon('reports.general.avg_sale_price_label'), money(report.sales_performance.avg_sale_price)],
    [withColon('reports.general.units_sold_label'), `${report.sales_performance.units_sold} (${salesRatePercent.toFixed(1)}%)`, withColon('reports.general.total_sales_label'), report.sales_performance.total_sales.toString()],
    [withColon('reports.general.available_label'), report.sales_performance.available_units.toString(), withColon('reports.general.buyers_label'), report.sales_performance.buyers.toString()],
    [withColon('reports.general.reserved_label'), report.sales_performance.reserved_units.toString(), withColon('reports.general.active_leads_label'), report.sales_performance.active_leads.toString()],
    [withColon('reports.general.total_revenue_label'), money(report.sales_performance.total_revenue), withColon('reports.general.conversion_rate_label'), report.sales_performance.conversion_rate.toFixed(1) + '%']
  ]

  labelValueRows(salesData, { x: margin + 5, y: yPosition + 18, step: 4, col2: margin + 95 })

  yPosition += 50

  checkPageBreak(40)
  pdf.setFontSize(12)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text(t('reports.general.pdf.sales_progress'), margin, yPosition)
  yPosition += 8

  drawProgressBar(pdf, margin, yPosition, pageWidth - 2 * margin, 8, salesRatePercent, {
    label: bare('reports.general.units_sold_label'),
    color: '#22c55e',
    showPercentage: true,
    fontFamily
  })
  yPosition += 15

  pdf.setFontSize(12)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text(t('reports.general.pdf.construction_progress'), margin, yPosition)
  yPosition += 8

  const constructionProgress = report.construction_status.total_phases > 0
    ? (report.construction_status.completed_phases / report.construction_status.total_phases) * 100
    : 0
  drawProgressBar(pdf, margin, yPosition, pageWidth - 2 * margin, 8, constructionProgress, {
    label: bare('reports.general.completed_phases'),
    color: '#2563eb',
    showPercentage: true,
    fontFamily
  })
  yPosition += 15

  pdf.setFontSize(12)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text(bare('reports.general.budget_utilization'), margin, yPosition)
  yPosition += 8

  drawProgressBar(pdf, margin, yPosition, pageWidth - 2 * margin, 8, report.construction_status.budget_utilization, {
    label: bare('reports.general.budget_realized'),
    color: report.construction_status.budget_utilization > 90 ? '#ef4444' : '#f59e0b',
    showPercentage: true,
    fontFamily
  })
  yPosition += 20

  // ── Funding & Finance page ────────────────────────────────────────────────
  pdf.addPage()
  yPosition = margin

  pdf.setFillColor(245, 158, 11)
  pdf.rect(0, 0, pageWidth, 45, 'F')
  pdf.setFillColor(180, 83, 9)
  pdf.rect(0, 0, 8, 45, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(18)
  pdf.setFont(fontFamily, 'bold')
  pdf.text(t('reports.general.funding_structure'), margin, 25)
  pdf.setTextColor(0, 0, 0)
  yPosition = 55

  pdf.setFillColor(254, 243, 199)
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'F')
  pdf.setFontSize(14)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(245, 158, 11)
  pdf.text(t('reports.general.pdf.financial_structure'), margin + 5, yPosition + 10)
  pdf.setFontSize(9)
  pdf.setFont(fontFamily, 'normal')
  pdf.setTextColor(0, 0, 0)

  const fundingData = [
    [withColon('reports.general.total_equity'), money(report.funding_structure.total_equity), withColon('reports.general.active_funders'), report.funding_structure.active_investors.toString()],
    [withColon('reports.general.total_debt'), money(report.funding_structure.total_debt), withColon('reports.general.active_banks'), report.funding_structure.active_banks.toString()],
    [withColon('reports.general.de_ratio_label'), report.funding_structure.debt_equity_ratio.toFixed(2), withColon('reports.general.bank_credits'), report.funding_structure.bank_credits.toString()],
    [withColon('reports.general.total_credit_lines'), money(report.funding_structure.total_credit_lines), withColon('reports.general.avg_interest'), report.funding_structure.avg_interest_rate.toFixed(2) + '%'],
    [withColon('reports.general.available_credit'), money(report.funding_structure.available_credit), withColon('reports.general.monthly_debt_service'), money(report.funding_structure.monthly_debt_service)]
  ]

  labelValueRows(fundingData, { x: margin + 5, y: yPosition + 18, step: 5, col2: margin + 100 })

  yPosition += 60

  // ── Construction Status page ──────────────────────────────────────────────
  pdf.addPage()
  yPosition = margin

  pdf.setFillColor(239, 68, 68)
  pdf.rect(0, 0, pageWidth, 45, 'F')
  pdf.setFillColor(185, 28, 28)
  pdf.rect(0, 0, 8, 45, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(20)
  pdf.setFont(fontFamily, 'bold')
  pdf.text(t('reports.general.construction_status'), margin, 25)
  pdf.setTextColor(0, 0, 0)
  yPosition = 55

  pdf.setFillColor(254, 226, 226)
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'F')
  pdf.setFontSize(14)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(220, 38, 38)
  pdf.text(t('reports.general.pdf.construction_overview'), margin + 5, yPosition + 10)
  pdf.setFontSize(9)
  pdf.setFont(fontFamily, 'normal')
  pdf.setTextColor(0, 0, 0)

  const constructionData = [
    [withColon('reports.general.total_contracts'), report.construction_status.total_contracts.toString(), withColon('reports.general.budget_utilization'), report.construction_status.budget_utilization.toFixed(1) + '%'],
    [withColon('reports.general.active_contracts'), report.construction_status.active_contracts.toString(), withColon('reports.general.total_subcontractors'), report.construction_status.total_subcontractors.toString()],
    [withColon('reports.general.completed_contracts'), report.construction_status.completed_contracts.toString(), withColon('reports.general.total_phases'), report.construction_status.total_phases.toString()],
    [withColon('reports.general.contract_value'), money(report.construction_status.contract_value), withColon('reports.general.completed_phases'), report.construction_status.completed_phases.toString()],
    [withColon('reports.general.budget_realized'), money(report.construction_status.budget_realized), withColon('reports.general.work_logs_7days'), report.construction_status.work_logs_7days.toString()]
  ]

  labelValueRows(constructionData, { x: margin + 5, y: yPosition + 18, step: 5, col2: margin + 95 })

  yPosition += 60

  // ── Accounting Overview page ──────────────────────────────────────────────
  pdf.addPage()
  yPosition = margin

  pdf.setFillColor(6, 182, 212)
  pdf.rect(0, 0, pageWidth, 45, 'F')
  pdf.setFillColor(8, 145, 178)
  pdf.rect(0, 0, 8, 45, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(20)
  pdf.setFont(fontFamily, 'bold')
  pdf.text(t('reports.general.accounting_overview'), margin, 25)
  pdf.setTextColor(0, 0, 0)
  yPosition = 55

  pdf.setFillColor(224, 242, 254)
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 60, 'F')
  pdf.setFontSize(14)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(6, 182, 212)
  pdf.text(t('reports.general.pdf.invoice_payment_summary'), margin + 5, yPosition + 10)
  pdf.setFontSize(9)
  pdf.setFont(fontFamily, 'normal')
  pdf.setTextColor(0, 0, 0)

  const accountingData = [
    [withColon('reports.general.total_invoices'), report.accounting_overview.total_invoices.toString(), withColon('reports.general.paid_invoices'), report.accounting_overview.paid_invoices.toString()],
    [withColon('reports.general.total_invoice_value'), moneyCompact(report.accounting_overview.total_invoice_value), withColon('reports.general.pdf.paid_value'), moneyCompact(report.accounting_overview.paid_value)],
    [withColon('reports.general.pending_invoices'), report.accounting_overview.pending_invoices.toString(), withColon('reports.general.overdue_invoices'), report.accounting_overview.overdue_invoices.toString()],
    [withColon('reports.general.pdf.pending_value'), moneyCompact(report.accounting_overview.pending_value), withColon('reports.general.pdf.overdue_value'), moneyCompact(report.accounting_overview.overdue_value)],
    [withColon('reports.general.payment_completion'), report.accounting_overview.payment_completion_rate.toFixed(1) + '%', '', '']
  ]

  labelValueRows(accountingData, { x: margin + 5, y: yPosition + 18, step: 6, col2: margin + 100 })

  yPosition += 50

  checkPageBreak(70)
  pdf.setFontSize(12)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text(t('reports.general.pdf.invoice_status_distribution'), margin, yPosition)
  yPosition += 8

  const invoiceStatusData = [
    { label: t('status.paid'), value: report.accounting_overview.paid_invoices },
    { label: t('status.pending'), value: report.accounting_overview.pending_invoices },
    { label: t('status.overdue'), value: report.accounting_overview.overdue_invoices }
  ]
  drawBarChart(pdf, margin, yPosition, pageWidth - 2 * margin, 45, invoiceStatusData, {
    color: '#06b6d4',
    showValues: true,
    valueFormat: 'plain',
    fontFamily
  })
  yPosition += 55

  checkPageBreak(25)
  pdf.setFontSize(12)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text(bare('reports.general.payment_completion'), margin, yPosition)
  yPosition += 8

  drawProgressBar(pdf, margin, yPosition, pageWidth - 2 * margin, 8, report.accounting_overview.payment_completion_rate, {
    color: '#06b6d4',
    showPercentage: true,
    fontFamily
  })
  yPosition += 20

  checkPageBreak(100)
  const halfWidth = (pageWidth - 2 * margin - 5) / 2

  pdf.setFillColor(209, 250, 229)
  pdf.rect(margin, yPosition, halfWidth, 45, 'F')
  pdf.setFontSize(11)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(16, 185, 129)
  pdf.text(t('reports.general.pdf.tic_cost_management'), margin + 5, yPosition + 10)
  pdf.setFontSize(8)
  pdf.setFont(fontFamily, 'normal')
  pdf.setTextColor(0, 0, 0)

  const ticData = [
    [withColon('reports.general.pdf.planned_investment'), money(report.tic_cost_management.total_tic_budget)],
    [withColon('reports.general.pdf.projects_with_plan'), report.tic_cost_management.projects_with_tic.toString()],
    [withColon('reports.general.pdf.projects_without_plan'), report.tic_cost_management.projects_without_tic.toString()]
  ]

  labelValueRows(ticData, { x: margin + 5, y: yPosition + 16, step: 5 })

  pdf.setFillColor(254, 243, 199)
  pdf.rect(margin + halfWidth + 5, yPosition, halfWidth, 45, 'F')
  pdf.setFontSize(11)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(245, 158, 11)
  pdf.text(t('reports.general.office_expenses'), margin + halfWidth + 10, yPosition + 10)
  pdf.setFontSize(8)
  pdf.setFont(fontFamily, 'normal')
  pdf.setTextColor(0, 0, 0)

  const officeData = [
    [withColon('reports.general.total_office_suppliers'), report.office_expenses.total_office_suppliers.toString()],
    [withColon('reports.general.total_office_invoices'), report.office_expenses.total_office_invoices.toString()],
    [withColon('reports.general.total_office_spent'), money(report.office_expenses.total_office_spent)],
    [withColon('reports.general.avg_office_invoice'), money(report.office_expenses.avg_office_invoice)]
  ]

  labelValueRows(officeData, { x: margin + halfWidth + 10, y: yPosition + 16, step: 5 })

  yPosition += 55

  checkPageBreak(100)
  pdf.setFillColor(254, 205, 211)
  pdf.rect(margin, yPosition, halfWidth, 50, 'F')
  pdf.setFontSize(11)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(225, 29, 72)
  pdf.text(t('reports.general.company_investments'), margin + 5, yPosition + 10)
  pdf.setFontSize(8)
  pdf.setFont(fontFamily, 'normal')
  pdf.setTextColor(0, 0, 0)

  const creditsData = [
    [withColon('reports.general.total_investments_label'), report.company_credits.total_credits.toString()],
    [withColon('reports.general.total_investment_value'), money(report.company_credits.total_credit_value)],
    [withColon('reports.general.available_inv'), money(report.company_credits.credits_available)],
    [withColon('reports.general.used_inv'), money(report.company_credits.credits_used)],
    [withColon('reports.general.cesija_payments'), report.company_credits.cesija_payments.toString()],
    [withColon('reports.general.cesija_value'), money(report.company_credits.cesija_value)]
  ]

  labelValueRows(creditsData, { x: margin + 5, y: yPosition + 16, step: 5 })

  pdf.setFillColor(241, 245, 249)
  pdf.rect(margin + halfWidth + 5, yPosition, halfWidth, 50, 'F')
  pdf.setFontSize(11)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(71, 85, 105)
  pdf.text(t('reports.general.bank_accounts'), margin + halfWidth + 10, yPosition + 10)
  pdf.setFontSize(8)
  pdf.setFont(fontFamily, 'normal')
  pdf.setTextColor(0, 0, 0)

  const bankData = [
    [withColon('reports.general.total_bank_accounts'), report.bank_accounts.total_accounts.toString()],
    [withColon('reports.general.total_balance'), money(report.bank_accounts.total_balance)],
    [withColon('reports.general.positive_accounts'), report.bank_accounts.positive_balance_accounts.toString()],
    [withColon('reports.general.negative_accounts'), report.bank_accounts.negative_balance_accounts.toString()]
  ]

  labelValueRows(bankData, { x: margin + halfWidth + 10, y: yPosition + 16, step: 5 })

  yPosition += 60

  if (report.contract_types.length > 0) {
    checkPageBreak(60)
    pdf.setFontSize(14)
    pdf.setFont(fontFamily, 'bold')
    pdf.setTextColor(37, 99, 235)
    pdf.text(t('reports.general.contract_types'), margin, yPosition)
    yPosition += 8

    const contractData = report.contract_types.map((ct, idx) => ({
      label: ct.name.substring(0, 12),
      value: ct.count,
      color: ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][idx % 6]
    }))

    if (contractData.length <= 6) {
      drawPieChart(pdf, pageWidth / 2, yPosition + 35, 28, contractData, { showLegend: true, valueFormat: 'plain', fontFamily })
      yPosition += 80
    } else {
      drawBarChart(pdf, margin, yPosition, pageWidth - 2 * margin, 45, contractData.map(cd => ({ label: cd.label, value: cd.value })), {
        color: '#2563eb',
        showValues: true,
        valueFormat: 'plain',
        fontFamily
      })
      yPosition += 55
    }
  }

  checkPageBreak(70)
  pdf.setFontSize(14)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text(t('reports.general.pdf.cash_flow_trend'), margin, yPosition)
  yPosition += 8

  const cashFlowTrend = report.cash_flow.slice(0, 6).map(m => ({
    label: formatMonthShort(m.month_key, language),
    value: m.net / 1000
  }))
  drawLineChart(pdf, margin, yPosition, pageWidth - 2 * margin, 50, cashFlowTrend, {
    color: '#2563eb',
    showPoints: true,
    fillArea: true,
    fontFamily
  })
  yPosition += 60

  checkPageBreak(60)
  pdf.setFontSize(14)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text(t('reports.general.cash_flow'), margin, yPosition)
  yPosition += 10

  pdf.setFillColor(240, 240, 240)
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F')
  pdf.setFontSize(9)
  pdf.setFont(fontFamily, 'bold')
  pdf.text(t('reports.general.month_col'), margin + 5, yPosition + 5)
  pdf.text(t('reports.general.inflow_col'), margin + 50, yPosition + 5)
  pdf.text(t('reports.general.outflow_col'), margin + 90, yPosition + 5)
  pdf.text(t('reports.general.net_col'), margin + 130, yPosition + 5)
  yPosition += 10

  pdf.setFont(fontFamily, 'normal')
  let totalInflow = 0
  let totalOutflow = 0
  let totalNet = 0

  report.cash_flow.forEach((month, index) => {
    totalInflow += month.inflow
    totalOutflow += month.outflow
    totalNet += month.net

    pdf.text(formatMonthYear(month.month_key, language), margin + 5, yPosition + (index * 5))
    pdf.text(moneyCompact(month.inflow), margin + 50, yPosition + (index * 5))
    pdf.text(moneyCompact(month.outflow), margin + 90, yPosition + (index * 5))

    pdf.setTextColor(month.net >= 0 ? 22 : 220, month.net >= 0 ? 163 : 38, month.net >= 0 ? 74 : 38)
    pdf.text(moneyCompact(month.net), margin + 130, yPosition + (index * 5))
    pdf.setTextColor(0, 0, 0)
  })

  yPosition += report.cash_flow.length * 5 + 5
  pdf.setFont(fontFamily, 'bold')
  pdf.text(t('reports.general.six_month_totals'), margin + 5, yPosition)
  const totalsLine = [
    `${withColon('reports.general.inflow_col')} ${moneyCompact(totalInflow)}`,
    `${withColon('reports.general.outflow_col')} ${moneyCompact(totalOutflow)}`,
    `${withColon('reports.general.net_col')} ${moneyCompact(totalNet)}`
  ].join(' | ')
  pdf.text(totalsLine, margin + 5, yPosition + 5)
  yPosition += 15

  // ── Project Portfolio page ────────────────────────────────────────────────
  if (report.projects.length > 0) {
    pdf.addPage()
    yPosition = margin

    pdf.setFillColor(15, 23, 42)
    pdf.rect(0, 0, pageWidth, 45, 'F')
    pdf.setFillColor(37, 99, 235)
    pdf.rect(0, 0, 8, 45, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(20)
    pdf.setFont(fontFamily, 'bold')
    pdf.text(t('reports.general.pdf.project_portfolio'), margin, 25)
    pdf.setTextColor(0, 0, 0)
    yPosition = 55

    pdf.setFontSize(14)
    pdf.setFont(fontFamily, 'bold')
    pdf.setTextColor(37, 99, 235)
    pdf.text(t('reports.general.pdf.project_performance'), margin, yPosition)
    yPosition += 10

    const projectPerformance = report.projects
      .slice()
      .sort((a, b) => b.profit_margin - a.profit_margin)
      .slice(0, 8)
      .map(p => ({
        label: p.name.substring(0, 15),
        value: p.profit_margin,
        color: p.profit_margin > 20 ? '#22c55e' : p.profit_margin > 10 ? '#f59e0b' : '#ef4444'
      }))

    if (projectPerformance.length > 0) {
      drawHorizontalBarChart(pdf, margin + 50, yPosition, pageWidth - 2 * margin - 50, 70, projectPerformance, {
        title: t('reports.general.pdf.chart_profit_margin'),
        showValues: true,
        valueFormat: 'plain',
        fontFamily
      })
      yPosition += 80
    }

    checkPageBreak(15)
    pdf.setFontSize(14)
    pdf.setFont(fontFamily, 'bold')
    pdf.setTextColor(37, 99, 235)
    pdf.text(t('reports.general.project_breakdown'), margin, yPosition)
    yPosition += 10

    report.projects.forEach((project, idx) => {
      checkPageBreak(55)

      pdf.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255)
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'F')

      pdf.setDrawColor(37, 99, 235)
      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, margin, yPosition + 50)

      pdf.setFontSize(12)
      pdf.setFont(fontFamily, 'bold')
      pdf.setTextColor(0, 0, 0)
      pdf.text(project.name, margin + 5, yPosition + 7)

      pdf.setFontSize(8)
      pdf.setFont(fontFamily, 'normal')
      pdf.setTextColor(100, 100, 100)
      // Category labels are Croatian domain terms; kept untranslated, and appended
      // to the location line so the fixed 50mm card height still holds.
      pdf.text(
        project.category
          ? `${project.location}  ·  ${PROJECT_CATEGORY_LABELS[project.category]}`
          : project.location,
        margin + 5,
        yPosition + 12
      )

      const riskColor = project.risk_level === 'High' ? '#ef4444' : project.risk_level === 'Medium' ? '#f59e0b' : '#22c55e'
      const riskBg = hexToRgb(riskColor)
      pdf.setFillColor(riskBg.r, riskBg.g, riskBg.b)
      pdf.roundedRect(pageWidth - margin - 25, yPosition + 4, 20, 6, 2, 2, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(7)
      pdf.setFont(fontFamily, 'bold')
      // The stored value stays English ('Low' / 'Medium' / 'High'); only the label is mapped.
      const riskText = statusLabel(RISK_LEVEL, project.risk_level, t)
      const riskTextWidth = pdf.getTextWidth(riskText)
      pdf.text(riskText, pageWidth - margin - 15 - riskTextWidth / 2, yPosition + 8.5)

      pdf.setTextColor(0, 0, 0)
      pdf.setFontSize(9)
      pdf.setFont(fontFamily, 'normal')

      const projectData = [
        [withColon('reports.general.budget_label'), project.has_budget ? moneyCompact(project.budget) : t('general_projects.budget_not_set'), withColon('reports.general.revenue_label'), moneyCompact(project.revenue)],
        [withColon('reports.general.expenses_label'), moneyCompact(project.expenses), withColon('reports.portfolio.profit'), moneyCompact(project.profit)],
        [withColon('reports.general.units_label'), `${project.units_sold}/${project.total_units}`, withColon('reports.general.sales_rate'), `${project.sales_rate.toFixed(1)}%`],
        [withColon('reports.general.phases_label'), `${project.phases_done}/${project.total_phases}`, withColon('reports.general.contracts_label'), project.contracts.toString()]
      ]

      labelValueRows(projectData, { x: margin + 5, y: yPosition + 20, step: 6, col2: margin + 70 })

      drawProgressBar(pdf, margin + 5, yPosition + 44, pageWidth - 2 * margin - 10, 4, project.profit_margin, {
        color: project.profit_margin > 20 ? '#22c55e' : project.profit_margin > 10 ? '#f59e0b' : '#ef4444',
        showPercentage: false,
        fontFamily
      })

      yPosition += 55
    })
  }

  // ── Risk Assessment page ──────────────────────────────────────────────────
  if (report.risks.length > 0) {
    pdf.addPage()
    yPosition = margin

    pdf.setFillColor(220, 38, 38)
    pdf.rect(0, 0, pageWidth, 45, 'F')
    pdf.setFillColor(127, 29, 29)
    pdf.rect(0, 0, 8, 45, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(20)
    pdf.setFont(fontFamily, 'bold')
    pdf.text(t('reports.general.risk_assessment'), margin, 25)
    pdf.setTextColor(0, 0, 0)
    yPosition = 55

    report.risks.forEach((risk) => {
      checkPageBreak(25)

      pdf.setFillColor(254, 226, 226)
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 20, 'F')
      pdf.setDrawColor(220, 38, 38)
      pdf.setLineWidth(1)
      pdf.line(margin, yPosition, margin, yPosition + 20)

      pdf.setFontSize(11)
      pdf.setFont(fontFamily, 'bold')
      pdf.setTextColor(220, 38, 38)
      pdf.text(t(`reports.general.risks.${risk.kind}.type`), margin + 5, yPosition + 8)

      pdf.setFontSize(9)
      pdf.setFont(fontFamily, 'normal')
      pdf.setTextColor(0, 0, 0)
      pdf.text(
        t(`reports.general.risks.${risk.kind}.description`, { count: risk.count }),
        margin + 5,
        yPosition + 15
      )

      yPosition += 25
    })
    yPosition += 5
  }

  // ── Insights & Recommendations page ───────────────────────────────────────
  pdf.addPage()
  yPosition = margin

  pdf.setFillColor(22, 163, 74)
  pdf.rect(0, 0, pageWidth, 45, 'F')
  pdf.setFillColor(21, 128, 61)
  pdf.rect(0, 0, 8, 45, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(18)
  pdf.setFont(fontFamily, 'bold')
  pdf.text(t('reports.general.insights'), margin, 25)
  pdf.setTextColor(0, 0, 0)
  yPosition = 55

  pdf.setFillColor(220, 252, 231)
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 12, 'F')
  pdf.setFontSize(12)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(22, 163, 74)
  pdf.text(bare('reports.general.top_projects'), margin + 5, yPosition + 8)
  yPosition += 15

  pdf.setFontSize(9)
  pdf.setFont(fontFamily, 'normal')
  pdf.setTextColor(0, 0, 0)

  report.insights.top_projects.forEach((project, index) => {
    checkPageBreak(12)
    pdf.setFont(fontFamily, 'bold')
    pdf.text(`${index + 1}. ${project.name}`, margin + 5, yPosition)
    pdf.setFont(fontFamily, 'normal')
    const detail = [
      `${withColon('reports.general.revenue_label')} ${moneyCompact(project.revenue)}`,
      `${withColon('reports.general.sales_rate')} ${project.sales_rate.toFixed(1)}%`
    ].join(' | ')
    pdf.text(detail, margin + 10, yPosition + 5)
    yPosition += 10
  })

  yPosition += 5

  pdf.setFillColor(220, 252, 231)
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 12, 'F')
  pdf.setFontSize(12)
  pdf.setFont(fontFamily, 'bold')
  pdf.setTextColor(22, 163, 74)
  pdf.text(bare('reports.general.recommendations'), margin + 5, yPosition + 8)
  yPosition += 15

  pdf.setFontSize(9)
  pdf.setFont(fontFamily, 'normal')
  pdf.setTextColor(0, 0, 0)

  // The service hands over i18n keys, not prose: it has no translator and must not decide the
  // language of a document. `GeneralReports.tsx` renders the same list.
  report.insights.recommendation_keys.forEach((key) => {
    checkPageBreak(10)
    pdf.setFillColor(240, 253, 244)
    pdf.rect(margin + 2, yPosition - 3, 3, 3, 'F')
    pdf.text(t(key), margin + 8, yPosition)
    yPosition += 7
  })

  // ── Footer on all pages ───────────────────────────────────────────────────
  const totalPages = pdf.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)

    pdf.setDrawColor(37, 99, 235)
    pdf.setLineWidth(0.5)
    pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15)

    pdf.setFontSize(8)
    pdf.setTextColor(100, 100, 100)
    pdf.setFont(fontFamily, 'normal')
    pdf.text(t('reports.general.landmark_group'), margin, pageHeight - 10)
    pdf.text(t('reports.general.pdf.footer'), margin, pageHeight - 6)

    pdf.setFont(fontFamily, 'bold')
    const pageText = t('common.pdf.page_of', { page: i, total: totalPages })
    pdf.text(pageText, pageWidth - margin - pdf.getTextWidth(pageText), pageHeight - 10)
    pdf.setFont(fontFamily, 'normal')
    const dateText = formatDate(new Date(), language)
    pdf.text(dateText, pageWidth - margin - pdf.getTextWidth(dateText), pageHeight - 6)
  }

  pdf.save(exportFileName('izvjestaj-portfelj', 'pdf'))

  logActivity({
    action: 'export.general_pdf',
    entity: 'report',
    metadata: { severity: 'low', format: 'pdf', row_count: report.projects.length }
  })
}
