import React, { useState, useEffect } from 'react'
import { supabase, Project, Subcontractor, Contract, WirePayment, ProjectPhase } from '../lib/supabase'
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  Download,
  FileText,
  Activity,
  AlertCircle,
  ClipboardCheck
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns'

interface MonthlyData {
  month: string
  contracts: number
  payments: number
  budget_used: number
}

interface WorkLog {
  id: string
  date: string
  subcontractor_id: string
  work_description: string
  status: string
  color: string
  notes: string | null
  blocker_details: string | null
  created_at: string
  subcontractors?: {
    name: string
  }
  contracts?: {
    contract_number: string
    job_description: string
  }
}

interface ProjectSupervisionReport {
  project: Project
  total_budget: number
  budget_used: number
  remaining_budget: number
  total_contracts: number
  active_contracts: number
  completed_contracts: number
  total_phases: number
  completed_phases: number
  total_subcontractors: number
  total_payments: number
  total_work_logs: number
  monthly_data: MonthlyData[]
  contracts: Contract[]
  phases: ProjectPhase[]
  subcontractors: Subcontractor[]
  payments: WirePayment[]
  work_logs: WorkLog[]
  investors: string
}

const SupervisionReports: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [projectReport, setProjectReport] = useState<ProjectSupervisionReport | null>(null)
  const [dateRange, setDateRange] = useState({
    start: format(subMonths(new Date(), 6), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })
  const [loading, setLoading] = useState(true)
  const [generatingReport, setGeneratingReport] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    if (selectedProject) {
      generateProjectReport()
    }
  }, [selectedProject, dateRange])

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('*')
        .order('name')

      if (error) throw error
      setProjects(projectsData || [])

      if (projectsData && projectsData.length > 0) {
        setSelectedProject(projectsData[0].id)
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateProjectReport = async () => {
    if (!selectedProject) return

    setGeneratingReport(true)
    try {
      const project = projects.find(p => p.id === selectedProject)
      if (!project) return

      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('*')
        .eq('project_id', selectedProject)

      if (contractsError) throw contractsError

      const { data: phasesData, error: phasesError } = await supabase
        .from('project_phases')
        .select('*')
        .eq('project_id', selectedProject)

      if (phasesError) throw phasesError

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('wire_payments')
        .select(`
          *,
          contracts!inner(project_id)
        `)
        .eq('contracts.project_id', selectedProject)

      if (paymentsError) throw paymentsError

      const { data: subcontractorsData, error: subcontractorsError } = await supabase
        .from('subcontractors')
        .select('*')

      if (subcontractorsError) throw subcontractorsError

      const { data: workLogsData, error: workLogsError } = await supabase
        .from('work_logs')
        .select(`
          *,
          subcontractors!work_logs_subcontractor_id_fkey (name),
          contracts!work_logs_contract_id_fkey (contract_number, job_description)
        `)
        .eq('project_id', selectedProject)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: false })

      if (workLogsError) throw workLogsError

      // Fetch bank credits
      const { data: bankCreditsData, error: bankCreditsError } = await supabase
        .from('bank_credits')
        .select('*, banks(name)')
        .eq('project_id', selectedProject)

      if (bankCreditsError) throw bankCreditsError

      // Fetch project investments
      const { data: investmentsData, error: investmentsError } = await supabase
        .from('project_investments')
        .select('*, investors(name)')
        .eq('project_id', selectedProject)

      if (investmentsError) throw investmentsError

      const contracts = contractsData || []
      const phases = phasesData || []
      const payments = paymentsData || []
      const subcontractors = subcontractorsData || []
      const work_logs = workLogsData || []

      const contractSubcontractorIds = contracts.map(c => c.subcontractor_id)
      const projectSubcontractors = subcontractors.filter(s =>
        contractSubcontractorIds.includes(s.id)
      )

      const total_budget = project.budget
      const budget_used = contracts.reduce((sum, c) => sum + c.budget_realized, 0)
      const remaining_budget = total_budget - budget_used
      const total_contracts = contracts.length
      const active_contracts = contracts.filter(c => c.status === 'active').length
      const completed_contracts = contracts.filter(c => c.status === 'completed').length
      const total_phases = phases.length
      const completed_phases = phases.filter(p => p.status === 'completed').length
      const total_subcontractors = projectSubcontractors.length
      const total_payments = payments.reduce((sum, p) => sum + p.amount, 0)
      const total_work_logs = work_logs.length

      // Build investors list
      const investorNames: string[] = []
      if (bankCreditsData && bankCreditsData.length > 0) {
        bankCreditsData.forEach(bc => {
          if (bc.banks?.name && !investorNames.includes(bc.banks.name)) {
            investorNames.push(bc.banks.name)
          }
        })
      }
      if (investmentsData && investmentsData.length > 0) {
        investmentsData.forEach(inv => {
          if (inv.investors?.name && !investorNames.includes(inv.investors.name)) {
            investorNames.push(inv.investors.name)
          }
        })
      }
      const investorsString = investorNames.length > 0 ? investorNames.join(', ') : 'N/A'

      const startDate = new Date(dateRange.start)
      const endDate = new Date(dateRange.end)
      const months = eachMonthOfInterval({ start: startDate, end: endDate })

      const monthly_data: MonthlyData[] = months.map(month => {
        const monthStart = startOfMonth(month)
        const monthEnd = endOfMonth(month)

        const monthPayments = payments.filter(payment => {
          if (!payment.payment_date) return false
          const paymentDate = new Date(payment.payment_date)
          return paymentDate >= monthStart && paymentDate <= monthEnd &&
                 paymentDate >= startDate && paymentDate <= endDate
        })

        const monthContracts = contracts.filter(contract => {
          const contractDate = new Date(contract.created_at)
          return contractDate >= monthStart && contractDate <= monthEnd
        })

        return {
          month: format(month, 'MMM yyyy'),
          contracts: monthContracts.length,
          payments: monthPayments.reduce((sum, p) => sum + p.amount, 0),
          budget_used: monthPayments.reduce((sum, p) => sum + p.amount, 0)
        }
      })

      setProjectReport({
        project,
        total_budget,
        budget_used,
        remaining_budget,
        total_contracts,
        active_contracts,
        completed_contracts,
        total_phases,
        completed_phases,
        total_subcontractors,
        total_payments,
        total_work_logs,
        monthly_data,
        contracts,
        phases,
        subcontractors: projectSubcontractors,
        payments,
        work_logs,
        investors: investorsString
      })
    } catch (error) {
      console.error('Error generating project report:', error)
    } finally {
      setGeneratingReport(false)
    }
  }

  const generatePDFReport = async () => {
    if (!projectReport) return

    try {
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

      const addText = (text: string, x: number, y: number, options: any = {}) => {
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
        checkPageBreak(6)
        const y = yPosition + (index * 6)
        pdf.text(`${month.month}:`, margin + 5, y)
        pdf.text(`${month.contracts} contracts`, margin + 40, y)
        pdf.text(`€${month.budget_used.toLocaleString()} spent`, margin + 80, y)
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
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF report. Please try again.')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading reports...</div>
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Supervision Reports</h1>
          <p className="text-gray-600 mt-2">Generate comprehensive supervision and construction reports</p>
        </div>
        {projectReport && (
          <button
            onClick={generatePDFReport}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a project</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {generatingReport && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Generating report...</p>
        </div>
      )}

      {projectReport && !generatingReport && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Project Supervision Overview</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                projectReport.project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                projectReport.project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {projectReport.project.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">{projectReport.project.name}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Location:</span>
                    <span className="font-medium">{projectReport.project.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Start Date:</span>
                    <span className="font-medium">{format(new Date(projectReport.project.start_date), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Budget:</span>
                    <span className="font-medium">€{projectReport.total_budget.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Investor:</span>
                    <span className="font-medium">{projectReport.investors}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Budget Performance</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Budget Used:</span>
                    <span className="font-bold text-orange-600">€{projectReport.total_payments.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Remaining:</span>
                    <span className="font-bold text-green-600">€{projectReport.remaining_budget.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Utilization:</span>
                    <span className="font-medium">{projectReport.total_budget > 0 ? ((projectReport.budget_used / projectReport.total_budget) * 100).toFixed(1) : '0'}%</span>
                  </div>
                  
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Total Contracts</p>
                  <p className="text-2xl font-bold text-gray-900">{projectReport.total_contracts}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Active Contracts</p>
                  <p className="text-2xl font-bold text-gray-900">{projectReport.active_contracts}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Subcontractors</p>
                  <p className="text-2xl font-bold text-gray-900">{projectReport.total_subcontractors}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Activity className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Phases Done</p>
                  <p className="text-2xl font-bold text-gray-900">{projectReport.completed_phases}/{projectReport.total_phases}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-teal-100 rounded-lg">
                  <ClipboardCheck className="w-6 h-6 text-teal-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Work Logs</p>
                  <p className="text-2xl font-bold text-gray-900">{projectReport.total_work_logs}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Contract Status Distribution</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-green-500 rounded mr-3"></div>
                      <span className="text-gray-700">Completed</span>
                    </div>
                    <span className="font-semibold">{projectReport.completed_contracts} contracts</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-blue-500 rounded mr-3"></div>
                      <span className="text-gray-700">Active</span>
                    </div>
                    <span className="font-semibold">{projectReport.active_contracts} contracts</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-gray-500 rounded mr-3"></div>
                      <span className="text-gray-700">Other</span>
                    </div>
                    <span className="font-semibold">{projectReport.total_contracts - projectReport.active_contracts - projectReport.completed_contracts} contracts</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Completed</span>
                      <span className="text-sm font-medium">{projectReport.total_contracts > 0 ? ((projectReport.completed_contracts / projectReport.total_contracts) * 100).toFixed(1) : '0'}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${projectReport.total_contracts > 0 ? (projectReport.completed_contracts / projectReport.total_contracts) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Active</span>
                      <span className="text-sm font-medium">{projectReport.total_contracts > 0 ? ((projectReport.active_contracts / projectReport.total_contracts) * 100).toFixed(1) : '0'}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${projectReport.total_contracts > 0 ? (projectReport.active_contracts / projectReport.total_contracts) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Monthly Budget Performance</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contracts</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Budget Used</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {projectReport.monthly_data.map((month, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{month.month}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{month.contracts}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">€{month.budget_used.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">€{month.payments.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <ClipboardCheck className="w-5 h-5 mr-2 text-blue-600" />
              Work Logs ({projectReport.total_work_logs})
            </h2>
            {projectReport.work_logs.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-600">No work logs recorded during this period</p>
              </div>
            ) : (
              <div className="space-y-3">
                {projectReport.work_logs.slice(0, 10).map((log) => (
                  <div
                    key={log.id}
                    className="border-l-4 rounded-lg p-4 bg-gray-50 border border-gray-200"
                    style={{ borderLeftColor: log.color || 'blue' }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{log.subcontractors?.name || 'Unknown'}</h3>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                            {log.status.replace('_', ' ')}
                          </span>
                        </div>
                        {log.contracts && (
                          <p className="text-xs text-gray-500 mb-2">
                            Contract: {log.contracts.contract_number} - {log.contracts.job_description}
                          </p>
                        )}
                        <p className="text-sm text-gray-700">{log.work_description}</p>
                      </div>
                      <span className="text-xs text-gray-500">
                        {format(new Date(log.date), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    {log.blocker_details && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                        <p className="text-xs font-medium text-red-800">Issue: {log.blocker_details}</p>
                      </div>
                    )}
                    {log.notes && (
                      <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                        <p className="text-xs text-gray-600">{log.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
                {projectReport.work_logs.length > 10 && (
                  <div className="text-center py-3 text-sm text-gray-600">
                    ... and {projectReport.work_logs.length - 10} more work logs. Full details in PDF export.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Summary & Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-3">Performance Highlights</h3>
                <ul className="space-y-2 text-blue-800">
                  <li>• {projectReport.budget_used / projectReport.total_budget > 0.9 ? 'High' : projectReport.budget_used / projectReport.total_budget > 0.75 ? 'Moderate' : 'Good'} budget utilization at {projectReport.total_budget > 0 ? ((projectReport.budget_used / projectReport.total_budget) * 100).toFixed(1) : '0'}%</li>
                  <li>• {projectReport.completed_contracts} contracts completed out of {projectReport.total_contracts}</li>
                  <li>• {projectReport.completed_phases} phases completed out of {projectReport.total_phases}</li>
                  <li>• Managing {projectReport.total_subcontractors} subcontractors</li>
                </ul>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-3">Recommendations</h3>
                <ul className="space-y-2 text-green-800">
                  {projectReport.budget_used / projectReport.total_budget > 0.9 && <li>• Monitor remaining budget closely</li>}
                  {projectReport.active_contracts > 0 && <li>• Focus on completing active contracts</li>}
                  {projectReport.completed_phases < projectReport.total_phases && <li>• Coordinate phase completion schedules</li>}
                  <li>• Maintain regular communication with subcontractors</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SupervisionReports
