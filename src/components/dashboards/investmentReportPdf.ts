import type { TFunction } from 'i18next'
import type { Project, BankCredit, FinancialSummary } from '../../types/investment'
import { formatDate, formatDateTime } from '../../utils/formatters'
import { pdfMoney } from '../Reports/pdf/pdfText'
import { loadUnicodeFont, PDF_FONT_FAMILY } from '../../utils/pdfFont'
import { exportT, EXPORT_LANGUAGE } from '../../utils/exportLanguage'
import { exportFileName } from '../../utils/downloadFile'
import { PROJECT_STATUS, statusLabel } from '../../utils/statusDisplay'
import { logActivity } from '../../lib/activityLog'
import { utilisationToneRgb, getCreditTypeLabelKey } from '../Funding/Investors/utils/creditCalculations'
import { yieldToUI } from '../../utils/yieldToUI'

/**
 * A label with exactly one colon: some of these keys carry their own ("Datum početka:") because
 * the screen draws them that way, and some do not ("Iskorišteno").
 */
const rowLabel = (t: TFunction, key: string): string => `${t(key).replace(/\s*:\s*$/, '')}:`

const addHeader = (doc: import('jspdf').jsPDF, yPos: number, t: TFunction) => {
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, 210, yPos, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont(PDF_FONT_FAMILY, 'bold')
  doc.setFontSize(24)
  doc.text(t('dashboards.investment.pdf_title'), 105, yPos / 2 - 5, { align: 'center' })

  doc.setFontSize(12)
  doc.setFont(PDF_FONT_FAMILY, 'normal')
  doc.text(
    `${rowLabel(t, 'reports.general.generated')} ${formatDateTime(new Date(), EXPORT_LANGUAGE)}`,
    105,
    yPos / 2 + 5,
    { align: 'center' }
  )

  doc.setTextColor(0, 0, 0)
  return yPos + 10
}

const addSectionTitle = (doc: import('jspdf').jsPDF, title: string, yPos: number) => {
  doc.setFillColor(241, 245, 249)
  doc.rect(14, yPos - 2, 182, 10, 'F')

  doc.setFont(PDF_FONT_FAMILY, 'bold')
  doc.setFontSize(14)
  doc.setTextColor(30, 58, 138)
  doc.text(title, 20, yPos + 5)

  doc.setTextColor(0, 0, 0)
  return yPos + 15
}

