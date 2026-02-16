import { format } from 'date-fns'

interface Project {
  id: string
  name: string
  location: string
  budget: number
  status: string
  investor: string
  start_date: string
  end_date: string
}

interface Company {
  id: string
  name: string
  oib: string
}

interface CreditAllocation {
  id: string
  credit_id: string
  project_id: string | null
  allocated_amount: number
  used_amount: number
  description: string | null
  project?: Project
}

interface BankCredit {
  id: string
  credit_name: string
  company_id: string
  project_id: string | null
  amount: number
  used_amount: number
  repaid_amount: number
  outstanding_balance: number
  interest_rate: number
  start_date: string
  maturity_date: string | null
  usage_expiration_date: string | null
  status: string
  credit_type: string
  company?: Company
  project?: Project
  credit_allocations?: CreditAllocation[]
}

interface FinancialSummary {
  total_portfolio_value: number
  total_debt: number
  total_equity: number
  debt_to_equity_ratio: number
  weighted_avg_interest: number
  upcoming_maturities: number
  total_credit_lines: number
  available_credit: number
  total_used_credit: number
  total_repaid_credit: number
}

const formatEuropean = (value: number): string => {
  return value.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const addHeader = (doc: any, yPos: number) => {
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, 210, yPos, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text('INVESTMENT DASHBOARD REPORT', 105, yPos / 2 - 5, { align: 'center' })

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, 105, yPos / 2 + 5, { align: 'center' })

  doc.setTextColor(0, 0, 0)
  return yPos + 10
}

