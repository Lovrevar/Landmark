import { format } from 'date-fns'
import type { ProjectSupervisionReport } from '../types'

export async function generateSupervisionReportPDF(
  projectReport: ProjectSupervisionReport,
  dateRange: { start: string; end: string }
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF('p', 'mm', 'a4')

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - (margin * 2)
  let yPosition = margin

  const checkPageBreak = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin) {
      pdf.addPage()
      yPosition = margin
      return true
    }
    return false
  }

  const addText = (text: string, x: number, y: number, options: { fontSize?: number; maxWidth?: number; lineHeight?: number; style?: string; color?: number[] } = {}) => {
    const fontSize = options.fontSize || 10
    const maxWidth = options.maxWidth || contentWidth
    const lineHeight = options.lineHeight || fontSize * 0.35

    pdf.setFontSize(fontSize)
    if (options.style) pdf.setFont('helvetica', options.style)
    if (options.color) pdf.setTextColor(options.color[0], options.color[1], options.color[2])

    const lines = pdf.splitTextToSize(text, maxWidth)
    for (let i = 0; i < lines.length; i++) {
      checkPageBreak(lineHeight)
      pdf.text(lines[i], x, y + (i * lineHeight))
    }
    return y + (lines.length * lineHeight)
  }

  pdf.setFillColor(37, 99, 235)
  pdf.rect(0, 0, pageWidth, 35, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text('LANDMARK GROUP Supervision Report', margin, 20)
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'normal')
  pdf.text(projectReport.project.name, margin, 28)
  pdf.setTextColor(0, 0, 0)
  yPosition = 45

  pdf.setFontSize(10)
  pdf.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, margin, yPosition)
  pdf.text(`Report Period: ${format(new Date(dateRange.start), 'MMM dd, yyyy')} - ${format(new Date(dateRange.end), 'MMM dd, yyyy')}`, margin, yPosition + 5)
  yPosition += 20

  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(37, 99, 235)
  yPosition = addText('Project Overview', margin, yPosition, { fontSize: 14, style: 'bold', color: [37, 99, 235] })
  yPosition += 5

  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')

  const overviewData = [
    ['Location', projectReport.project.location],
    ['Status', projectReport.project.status],
    ['Start Date', format(new Date(projectReport.project.start_date), 'MMMM dd, yyyy')],
    ['Total Budget', `€${projectReport.total_budget.toLocaleString()}`],
    ['Budget Used', `€${projectReport.total_payments.toLocaleString()}`],
    ['Remaining Budget', `€${projectReport.remaining_budget.toLocaleString()}`],
    ['Budget Utilization', `${projectReport.total_budget > 0 ? ((projectReport.budget_used / projectReport.total_budget) * 100).toFixed(1) : '0'}%`],
    ['Total Contracts', projectReport.total_contracts.toString()],
    ['Active Contracts', projectReport.active_contracts.toString()],
    ['Completed Contracts', projectReport.completed_contracts.toString()],
    ['Total Phases', projectReport.total_phases.toString()],
    ['Completed Phases', projectReport.completed_phases.toString()],
    ['Total Subcontractors', projectReport.total_subcontractors.toString()],
    ['Total Payments', `€${projectReport.total_payments.toLocaleString()}`],
    ['Work Logs', projectReport.total_work_logs.toString()]
  ]

  overviewData.forEach(([label, value], index) => {
    const y = yPosition + (index * 6)
    checkPageBreak(6)

    pdf.setFont('helvetica', 'bold')
    pdf.text(`${label}:`, margin + 5, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(value, margin + 60, y)
  })

  yPosition += (overviewData.length * 6) + 15

  checkPageBreak(40)
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(37, 99, 235)
  yPosition = addText('Monthly Budget Performance', margin, yPosition, { fontSize: 14, style: 'bold', color: [37, 99, 235] })
  yPosition += 10

  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')

  projectReport.monthly_data.forEach((month, index) => {
    checkPageBreak(8)
    const y = yPosition + (index * 8)
    pdf.text(`${month.month}:`, margin + 5, y)
    pdf.text(`${month.contracts} contracts`, margin + 40, y)
    pdf.text(`€${month.payments.toLocaleString()} paid`, margin + 80, y)
    if (month.subcontractors_paid !== 'None') {
      pdf.setFontSize(8)
      pdf.text(`Paid: ${month.subcontractors_paid}`, margin + 5, y + 4)
      pdf.setFontSize(10)
    }
  })

  yPosition += (projectReport.monthly_data.length * 6) + 15

  checkPageBreak(40)
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(37, 99, 235)
  yPosition = addText('Contract Details', margin, yPosition, { fontSize: 14, style: 'bold', color: [37, 99, 235] })
  yPosition += 10

  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')

  projectReport.contracts.forEach((contract, index) => {
    checkPageBreak(8)
    const y = yPosition + (index * 8)
    const statusColor = contract.status === 'completed' ? [34, 197, 94] :
                      contract.status === 'active' ? [59, 130, 246] :
                      [156, 163, 175]

    pdf.text(`${contract.contract_number}:`, margin + 5, y)
    pdf.text(`€${contract.contract_amount.toLocaleString()}`, margin + 50, y)
    pdf.text(`Spent: €${contract.budget_realized.toLocaleString()}`, margin + 90, y)

    pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2])
    pdf.setFont('helvetica', 'bold')
    pdf.text(contract.status.toUpperCase(), margin + 140, y)
    pdf.setTextColor(0, 0, 0)
    pdf.setFont('helvetica', 'normal')
  })

  yPosition += (projectReport.contracts.length * 8) + 15

  checkPageBreak(40)
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(37, 99, 235)
  yPosition = addText('Work Logs Summary', margin, yPosition, { fontSize: 14, style: 'bold', color: [37, 99, 235] })
  yPosition += 10

  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')

  if (projectReport.work_logs.length === 0) {
    pdf.text('No work logs recorded during this period', margin + 5, yPosition)
    yPosition += 10
  } else {
    projectReport.work_logs.slice(0, 10).forEach((log, index) => {
      checkPageBreak(12)
      const y = yPosition + (index * 12)

      pdf.setFont('helvetica', 'bold')
      pdf.text(`${format(new Date(log.date), 'MMM dd, yyyy')} - ${log.subcontractors?.name || 'Unknown'}`, margin + 5, y)

      pdf.setFont('helvetica', 'normal')
      const descriptionLines = pdf.splitTextToSize(log.work_description, contentWidth - 10)
      pdf.text(descriptionLines[0], margin + 5, y + 4)

      if (log.contracts) {
        pdf.setFontSize(8)
        pdf.setTextColor(100, 100, 100)
        pdf.text(`Contract: ${log.contracts.contract_number}`, margin + 5, y + 8)
        pdf.setTextColor(0, 0, 0)
        pdf.setFontSize(9)
      }
    })

    if (projectReport.work_logs.length > 10) {
      yPosition += (10 * 12) + 5
      checkPageBreak(6)
      pdf.setFont('helvetica', 'italic')
      pdf.setTextColor(100, 100, 100)
      pdf.text(`... and ${projectReport.work_logs.length - 10} more work logs`, margin + 5, yPosition)
      pdf.setTextColor(0, 0, 0)
      yPosition += 10
    } else {
      yPosition += (projectReport.work_logs.length * 12) + 10
    }
  }

  const footerY = pageHeight - 15
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(107, 114, 128)
  pdf.text('LANDMARK GROUP - Supervision Report', margin, footerY)
  pdf.text(`Page ${pdf.getNumberOfPages()}`, pageWidth - margin - 20, footerY)

  const fileName = `Supervision_Report_${projectReport.project.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
  pdf.save(fileName)
}