const drawDonutChart = (doc: import('jspdf').jsPDF, x: number, y: number, outerRadius: number, innerRadius: number, data: { label: string, value: number, color: number[] }[], t: TFunction) => {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  if (total === 0) return

  let currentAngle = 0

  data.forEach((item) => {
    const sliceAngle = (item.value / total) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + sliceAngle

    doc.setFillColor(item.color[0], item.color[1], item.color[2])

    const numSegments = Math.max(100, Math.ceil(sliceAngle))
    const angleStep = (sliceAngle * Math.PI / 180) / numSegments

    for (let i = 0; i < numSegments; i++) {
      const angle1 = (startAngle * Math.PI / 180) + (i * angleStep)
      const angle2 = (startAngle * Math.PI / 180) + ((i + 1) * angleStep)

      const x1_outer = x + outerRadius * Math.cos(angle1)
      const y1_outer = y + outerRadius * Math.sin(angle1)
      const x2_outer = x + outerRadius * Math.cos(angle2)
      const y2_outer = y + outerRadius * Math.sin(angle2)

      const x1_inner = x + innerRadius * Math.cos(angle1)
      const y1_inner = y + innerRadius * Math.sin(angle1)
      const x2_inner = x + innerRadius * Math.cos(angle2)
      const y2_inner = y + innerRadius * Math.sin(angle2)

      doc.lines(
        [
          [x2_outer - x1_outer, y2_outer - y1_outer],
          [x2_inner - x2_outer, y2_inner - y2_outer],
          [x1_inner - x2_inner, y1_inner - y2_inner],
          [x1_outer - x1_inner, y1_outer - y1_inner]
        ],
        x1_outer,
        y1_outer,
        [1, 1],
        'F'
      )
    }

    const midAngle = ((startAngle + endAngle) / 2) * Math.PI / 180
    const percentage = ((item.value / total) * 100).toFixed(0)
    const labelRadius = (outerRadius + innerRadius) / 2
    const labelX = x + labelRadius * Math.cos(midAngle)
    const labelY = y + labelRadius * Math.sin(midAngle) + 1

    if (Number(percentage) > 5) {
      doc.setFont(PDF_FONT_FAMILY, 'bold')
      doc.setFontSize(9)
      doc.setTextColor(255, 255, 255)
      doc.text(`${percentage}%`, labelX, labelY, { align: 'center' })
    }

    currentAngle = endAngle
  })

  currentAngle = 0
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(1)
  data.forEach((item) => {
    const sliceAngle = (item.value / total) * 360
    const startAngle = currentAngle
    const angle = (startAngle * Math.PI / 180)

    const x1_outer = x + outerRadius * Math.cos(angle)
    const y1_outer = y + outerRadius * Math.sin(angle)
    const x1_inner = x + innerRadius * Math.cos(angle)
    const y1_inner = y + innerRadius * Math.sin(angle)

    doc.line(x1_inner, y1_inner, x1_outer, y1_outer)

    currentAngle += sliceAngle
  })

  doc.setFont(PDF_FONT_FAMILY, 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  doc.text(t('common.total'), x, y - 1, { align: 'center' })
  doc.setFontSize(9)
  doc.text(pdfMoney(total), x, y + 4, { align: 'center' })

  let legendY = y - (data.length * 5.5)
  const legendX = x + outerRadius + 15

  data.forEach(item => {
    doc.setFillColor(item.color[0], item.color[1], item.color[2])
    doc.roundedRect(legendX, legendY - 2.5, 5, 5, 1, 1, 'F')

    doc.setFont(PDF_FONT_FAMILY, 'bold')
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    doc.text(item.label, legendX + 8, legendY + 1.5)

    doc.setFont(PDF_FONT_FAMILY, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(`${pdfMoney(item.value)} (${((item.value / total) * 100).toFixed(1)}%)`, legendX + 8, legendY + 6)

    legendY += 11
  })

  doc.setTextColor(0, 0, 0)
}

const drawBarChart = (doc: import('jspdf').jsPDF, x: number, y: number, width: number, height: number, data: { label: string, value: number, max: number, color?: [number, number, number] }[]) => {
  const maxValue = Math.max(...data.map(d => d.max))
  const barHeight = Math.min(6, (height - (data.length + 1) * 2) / data.length)

  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.1)
  doc.line(x, y, x, y + height)
  doc.line(x, y + height, x + width, y + height)

  data.forEach((item, index) => {
    const barY = y + index * (barHeight + 2)
    const barWidth = maxValue > 0 ? (item.value / maxValue) * width : 0

    doc.setFillColor(226, 232, 240)
    doc.rect(x, barY, width, barHeight, 'F')

    const color = item.color || [59, 130, 246]
    doc.setFillColor(...color)
    doc.rect(x, barY, barWidth, barHeight, 'F')

    doc.setFont(PDF_FONT_FAMILY, 'normal')
    doc.setFontSize(7)
    doc.setTextColor(30, 30, 30)

    const labelText = item.label.length > 20 ? item.label.substring(0, 18) + '...' : item.label
    doc.text(labelText, x - 2, barY + barHeight / 2 + 0.8, { align: 'right' })

    doc.setFont(PDF_FONT_FAMILY, 'bold')
    doc.setFontSize(7)
    const valueText = pdfMoney(item.value)
    if (barWidth > 25) {
      doc.setTextColor(255, 255, 255)
      doc.text(valueText, x + barWidth - 2, barY + barHeight / 2 + 0.8, { align: 'right' })
    } else {
      doc.setTextColor(...color)
      doc.text(valueText, x + barWidth + 2, barY + barHeight / 2 + 0.8)
    }
  })

  doc.setTextColor(0, 0, 0)
}

export const generateInvestmentReportPDF = async (
  financialSummary: FinancialSummary,
  bankCredits: BankCredit[],
  projects: Project[]
) => {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()

  // No fallback: a built-in WinAnsi face cannot spell a Croatian company or project name, and one
  // unmapped character turns the whole line into noise. A failure reaches `useAsyncExport`.
  await loadUnicodeFont(doc)

  // Exports are Croatian whatever the UI language is (docs/REPORTS.md).
  const t = exportT()

  /** A credit's own name, or its company and type — never the raw `line_of_credit` enum. */
  const creditLabel = (credit: BankCredit): string => {
    if (credit.credit_name) return credit.credit_name
    const company = credit.company?.name || t('funding.investments.unnamed_credit')
    const typeKey = getCreditTypeLabelKey(credit.credit_type, credit.credit_seniority)
    return typeKey ? `${company} - ${t(typeKey)}` : company
  }

  let yPos = addHeader(doc, 40, t)

  yPos = addSectionTitle(doc, t('reports.general.exec_summary'), yPos)

  const statBoxes: Array<{ label: string; value: number; color: [number, number, number] }> = [
    { label: t('dashboards.investment.portfolio_value'), value: financialSummary.total_portfolio_value, color: [59, 130, 246] },
    { label: t('dashboards.investment.outstanding_debt'), value: financialSummary.total_debt, color: [239, 68, 68] },
    { label: t('dashboards.investment.available_investments'), value: financialSummary.available_credit, color: [34, 197, 94] },
    { label: t('dashboards.investment.used'), value: financialSummary.total_used_credit, color: [168, 85, 247] }
  ]

  const boxWidth = 42
  const boxHeight = 20
  let boxX = 20

  statBoxes.forEach(box => {
    doc.setFillColor(...box.color)
    doc.roundedRect(boxX, yPos, boxWidth, boxHeight, 2, 2, 'F')

    doc.setFont(PDF_FONT_FAMILY, 'normal')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(box.label, boxX + boxWidth / 2, yPos + 6, { align: 'center' })

    doc.setFont(PDF_FONT_FAMILY, 'bold')
    doc.setFontSize(14)
    doc.text(pdfMoney(box.value), boxX + boxWidth / 2, yPos + 15, { align: 'center' })

    boxX += boxWidth + 5
  })

  yPos += boxHeight + 15

  const utilizationRate = financialSummary.total_credit_lines > 0
    ? (financialSummary.total_used_credit / financialSummary.total_credit_lines) * 100
    : 0

  doc.setFont(PDF_FONT_FAMILY, 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  doc.text(`${rowLabel(t, 'dashboards.investment.investment_utilization')} ${utilizationRate.toFixed(1)}%`, 20, yPos)

  doc.setFillColor(226, 232, 240)
  doc.roundedRect(20, yPos + 3, 170, 6, 1, 1, 'F')

  const progressColor = utilisationToneRgb(utilizationRate)
  doc.setFillColor(...progressColor)
  doc.roundedRect(20, yPos + 3, (170 * Math.min(utilizationRate, 100)) / 100, 6, 1, 1, 'F')

  yPos += 15

  yPos = addSectionTitle(doc, t('reports.general.kpi_title'), yPos)

  const activeCredits = bankCredits.filter(c => c.status === 'active').length
  const highUtilizationCredits = bankCredits.filter(c => {
    const util = c.amount > 0 ? (c.used_amount / c.amount) * 100 : 0
    return util >= 80
  }).length

  const insights: string[] = []
  insights.push(`${rowLabel(t, 'dashboards.investment.total_investment_lines')} ${pdfMoney(financialSummary.total_credit_lines)}`)
  insights.push(`${rowLabel(t, 'dashboards.investment.active_investments')} ${activeCredits} / ${bankCredits.length}`)
  insights.push(`${rowLabel(t, 'dashboards.investment.avg_interest_rate')} ${financialSummary.weighted_avg_interest.toFixed(2)}%`)
  if (financialSummary.upcoming_maturities > 0) {
    // This line used to open with a `⚠`, which WinAnsi has no mapping for — so the single most
    // prominent warning in the report rendered as noise every time it fired. The embedded font
    // could draw the glyph now, but the screens word this warning rather than draw it.
    insights.push(`${t('common.warning')}: ${t('dashboards.investment.investments_maturing', { count: financialSummary.upcoming_maturities })}`)
  }
  if (highUtilizationCredits > 0) {
    insights.push(t('dashboards.investment.high_utilization', { count: highUtilizationCredits }))
  }

  const insightBoxHeight = insights.length * 6 + 8
  doc.setFillColor(240, 249, 255)
  doc.setDrawColor(59, 130, 246)
  doc.setLineWidth(0.5)
  doc.roundedRect(20, yPos, 170, insightBoxHeight, 2, 2, 'FD')

  doc.setFont(PDF_FONT_FAMILY, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(30, 58, 138)

  yPos += 5
  insights.forEach(insight => {
    doc.text(`• ${insight}`, 23, yPos)
    yPos += 5
  })

  yPos += 15

  yPos = addSectionTitle(doc, t('dashboards.investment.pdf_distribution_by_project'), yPos)

  const projectAllocations = new Map<string, number>()

  const addToProject = (projectName: string, amount: number) => {
    if (amount <= 0) return
    projectAllocations.set(projectName, (projectAllocations.get(projectName) || 0) + amount)
  }

  // Distribute every credit's full face amount on a single, consistent basis:
  // each allocation's slice goes to its project, and any unallocated remainder
  // (amount − Σ allocated) is bucketed as "Nealocirano" — so the donut always
  // sums to the total facility value rather than mixing allocated slices for
  // some credits with full amounts for others.
  bankCredits.forEach(credit => {
    const amount = Number(credit.amount) || 0
    if (amount <= 0) return
    const allocations = credit.credit_allocations || []
    let allocated = 0
    allocations.forEach(allocation => {
      const slice = Number(allocation.allocated_amount) || 0
      addToProject(allocation.project?.name || 'OPEX', slice)
      allocated += slice
    })
    const remainder = amount - allocated
    if (remainder > 0) addToProject(credit.project?.name || t('funding.unallocated'), remainder)
  })

  const colors = [
    [59, 130, 246],
    [34, 197, 94],
    [168, 85, 247],
    [249, 115, 22],
    [239, 68, 68],
    [156, 163, 175],
    [236, 72, 153],
    [147, 51, 234],
    [14, 165, 233],
    [34, 211, 238]
  ]

  const donutData = Array.from(projectAllocations.entries())
    .map(([label, value], index) => ({
      label,
      value,
      color: colors[index % colors.length]
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  if (donutData.length > 0) {
    const chartCenterX = 55
    const chartCenterY = yPos + 30
    const outerRadius = 20
    const innerRadius = 12

    drawDonutChart(doc, chartCenterX, chartCenterY, outerRadius, innerRadius, donutData, t)
    yPos += 70
  } else {
    yPos += 10
  }

  const allAllocations: Array<{ label: string, value: number, max: number, color: [number, number, number] }> = []

  bankCredits.forEach(credit => {
    if (credit.credit_allocations && credit.credit_allocations.length > 0) {
      credit.credit_allocations.forEach(allocation => {
        const projectName = allocation.project?.name || 'OPEX'
        const utilPercent = allocation.allocated_amount > 0 ? (allocation.used_amount / allocation.allocated_amount) * 100 : 0
        const color: [number, number, number] = utilPercent >= 90 ? [239, 68, 68] : utilPercent >= 70 ? [249, 115, 22] : [59, 130, 246]

        allAllocations.push({
          label: `${creditLabel(credit)} - ${projectName}`,
          value: allocation.allocated_amount,
          max: allocation.allocated_amount,
          color
        })
      })
    } else {
      const utilPercent = credit.amount > 0 ? (credit.used_amount / credit.amount) * 100 : 0
      const color: [number, number, number] = utilPercent >= 90 ? [239, 68, 68] : utilPercent >= 70 ? [249, 115, 22] : [59, 130, 246]
      allAllocations.push({
        label: creditLabel(credit),
        value: credit.amount,
        max: credit.amount,
        color
      })
    }
  })

  const creditUtilizationData = allAllocations.sort((a, b) => Number(b.value) - Number(a.value))

  if (creditUtilizationData.length > 0) {
    const itemsPerPage = Math.floor(210 / 8)
    const totalChunks = Math.ceil(creditUtilizationData.length / itemsPerPage)

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * itemsPerPage
      const end = Math.min(start + itemsPerPage, creditUtilizationData.length)
      const chunk = creditUtilizationData.slice(start, end)
      const currentChartHeight = chunk.length * 8

      if (yPos + currentChartHeight + 20 > 260) {
        doc.addPage()
        yPos = 20
      }

      if (chunkIndex === 0 || yPos === 20) {
        yPos = addSectionTitle(doc, t('dashboards.investment.pdf_allocations_by_project'), yPos)
      }

      drawBarChart(doc, 70, yPos, 120, currentChartHeight, chunk)
      yPos += currentChartHeight + 15

      if (chunkIndex < totalChunks - 1) {
        doc.addPage()
        yPos = 20
      }
    }
  }

  if (yPos > 260) {
    doc.addPage()
    yPos = 20
  }

  yPos = addSectionTitle(doc, t('dashboards.investment.pdf_credit_details'), yPos)

  const sortedCredits = [...bankCredits].sort((a, b) => Number(b.amount) - Number(a.amount))
  for (let creditIdx = 0; creditIdx < sortedCredits.length; creditIdx++) {
    const credit = sortedCredits[creditIdx]
    const hasAllocations = credit.credit_allocations && credit.credit_allocations.length > 0
    const allocationCount = hasAllocations ? credit.credit_allocations!.length : 0
    const baseHeight = 38
    const allocationHeight = allocationCount * 6
    const boxHeight = baseHeight + allocationHeight
    const requiredHeight = boxHeight + 3

    if (yPos + requiredHeight > 260) {
      doc.addPage()
      yPos = 20
    }

    const utilizationPercent = credit.amount > 0 ? (credit.used_amount / credit.amount) * 100 : 0
    const bgColor: [number, number, number] = credit.status === 'active' ? [220, 252, 231] : [254, 243, 199]

    doc.setFillColor(...bgColor)
    doc.roundedRect(20, yPos, 170, boxHeight, 2, 2, 'F')

    doc.setFont(PDF_FONT_FAMILY, 'bold')
    doc.setFontSize(10)
    doc.setTextColor(30, 30, 30)
    doc.text(creditLabel(credit), 23, yPos + 5)

    doc.setFont(PDF_FONT_FAMILY, 'bold')
    doc.setFontSize(8)
    doc.setTextColor(60, 60, 60)

    const detailY = yPos + 11

    // `amount − used_amount` goes negative on an over-utilised credit, which is an expected state
    // (the utilisation bar below clamps at 100%). `pdfMoney` swaps hr-HR's U+2212 for an ASCII
    // hyphen, without which this whole line used to render as mojibake.
    doc.text(`${rowLabel(t, 'common.amount')} ${pdfMoney(credit.amount)}`, 23, detailY)
    doc.text(`${rowLabel(t, 'dashboards.investment.used')} ${pdfMoney(credit.used_amount)}`, 70, detailY)
    doc.text(`${rowLabel(t, 'dashboards.investment.available_investments')} ${pdfMoney(credit.amount - credit.used_amount)}`, 117, detailY)

    doc.text(`${rowLabel(t, 'dashboards.investment.outstanding')} ${pdfMoney(credit.outstanding_balance)}`, 23, detailY + 5)
    doc.text(`${rowLabel(t, 'dashboards.investment.repaid')} ${pdfMoney(credit.repaid_amount)}`, 70, detailY + 5)
    doc.text(`${rowLabel(t, 'dashboards.investment.interest_rate')} ${Number(credit.interest_rate).toFixed(2)}%`, 117, detailY + 5)

    doc.setFont(PDF_FONT_FAMILY, 'normal')
    doc.setFontSize(7)
    doc.setTextColor(100, 100, 100)
    doc.text(`${rowLabel(t, 'dashboards.investment.start_date')} ${formatDate(credit.start_date, EXPORT_LANGUAGE)}`, 23, detailY + 10)

    if (credit.maturity_date) {
      doc.text(`${rowLabel(t, 'dashboards.investment.maturity_date')} ${formatDate(credit.maturity_date, EXPORT_LANGUAGE)}`, 70, detailY + 10)
    }

    if (credit.usage_expiration_date) {
      doc.text(`${rowLabel(t, 'dashboards.investment.usage_expires')} ${formatDate(credit.usage_expiration_date, EXPORT_LANGUAGE)}`, 117, detailY + 10)
    }

    let currentY = detailY + 15

    if (hasAllocations) {
      doc.setFont(PDF_FONT_FAMILY, 'bold')
      doc.setFontSize(8)
      doc.setTextColor(30, 58, 138)
      doc.text(rowLabel(t, 'dashboards.investment.pdf_allocations'), 23, currentY)
      currentY += 5

      credit.credit_allocations!.forEach(allocation => {
        const projectName = allocation.project?.name || 'OPEX'
        const allocPercent = allocation.allocated_amount > 0 ? (allocation.allocated_amount / credit.amount) * 100 : 0

        doc.setFont(PDF_FONT_FAMILY, 'normal')
        doc.setFontSize(7)
        doc.setTextColor(60, 60, 60)
        doc.text(`• ${projectName}: ${pdfMoney(allocation.allocated_amount)} (${allocPercent.toFixed(1)}%)`, 26, currentY)

        currentY += 5
      })
    }

    doc.setFont(PDF_FONT_FAMILY, 'bold')
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    const utilizationY = boxHeight - 8
    doc.text(rowLabel(t, 'dashboards.investment.utilization'), 23, yPos + utilizationY)
    doc.text(`${utilizationPercent.toFixed(1)}%`, 187, yPos + utilizationY, { align: 'right' })

    const barStartX = 45
    const barWidth = 142
    doc.setFillColor(226, 232, 240)
    doc.roundedRect(barStartX, yPos + utilizationY - 3, barWidth, 4, 1, 1, 'F')

    const utilBarColor: [number, number, number] = utilizationPercent >= 90 ? [239, 68, 68] : utilizationPercent >= 70 ? [249, 115, 22] : [59, 130, 246]
    doc.setFillColor(...utilBarColor)
    doc.roundedRect(barStartX, yPos + utilizationY - 3, (barWidth * Math.min(utilizationPercent, 100)) / 100, 4, 1, 1, 'F')

    yPos += boxHeight + 3

    if ((creditIdx + 1) % 25 === 0) await yieldToUI()
  }

  if (yPos > 260 && projects.length > 0) {
    doc.addPage()
    yPos = 20
  }

  if (projects.length > 0) {
    yPos = addSectionTitle(doc, t('dashboards.investment.pdf_portfolio_projects'), yPos)

    doc.setFont(PDF_FONT_FAMILY, 'normal')
    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    doc.text(`${rowLabel(t, 'dashboards.investment.pdf_total_projects')} ${projects.length}`, 20, yPos)
    yPos += 5
    doc.text(`${rowLabel(t, 'dashboards.investment.portfolio_value')} ${pdfMoney(financialSummary.total_portfolio_value)}`, 20, yPos)
    yPos += 10

    projects.slice(0, 15).forEach(project => {
      if (yPos > 260) {
        doc.addPage()
        yPos = 20
      }

      doc.setFont(PDF_FONT_FAMILY, 'bold')
      doc.setFontSize(9)
      doc.setTextColor(30, 30, 30)
      doc.text(`• ${project.name}`, 23, yPos)

      doc.setFont(PDF_FONT_FAMILY, 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text(
        `${project.location} | ${rowLabel(t, 'common.budget')} ${pdfMoney(project.budget)} | ${statusLabel(PROJECT_STATUS, project.status, t)}`,
        27,
        yPos + 4
      )

      yPos += 9
    })

    if (projects.length > 15) {
      // Not 'italic': `pdfFont` registers normal and bold only, and jsPDF answers an unregistered
      // style by silently falling back to a WinAnsi standard face — which is the whole bug.
      doc.setFont(PDF_FONT_FAMILY, 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text(t('dashboards.investment.pdf_more_projects', { count: projects.length - 15 }), 23, yPos)
      yPos += 5
    }
  }

  const totalPages = doc.internal.pages.length - 1
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont(PDF_FONT_FAMILY, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(t('pagination.page_info', { current: i, total: totalPages }), 105, 280, { align: 'center' })
    doc.text('Cogni Real Estate Management System', 20, 280)
    doc.text(formatDate(new Date(), EXPORT_LANGUAGE), 190, 280, { align: 'right' })
  }

  doc.save(exportFileName('izvjestaj-investicije', 'pdf'))

  logActivity({
    action: 'export.investment_pdf',
    entity: 'report',
    metadata: {
      severity: 'low',
      format: 'pdf',
      row_count: bankCredits.length,
      project_count: projects.length,
    },
  })
}