const addSectionTitle = (doc: any, title: string, yPos: number) => {
  doc.setFillColor(241, 245, 249)
  doc.rect(14, yPos - 2, 182, 10, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(30, 58, 138)
  doc.text(title, 20, yPos + 5)

  doc.setTextColor(0, 0, 0)
  return yPos + 15
}

const drawDonutChart = (doc: any, x: number, y: number, outerRadius: number, innerRadius: number, data: { label: string, value: number, color: number[] }[]) => {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  if (total === 0) return

  let currentAngle = 0

  data.forEach((item) => {
    const sliceAngle = (item.value / total) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + sliceAngle

    doc.setFillColor(item.color[0], item.color[1], item.color[2])
    doc.setDrawColor(255, 255, 255)
    doc.setLineWidth(0.5)

    const numSegments = Math.max(30, Math.ceil(sliceAngle / 2))
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
        'FD'
      )
    }

    const midAngle = ((startAngle + endAngle) / 2) * Math.PI / 180
    const percentage = ((item.value / total) * 100).toFixed(0)
    const labelRadius = (outerRadius + innerRadius) / 2
    const labelX = x + labelRadius * Math.cos(midAngle)
    const labelY = y + labelRadius * Math.sin(midAngle) + 1

    if (Number(percentage) > 5) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(255, 255, 255)
      doc.text(`${percentage}%`, labelX, labelY, { align: 'center' })
    }

    currentAngle = endAngle
  })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  doc.text('Total', x, y - 1, { align: 'center' })
  doc.setFontSize(9)
  doc.text(`€${formatEuropean(total)}`, x, y + 4, { align: 'center' })

  let legendY = y - (data.length * 5.5)
  const legendX = x + outerRadius + 15

  data.forEach(item => {
    doc.setFillColor(item.color[0], item.color[1], item.color[2])
    doc.roundedRect(legendX, legendY - 2.5, 5, 5, 1, 1, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(30, 30, 30)
    doc.text(item.label, legendX + 8, legendY + 1.5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(`€${formatEuropean(item.value)} (${((item.value / total) * 100).toFixed(1)}%)`, legendX + 8, legendY + 6)

    legendY += 11
  })

  doc.setTextColor(0, 0, 0)
}

const drawBarChart = (doc: any, x: number, y: number, width: number, height: number, data: { label: string, value: number, max: number, color?: number[] }[]) => {
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

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(30, 30, 30)

    const labelText = item.label.length > 20 ? item.label.substring(0, 18) + '...' : item.label
    doc.text(labelText, x - 2, barY + barHeight / 2 + 0.8, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    const valueText = `€${formatEuropean(item.value)}`
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
  projects: Project[],
  companies: Company[]
) => {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()

  let yPos = addHeader(doc, 40)

  yPos = addSectionTitle(doc, 'EXECUTIVE SUMMARY', yPos)

  const statBoxes = [
    { label: 'Portfolio Value', value: financialSummary.total_portfolio_value, color: [59, 130, 246] },
    { label: 'Outstanding Debt', value: financialSummary.total_debt, color: [239, 68, 68] },
    { label: 'Available Investments', value: financialSummary.available_credit, color: [34, 197, 94] },
    { label: 'Used Credit', value: financialSummary.total_used_credit, color: [168, 85, 247] }
  ]

  const boxWidth = 42
  const boxHeight = 20
  let boxX = 20

  statBoxes.forEach(box => {
    doc.setFillColor(...box.color)
    doc.roundedRect(boxX, yPos, boxWidth, boxHeight, 2, 2, 'F')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(box.label, boxX + boxWidth / 2, yPos + 6, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(`€${formatEuropean(box.value)}`, boxX + boxWidth / 2, yPos + 15, { align: 'center' })

    boxX += boxWidth + 5
  })

  yPos += boxHeight + 15

  const utilizationRate = financialSummary.total_credit_lines > 0
    ? (financialSummary.total_used_credit / financialSummary.total_credit_lines) * 100
    : 0

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  doc.text(`Investment Utilization Rate: ${utilizationRate.toFixed(1)}%`, 20, yPos)

  doc.setFillColor(226, 232, 240)
  doc.roundedRect(20, yPos + 3, 170, 6, 1, 1, 'F')

  const progressColor = utilizationRate >= 90 ? [239, 68, 68] : utilizationRate >= 70 ? [249, 115, 22] : [59, 130, 246]
  doc.setFillColor(...progressColor)
  doc.roundedRect(20, yPos + 3, (170 * Math.min(utilizationRate, 100)) / 100, 6, 1, 1, 'F')

  yPos += 15

  yPos = addSectionTitle(doc, 'KEY METRICS', yPos)

  const activeCredits = bankCredits.filter(c => c.status === 'active').length
  const highUtilizationCredits = bankCredits.filter(c => {
    const util = c.amount > 0 ? (c.used_amount / c.amount) * 100 : 0
    return util >= 80
  }).length

  const insights = []
  insights.push(`Total Investment Lines: €${formatEuropean(financialSummary.total_credit_lines)}`)
  insights.push(`Active Investments: ${activeCredits} of ${bankCredits.length}`)
  insights.push(`Average Interest Rate: ${financialSummary.weighted_avg_interest.toFixed(2)}%`)
  if (financialSummary.upcoming_maturities > 0) {
    insights.push(`⚠ ${financialSummary.upcoming_maturities} investment(s) maturing within 90 days`)
  }
  if (highUtilizationCredits > 0) {
    insights.push(`⚠ ${highUtilizationCredits} investment(s) with high utilization (≥80%)`)
  }

  const insightBoxHeight = insights.length * 6 + 8
  doc.setFillColor(240, 249, 255)
  doc.setDrawColor(59, 130, 246)
  doc.setLineWidth(0.5)
  doc.roundedRect(20, yPos, 170, insightBoxHeight, 2, 2, 'FD')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(30, 58, 138)

  yPos += 5
  insights.forEach(insight => {
    doc.text(`• ${insight}`, 23, yPos)
    yPos += 5
  })

  yPos += 8

  yPos = addSectionTitle(doc, 'INVESTMENT DISTRIBUTION BY PROJECT', yPos)

  const projectAllocations = new Map<string, number>()

  bankCredits.forEach(credit => {
    if (credit.credit_allocations && credit.credit_allocations.length > 0) {
      credit.credit_allocations.forEach(allocation => {
        const projectName = allocation.project?.name || 'OPEX'
        const currentAmount = projectAllocations.get(projectName) || 0
        projectAllocations.set(projectName, currentAmount + Number(allocation.allocated_amount))
      })
    } else if (credit.amount > 0) {
      const projectName = credit.project?.name || 'Unallocated'
      const currentAmount = projectAllocations.get(projectName) || 0
      projectAllocations.set(projectName, currentAmount + Number(credit.amount))
    }
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

    drawDonutChart(doc, chartCenterX, chartCenterY, outerRadius, innerRadius, donutData)
    yPos += 70
  } else {
    yPos += 10
  }

  const allAllocations: Array<{ label: string, value: number, max: number, color: number[] }> = []

  bankCredits.forEach(credit => {
    if (credit.credit_allocations && credit.credit_allocations.length > 0) {
      credit.credit_allocations.forEach(allocation => {
        const projectName = allocation.project?.name || 'OPEX'
        const creditLabel = `${credit.credit_name || credit.company?.name || 'Credit'} - ${projectName}`
        const utilPercent = allocation.allocated_amount > 0 ? (allocation.used_amount / allocation.allocated_amount) * 100 : 0
        const color = utilPercent >= 90 ? [239, 68, 68] : utilPercent >= 70 ? [249, 115, 22] : [59, 130, 246]

        allAllocations.push({
          label: creditLabel,
          value: allocation.allocated_amount,
          max: allocation.allocated_amount,
          color
        })
      })
    } else {
      const utilPercent = credit.amount > 0 ? (credit.used_amount / credit.amount) * 100 : 0
      const color = utilPercent >= 90 ? [239, 68, 68] : utilPercent >= 70 ? [249, 115, 22] : [59, 130, 246]
      allAllocations.push({
        label: credit.credit_name || `${credit.company?.name || 'Credit'}`,
        value: credit.amount,
        max: credit.amount,
        color
      })
    }
  })

  const creditUtilizationData = allAllocations.sort((a, b) => Number(b.value) - Number(a.value))

  if (creditUtilizationData.length > 0) {
    const chartHeight = creditUtilizationData.length * 8
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
        yPos = addSectionTitle(doc, 'INVESTMENT ALLOCATIONS BY PROJECT', yPos)
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

  yPos = addSectionTitle(doc, 'ACTIVE INVESTMENTS DETAILS', yPos)

  bankCredits
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .forEach((credit, index) => {
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
      const bgColor = credit.status === 'active' ? [220, 252, 231] : [254, 243, 199]

      doc.setFillColor(...bgColor)
      doc.roundedRect(20, yPos, 170, boxHeight, 2, 2, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(30, 30, 30)
      doc.text(credit.credit_name || `${credit.company?.name || 'Credit'} - ${credit.credit_type.replace('_', ' ')}`, 23, yPos + 5)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(60, 60, 60)

      const detailY = yPos + 11

      doc.text(`Amount: €${formatEuropean(credit.amount)}`, 23, detailY)
      doc.text(`Used: €${formatEuropean(credit.used_amount)}`, 70, detailY)
      doc.text(`Available: €${formatEuropean(credit.amount - credit.used_amount)}`, 117, detailY)

      doc.text(`Outstanding: €${formatEuropean(credit.outstanding_balance)}`, 23, detailY + 5)
      doc.text(`Repaid: €${formatEuropean(credit.repaid_amount)}`, 70, detailY + 5)
      doc.text(`Interest: ${Number(credit.interest_rate).toFixed(2)}%`, 117, detailY + 5)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(100, 100, 100)
      doc.text(`Start: ${format(new Date(credit.start_date), 'MMM dd, yyyy')}`, 23, detailY + 10)

      if (credit.maturity_date) {
        doc.text(`Maturity: ${format(new Date(credit.maturity_date), 'MMM dd, yyyy')}`, 70, detailY + 10)
      }

      if (credit.usage_expiration_date) {
        doc.text(`Usage Expires: ${format(new Date(credit.usage_expiration_date), 'MMM dd, yyyy')}`, 117, detailY + 10)
      }

      let currentY = detailY + 15

      if (hasAllocations) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(30, 58, 138)
        doc.text('Allocations:', 23, currentY)
        currentY += 5

        credit.credit_allocations!.forEach(allocation => {
          const projectName = allocation.project?.name || 'OPEX'
          const allocPercent = allocation.allocated_amount > 0 ? (allocation.allocated_amount / credit.amount) * 100 : 0

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7)
          doc.setTextColor(60, 60, 60)
          doc.text(`• ${projectName}: €${formatEuropean(allocation.allocated_amount)} (${allocPercent.toFixed(1)}%)`, 26, currentY)

          currentY += 5
        })
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      const utilizationY = boxHeight - 8
      doc.text('Utilization:', 23, yPos + utilizationY)
      doc.text(`${utilizationPercent.toFixed(1)}%`, 187, yPos + utilizationY, { align: 'right' })

      const barStartX = 45
      const barWidth = 142
      doc.setFillColor(226, 232, 240)
      doc.roundedRect(barStartX, yPos + utilizationY - 3, barWidth, 4, 1, 1, 'F')

      const utilBarColor = utilizationPercent >= 90 ? [239, 68, 68] : utilizationPercent >= 70 ? [249, 115, 22] : [59, 130, 246]
      doc.setFillColor(...utilBarColor)
      doc.roundedRect(barStartX, yPos + utilizationY - 3, (barWidth * Math.min(utilizationPercent, 100)) / 100, 4, 1, 1, 'F')

      yPos += boxHeight + 3
    })

  if (yPos > 260 && projects.length > 0) {
    doc.addPage()
    yPos = 20
  }

  if (projects.length > 0) {
    yPos = addSectionTitle(doc, 'PORTFOLIO PROJECTS', yPos)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    doc.text(`Total Projects: ${projects.length}`, 20, yPos)
    yPos += 5
    doc.text(`Total Portfolio Value: €${formatEuropean(financialSummary.total_portfolio_value)}`, 20, yPos)
    yPos += 10

    projects.slice(0, 15).forEach(project => {
      if (yPos > 260) {
        doc.addPage()
        yPos = 20
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(30, 30, 30)
      doc.text(`• ${project.name}`, 23, yPos)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text(`${project.location} | Budget: €${formatEuropean(project.budget)} | ${project.status}`, 27, yPos + 4)

      yPos += 9
    })

    if (projects.length > 15) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text(`... and ${projects.length - 15} more projects`, 23, yPos)
      yPos += 5
    }
  }

  const totalPages = doc.internal.pages.length - 1
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Page ${i} of ${totalPages}`, 105, 280, { align: 'center' })
    doc.text(`Cogni Real Estate Management System`, 20, 280)
    doc.text(format(new Date(), 'MMM dd, yyyy'), 190, 280, { align: 'right' })
  }

  doc.save(`Investment_Dashboard_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}
