import React, { useState, useEffect } from 'react'
import { supabase, Project } from '../lib/supabase'
import {
  BarChart3,
  Download,
  FileText,
  Building2,
  DollarSign,
  Users,
  TrendingUp,
  Calendar
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns'

interface ProjectReport {
  project: Project
  total_budget: number
  total_contracts: number
  total_subcontractors: number
  total_payments: number
  total_investments: number
  total_credits: number
  apartments_count: number
  customers_count: number
}

const GeneralReports: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [projectReports, setProjectReports] = useState<ProjectReport[]>([])
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
    generateReport()
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
        setSelectedProject('all')
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateReport = async () => {
    setGeneratingReport(true)
    try {
      const projectsToReport = selectedProject === 'all'
        ? projects
        : projects.filter(p => p.id === selectedProject)

      const reports: ProjectReport[] = []

      for (const project of projectsToReport) {
        const { data: contractsData } = await supabase
          .from('contracts')
          .select('*')
          .eq('project_id', project.id)

        const { data: paymentsData } = await supabase
          .from('wire_payments')
          .select(`
            *,
            contracts!inner(project_id)
          `)
          .eq('contracts.project_id', project.id)
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end)

        const { data: investmentsData } = await supabase
          .from('project_investments')
          .select('*')
          .eq('project_id', project.id)

        const { data: creditsData } = await supabase
          .from('bank_credits')
          .select('*')
          .eq('project_id', project.id)

        const { data: apartmentsData } = await supabase
          .from('units')
          .select('*')
          .eq('project_id', project.id)

        const { data: customersData } = await supabase
          .from('customers')
          .select('id')
          .eq('project_id', project.id)

        const subcontractorIds = new Set((contractsData || []).map(c => c.subcontractor_id))

        reports.push({
          project,
          total_budget: project.budget,
          total_contracts: (contractsData || []).length,
          total_subcontractors: subcontractorIds.size,
          total_payments: (paymentsData || []).reduce((sum, p) => sum + p.amount, 0),
          total_investments: (investmentsData || []).reduce((sum, i) => sum + i.amount, 0),
          total_credits: (creditsData || []).reduce((sum, c) => sum + c.amount, 0),
          apartments_count: (apartmentsData || []).length,
          customers_count: (customersData || []).length
        })
      }

      setProjectReports(reports)
    } catch (error) {
      console.error('Error generating report:', error)
    } finally {
      setGeneratingReport(false)
    }
  }

  const generatePDFReport = async () => {
    if (projectReports.length === 0) return

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

      pdf.setFillColor(37, 99, 235)
      pdf.rect(0, 0, pageWidth, 35, 'F')

      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(20)
      pdf.setFont('helvetica', 'bold')
      pdf.text('LANDMARK GROUP General Report', margin, 20)

      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'normal')
      const reportTitle = selectedProject === 'all'
        ? `All Projects (${projectReports.length})`
        : projectReports[0]?.project.name || ''
      pdf.text(reportTitle, margin, 28)

      pdf.setTextColor(0, 0, 0)
      yPosition = 45

      pdf.setFontSize(10)
      pdf.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, margin, yPosition)
      pdf.text(`Report Period: ${format(new Date(dateRange.start), 'MMM dd, yyyy')} - ${format(new Date(dateRange.end), 'MMM dd, yyyy')}`, margin, yPosition + 5)
      yPosition += 20

      if (selectedProject === 'all') {
        const totalBudget = projectReports.reduce((sum, r) => sum + r.total_budget, 0)
        const totalContracts = projectReports.reduce((sum, r) => sum + r.total_contracts, 0)
        const totalPayments = projectReports.reduce((sum, r) => sum + r.total_payments, 0)
        const totalInvestments = projectReports.reduce((sum, r) => sum + r.total_investments, 0)
        const totalCredits = projectReports.reduce((sum, r) => sum + r.total_credits, 0)
        const totalApartments = projectReports.reduce((sum, r) => sum + r.apartments_count, 0)
        const totalCustomers = projectReports.reduce((sum, r) => sum + r.customers_count, 0)

        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(37, 99, 235)
        pdf.text('Portfolio Summary', margin, yPosition)
        yPosition += 10

        pdf.setTextColor(0, 0, 0)
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')

        const summaryData = [
          ['Total Projects', projectReports.length.toString()],
          ['Total Budget', `€${totalBudget.toLocaleString()}`],
          ['Total Contracts', totalContracts.toString()],
          ['Total Payments', `€${totalPayments.toLocaleString()}`],
          ['Total Investments', `€${totalInvestments.toLocaleString()}`],
          ['Total Bank Credits', `€${totalCredits.toLocaleString()}`],
          ['Total Apartments', totalApartments.toString()],
          ['Total Customers', totalCustomers.toString()]
        ]

        summaryData.forEach(([label, value], index) => {
          const y = yPosition + (index * 6)
          checkPageBreak(6)

          pdf.setFont('helvetica', 'bold')
          pdf.text(`${label}:`, margin + 5, y)
          pdf.setFont('helvetica', 'normal')
          pdf.text(value, margin + 70, y)
        })

        yPosition += (summaryData.length * 6) + 20
      }

      for (const report of projectReports) {
        checkPageBreak(60)

        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(37, 99, 235)
        pdf.text(report.project.name, margin, yPosition)
        yPosition += 8

        pdf.setTextColor(0, 0, 0)
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')

        const projectData = [
          ['Location', report.project.location],
          ['Status', report.project.status],
          ['Start Date', format(new Date(report.project.start_date), 'MMM dd, yyyy')],
          ['Total Budget', `€${report.total_budget.toLocaleString()}`],
          ['Total Contracts', report.total_contracts.toString()],
          ['Total Subcontractors', report.total_subcontractors.toString()],
          ['Total Payments', `€${report.total_payments.toLocaleString()}`],
          ['Equity Investment', `€${report.total_investments.toLocaleString()}`],
          ['Bank Financing', `€${report.total_credits.toLocaleString()}`],
          ['Total Funding', `€${(report.total_investments + report.total_credits).toLocaleString()}`],
          ['Apartments/Units', report.apartments_count.toString()],
          ['Customers', report.customers_count.toString()]
        ]

        projectData.forEach(([label, value], index) => {
          const y = yPosition + (index * 6)
          checkPageBreak(6)

          pdf.setFont('helvetica', 'bold')
          pdf.text(`${label}:`, margin + 5, y)
          pdf.setFont('helvetica', 'normal')
          pdf.text(value, margin + 60, y)
        })

        yPosition += (projectData.length * 6) + 15

        if (selectedProject === 'all') {
          pdf.setDrawColor(200, 200, 200)
          pdf.line(margin, yPosition, pageWidth - margin, yPosition)
          yPosition += 10
        }
      }

      const footerY = pageHeight - 15
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(107, 114, 128)
      pdf.text('LANDMARK GROUP - General Report', margin, footerY)
      pdf.text(`Page ${pdf.getNumberOfPages()}`, pageWidth - margin - 20, footerY)

      const fileName = selectedProject === 'all'
        ? `General_Report_All_Projects_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
        : `General_Report_${projectReports[0]?.project.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`

      pdf.save(fileName)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF report. Please try again.')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading reports...</div>
  }

  const totalBudget = projectReports.reduce((sum, r) => sum + r.total_budget, 0)
  const totalContracts = projectReports.reduce((sum, r) => sum + r.total_contracts, 0)
  const totalPayments = projectReports.reduce((sum, r) => sum + r.total_payments, 0)
  const totalInvestments = projectReports.reduce((sum, r) => sum + r.total_investments, 0)
  const totalCredits = projectReports.reduce((sum, r) => sum + r.total_credits, 0)
  const totalApartments = projectReports.reduce((sum, r) => sum + r.apartments_count, 0)

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">General Reports</h1>
          <p className="text-gray-600 mt-2">Generate comprehensive project reports and portfolio overview</p>
        </div>
        {projectReports.length > 0 && (
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
              <option value="all">All Projects</option>
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

      {projectReports.length > 0 && !generatingReport && (
        <div className="space-y-6">
          {selectedProject === 'all' && (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Portfolio Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Financial Summary</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Budget:</span>
                        <span className="font-medium">€{totalBudget.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Investments:</span>
                        <span className="font-medium text-green-600">€{totalInvestments.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Credits:</span>
                        <span className="font-medium text-blue-600">€{totalCredits.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Payments:</span>
                        <span className="font-medium">€{totalPayments.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Project Statistics</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Projects:</span>
                        <span className="font-medium">{projectReports.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Contracts:</span>
                        <span className="font-medium">{totalContracts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Units:</span>
                        <span className="font-medium">{totalApartments}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Active Customers:</span>
                        <span className="font-medium">{projectReports.reduce((sum, r) => sum + r.customers_count, 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-gray-600">Total Budget</p>
                      <p className="text-2xl font-bold text-gray-900">€{(totalBudget / 1000000).toFixed(1)}M</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-gray-600">Total Funding</p>
                      <p className="text-2xl font-bold text-gray-900">€{((totalInvestments + totalCredits) / 1000000).toFixed(1)}M</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <DollarSign className="w-6 h-6 text-orange-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-gray-600">Total Spent</p>
                      <p className="text-2xl font-bold text-gray-900">€{(totalPayments / 1000000).toFixed(1)}M</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <FileText className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-gray-600">Active Projects</p>
                      <p className="text-2xl font-bold text-gray-900">{projectReports.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="space-y-6">
            {projectReports.map((report) => (
              <div key={report.project.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">{report.project.name}</h2>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    report.project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                    report.project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {report.project.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-xs text-blue-700 mb-1">Total Budget</p>
                    <p className="text-xl font-bold text-blue-900">€{report.total_budget.toLocaleString()}</p>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-xs text-green-700 mb-1">Equity Investment</p>
                    <p className="text-xl font-bold text-green-900">€{report.total_investments.toLocaleString()}</p>
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-xs text-purple-700 mb-1">Bank Financing</p>
                    <p className="text-xl font-bold text-purple-900">€{report.total_credits.toLocaleString()}</p>
                  </div>

                  <div className="bg-orange-50 p-4 rounded-lg">
                    <p className="text-xs text-orange-700 mb-1">Total Payments</p>
                    <p className="text-xl font-bold text-orange-900">€{report.total_payments.toLocaleString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <FileText className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{report.total_contracts}</p>
                    <p className="text-xs text-gray-600">Contracts</p>
                  </div>

                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Users className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{report.total_subcontractors}</p>
                    <p className="text-xs text-gray-600">Subcontractors</p>
                  </div>

                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Building2 className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{report.apartments_count}</p>
                    <p className="text-xs text-gray-600">Units</p>
                  </div>

                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Users className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{report.customers_count}</p>
                    <p className="text-xs text-gray-600">Customers</p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Location:</span>
                      <span className="ml-2 font-medium">{report.project.location}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Start Date:</span>
                      <span className="ml-2 font-medium">{format(new Date(report.project.start_date), 'MMM dd, yyyy')}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Investor:</span>
                      <span className="ml-2 font-medium">{report.project.investor || 'Multiple'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default GeneralReports
