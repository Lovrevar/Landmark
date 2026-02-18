import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from 'date-fns'
import { Project, Task, Subcontractor, Invoice, Apartment } from '../lib/supabase'
import { supabase } from '../lib/supabase'

// Global helper functions for PDF generation
let pdf: jsPDF
let pageWidth: number
let pageHeight: number
let margin: number
let contentWidth: number
let yPosition: number

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

  if (options.color) {
    if (Array.isArray(options.color)) {
      pdf.setTextColor(options.color[0], options.color[1], options.color[2])
    } else {
      pdf.setTextColor(options.color)
    }
  }

  const lines = pdf.splitTextToSize(text, maxWidth)

  for (let i = 0; i < lines.length; i++) {
    checkPageBreak(lineHeight)
    pdf.text(lines[i], x, y + (i * lineHeight))
  }

  return y + (lines.length * lineHeight)
}

// Helper function to add section headers
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
  pdf = new jsPDF('p', 'mm', 'a4')
  pageWidth = pdf.internal.pageSize.getWidth()
  pageHeight = pdf.internal.pageSize.getHeight()
  margin = 20
  contentWidth = pageWidth - (margin * 2)
  
  yPosition = margin
  
  // Header
  pdf.setFillColor(37, 99, 235) // Blue background
  pdf.rect(0, 0, pageWidth, 40, 'F')
  
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(24)
  pdf.setFont('helvetica', 'bold')
  pdf.text('LANDMARK GROUP', margin, 25)
  
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
  pdf.text('LANDMARK GROUP - Confidential Executive Report', margin, footerY)
  pdf.text(`Page ${pdf.getNumberOfPages()}`, pageWidth - margin - 20, footerY)

  // Save the PDF
  const fileName = `LANDMARK_GROUP_Executive_Report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
  pdf.save(fileName)
}

export const generateProjectDetailReport = async (project: any) => {
  pdf = new jsPDF('p', 'mm', 'a4')
  pageWidth = pdf.internal.pageSize.getWidth()
  pageHeight = pdf.internal.pageSize.getHeight()
  margin = 20
  contentWidth = pageWidth - (margin * 2)
  
  yPosition = margin

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
  
  if (project.subcontractors?.some((s: Subcontractor) => {
    const progress = s.cost > 0 ? Math.min(100, (s.budget_realized / s.cost) * 100) : 0
    return new Date(s.deadline) < new Date() && progress < 100
  })) {
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
  pdf.text('LANDMARK GROUP - Confidential Project Report', margin, footerY)
  pdf.text(`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, pageWidth - margin - 50, footerY)

  // Save the PDF
  const fileName = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_Report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
  pdf.save(fileName)
}

