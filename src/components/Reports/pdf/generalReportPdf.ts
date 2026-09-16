import { format } from 'date-fns'
import {
  drawBarChart,
  drawPieChart,
  drawLineChart,
  drawHorizontalBarChart,
  drawProgressBar,
  hexToRgb
} from './pdfCharts'
import type { ComprehensiveReport } from '../types'
import { PROJECT_CATEGORY_LABELS } from '../../../lib/supabase'
import { formatEuroCompact, formatEuroRounded } from '../../../utils/formatters'

/**
 * jsPDF's built-in fonts are WinAnsi-encoded, which has no U+2212. `hr-HR` uses U+2212 as its
 * minus sign, and a single one of them makes jsPDF re-encode the whole string as two-byte
 * characters that the WinAnsi font then renders as mojibake — a negative net cash flow would come
 * out as garbage instead of a number. The euro sign itself is fine (WinAnsi 0x80).
 */
const winAnsi = (text: string): string => text.replace(/\u2212/g, '-')

/** Whole euros, for the aggregate figures this report is made of. */
const money = (value: number | null | undefined): string => winAnsi(formatEuroRounded(value))

/** Abbreviated euros (€1,2M / €45K), for the summary lines and KPI boxes. */
const moneyCompact = (value: number | null | undefined): string => winAnsi(formatEuroCompact(value))

