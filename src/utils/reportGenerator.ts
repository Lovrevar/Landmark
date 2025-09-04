import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { format } from 'date-fns'
import { Project, Task, Subcontractor, Invoice, Apartment } from '../lib/supabase'

interface ProjectWithStats extends Project {
  task_completion: number
  total_expenses: number
  apartment_sales: number
  tasks: Task[]
  subcontractors: Subcontractor[]
  invoices: Invoice[]
  apartments: Apartment[]
}

export const generateDirectorReport = async (projects: ProjectWithStats[]) => {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - (margin * 2)
  
  let yPosition = margin

  // Helper function to add new page if needed
  const checkPageBreak = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin) {
      pdf.addPage()
      yPosition = margin
      return true
    }
    return false
  }

  // Helper function to add text with word wrap
  const addText = (text: string, x: number, y: number, options: any = {}) => {
    const fontSize = options.fontSize || 10
    const maxWidth = options.maxWidth || contentWidth
    const lineHeight = options.lineHeight || fontSize * 0.35
    
    pdf.setFontSize(fontSize)
    if (options.style) pdf.setFont('helvetica', options.style)
    if (options.color) pdf.setTextColor(options.color)
    
    const lines = pdf.splitTextToSize(text, maxWidth)
    
    for (let i = 0; i < lines.length; i++) {
      checkPageBreak(lineHeight)
      pdf.text(lines[i], x, y + (i * lineHeight))
    }
    
    return y + (lines.length * lineHeight)
  }

  // Header
  pdf.setFillColor(37, 99, 235) // Blue background
  pdf.rect(0, 0, pageWidth, 40, 'F')
  
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(24)
  pdf.setFont('helvetica', 'bold')
  pdf.text('ConstructCorp', margin, 25)
  
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Executive Project Report', margin, 32)
  
  pdf.setTextColor(0, 0, 0)
  yPosition = 50

  // Report metadata
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, pageWidth - margin - 50, yPosition)
  pdf.text(`Total Projects: ${projects.length}`, pageWidth - margin - 50, yPosition + 5)
  yPosition += 20

  // Executive Summary
  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(37, 99, 235)
  yPosition = addText('Executive Summary', margin, yPosition, { fontSize: 16, style: 'bold', color: [37, 99, 235] })
  yPosition += 5

  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')

  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0)
  const totalExpenses = projects.reduce((sum, p) => sum + p.total_expenses, 0)
  const totalRevenue = projects.reduce((sum, p) => sum + p.apartment_sales, 0)
  const activeProjects = projects.filter(p => p.status === 'In Progress').length
  const completedProjects = projects.filter(p => p.status === 'Completed').length
  const avgCompletion = projects.length > 0 ? Math.round(projects.reduce((sum, p) => sum + p.task_completion, 0) / projects.length) : 0

  const summaryData = [
    `Portfolio Overview: ${projects.length} total projects with ${activeProjects} currently active and ${completedProjects} completed.`,
    `Financial Performance: $${totalBudget.toLocaleString()} total budget allocated, $${totalExpenses.toLocaleString()} spent, $${totalRevenue.toLocaleString()} revenue generated.`,
    `Overall Progress: ${avgCompletion}% average completion rate across all active projects.`,
    `Profitability: $${(totalRevenue - totalExpenses).toLocaleString()} net profit margin (${totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1) : '0'}%).`
  ]

  for (const item of summaryData) {
    yPosition = addText(`• ${item}`, margin, yPosition + 8, { maxWidth: contentWidth - 10 })
  }

  yPosition += 15

  // Portfolio Performance Metrics
  checkPageBreak(60)
  pdf.setFillColor(248, 250, 252)
  pdf.rect(margin, yPosition, contentWidth, 50, 'F')
  
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(37, 99, 235)
  pdf.text('Portfolio Performance Metrics', margin + 5, yPosition + 12)
  
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(0, 0, 0)
  
  const metricsY = yPosition + 20
  const colWidth = contentWidth / 4
  
  // Metrics columns
  const metrics = [
    { label: 'Total Budget', value: `$${(totalBudget / 1000000).toFixed(1)}M` },
    { label: 'Total Spent', value: `$${(totalExpenses / 1000000).toFixed(1)}M` },
    { label: 'Revenue Generated', value: `$${(totalRevenue / 1000000).toFixed(1)}M` },
    { label: 'Net Profit', value: `$${((totalRevenue - totalExpenses) / 1000000).toFixed(1)}M` }
  ]
  
  metrics.forEach((metric, index) => {
    const x = margin + 5 + (index * colWidth)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(14)
    pdf.text(metric.value, x, metricsY + 8)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.text(metric.label, x, metricsY + 15)
  })
  
  yPosition += 60

  // Project Details
  for (const project of projects) {
    checkPageBreak(80)
    
    // Project header
    pdf.setFillColor(37, 99, 235)
    pdf.rect(margin, yPosition, contentWidth, 15, 'F')
    
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text(project.name, margin + 5, yPosition + 10)
    
    pdf.setFontSize(8)
    pdf.text(project.location, pageWidth - margin - 50, yPosition + 10)
    
    yPosition += 20
    pdf.setTextColor(0, 0, 0)

    // Project overview
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    
    const projectInfo = [
      `Status: ${project.status}`,
      `Timeline: ${format(new Date(project.start_date), 'MMM dd, yyyy')} - ${project.end_date ? format(new Date(project.end_date), 'MMM dd, yyyy') : 'TBD'}`,
      `Budget: $${project.budget.toLocaleString()}`,
      `Expenses: $${project.total_expenses.toLocaleString()}`,
      `Revenue: $${project.apartment_sales.toLocaleString()}`,
      `Completion: ${project.task_completion}%`,
      `Investor: ${project.investor || 'N/A'}`
    ]

    const infoY = yPosition
    const leftCol = projectInfo.slice(0, 4)
    const rightCol = projectInfo.slice(4)

    leftCol.forEach((info, index) => {
      pdf.text(info, margin + 5, infoY + (index * 5))
    })

    rightCol.forEach((info, index) => {
      pdf.text(info, margin + (contentWidth / 2), infoY + (index * 5))
    })

    yPosition += 25

    // Financial breakdown
    if (project.budget > 0) {
      checkPageBreak(30)
      
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Financial Breakdown:', margin + 5, yPosition)
      yPosition += 8

      const budgetUsed = (project.total_expenses / project.budget) * 100
      const profitMargin = project.apartment_sales > 0 ? ((project.apartment_sales - project.total_expenses) / project.apartment_sales * 100) : 0

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      
      // Budget utilization bar
      pdf.text(`Budget Utilization: ${budgetUsed.toFixed(1)}%`, margin + 5, yPosition)
      
      // Draw budget bar
      const barWidth = 100
      const barHeight = 4
      pdf.setFillColor(229, 231, 235) // Gray background
      pdf.rect(margin + 5, yPosition + 2, barWidth, barHeight, 'F')
      
      const usedWidth = (budgetUsed / 100) * barWidth
      const barColor = budgetUsed > 90 ? [239, 68, 68] : budgetUsed > 75 ? [245, 158, 11] : [34, 197, 94]
      pdf.setFillColor(barColor[0], barColor[1], barColor[2])
      pdf.rect(margin + 5, yPosition + 2, Math.min(usedWidth, barWidth), barHeight, 'F')
      
      yPosition += 12

      pdf.text(`Profit Margin: ${profitMargin.toFixed(1)}%`, margin + 5, yPosition)
      pdf.text(`ROI: ${project.budget > 0 ? (((project.apartment_sales - project.total_expenses) / project.budget) * 100).toFixed(1) : '0'}%`, margin + 80, yPosition)
      
      yPosition += 15
    }

    // Risk assessment
    checkPageBreak(20)
    const overdueTasks = project.tasks?.filter(t => new Date(t.deadline) < new Date() && t.status !== 'Completed').length || 0
    const budgetRisk = (project.total_expenses / project.budget) > 0.9
    const timelineRisk = project.end_date ? new Date(project.end_date) < new Date() && project.status !== 'Completed' : false

    let riskLevel = 'Low'
    let riskColor = [34, 197, 94] // Green
    
    if (budgetRisk || timelineRisk || overdueTasks > 2) {
      riskLevel = 'High'
      riskColor = [239, 68, 68] // Red
    } else if ((project.total_expenses / project.budget) > 0.75 || overdueTasks > 0) {
      riskLevel = 'Medium'
      riskColor = [245, 158, 11] // Orange
    }

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text('Risk Assessment:', margin + 5, yPosition)
    pdf.setTextColor(riskColor[0], riskColor[1], riskColor[2])
    pdf.text(riskLevel, margin + 40, yPosition)
    pdf.setTextColor(0, 0, 0)

    if (overdueTasks > 0 || budgetRisk || timelineRisk) {
      yPosition += 8
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      const risks = []
      if (overdueTasks > 0) risks.push(`${overdueTasks} overdue tasks`)
      if (budgetRisk) risks.push('budget exceeded')
      if (timelineRisk) risks.push('timeline overrun')
      pdf.text(`Issues: ${risks.join(', ')}`, margin + 5, yPosition)
    }

    yPosition += 20

    // Add separator line
    pdf.setDrawColor(229, 231, 235)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10
  }

  // Footer
  const footerY = pageHeight - 15
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(107, 114, 128)
  pdf.text('ConstructCorp - Confidential Executive Report', margin, footerY)
  pdf.text(`Page ${pdf.getNumberOfPages()}`, pageWidth - margin - 20, footerY)

  // Save the PDF
  const fileName = `ConstructCorp_Executive_Report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
  pdf.save(fileName)
}

export const generateProjectDetailReport = async (project: any) => {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - (margin * 2)
  
  let yPosition = margin

  // Helper functions
  const checkPageBreak = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin) {
      pdf.addPage()
      yPosition = margin
      return true
    }
    return false
  }

  const addSection = (title: string, color: number[] = [37, 99, 235]) => {
    checkPageBreak(20)
    pdf.setFillColor(color[0], color[1], color[2])
    pdf.rect(margin, yPosition, contentWidth, 12, 'F')
    
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text(title, margin + 5, yPosition + 8)
    
    yPosition += 17
    pdf.setTextColor(0, 0, 0)
  }

  // Header
  pdf.setFillColor(37, 99, 235)
  pdf.rect(0, 0, pageWidth, 35, 'F')
  
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Project Report', margin, 20)
  
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'normal')
  pdf.text(project.name, margin, 28)
  
  pdf.setTextColor(0, 0, 0)
  yPosition = 45

  // Project Overview
  addSection('Project Overview')
  
  const overviewData = [
    ['Location', project.location],
    ['Status', project.status],
    ['Start Date', format(new Date(project.start_date), 'MMMM dd, yyyy')],
    ['End Date', project.end_date ? format(new Date(project.end_date), 'MMMM dd, yyyy') : 'TBD'],
    ['Investor', project.investor || 'N/A'],
    ['Total Budget', `$${project.budget.toLocaleString()}`],
    ['Amount Spent', `$${project.total_spent.toLocaleString()}`],
    ['Revenue Generated', `$${project.total_revenue.toLocaleString()}`],
    ['Expected Profit', `$${(project.total_revenue - project.total_spent).toLocaleString()}`]
  ]

  pdf.setFontSize(10)
  overviewData.forEach(([label, value], index) => {
    const y = yPosition + (index * 6)
    checkPageBreak(6)
    
    pdf.setFont('helvetica', 'bold')
    pdf.text(`${label}:`, margin + 5, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(value, margin + 60, y)
  })

  yPosition += (overviewData.length * 6) + 10

  // Tasks Summary
  if (project.tasks && project.tasks.length > 0) {
    addSection('Tasks Summary')
    
    const tasksByStatus = {
      'Completed': project.tasks.filter((t: Task) => t.status === 'Completed').length,
      'In Progress': project.tasks.filter((t: Task) => t.status === 'In Progress').length,
      'Pending': project.tasks.filter((t: Task) => t.status === 'Pending').length,
      'Overdue': project.tasks.filter((t: Task) => new Date(t.deadline) < new Date() && t.status !== 'Completed').length
    }

    pdf.setFontSize(10)
    Object.entries(tasksByStatus).forEach(([status, count], index) => {
      const y = yPosition + (index * 6)
      checkPageBreak(6)
      
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${status}:`, margin + 5, y)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`${count} tasks`, margin + 40, y)
    })

    yPosition += 30

    // Critical tasks
    const criticalTasks = project.tasks.filter((t: Task) => 
      new Date(t.deadline) < new Date() && t.status !== 'Completed'
    )

    if (criticalTasks.length > 0) {
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(239, 68, 68)
      pdf.text('Critical Tasks (Overdue):', margin + 5, yPosition)
      pdf.setTextColor(0, 0, 0)
      yPosition += 8

      criticalTasks.forEach((task: Task) => {
        checkPageBreak(6)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.text(`• ${task.name} (Due: ${format(new Date(task.deadline), 'MMM dd')})`, margin + 10, yPosition)
        yPosition += 5
      })
      yPosition += 5
    }
  }

  // Subcontractors Summary
  if (project.subcontractors && project.subcontractors.length > 0) {
    addSection('Subcontractors Summary')
    
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    
    project.subcontractors.forEach((sub: Subcontractor, index: number) => {
      checkPageBreak(15)
      
      const isOverdue = new Date(sub.deadline) < new Date() && sub.progress < 100
      
      pdf.setFont('helvetica', 'bold')
      pdf.text(sub.name, margin + 5, yPosition)
      
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.text(`Progress: ${sub.progress}%`, margin + 5, yPosition + 5)
      pdf.text(`Cost: $${sub.cost.toLocaleString()}`, margin + 50, yPosition + 5)
      pdf.text(`Deadline: ${format(new Date(sub.deadline), 'MMM dd, yyyy')}`, margin + 100, yPosition + 5)
      
      if (isOverdue) {
        pdf.setTextColor(239, 68, 68)
        pdf.setFont('helvetica', 'bold')
        pdf.text('OVERDUE', margin + 150, yPosition + 5)
        pdf.setTextColor(0, 0, 0)
      }
      
      pdf.setFontSize(8)
      pdf.text(sub.job_description.substring(0, 80) + (sub.job_description.length > 80 ? '...' : ''), margin + 5, yPosition + 10)
      
      yPosition += 18
    })
  }

  // Financial Analysis
  if (project.apartments && project.apartments.length > 0) {
    addSection('Sales Performance', [34, 197, 94])
    
    const soldUnits = project.apartments.filter((apt: Apartment) => apt.status === 'Sold').length
    const availableUnits = project.apartments.filter((apt: Apartment) => apt.status === 'Available').length
    const reservedUnits = project.apartments.filter((apt: Apartment) => apt.status === 'Reserved').length
    
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    
    const salesData = [
      ['Total Units', project.apartments.length.toString()],
      ['Units Sold', `${soldUnits} (${((soldUnits / project.apartments.length) * 100).toFixed(1)}%)`],
      ['Available Units', availableUnits.toString()],
      ['Reserved Units', reservedUnits.toString()],
      ['Average Price', `$${(project.apartments.reduce((sum: number, apt: Apartment) => sum + apt.price, 0) / project.apartments.length).toLocaleString()}`],
      ['Total Revenue', `$${project.total_revenue.toLocaleString()}`]
    ]

    salesData.forEach(([label, value], index) => {
      const y = yPosition + (index * 6)
      checkPageBreak(6)
      
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${label}:`, margin + 5, y)
      pdf.setFont('helvetica', 'normal')
      pdf.text(value, margin + 60, y)
    })

    yPosition += (salesData.length * 6) + 15
  }

  // Recommendations
  checkPageBreak(40)
  addSection('Recommendations & Next Steps', [168, 85, 247])
  
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  
  const recommendations = []
  
  if ((project.total_expenses / project.budget) > 0.9) {
    recommendations.push('• Monitor budget closely - approaching limit')
  }
  
  if (project.tasks?.some((t: Task) => new Date(t.deadline) < new Date() && t.status !== 'Completed')) {
    recommendations.push('• Address overdue tasks immediately')
  }
  
  if (project.subcontractors?.some((s: Subcontractor) => new Date(s.deadline) < new Date() && s.progress < 100)) {
    recommendations.push('• Follow up with overdue subcontractors')
  }
  
  if (project.completion_percentage < 50 && project.status === 'In Progress') {
    recommendations.push('• Accelerate project timeline to meet deadlines')
  }
  
  if (recommendations.length === 0) {
    recommendations.push('• Project is on track - continue current management approach')
    recommendations.push('• Consider opportunities for cost optimization')
  }

  recommendations.forEach((rec, index) => {
    yPosition = addText(rec, margin + 5, yPosition + 6, { maxWidth: contentWidth - 10 })
  })

  // Footer
  const footerY = pageHeight - 15
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(107, 114, 128)
  pdf.text('ConstructCorp - Confidential Project Report', margin, footerY)
  pdf.text(`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, pageWidth - margin - 50, footerY)

  // Save the PDF
  const fileName = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_Report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
  pdf.save(fileName)
}