export const generateComprehensiveExecutiveReport = async () => {
  pdf = new jsPDF('p', 'mm', 'a4')
  pageWidth = pdf.internal.pageSize.getWidth()
  pageHeight = pdf.internal.pageSize.getHeight()
  margin = 20
  contentWidth = pageWidth - (margin * 2)
  yPosition = margin

  try {
    const [
      projectsData,
      apartmentsData,
      salesData,
      customersData,
      contractsData,
      wirePaymentsData,
      creditAllocationsData,
      banksData,
      bankCreditsData,
      subcontractorsData,
      phasesData,
      workLogsData
    ] = await Promise.all([
      supabase.from('projects').select('*'),
      supabase.from('apartments').select('*'),
      supabase.from('sales').select('*'),
      supabase.from('customers').select('*'),
      supabase.from('contracts').select('*'),
      supabase.from('subcontractor_payments').select('*'),
      supabase.from('credit_allocations').select('*'),
      supabase.from('banks').select('*'),
      supabase.from('bank_credits').select('*'),
      supabase.from('subcontractors').select('*'),
      supabase.from('project_phases').select('*'),
      supabase.from('work_logs').select('*')
    ])

    const projects = projectsData.data || []
    const apartments = apartmentsData.data || []
    const sales = salesData.data || []
    const customers = customersData.data || []
    const contracts = contractsData.data || []
    const wirePayments = wirePaymentsData.data || []
    const creditAllocations = creditAllocationsData.data || []
    const banks = banksData.data || []
    const bankCredits = bankCreditsData.data || []
    const subcontractors = subcontractorsData.data || []
    const phases = phasesData.data || []
    const workLogs = workLogsData.data || []

    pdf.setFillColor(37, 99, 235)
    pdf.rect(0, 0, pageWidth, 45, 'F')

    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(26)
    pdf.setFont('helvetica', 'bold')
    pdf.text('LANDMARK GROUP', margin, 22)

    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'normal')
    pdf.text('Comprehensive Executive Report', margin, 32)

    pdf.setFontSize(10)
    pdf.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, margin, 40)

    pdf.setTextColor(0, 0, 0)
    yPosition = 55

    const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0)
    const totalRevenue = sales.reduce((sum, s) => sum + s.sale_price, 0)
    const totalExpenses = wirePayments.reduce((sum, p) => sum + p.amount, 0)
    const netProfit = totalRevenue - totalExpenses
    const totalEquity = creditAllocations.reduce((sum, alloc) => sum + parseFloat(alloc.allocated_amount || 0), 0)
    const totalDebt = banks.reduce((sum, b) => sum + b.outstanding_debt, 0)
    const activeFunderIds = new Set(
      creditAllocations
        .map(alloc => bankCredits.find(bc => bc.id === alloc.credit_id)?.bank_id)
        .filter(Boolean)
    )
    const activeFundersCount = activeFunderIds.size
    const debtToEquity = totalEquity > 0 ? totalDebt / totalEquity : 0

    pdf.setFillColor(248, 250, 252)
    pdf.rect(margin, yPosition, contentWidth, 8, 'F')
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(37, 99, 235)
    pdf.text('EXECUTIVE SUMMARY', margin + 5, yPosition + 6)
    yPosition += 13

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')

    const summaryPoints = [
      `Portfolio: ${projects.length} projects (${projects.filter(p => p.status === 'In Progress').length} active, ${projects.filter(p => p.status === 'Completed').length} completed)`,
      `Financial: €${(totalRevenue / 1000000).toFixed(1)}M revenue, €${(totalExpenses / 1000000).toFixed(1)}M expenses, €${(netProfit / 1000000).toFixed(1)}M profit (${totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0'}% margin)`,
      `Capital Structure: €${(totalEquity / 1000000).toFixed(1)}M equity, €${(totalDebt / 1000000).toFixed(1)}M debt, ${debtToEquity.toFixed(2)} D/E ratio`,
      `Sales: ${apartments.filter(a => a.status === 'Sold').length}/${apartments.length} units sold (${apartments.length > 0 ? ((apartments.filter(a => a.status === 'Sold').length / apartments.length) * 100).toFixed(1) : '0'}%), ${sales.length} transactions`,
      `Construction: ${contracts.length} contracts, ${subcontractors.length} subcontractors, ${workLogs.length} work logs recorded`
    ]

    summaryPoints.forEach(point => {
      yPosition = addText(`• ${point}`, margin + 5, yPosition + 5, { maxWidth: contentWidth - 10 })
    })
    yPosition += 10

    checkPageBreak(70)
    pdf.setFillColor(248, 250, 252)
    pdf.rect(margin, yPosition, contentWidth, 8, 'F')
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(37, 99, 235)
    pdf.text('KEY PERFORMANCE INDICATORS', margin + 5, yPosition + 6)
    yPosition += 13

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')

    const kpis = [
      { label: 'Portfolio Value', value: `€${(totalBudget / 1000000).toFixed(1)}M` },
      { label: 'Total Revenue', value: `€${(totalRevenue / 1000000).toFixed(1)}M` },
      { label: 'Net Profit', value: `€${(netProfit / 1000000).toFixed(1)}M` },
      { label: 'ROI', value: `${totalBudget > 0 ? ((netProfit / totalBudget) * 100).toFixed(1) : '0'}%` }
    ]

    const kpiY = yPosition
    const kpiColWidth = contentWidth / 4
    kpis.forEach((kpi, index) => {
      const x = margin + (index * kpiColWidth) + 5
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(16)
      pdf.text(kpi.value, x, kpiY + 10)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.text(kpi.label, x, kpiY + 16)
    })
    yPosition += 25

    const kpis2 = [
      { label: 'Sales Rate', value: `${apartments.length > 0 ? ((apartments.filter(a => a.status === 'Sold').length / apartments.length) * 100).toFixed(1) : '0'}%` },
      { label: 'D/E Ratio', value: debtToEquity.toFixed(2) },
      { label: 'Active Projects', value: projects.filter(p => p.status === 'In Progress').length.toString() },
      { label: 'Total Customers', value: customers.length.toString() }
    ]

    const kpi2Y = yPosition
    kpis2.forEach((kpi, index) => {
      const x = margin + (index * kpiColWidth) + 5
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(16)
      pdf.text(kpi.value, x, kpi2Y + 10)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.text(kpi.label, x, kpi2Y + 16)
    })
    yPosition += 30

    checkPageBreak(60)
    pdf.setFillColor(248, 250, 252)
    pdf.rect(margin, yPosition, contentWidth, 8, 'F')
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(34, 197, 94)
    pdf.text('SALES PERFORMANCE', margin + 5, yPosition + 6)
    yPosition += 13

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)

    const totalUnits = apartments.length
    const soldUnits = apartments.filter(a => a.status === 'Sold').length
    const availableUnits = apartments.filter(a => a.status === 'Available').length
    const reservedUnits = apartments.filter(a => a.status === 'Reserved').length
    const avgSalePrice = sales.length > 0 ? totalRevenue / sales.length : 0
    const buyers = customers.filter(c => c.status === 'buyer').length
    const leads = customers.filter(c => c.status === 'lead').length

    const salesMetrics = [
      ['Total Units', totalUnits.toString()],
      ['Units Sold', `${soldUnits} (${totalUnits > 0 ? ((soldUnits / totalUnits) * 100).toFixed(1) : '0'}%)`],
      ['Available', availableUnits.toString()],
      ['Reserved', reservedUnits.toString()],
      ['Total Revenue', `€${totalRevenue.toLocaleString()}`],
      ['Avg Sale Price', `€${avgSalePrice.toLocaleString()}`],
      ['Total Sales', sales.length.toString()],
      ['Buyers', buyers.toString()],
      ['Active Leads', leads.toString()],
      ['Conversion Rate', `${customers.length > 0 ? ((buyers / customers.length) * 100).toFixed(1) : '0'}%`]
    ]

    const leftSales = salesMetrics.slice(0, 5)
    const rightSales = salesMetrics.slice(5)

    leftSales.forEach(([label, value], index) => {
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${label}:`, margin + 5, yPosition + (index * 5))
      pdf.setFont('helvetica', 'normal')
      pdf.text(value, margin + 45, yPosition + (index * 5))
    })

    rightSales.forEach(([label, value], index) => {
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${label}:`, margin + (contentWidth / 2) + 5, yPosition + (index * 5))
      pdf.setFont('helvetica', 'normal')
      pdf.text(value, margin + (contentWidth / 2) + 45, yPosition + (index * 5))
    })
    yPosition += 30

    checkPageBreak(60)
    pdf.setFillColor(248, 250, 252)
    pdf.rect(margin, yPosition, contentWidth, 8, 'F')
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(168, 85, 247)
    pdf.text('FUNDING & FINANCIAL STRUCTURE', margin + 5, yPosition + 6)
    yPosition += 13

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)

    const totalCreditLimit = banks.reduce((sum, b) => sum + b.total_credit_limit, 0)
    const availableCredit = banks.reduce((sum, b) => sum + b.available_funds, 0)
    const avgInterestRate = bankCredits.length > 0 ? bankCredits.reduce((sum, bc) => sum + bc.interest_rate, 0) / bankCredits.length : 0
    const totalMonthlyPayments = bankCredits.reduce((sum, bc) => sum + bc.monthly_payment, 0)

    const fundingMetrics = [
      ['Total Equity Invested', `€${totalEquity.toLocaleString()}`],
      ['Total Debt', `€${totalDebt.toLocaleString()}`],
      ['Debt-to-Equity Ratio', debtToEquity.toFixed(2)],
      ['Total Credit Lines', `€${totalCreditLimit.toLocaleString()}`],
      ['Available Credit', `€${availableCredit.toLocaleString()}`],
      ['Active Funders', activeFundersCount.toString()],
      ['Active Banks', banks.length.toString()],
      ['Bank Credits', bankCredits.length.toString()],
      ['Avg Interest Rate', `${avgInterestRate.toFixed(2)}%`],
      ['Monthly Debt Service', `€${totalMonthlyPayments.toLocaleString()}`]
    ]

    const leftFunding = fundingMetrics.slice(0, 5)
    const rightFunding = fundingMetrics.slice(5)

    leftFunding.forEach(([label, value], index) => {
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${label}:`, margin + 5, yPosition + (index * 5))
      pdf.setFont('helvetica', 'normal')
      pdf.text(value, margin + 50, yPosition + (index * 5))
    })

    rightFunding.forEach(([label, value], index) => {
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${label}:`, margin + (contentWidth / 2) + 5, yPosition + (index * 5))
      pdf.setFont('helvetica', 'normal')
      pdf.text(value, margin + (contentWidth / 2) + 50, yPosition + (index * 5))
    })
    yPosition += 30

    checkPageBreak(60)
    pdf.setFillColor(248, 250, 252)
    pdf.rect(margin, yPosition, contentWidth, 8, 'F')
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(245, 158, 11)
    pdf.text('CONSTRUCTION & SUPERVISION STATUS', margin + 5, yPosition + 6)
    yPosition += 13

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)

    const activeContracts = contracts.filter(c => c.status === 'active').length
    const completedContracts = contracts.filter(c => c.status === 'completed').length
    const totalContractValue = contracts.reduce((sum, c) => sum + c.contract_amount, 0)
    const budgetRealized = contracts.reduce((sum, c) => sum + c.budget_realized, 0)
    const completedPhases = phases.filter(p => p.status === 'completed').length
    const recentWorkLogs = workLogs.filter(wl => {
      const logDate = new Date(wl.date)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return logDate >= weekAgo
    }).length

    const constructionMetrics = [
      ['Total Contracts', contracts.length.toString()],
      ['Active Contracts', activeContracts.toString()],
      ['Completed Contracts', completedContracts.toString()],
      ['Contract Value', `€${totalContractValue.toLocaleString()}`],
      ['Budget Realized', `€${budgetRealized.toLocaleString()}`],
      ['Budget Utilization', `${totalContractValue > 0 ? ((budgetRealized / totalContractValue) * 100).toFixed(1) : '0'}%`],
      ['Total Subcontractors', subcontractors.length.toString()],
      ['Total Phases', phases.length.toString()],
      ['Completed Phases', completedPhases.toString()],
      ['Work Logs (7 days)', recentWorkLogs.toString()]
    ]

    const leftConstruction = constructionMetrics.slice(0, 5)
    const rightConstruction = constructionMetrics.slice(5)

    leftConstruction.forEach(([label, value], index) => {
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${label}:`, margin + 5, yPosition + (index * 5))
      pdf.setFont('helvetica', 'normal')
      pdf.text(value, margin + 50, yPosition + (index * 5))
    })

    rightConstruction.forEach(([label, value], index) => {
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${label}:`, margin + (contentWidth / 2) + 5, yPosition + (index * 5))
      pdf.setFont('helvetica', 'normal')
      pdf.text(value, margin + (contentWidth / 2) + 50, yPosition + (index * 5))
    })
    yPosition += 30

    checkPageBreak(60)
    pdf.setFillColor(248, 250, 252)
    pdf.rect(margin, yPosition, contentWidth, 8, 'F')
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(59, 130, 246)
    pdf.text('CASH FLOW ANALYSIS', margin + 5, yPosition + 6)
    yPosition += 13

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)

    const last6Months = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i)
      const monthStart = startOfMonth(monthDate)
      const monthEnd = endOfMonth(monthDate)

      const monthSales = sales.filter(s => {
        const saleDate = new Date(s.sale_date)
        return saleDate >= monthStart && saleDate <= monthEnd
      })

      const monthPayments = wirePayments.filter(p => {
        const paymentDate = new Date(p.created_at)
        return paymentDate >= monthStart && paymentDate <= monthEnd
      })

      const inflow = monthSales.reduce((sum, s) => sum + s.sale_price, 0)
      const outflow = monthPayments.reduce((sum, p) => sum + p.amount, 0)

      last6Months.push({
        month: format(monthDate, 'MMM yyyy'),
        inflow,
        outflow,
        net: inflow - outflow
      })
    }

    pdf.setFont('helvetica', 'bold')
    pdf.text('Month', margin + 5, yPosition)
    pdf.text('Inflow', margin + 35, yPosition)
    pdf.text('Outflow', margin + 70, yPosition)
    pdf.text('Net Cash Flow', margin + 110, yPosition)
    yPosition += 6

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)

    last6Months.forEach(month => {
      checkPageBreak(6)
      pdf.text(month.month, margin + 5, yPosition)
      pdf.text(`€${(month.inflow / 1000).toFixed(0)}K`, margin + 35, yPosition)
      pdf.text(`€${(month.outflow / 1000).toFixed(0)}K`, margin + 70, yPosition)

      const netColor = month.net >= 0 ? [34, 197, 94] : [239, 68, 68]
      pdf.setTextColor(netColor[0], netColor[1], netColor[2])
      pdf.text(`€${(month.net / 1000).toFixed(0)}K`, margin + 110, yPosition)
      pdf.setTextColor(0, 0, 0)

      yPosition += 5
    })
    yPosition += 10

    pdf.setFontSize(10)
    const totalInflow = last6Months.reduce((sum, m) => sum + m.inflow, 0)
    const totalOutflow = last6Months.reduce((sum, m) => sum + m.outflow, 0)
    const totalNet = totalInflow - totalOutflow

    pdf.setFont('helvetica', 'bold')
    pdf.text('6-Month Totals:', margin + 5, yPosition)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Inflow: €${(totalInflow / 1000000).toFixed(2)}M | Outflow: €${(totalOutflow / 1000000).toFixed(2)}M | Net: €${(totalNet / 1000000).toFixed(2)}M`, margin + 5, yPosition + 5)
    yPosition += 15

    checkPageBreak(80)
    pdf.setFillColor(248, 250, 252)
    pdf.rect(margin, yPosition, contentWidth, 8, 'F')
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(37, 99, 235)
    pdf.text('PROJECT-BY-PROJECT BREAKDOWN', margin + 5, yPosition + 6)
    yPosition += 13

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)

    projects.forEach(project => {
      checkPageBreak(50)

      pdf.setFillColor(230, 230, 230)
      pdf.rect(margin, yPosition, contentWidth, 7, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text(project.name, margin + 3, yPosition + 5)
      pdf.setFontSize(8)
      pdf.text(project.location, pageWidth - margin - 50, yPosition + 5)
      yPosition += 10

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')

      const projectApartments = apartments.filter(a => a.project_id === project.id)
      const projectSales = sales.filter(s => {
        const apt = apartments.find(a => a.id === s.apartment_id)
        return apt && apt.project_id === project.id
      })
      const projectContracts = contracts.filter(c => c.project_id === project.id)
      const projectPayments = wirePayments.filter(p => {
        const contract = contracts.find(c => c.id === p.contract_id)
        return contract && contract.project_id === project.id
      })
      const projectPhases = phases.filter(ph => ph.project_id === project.id)
      const projectCredits = bankCredits.filter(bc => bc.project_id === project.id)
      const projectAllocations = creditAllocations.filter(alloc => alloc.project_id === project.id)

      const projectRevenue = projectSales.reduce((sum, s) => sum + s.sale_price, 0)
      const projectExpenses = projectPayments.reduce((sum, p) => sum + p.amount, 0)
      const projectEquity = projectAllocations.reduce((sum, alloc) => sum + parseFloat(alloc.allocated_amount || 0), 0)
      const projectDebt = projectCredits.reduce((sum, bc) => sum + bc.outstanding_balance, 0)
      const soldUnitsProj = projectApartments.filter(a => a.status === 'Sold').length
      const salesRate = projectApartments.length > 0 ? (soldUnitsProj / projectApartments.length) * 100 : 0

      const projectInfo = [
        `Status: ${project.status}`,
        `Budget: €${project.budget.toLocaleString()}`,
        `Revenue: €${projectRevenue.toLocaleString()}`,
        `Expenses: €${projectExpenses.toLocaleString()}`,
        `Units: ${soldUnitsProj}/${projectApartments.length} sold (${salesRate.toFixed(1)}%)`,
        `Contracts: ${projectContracts.length}`,
        `Phases: ${projectPhases.filter(p => p.status === 'completed').length}/${projectPhases.length} done`,
        `Funding: €${projectEquity.toLocaleString()} equity, €${projectDebt.toLocaleString()} debt`
      ]

      projectInfo.forEach((info, index) => {
        const col = index < 4 ? 0 : 1
        const row = index % 4
        pdf.text(info, margin + 5 + (col * (contentWidth / 2)), yPosition + (row * 4))
      })
      yPosition += 18

      const budgetUsage = project.budget > 0 ? (projectExpenses / project.budget) * 100 : 0
      let riskLevel = 'Low'
      let riskColor = [34, 197, 94]

      if (budgetUsage > 90 || salesRate < 30) {
        riskLevel = 'High'
        riskColor = [239, 68, 68]
      } else if (budgetUsage > 75 || salesRate < 50) {
        riskLevel = 'Medium'
        riskColor = [245, 158, 11]
      }

      pdf.setFont('helvetica', 'bold')
      pdf.text('Risk:', margin + 5, yPosition)
      pdf.setTextColor(riskColor[0], riskColor[1], riskColor[2])
      pdf.text(riskLevel, margin + 20, yPosition)
      pdf.setTextColor(0, 0, 0)

      yPosition += 8
      pdf.setDrawColor(200, 200, 200)
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 8
    })

    checkPageBreak(60)
    pdf.setFillColor(248, 250, 252)
    pdf.rect(margin, yPosition, contentWidth, 8, 'F')
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(239, 68, 68)
    pdf.text('RISK ASSESSMENT', margin + 5, yPosition + 6)
    yPosition += 13

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')

    const risks = []

    if (debtToEquity > 2) {
      risks.push(`• HIGH LEVERAGE: Debt-to-Equity ratio of ${debtToEquity.toFixed(2)} exceeds recommended threshold`)
    }

    const lowSalesProjects = projects.filter(p => {
      const projectApts = apartments.filter(a => a.project_id === p.id)
      const sold = projectApts.filter(a => a.status === 'Sold').length
      return projectApts.length > 0 && (sold / projectApts.length) < 0.4
    })
    if (lowSalesProjects.length > 0) {
      risks.push(`• SLOW SALES: ${lowSalesProjects.length} project(s) with sales rate below 40%`)
    }

    const highBudgetProjects = projects.filter(p => {
      const projContracts = contracts.filter(c => c.project_id === p.id)
      const spent = projContracts.reduce((sum, c) => sum + c.budget_realized, 0)
      return p.budget > 0 && (spent / p.budget) > 0.9
    })
    if (highBudgetProjects.length > 0) {
      risks.push(`• BUDGET OVERRUN: ${highBudgetProjects.length} project(s) with over 90% budget utilization`)
    }

    const overdueContracts = contracts.filter(c => {
      const deadline = new Date(c.deadline)
      return deadline < new Date() && c.status !== 'completed'
    })
    if (overdueContracts.length > 0) {
      risks.push(`• TIMELINE DELAYS: ${overdueContracts.length} overdue contract(s) requiring immediate attention`)
    }

    if (availableCredit < totalMonthlyPayments * 3) {
      risks.push(`• LIQUIDITY CONCERN: Available credit may not cover 3 months of debt service`)
    }

    if (risks.length === 0) {
      pdf.setTextColor(34, 197, 94)
      pdf.setFont('helvetica', 'bold')
      pdf.text('NO CRITICAL RISKS IDENTIFIED', margin + 5, yPosition)
      pdf.setTextColor(0, 0, 0)
      pdf.setFont('helvetica', 'normal')
      yPosition += 6
      pdf.text('Portfolio is operating within acceptable risk parameters.', margin + 5, yPosition)
    } else {
      risks.forEach(risk => {
        yPosition = addText(risk, margin + 5, yPosition + 5, { maxWidth: contentWidth - 10 })
      })
    }
    yPosition += 15

    checkPageBreak(60)
    pdf.setFillColor(248, 250, 252)
    pdf.rect(margin, yPosition, contentWidth, 8, 'F')
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(34, 197, 94)
    pdf.text('EXECUTIVE INSIGHTS & RECOMMENDATIONS', margin + 5, yPosition + 6)
    yPosition += 13

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')

    const recommendations = []

    const topPerformers = projects.map(p => {
      const projApts = apartments.filter(a => a.project_id === p.id)
      const projSales = sales.filter(s => {
        const apt = apartments.find(a => a.id === s.apartment_id)
        return apt && apt.project_id === p.id
      })
      const revenue = projSales.reduce((sum, s) => sum + s.sale_price, 0)
      const sold = projApts.filter(a => a.status === 'Sold').length
      const rate = projApts.length > 0 ? (sold / projApts.length) * 100 : 0
      return { name: p.name, revenue, rate }
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 3)

    if (topPerformers.length > 0) {
      recommendations.push('TOP PERFORMING PROJECTS:')
      topPerformers.forEach(tp => {
        recommendations.push(`  - ${tp.name}: €${(tp.revenue / 1000000).toFixed(1)}M revenue, ${tp.rate.toFixed(1)}% sales rate`)
      })
      recommendations.push('')
    }

    recommendations.push('STRATEGIC RECOMMENDATIONS:')

    const overallSalesRate = totalUnits > 0 ? (soldUnits / totalUnits) * 100 : 0

    if (overallSalesRate < 60) {
      recommendations.push('• Intensify marketing efforts to accelerate sales velocity')
    }

    if (debtToEquity > 1.5) {
      recommendations.push('• Consider equity fundraising to optimize capital structure')
    }

    if (leads > buyers * 3) {
      recommendations.push('• Focus on lead conversion - strong pipeline but lower conversion')
    }

    if (totalNet < 0) {
      recommendations.push('• Cash flow negative - prioritize collections and manage outflows')
    }

    if (availableUnits > soldUnits) {
      recommendations.push('• Significant inventory available - consider pricing strategies')
    }

    recommendations.push('• Continue monitoring project budgets and timeline adherence')
    recommendations.push('• Maintain strong relationships with financing partners')

    recommendations.forEach(rec => {
      yPosition = addText(rec, margin + 5, yPosition + 5, { maxWidth: contentWidth - 10 })
    })

    for (let i = 1; i <= pdf.getNumberOfPages(); i++) {
      pdf.setPage(i)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(107, 114, 128)
      pdf.text('LANDMARK GROUP - Confidential Executive Report', margin, pageHeight - 10)
      pdf.text(`Page ${i} of ${pdf.getNumberOfPages()}`, pageWidth - margin - 20, pageHeight - 10)
    }

    const fileName = `LANDMARK_Comprehensive_Executive_Report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
    pdf.save(fileName)

  } catch (error) {
    console.error('Error generating comprehensive report:', error)
    throw error
  }
}