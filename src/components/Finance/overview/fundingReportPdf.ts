import { format } from 'date-fns'

interface FundingSource {
  id: string
  type: 'investor' | 'bank'
  name: string
  totalAmount: number
  spentAmount: number
  availableAmount: number
  usageExpirationDate: string | null
  gracePeriod: number
  investmentDate: string
  maturityDate: string | null
  expectedReturn?: number
  interestRate?: number
  status: 'active' | 'expired' | 'expiring_soon' | 'depleted'
  project_id: string
}

interface ProjectFundingSummary {
  project: {
    id: string
    name: string
    location: string
    start_date: string
  }
  totalCommitted: number
  totalSpent: number
  totalAvailable: number
  fundingSources: FundingSource[]
  utilizationRate: number
  warnings: string[]
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
  doc.text('FUNDING OVERVIEW REPORT', 105, yPos / 2 - 5, { align: 'center' })

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, 105, yPos / 2 + 5, { align: 'center' })

  doc.setTextColor(0, 0, 0)
  return yPos + 10
}

const addSectionTitle = (doc: any, title: string, yPos: number, icon?: string) => {
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
  let currentAngle = -Math.PI / 2

  data.forEach(item => {
    const sliceAngle = (item.value / total) * 2 * Math.PI
    const rgb = item.color
    doc.setFillColor(rgb[0], rgb[1], rgb[2])
    doc.setDrawColor(255, 255, 255)
    doc.setLineWidth(1)

    const segments = 100

    for (let i = 0; i < segments; i++) {
      const angle1 = currentAngle + (sliceAngle * i) / segments
      const angle2 = currentAngle + (sliceAngle * (i + 1)) / segments

      const x1_outer = x + outerRadius * Math.cos(angle1)
      const y1_outer = y + outerRadius * Math.sin(angle1)
      const x2_outer = x + outerRadius * Math.cos(angle2)
      const y2_outer = y + outerRadius * Math.sin(angle2)

      const x1_inner = x + innerRadius * Math.cos(angle1)
      const y1_inner = y + innerRadius * Math.sin(angle1)
      const x2_inner = x + innerRadius * Math.cos(angle2)
      const y2_inner = y + innerRadius * Math.sin(angle2)

      doc.lines([
        [x2_outer - x1_outer, y2_outer - y1_outer],
        [x2_inner - x2_outer, y2_inner - y2_outer],
        [x1_inner - x2_inner, y1_inner - y2_inner],
        [x1_outer - x1_inner, y1_outer - y1_inner]
      ], x1_outer, y1_outer, [1, 1], 'FD')
    }

    const midAngle = currentAngle + sliceAngle / 2
    const percentage = ((item.value / total) * 100).toFixed(0)
    const labelRadius = (outerRadius + innerRadius) / 2
    const labelX = x + labelRadius * Math.cos(midAngle)
    const labelY = y + labelRadius * Math.sin(midAngle)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(255, 255, 255)
    doc.text(`${percentage}%`, labelX, labelY, { align: 'center' })

    currentAngle += sliceAngle
  })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(30, 30, 30)
  doc.text('Total', x, y - 2, { align: 'center' })
  doc.setFontSize(10)
  doc.text(`€${formatEuropean(total)}`, x, y + 4, { align: 'center' })

  let legendY = y - (data.length * 4)
  const legendX = x + outerRadius + 20

  data.forEach(item => {
    doc.setFillColor(item.color[0], item.color[1], item.color[2])
    doc.roundedRect(legendX, legendY - 2.5, 5, 5, 1, 1, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(30, 30, 30)
    doc.text(item.label, legendX + 8, legendY + 2)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(`€${formatEuropean(item.value)} (${((item.value / total) * 100).toFixed(1)}%)`, legendX + 8, legendY + 7)

    legendY += 12
  })

  doc.setTextColor(0, 0, 0)
}

const drawBarChart = (doc: any, x: number, y: number, width: number, height: number, data: { label: string, value: number, max: number }[]) => {
  const maxValue = Math.max(...data.map(d => d.max))
  const barHeight = (height - (data.length + 1) * 3) / data.length

  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.1)
  doc.line(x, y, x, y + height)
  doc.line(x, y + height, x + width, y + height)

  data.forEach((item, index) => {
    const barY = y + index * (barHeight + 3)
    const barWidth = maxValue > 0 ? (item.value / maxValue) * width : 0

    doc.setFillColor(226, 232, 240)
    doc.rect(x, barY, width, barHeight, 'F')

    doc.setFillColor(59, 130, 246)
    doc.rect(x, barY, barWidth, barHeight, 'F')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(30, 30, 30)

    const labelText = item.label.length > 20 ? item.label.substring(0, 18) + '...' : item.label
    doc.text(labelText, x - 2, barY + barHeight / 2 + 1, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    if (barWidth > 20) {
      doc.text(`€${formatEuropean(item.value)}`, x + barWidth - 2, barY + barHeight / 2 + 1, { align: 'right' })
    } else {
      doc.setTextColor(59, 130, 246)
      doc.text(`€${formatEuropean(item.value)}`, x + barWidth + 2, barY + barHeight / 2 + 1)
    }
  })

  doc.setTextColor(0, 0, 0)
}

export const generateFundingReportPDF = async (projects: ProjectFundingSummary[]) => {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()

  let yPos = addHeader(doc, 40)

  const totalStats = projects.reduce((acc, p) => ({
    committed: acc.committed + p.totalCommitted,
    spent: acc.spent + p.totalSpent,
    available: acc.available + p.totalAvailable,
    warnings: acc.warnings + p.warnings.length
  }), { committed: 0, spent: 0, available: 0, warnings: 0 })

  yPos = addSectionTitle(doc, 'EXECUTIVE SUMMARY', yPos)

  const statBoxes = [
    { label: 'Total Committed', value: totalStats.committed, color: [59, 130, 246] },
    { label: 'Total Spent', value: totalStats.spent, color: [239, 68, 68] },
    { label: 'Available Funds', value: totalStats.available, color: [34, 197, 94] },
    { label: 'Active Warnings', value: totalStats.warnings, color: [249, 115, 22], isCount: true }
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
    const displayValue = box.isCount ? box.value.toString() : `€${formatEuropean(box.value)}`
    doc.text(displayValue, boxX + boxWidth / 2, yPos + 15, { align: 'center' })

    boxX += boxWidth + 5
  })

  yPos += boxHeight + 15

  const utilizationRate = totalStats.committed > 0 ? (totalStats.spent / totalStats.committed) * 100 : 0

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  doc.text(`Overall Utilization Rate: ${utilizationRate.toFixed(1)}%`, 20, yPos)

  doc.setFillColor(226, 232, 240)
  doc.roundedRect(20, yPos + 3, 170, 6, 1, 1, 'F')

  const progressColor = utilizationRate >= 80 ? [249, 115, 22] : utilizationRate >= 50 ? [59, 130, 246] : [34, 197, 94]
  doc.setFillColor(...progressColor)
  doc.roundedRect(20, yPos + 3, (170 * Math.min(utilizationRate, 100)) / 100, 6, 1, 1, 'F')

  yPos += 15

  yPos = addSectionTitle(doc, 'KEY INSIGHTS & ALERTS', yPos)

  const allWarnings = projects.flatMap(p => p.warnings)
  const activeProjects = projects.length
  const sourcesExpiringSoon = projects.flatMap(p => p.fundingSources.filter(s => s.status === 'expiring_soon')).length
  const sourcesExpired = projects.flatMap(p => p.fundingSources.filter(s => s.status === 'expired')).length
  const sourcesDepleted = projects.flatMap(p => p.fundingSources.filter(s => s.status === 'depleted')).length

  const highUtilizationProjects = projects.filter(p => p.utilizationRate >= 80).length

  const insights = []
  if (highUtilizationProjects > 0) {
    insights.push(`${highUtilizationProjects} project${highUtilizationProjects > 1 ? 's' : ''} with high utilization (≥80%)`)
  }
  if (sourcesExpiringSoon > 0) {
    insights.push(`${sourcesExpiringSoon} funding source${sourcesExpiringSoon > 1 ? 's' : ''} expiring within 30 days`)
  }
  if (sourcesExpired > 0) {
    insights.push(`${sourcesExpired} funding source${sourcesExpired > 1 ? 's' : ''} already expired`)
  }
  if (sourcesDepleted > 0) {
    insights.push(`${sourcesDepleted} funding source${sourcesDepleted > 1 ? 's' : ''} fully depleted`)
  }
  if (allWarnings.length === 0) {
    insights.push('All funding sources are in good standing')
  }

  if (insights.length > 0) {
    const insightBoxHeight = insights.length * 7 + 8
    doc.setFillColor(254, 249, 195)
    doc.setDrawColor(251, 191, 36)
    doc.setLineWidth(0.5)
    doc.roundedRect(20, yPos, 170, insightBoxHeight, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(146, 64, 14)
    doc.text('Important Highlights:', 23, yPos + 5)

    yPos += 10
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(120, 53, 15)
    insights.forEach(insight => {
      doc.text(`• ${insight}`, 25, yPos)
      yPos += 6
    })

    yPos += 5
  }

  yPos += 5

  const investorSources = projects.flatMap(p => p.fundingSources.filter(s => s.type === 'investor'))
  const bankSources = projects.flatMap(p => p.fundingSources.filter(s => s.type === 'bank'))

  const totalInvestorCommitted = investorSources.reduce((sum, s) => sum + s.totalAmount, 0)
  const totalBankCommitted = bankSources.reduce((sum, s) => sum + s.totalAmount, 0)

  yPos = addSectionTitle(doc, 'FUNDING DISTRIBUTION', yPos)

  const donutData = [
    { label: 'Investors', value: totalInvestorCommitted, color: [59, 130, 246] },
    { label: 'Bank Credits', value: totalBankCommitted, color: [34, 197, 94] }
  ].filter(d => d.value > 0)

  if (donutData.length > 0) {
    drawDonutChart(doc, 50, yPos + 25, 20, 10, donutData)
  }

  yPos += 65

  if (yPos > 240) {
    doc.addPage()
    yPos = 20
  }

  yPos = addSectionTitle(doc, 'FUNDING SOURCES SUMMARY', yPos)

  const allSources = projects.flatMap(p => p.fundingSources)
  const totalInvestors = investorSources.length
  const totalBanks = bankSources.length
  const activeSources = allSources.filter(s => s.status === 'active').length

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)

  doc.text(`Total Funding Sources: ${allSources.length}`, 20, yPos)
  yPos += 5
  doc.text(`  • Investors: ${totalInvestors}`, 25, yPos)
  yPos += 5
  doc.text(`  • Bank Credits: ${totalBanks}`, 25, yPos)
  yPos += 5
  doc.text(`Active Sources: ${activeSources}`, 20, yPos)
  yPos += 5
  doc.text(`Expired/Depleted: ${allSources.length - activeSources}`, 20, yPos)
  yPos += 10

  if (yPos > 240) {
    doc.addPage()
    yPos = 20
  }

  yPos = addSectionTitle(doc, 'PROJECT UTILIZATION', yPos)

  const projectUtilizationData = projects.slice(0, 8).map(p => ({
    label: p.project.name,
    value: p.totalSpent,
    max: p.totalCommitted
  }))

  if (projectUtilizationData.length > 0) {
    drawBarChart(doc, 70, yPos, 120, projectUtilizationData.length * 10, projectUtilizationData)
    yPos += projectUtilizationData.length * 10 + 15
  }

  if (yPos > 220) {
    doc.addPage()
    yPos = 20
  }

  projects.forEach((projectSummary, projectIndex) => {
    if (projectIndex > 0 && yPos > 200) {
      doc.addPage()
      yPos = 20
    }

    yPos = addSectionTitle(doc, `PROJECT: ${projectSummary.project.name.toUpperCase()}`, yPos)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(`Location: ${projectSummary.project.location}`, 20, yPos)
    yPos += 5
    doc.text(`Start Date: ${format(new Date(projectSummary.project.start_date), 'MMM dd, yyyy')}`, 20, yPos)
    yPos += 10

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(30, 30, 30)

    const projectStatBoxes = [
      { label: 'Committed', value: projectSummary.totalCommitted, color: [191, 219, 254] },
      { label: 'Spent', value: projectSummary.totalSpent, color: [254, 202, 202] },
      { label: 'Available', value: projectSummary.totalAvailable, color: [187, 247, 208] }
    ]

    let statX = 20
    projectStatBoxes.forEach(stat => {
      doc.setFillColor(...stat.color)
      doc.roundedRect(statX, yPos, 55, 15, 1, 1, 'F')

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(60, 60, 60)
      doc.text(stat.label, statX + 27.5, yPos + 5, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text(`€${formatEuropean(stat.value)}`, statX + 27.5, yPos + 12, { align: 'center' })

      statX += 58
    })

    yPos += 20

    if (projectSummary.warnings.length > 0) {
      doc.setFillColor(254, 243, 199)
      doc.setDrawColor(251, 191, 36)
      doc.setLineWidth(0.5)
      doc.roundedRect(20, yPos, 170, 5 + projectSummary.warnings.length * 5, 2, 2, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(180, 83, 9)
      doc.text('⚠ WARNINGS', 23, yPos + 4)

      yPos += 8
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      projectSummary.warnings.forEach(warning => {
        doc.text(`• ${warning}`, 25, yPos)
        yPos += 4
      })

      yPos += 5
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(30, 30, 30)
    doc.text('Funding Sources:', 20, yPos)
    yPos += 6

    projectSummary.fundingSources.forEach(source => {
      if (yPos > 270) {
        doc.addPage()
        yPos = 20
      }

      const bgColor = source.type === 'investor' ? [219, 234, 254] : [220, 252, 231]
      doc.setFillColor(...bgColor)
      doc.roundedRect(20, yPos, 170, 22, 2, 2, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(30, 30, 30)
      doc.text(source.name, 23, yPos + 5)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(100, 100, 100)
      doc.text(source.type === 'investor' ? 'INVESTOR' : 'BANK', 23, yPos + 9)

      const statusColors: Record<string, number[]> = {
        active: [34, 197, 94],
        expiring_soon: [249, 115, 22],
        expired: [239, 68, 68],
        depleted: [156, 163, 175]
      }
      const statusColor = statusColors[source.status] || [156, 163, 175]
      doc.setFillColor(...statusColor)
      doc.roundedRect(23, yPos + 11, 25, 5, 1, 1, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.text(source.status.replace('_', ' ').toUpperCase(), 35.5, yPos + 14.5, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(60, 60, 60)

      const detailX = 95
      doc.text(`Total: €${formatEuropean(source.totalAmount)}`, detailX, yPos + 6)
      doc.text(`Spent: €${formatEuropean(source.spentAmount)}`, detailX, yPos + 11)
      doc.text(`Available: €${formatEuropean(source.availableAmount)}`, detailX, yPos + 16)

      const utilizationPct = source.totalAmount > 0 ? (source.spentAmount / source.totalAmount) * 100 : 0
      doc.text(`Utilized: ${utilizationPct.toFixed(1)}%`, detailX + 50, yPos + 6)

      if (source.expectedReturn) {
        doc.text(`Return: ${source.expectedReturn}%`, detailX + 50, yPos + 11)
      }
      if (source.interestRate) {
        doc.text(`Interest: ${source.interestRate}%`, detailX + 50, yPos + 11)
      }

      if (source.usageExpirationDate) {
        doc.text(`Expires: ${format(new Date(source.usageExpirationDate), 'MMM dd, yyyy')}`, detailX + 50, yPos + 16)
      }

      yPos += 25
    })

    yPos += 5
  })

  const totalPages = doc.internal.pages.length - 1
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Page ${i} of ${totalPages}`, 105, 290, { align: 'center' })
    doc.text(`Cogni Real Estate Management System`, 20, 290)
    doc.text(format(new Date(), 'MMM dd, yyyy'), 190, 290, { align: 'right' })
  }

  doc.save(`Funding_Overview_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}