export async function generateGeneralReportPDF(report: ComprehensiveReport): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF('p', 'mm', 'a4')

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

  // ── Cover page ───────────────────────────────────────────────────────────
  pdf.setFillColor(15, 23, 42)
  pdf.rect(0, 0, pageWidth, pageHeight, 'F')

  pdf.setFillColor(37, 99, 235)
  pdf.rect(0, 0, 10, pageHeight, 'F')

  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(48)
  pdf.setFont('helvetica', 'bold')
  let text = 'LANDMARK'
  let textWidth = pdf.getTextWidth(text)
  pdf.text(text, pageWidth / 2 - textWidth / 2, 80)
  text = 'GROUP'
  textWidth = pdf.getTextWidth(text)
  pdf.text(text, pageWidth / 2 - textWidth / 2, 95)

  pdf.setFontSize(24)
  pdf.setFont('helvetica', 'normal')
  text = 'Executive Portfolio Report'
  textWidth = pdf.getTextWidth(text)
  pdf.text(text, pageWidth / 2 - textWidth / 2, 120)

  pdf.setDrawColor(37, 99, 235)
  pdf.setLineWidth(1)
  pdf.line(pageWidth / 2 - 40, 125, pageWidth / 2 + 40, 125)

  pdf.setFontSize(14)
  pdf.setTextColor(200, 200, 200)
  text = `Report Period: ${format(new Date(), 'MMMM yyyy')}`
  textWidth = pdf.getTextWidth(text)
  pdf.text(text, pageWidth / 2 - textWidth / 2, 145)
  text = `Generated: ${format(new Date(), 'MMMM dd, yyyy')}`
  textWidth = pdf.getTextWidth(text)
  pdf.text(text, pageWidth / 2 - textWidth / 2, 155)

  pdf.setFontSize(12)
  const summaryStats = [
    `${report.executive_summary.total_projects} Projects`,
    `${moneyCompact(report.executive_summary.total_revenue)} Revenue`,
    `${report.kpis.roi.toFixed(1)}% ROI`
  ]
  text = summaryStats.join('  |  ')
  textWidth = pdf.getTextWidth(text)
  pdf.text(text, pageWidth / 2 - textWidth / 2, 180)

  pdf.setFontSize(10)
  pdf.setTextColor(150, 150, 150)
  text = 'CONFIDENTIAL'
  textWidth = pdf.getTextWidth(text)
  pdf.text(text, pageWidth / 2 - textWidth / 2, pageHeight - 30)

  // ── Page 2: KPIs ─────────────────────────────────────────────────────────
  pdf.addPage()
  yPosition = margin

  pdf.setFillColor(15, 23, 42)
  pdf.rect(0, 0, pageWidth, 55, 'F')

  pdf.setFillColor(37, 99, 235)
  pdf.rect(0, 0, 8, 55, 'F')

  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(32)
  pdf.setFont('helvetica', 'bold')
  pdf.text('LANDMARK GROUP', margin, 22)

  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Executive Portfolio Report', margin, 33)

  pdf.setFontSize(10)
  pdf.setTextColor(200, 200, 200)
  pdf.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, margin, 43)

  pdf.setTextColor(0, 0, 0)
  yPosition = 65

  pdf.setFillColor(240, 245, 250)
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'F')

  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text('EXECUTIVE SUMMARY', margin + 5, yPosition + 10)

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(0, 0, 0)

  const summaryLines = [
    `• Portfolio: ${report.executive_summary.total_projects} projects (${report.executive_summary.active_projects} active, ${report.executive_summary.completed_projects} completed)`,
    `• Financial: ${moneyCompact(report.executive_summary.total_revenue)} revenue, ${moneyCompact(report.executive_summary.total_expenses)} expenses, ${moneyCompact(report.executive_summary.total_profit)} profit (${report.executive_summary.profit_margin.toFixed(1)}% margin)`,
    `• Capital Structure: ${moneyCompact(report.funding_structure.total_equity)} equity, ${moneyCompact(report.funding_structure.total_debt)} debt, ${report.funding_structure.debt_equity_ratio.toFixed(2)} D/E ratio`,
    `• Sales: ${report.sales_performance.units_sold}/${report.sales_performance.total_units} units sold (${report.sales_performance.units_sold > 0 ? ((report.sales_performance.units_sold / report.sales_performance.total_units) * 100).toFixed(1) : '0'}%), ${report.sales_performance.total_sales} transactions`,
    `• Construction: ${report.construction_status.total_contracts} contracts, ${report.construction_status.total_subcontractors} subcontractors, ${report.construction_status.work_logs_7days} work logs recorded`
  ]

  summaryLines.forEach((line, index) => {
    pdf.text(line, margin + 5, yPosition + 20 + (index * 6))
  })

  yPosition += 60

  checkPageBreak(40)
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text('KEY PERFORMANCE INDICATORS', margin, yPosition)
  yPosition += 10

  const kpiData = [
    [moneyCompact(report.kpis.portfolio_value), 'Portfolio Value'],
    [moneyCompact(report.kpis.total_revenue), 'Total Revenue'],
    [moneyCompact(report.kpis.net_profit), 'Net Profit'],
    [report.kpis.roi.toFixed(1) + '%', 'ROI'],
    [report.kpis.sales_rate.toFixed(1) + '%', 'Sales Rate'],
    [report.kpis.debt_equity_ratio.toFixed(2), 'D/E Ratio'],
    [report.kpis.active_projects.toString(), 'Active Projects'],
    [report.kpis.total_customers.toString(), 'Total Customers']
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
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(37, 99, 235)
    let kpiTextWidth = pdf.getTextWidth(kpi[0])
    pdf.text(kpi[0], xPos + kpiBoxWidth / 2 - kpiTextWidth / 2, yPosition + 10)

    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
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
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text('PORTFOLIO ANALYTICS', margin, yPosition)
  yPosition += 10

  const fundingChartData = [
    { label: 'Equity', value: report.funding_structure.total_equity, color: '#22c55e' },
    { label: 'Debt', value: report.funding_structure.total_debt, color: '#ef4444' }
  ]
  drawPieChart(pdf, margin + 30, yPosition + 30, 25, fundingChartData, {
    title: 'Capital Structure',
    showLegend: true
  })

  const salesChartData = [
    { label: 'Sold', value: report.sales_performance.units_sold, color: '#22c55e' },
    { label: 'Reserved', value: report.sales_performance.reserved_units, color: '#f59e0b' },
    { label: 'Available', value: report.sales_performance.available_units, color: '#6b7280' }
  ]
  drawPieChart(pdf, pageWidth - margin - 30, yPosition + 30, 25, salesChartData, {
    title: 'Units Status',
    showLegend: true,
    valueFormat: 'plain'
  })

  yPosition += 85

  checkPageBreak(60)
  const cashFlowData = report.cash_flow.slice(0, 6).map(m => ({
    label: m.month.substring(0, 3),
    value: m.net / 1000
  }))
  drawBarChart(pdf, margin, yPosition, pageWidth - 2 * margin, 50, cashFlowData, {
    title: 'Monthly Net Cash Flow (€K)',
    color: '#2563eb',
    showValues: true
  })

  yPosition += 60

  checkPageBreak(60)
  const topProjectsChart = report.projects
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map(p => ({
      label: p.name.substring(0, 15),
      value: p.revenue / 1000000,
      color: p.profit_margin > 20 ? '#22c55e' : p.profit_margin > 10 ? '#f59e0b' : '#ef4444'
    }))

  if (topProjectsChart.length > 0) {
    drawHorizontalBarChart(pdf, margin + 50, yPosition, pageWidth - 2 * margin - 50, 50, topProjectsChart, {
      title: 'Top Projects by Revenue (€M)',
      showValues: true
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
  pdf.setFont('helvetica', 'bold')
  pdf.text('SALES PERFORMANCE', margin, 25)
  pdf.setTextColor(0, 0, 0)
  yPosition = 55

  pdf.setFillColor(220, 252, 231)
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 40, 'F')
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(22, 163, 74)
  pdf.text('Sales Overview', margin + 5, yPosition + 10)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(0, 0, 0)

  const salesData = [
    ['Total Units:', report.sales_performance.total_units.toString(), 'Avg Sale Price:', money(report.sales_performance.avg_sale_price)],
    ['Units Sold:', `${report.sales_performance.units_sold} (${((report.sales_performance.units_sold / report.sales_performance.total_units) * 100).toFixed(1)}%)`, 'Total Sales:', report.sales_performance.total_sales.toString()],
    ['Available:', report.sales_performance.available_units.toString(), 'Buyers:', report.sales_performance.buyers.toString()],
    ['Reserved:', report.sales_performance.reserved_units.toString(), 'Active Leads:', report.sales_performance.active_leads.toString()],
    ['Total Revenue:', money(report.sales_performance.total_revenue), 'Conversion Rate:', report.sales_performance.conversion_rate.toFixed(1) + '%']
  ]

  salesData.forEach((row, index) => {
    const y = yPosition + 18 + (index * 4)
    pdf.setFont('helvetica', 'bold')
    pdf.text(row[0], margin + 5, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(row[1], margin + 35, y)
    pdf.setFont('helvetica', 'bold')
    pdf.text(row[2], margin + 95, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(row[3], margin + 125, y)
  })

  yPosition += 50

  checkPageBreak(40)
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text('Sales Progress', margin, yPosition)
  yPosition += 8

  const salesRate = (report.sales_performance.units_sold / report.sales_performance.total_units) * 100
  drawProgressBar(pdf, margin, yPosition, pageWidth - 2 * margin, 8, salesRate, {
    label: 'Units Sold',
    color: '#22c55e',
    showPercentage: true
  })
  yPosition += 15

  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text('Construction Progress', margin, yPosition)
  yPosition += 8

  const constructionProgress = (report.construction_status.completed_phases / report.construction_status.total_phases) * 100
  drawProgressBar(pdf, margin, yPosition, pageWidth - 2 * margin, 8, constructionProgress, {
    label: 'Phases Completed',
    color: '#2563eb',
    showPercentage: true
  })
  yPosition += 15

  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text('Budget Utilization', margin, yPosition)
  yPosition += 8

  drawProgressBar(pdf, margin, yPosition, pageWidth - 2 * margin, 8, report.construction_status.budget_utilization, {
    label: 'Budget Realized',
    color: report.construction_status.budget_utilization > 90 ? '#ef4444' : '#f59e0b',
    showPercentage: true
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
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text('FUNDING & FINANCE', margin, 25)
  pdf.setTextColor(0, 0, 0)
  yPosition = 55

  pdf.setFillColor(254, 243, 199)
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'F')
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(245, 158, 11)
  pdf.text('Financial Structure', margin + 5, yPosition + 10)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(0, 0, 0)

  const fundingData = [
    ['Total Equity Invested:', money(report.funding_structure.total_equity), 'Active Funders:', report.funding_structure.active_investors.toString()],
    ['Total Debt:', money(report.funding_structure.total_debt), 'Active Banks:', report.funding_structure.active_banks.toString()],
    ['Debt-to-Equity Ratio:', report.funding_structure.debt_equity_ratio.toFixed(2), 'Bank Credits:', report.funding_structure.bank_credits.toString()],
    ['Total Credit Lines:', money(report.funding_structure.total_credit_lines), 'Avg Interest Rate:', report.funding_structure.avg_interest_rate.toFixed(2) + '%'],
    ['Available Credit:', money(report.funding_structure.available_credit), 'Monthly Debt Service:', money(report.funding_structure.monthly_debt_service)]
  ]

  fundingData.forEach((row, index) => {
    const y = yPosition + 18 + (index * 5)
    pdf.setFont('helvetica', 'bold')
    pdf.text(row[0], margin + 5, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(row[1], margin + 50, y)
    pdf.setFont('helvetica', 'bold')
    pdf.text(row[2], margin + 105, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(row[3], margin + 145, y)
  })

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
  pdf.setFont('helvetica', 'bold')
  pdf.text('CONSTRUCTION STATUS', margin, 25)
  pdf.setTextColor(0, 0, 0)
  yPosition = 55

  pdf.setFillColor(254, 226, 226)
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'F')
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(220, 38, 38)
  pdf.text('Construction & Supervision Overview', margin + 5, yPosition + 10)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(0, 0, 0)

  const constructionData = [
    ['Total Contracts:', report.construction_status.total_contracts.toString(), 'Budget Utilization:', report.construction_status.budget_utilization.toFixed(1) + '%'],
    ['Active Contracts:', report.construction_status.active_contracts.toString(), 'Total Subcontractors:', report.construction_status.total_subcontractors.toString()],
    ['Completed Contracts:', report.construction_status.completed_contracts.toString(), 'Total Phases:', report.construction_status.total_phases.toString()],
    ['Contract Value:', money(report.construction_status.contract_value), 'Completed Phases:', report.construction_status.completed_phases.toString()],
    ['Budget Realized:', money(report.construction_status.budget_realized), 'Work Logs (7 days):', report.construction_status.work_logs_7days.toString()]
  ]

  constructionData.forEach((row, index) => {
    const y = yPosition + 18 + (index * 5)
    pdf.setFont('helvetica', 'bold')
    pdf.text(row[0], margin + 5, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(row[1], margin + 45, y)
    pdf.setFont('helvetica', 'bold')
    pdf.text(row[2], margin + 105, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(row[3], margin + 145, y)
  })

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
  pdf.setFont('helvetica', 'bold')
  pdf.text('ACCOUNTING OVERVIEW', margin, 25)
  pdf.setTextColor(0, 0, 0)
  yPosition = 55

  pdf.setFillColor(224, 242, 254)
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 60, 'F')
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(6, 182, 212)
  pdf.text('Invoice & Payment Summary', margin + 5, yPosition + 10)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(0, 0, 0)

  const accountingData = [
    ['Total Invoices:', report.accounting_overview.total_invoices.toString(), 'Paid Invoices:', report.accounting_overview.paid_invoices.toString()],
    ['Total Invoice Value:', moneyCompact(report.accounting_overview.total_invoice_value), 'Paid Value:', moneyCompact(report.accounting_overview.paid_value)],
    ['Pending Invoices:', report.accounting_overview.pending_invoices.toString(), 'Overdue Invoices:', report.accounting_overview.overdue_invoices.toString()],
    ['Pending Value:', moneyCompact(report.accounting_overview.pending_value), 'Overdue Value:', moneyCompact(report.accounting_overview.overdue_value)],
    ['Payment Completion Rate:', report.accounting_overview.payment_completion_rate.toFixed(1) + '%', '', '']
  ]

  accountingData.forEach((row, index) => {
    const y = yPosition + 18 + (index * 6)
    pdf.setFont('helvetica', 'bold')
    pdf.text(row[0], margin + 5, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(row[1], margin + 55, y)
    if (row[2]) {
      pdf.setFont('helvetica', 'bold')
      pdf.text(row[2], margin + 105, y)
      pdf.setFont('helvetica', 'normal')
      pdf.text(row[3], margin + 145, y)
    }
  })

  yPosition += 50

  checkPageBreak(70)
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text('Invoice Status Distribution', margin, yPosition)
  yPosition += 8

  const invoiceStatusData = [
    { label: 'Paid', value: report.accounting_overview.paid_invoices },
    { label: 'Pending', value: report.accounting_overview.pending_invoices },
    { label: 'Overdue', value: report.accounting_overview.overdue_invoices }
  ]
  drawBarChart(pdf, margin, yPosition, pageWidth - 2 * margin, 45, invoiceStatusData, {
    color: '#06b6d4',
    showValues: true,
    valueFormat: 'plain'
  })
  yPosition += 55

  checkPageBreak(25)
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text('Payment Completion Rate', margin, yPosition)
  yPosition += 8

  drawProgressBar(pdf, margin, yPosition, pageWidth - 2 * margin, 8, report.accounting_overview.payment_completion_rate, {
    color: '#06b6d4',
    showPercentage: true
  })
  yPosition += 20

  checkPageBreak(100)
  const halfWidth = (pageWidth - 2 * margin - 5) / 2

  pdf.setFillColor(209, 250, 229)
  pdf.rect(margin, yPosition, halfWidth, 45, 'F')
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(16, 185, 129)
  pdf.text('TIC COST MANAGEMENT', margin + 5, yPosition + 10)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(0, 0, 0)

  const ticData = [
    ['Planned Investment:', money(report.tic_cost_management.total_tic_budget)],
    ['Projects with a Plan:', report.tic_cost_management.projects_with_tic.toString()],
    ['Projects without a Plan:', report.tic_cost_management.projects_without_tic.toString()]
  ]

  ticData.forEach((row, index) => {
    const y = yPosition + 16 + (index * 5)
    pdf.setFont('helvetica', 'bold')
    pdf.text(row[0], margin + 5, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(row[1], margin + 35, y)
  })

  pdf.setFillColor(254, 243, 199)
  pdf.rect(margin + halfWidth + 5, yPosition, halfWidth, 45, 'F')
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(245, 158, 11)
  pdf.text('OFFICE EXPENSES', margin + halfWidth + 10, yPosition + 10)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(0, 0, 0)

  const officeData = [
    ['Office Suppliers:', report.office_expenses.total_office_suppliers.toString()],
    ['Office Invoices:', report.office_expenses.total_office_invoices.toString()],
    ['Total Spent:', money(report.office_expenses.total_office_spent)],
    ['Avg Invoice:', money(report.office_expenses.avg_office_invoice)]
  ]

  officeData.forEach((row, index) => {
    const y = yPosition + 16 + (index * 5)
    pdf.setFont('helvetica', 'bold')
    pdf.text(row[0], margin + halfWidth + 10, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(row[1], margin + halfWidth + 40, y)
  })

  yPosition += 55

  checkPageBreak(100)
  pdf.setFillColor(254, 205, 211)
  pdf.rect(margin, yPosition, halfWidth, 50, 'F')
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(225, 29, 72)
  pdf.text('COMPANY INVESTMENTS', margin + 5, yPosition + 10)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(0, 0, 0)

  const creditsData = [
    ['Total Investments:', report.company_credits.total_credits.toString()],
    ['Investment Value:', money(report.company_credits.total_credit_value)],
    ['Available:', money(report.company_credits.credits_available)],
    ['Used:', money(report.company_credits.credits_used)],
    ['Cesija Payments:', report.company_credits.cesija_payments.toString()],
    ['Cesija Value:', money(report.company_credits.cesija_value)]
  ]

  creditsData.forEach((row, index) => {
    const y = yPosition + 16 + (index * 5)
    pdf.setFont('helvetica', 'bold')
    pdf.text(row[0], margin + 5, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(row[1], margin + 35, y)
  })

  pdf.setFillColor(241, 245, 249)
  pdf.rect(margin + halfWidth + 5, yPosition, halfWidth, 50, 'F')
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(71, 85, 105)
  pdf.text('BANK ACCOUNTS', margin + halfWidth + 10, yPosition + 10)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(0, 0, 0)

  const bankData = [
    ['Total Accounts:', report.bank_accounts.total_accounts.toString()],
    ['Total Balance:', money(report.bank_accounts.total_balance)],
    ['Positive Balance:', report.bank_accounts.positive_balance_accounts.toString()],
    ['Negative Balance:', report.bank_accounts.negative_balance_accounts.toString()]
  ]

  bankData.forEach((row, index) => {
    const y = yPosition + 16 + (index * 5)
    pdf.setFont('helvetica', 'bold')
    pdf.text(row[0], margin + halfWidth + 10, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(row[1], margin + halfWidth + 40, y)
  })

  yPosition += 60

  if (report.contract_types.length > 0) {
    checkPageBreak(60)
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(37, 99, 235)
    pdf.text('CONTRACT DISTRIBUTION', margin, yPosition)
    yPosition += 8

    const contractData = report.contract_types.map((ct, idx) => ({
      label: ct.name.substring(0, 12),
      value: ct.count,
      color: ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][idx % 6]
    }))

    if (contractData.length <= 6) {
      drawPieChart(pdf, pageWidth / 2, yPosition + 35, 28, contractData, { showLegend: true, valueFormat: 'plain' })
      yPosition += 80
    } else {
      drawBarChart(pdf, margin, yPosition, pageWidth - 2 * margin, 45, contractData.map(cd => ({ label: cd.label, value: cd.value })), {
        color: '#2563eb',
        showValues: true,
        valueFormat: 'plain'
      })
      yPosition += 55
    }
  }

  checkPageBreak(70)
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text('CASH FLOW TREND', margin, yPosition)
  yPosition += 8

  const cashFlowTrend = report.cash_flow.slice(0, 6).map(m => ({
    label: m.month.substring(0, 3),
    value: m.net / 1000
  }))
  drawLineChart(pdf, margin, yPosition, pageWidth - 2 * margin, 50, cashFlowTrend, {
    color: '#2563eb',
    showPoints: true,
    fillArea: true
  })
  yPosition += 60

  checkPageBreak(60)
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text('CASH FLOW ANALYSIS', margin, yPosition)
  yPosition += 10

  pdf.setFillColor(240, 240, 240)
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F')
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Month', margin + 5, yPosition + 5)
  pdf.text('Inflow', margin + 50, yPosition + 5)
  pdf.text('Outflow', margin + 90, yPosition + 5)
  pdf.text('Net Cash Flow', margin + 130, yPosition + 5)
  yPosition += 10

  pdf.setFont('helvetica', 'normal')
  let totalInflow = 0
  let totalOutflow = 0
  let totalNet = 0

  report.cash_flow.forEach((month, index) => {
    totalInflow += month.inflow
    totalOutflow += month.outflow
    totalNet += month.net

    pdf.text(month.month, margin + 5, yPosition + (index * 5))
    pdf.text(moneyCompact(month.inflow), margin + 50, yPosition + (index * 5))
    pdf.text(moneyCompact(month.outflow), margin + 90, yPosition + (index * 5))

    pdf.setTextColor(month.net >= 0 ? 22 : 220, month.net >= 0 ? 163 : 38, month.net >= 0 ? 74 : 38)
    pdf.text(moneyCompact(month.net), margin + 130, yPosition + (index * 5))
    pdf.setTextColor(0, 0, 0)
  })

  yPosition += report.cash_flow.length * 5 + 5
  pdf.setFont('helvetica', 'bold')
  pdf.text(`6-Month Totals:`, margin + 5, yPosition)
  pdf.text(`Inflow: ${moneyCompact(totalInflow)} | Outflow: ${moneyCompact(totalOutflow)} | Net: ${moneyCompact(totalNet)}`, margin + 5, yPosition + 5)
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
    pdf.setFont('helvetica', 'bold')
    pdf.text('PROJECT PORTFOLIO', margin, 25)
    pdf.setTextColor(0, 0, 0)
    yPosition = 55

    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(37, 99, 235)
    pdf.text('Project Performance Overview', margin, yPosition)
    yPosition += 10

    const projectPerformance = report.projects
      .sort((a, b) => b.profit_margin - a.profit_margin)
      .slice(0, 8)
      .map(p => ({
        label: p.name.substring(0, 15),
        value: p.profit_margin,
        color: p.profit_margin > 20 ? '#22c55e' : p.profit_margin > 10 ? '#f59e0b' : '#ef4444'
      }))

    if (projectPerformance.length > 0) {
      drawHorizontalBarChart(pdf, margin + 50, yPosition, pageWidth - 2 * margin - 50, 70, projectPerformance, {
        title: 'Profit Margin (%)',
        showValues: true,
        valueFormat: 'plain'
      })
      yPosition += 80
    }

    checkPageBreak(15)
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(37, 99, 235)
    pdf.text('Detailed Project Breakdown', margin, yPosition)
    yPosition += 10

    report.projects.forEach((project, idx) => {
      checkPageBreak(55)

      pdf.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255)
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'F')

      pdf.setDrawColor(37, 99, 235)
      pdf.setLineWidth(0.5)
      pdf.line(margin, yPosition, margin, yPosition + 50)

      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(0, 0, 0)
      pdf.text(project.name, margin + 5, yPosition + 7)

      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
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
      pdf.setFont('helvetica', 'bold')
      const riskTextWidth = pdf.getTextWidth(project.risk_level)
      pdf.text(project.risk_level, pageWidth - margin - 15 - riskTextWidth / 2, yPosition + 8.5)

      pdf.setTextColor(0, 0, 0)
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')

      const projectData = [
        ['Budget:', project.has_budget ? moneyCompact(project.budget) : 'not set', 'Revenue:', moneyCompact(project.revenue)],
        ['Expenses:', moneyCompact(project.expenses), 'Profit:', moneyCompact(project.profit)],
        ['Units:', `${project.units_sold}/${project.total_units}`, 'Sales Rate:', `${project.sales_rate.toFixed(1)}%`],
        ['Phases:', `${project.phases_done}/${project.total_phases}`, 'Contracts:', project.contracts.toString()]
      ]

      projectData.forEach((row, index) => {
        const y = yPosition + 20 + (index * 6)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[0], margin + 5, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[1], margin + 25, y)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[2], margin + 65, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[3], margin + 85, y)
      })

      drawProgressBar(pdf, margin + 5, yPosition + 44, pageWidth - 2 * margin - 10, 4, project.profit_margin, {
        color: project.profit_margin > 20 ? '#22c55e' : project.profit_margin > 10 ? '#f59e0b' : '#ef4444',
        showPercentage: false
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
    pdf.setFont('helvetica', 'bold')
    pdf.text('RISK ASSESSMENT', margin, 25)
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
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(220, 38, 38)
      pdf.text(risk.type, margin + 5, yPosition + 8)

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0, 0, 0)
      pdf.text(risk.description, margin + 5, yPosition + 15)

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
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text('INSIGHTS & RECOMMENDATIONS', margin, 25)
  pdf.setTextColor(0, 0, 0)
  yPosition = 55

  pdf.setFillColor(220, 252, 231)
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 12, 'F')
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(22, 163, 74)
  pdf.text('Top Performing Projects', margin + 5, yPosition + 8)
  yPosition += 15

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(0, 0, 0)

  report.insights.top_projects.forEach((project, index) => {
    pdf.setFont('helvetica', 'bold')
    pdf.text(`${index + 1}. ${project.name}`, margin + 5, yPosition)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Revenue: ${moneyCompact(project.revenue)} | Sales Rate: ${project.sales_rate.toFixed(1)}%`, margin + 10, yPosition + 5)
    yPosition += 10
  })

  yPosition += 5

  pdf.setFillColor(220, 252, 231)
  pdf.rect(margin, yPosition, pageWidth - 2 * margin, 12, 'F')
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(22, 163, 74)
  pdf.text('Strategic Recommendations', margin + 5, yPosition + 8)
  yPosition += 15

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(0, 0, 0)

  report.insights.recommendations.forEach((rec) => {
    pdf.setFillColor(240, 253, 244)
    pdf.rect(margin + 2, yPosition - 3, 3, 3, 'F')
    pdf.text(rec, margin + 8, yPosition)
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
    pdf.setFont('helvetica', 'normal')
    pdf.text('LANDMARK GROUP', margin, pageHeight - 10)
    pdf.text('Confidential Executive Report', margin, pageHeight - 6)

    pdf.setFont('helvetica', 'bold')
    const pageText = `Page ${i} of ${totalPages}`
    const pageTextWidth = pdf.getTextWidth(pageText)
    pdf.text(pageText, pageWidth - margin - pageTextWidth, pageHeight - 10)
    pdf.setFont('helvetica', 'normal')
    const dateText = format(new Date(), 'yyyy-MM-dd')
    const dateTextWidth = pdf.getTextWidth(dateText)
    pdf.text(dateText, pageWidth - margin - dateTextWidth, pageHeight - 6)
  }

  pdf.save(`LANDMARK_Executive_Report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`)
}
