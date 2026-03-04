import React, { useState, useEffect } from 'react'
import type { Project } from '../../lib/supabase'
import {
  TrendingUp,
  DollarSign,
  Home,
  Users,
  Download,
  Activity
} from 'lucide-react'
import { format, subMonths } from 'date-fns'
import { PageHeader, StatGrid, LoadingSpinner, Button, Badge, Select, FormField, Input, Table, StatCard } from '../ui'
import {
  fetchProjects,
  generateProjectReport,
  generateCustomerReport
} from './services/salesReportService'
import { generateSalesReportPDF } from './pdf/salesReportPdf'
import type { ProjectSalesReport, CustomerReport } from './types'

const SalesReports: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [reportType, setReportType] = useState<'project' | 'customer'>('project')
  const [projectReport, setProjectReport] = useState<ProjectSalesReport | null>(null)
  const [customerReport, setCustomerReport] = useState<CustomerReport | null>(null)
  const [dateRange, setDateRange] = useState({
    start: format(subMonths(new Date(), 6), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })
  const [loading, setLoading] = useState(true)
  const [generatingReport, setGeneratingReport] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (reportType === 'project' && selectedProject) {
      loadProjectReport()
    } else if (reportType === 'customer') {
      loadCustomerReport()
    }
  }, [selectedProject, dateRange, reportType])

  const loadProjects = async () => {
    setLoading(true)
    try {
      const data = await fetchProjects()
      setProjects(data)
      if (data.length > 0) setSelectedProject(data[0].id)
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProjectReport = async () => {
    if (!selectedProject) return
    setGeneratingReport(true)
    try {
      const report = await generateProjectReport(selectedProject, projects, dateRange)
      setProjectReport(report)
    } catch (error) {
      console.error('Error generating project report:', error)
    } finally {
      setGeneratingReport(false)
    }
  }

  const loadCustomerReport = async () => {
    setGeneratingReport(true)
    try {
      const report = await generateCustomerReport(dateRange)
      setCustomerReport(report)
    } catch (error) {
      console.error('Error generating customer report:', error)
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleGeneratePDF = async () => {
    if (reportType === 'project' && !projectReport) return
    if (reportType === 'customer' && !customerReport) return
    try {
      await generateSalesReportPDF(reportType, projectReport, customerReport, dateRange)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF report. Please try again.')
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading reports..." />
  }

  return (
    <div>
      <PageHeader
        title="Sales Reports"
        description="Generate comprehensive sales analytics and reports"
        actions={
          (projectReport || customerReport) ? (
            <Button icon={Download} onClick={handleGeneratePDF}>
              Export Report
            </Button>
          ) : undefined
        }
        className="mb-6"
      />

      {/* Report Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormField label="Report Type">
            <Select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as 'project' | 'customer')}
            >
              <option value="project">Project Sales Report</option>
              <option value="customer">Customer Report</option>
            </Select>
          </FormField>

          {reportType === 'project' && (
            <FormField label="Project">
              <Select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
              >
                <option value="">Select a project</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          <FormField label="Start Date">
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </FormField>
          <FormField label="End Date">
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </FormField>
        </div>
      </div>

      {generatingReport && (
        <LoadingSpinner message="Generating report..." />
      )}

      {/* Project Report */}
      {reportType === 'project' && projectReport && !generatingReport && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Project Sales Overview</h2>
              <Badge variant={
                projectReport.project.status === 'Completed' ? 'green'
                  : projectReport.project.status === 'In Progress' ? 'blue'
                  : 'gray'
              }>
                {projectReport.project.status}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">{projectReport.project.name}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-gray-600">Location:</span><span className="font-medium">{projectReport.project.location}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Start Date:</span><span className="font-medium">{format(new Date(projectReport.project.start_date), 'MMM dd, yyyy')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Budget:</span><span className="font-medium">${projectReport.project.budget.toLocaleString('hr-HR')}</span></div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Sales Performance</h3>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-gray-600">Sales Rate:</span><span className="font-bold text-green-600">{projectReport.sales_rate.toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Total Revenue:</span><span className="font-bold text-blue-600">${projectReport.total_revenue.toLocaleString('hr-HR')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Average Price:</span><span className="font-medium">${projectReport.average_price.toLocaleString('hr-HR')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Units Sold:</span><span className="font-medium">{projectReport.sold_units} / {projectReport.total_units}</span></div>
                </div>
              </div>
            </div>
          </div>

          <StatGrid columns={4}>
            <StatCard label="Total Units" value={projectReport.total_units} icon={Home} color="blue" />
            <StatCard label="Units Sold" value={projectReport.sold_units} icon={TrendingUp} color="green" />
            <StatCard label="Total Revenue" value={`$${(projectReport.total_revenue / 1000000).toFixed(1)}M`} icon={DollarSign} color="teal" />
            <StatCard label="Sales Rate" value={`${projectReport.sales_rate.toFixed(1)}%`} icon={Activity} color="orange" />
          </StatGrid>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Unit Status Distribution</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="space-y-4">
                  {[
                    { label: 'Sold', color: 'bg-green-500', count: projectReport.sold_units },
                    { label: 'Available', color: 'bg-blue-500', count: projectReport.available_units },
                    { label: 'Reserved', color: 'bg-yellow-500', count: projectReport.reserved_units }
                  ].map(({ label, color, count }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-4 h-4 ${color} rounded mr-3`}></div>
                        <span className="text-gray-700">{label}</span>
                      </div>
                      <span className="font-semibold">{count} units</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="space-y-3">
                  {[
                    { label: 'Sold', color: 'bg-green-500', count: projectReport.sold_units },
                    { label: 'Available', color: 'bg-blue-500', count: projectReport.available_units },
                    { label: 'Reserved', color: 'bg-yellow-500', count: projectReport.reserved_units }
                  ].map(({ label, color, count }) => (
                    <div key={label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600">{label}</span>
                        <span className="text-sm font-medium">{((count / projectReport.total_units) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className={`${color} h-2 rounded-full`} style={{ width: `${(count / projectReport.total_units) * 100}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Monthly Sales Trend</h2>
            <Table>
              <Table.Head>
                <Table.Tr>
                  <Table.Th>Month</Table.Th>
                  <Table.Th>Units Sold</Table.Th>
                  <Table.Th>Revenue</Table.Th>
                  <Table.Th>Avg. Price</Table.Th>
                </Table.Tr>
              </Table.Head>
              <Table.Body>
                {projectReport.monthly_sales.map((month, index) => (
                  <Table.Tr key={index}>
                    <Table.Td className="font-medium text-gray-900">{month.month}</Table.Td>
                    <Table.Td>{month.units_sold}</Table.Td>
                    <Table.Td>€{month.revenue.toLocaleString('hr-HR')}</Table.Td>
                    <Table.Td>€{month.units_sold > 0 ? (month.revenue / month.units_sold).toLocaleString('hr-HR') : '0'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Body>
            </Table>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Summary & Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-3">Performance Highlights</h3>
                <ul className="space-y-2 text-blue-800">
                  <li>• {projectReport.sales_rate > 70 ? 'Excellent' : projectReport.sales_rate > 50 ? 'Good' : 'Needs Improvement'} sales performance at {projectReport.sales_rate.toFixed(1)}%</li>
                  <li>• Generated €{projectReport.total_revenue.toLocaleString('hr-HR')} in total revenue</li>
                  <li>• Average unit price of €{projectReport.average_price.toLocaleString('hr-HR')}</li>
                  <li>• {projectReport.available_units} units still available for sale</li>
                </ul>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-3">Recommendations</h3>
                <ul className="space-y-2 text-green-800">
                  {projectReport.sales_rate < 50 && <li>• Consider marketing campaigns to boost sales</li>}
                  {projectReport.available_units > projectReport.sold_units && <li>• Focus on converting leads for remaining units</li>}
                  {projectReport.reserved_units > 0 && <li>• Follow up with reserved customers to close sales</li>}
                  <li>• Analyze successful sales patterns for future projects</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Report */}
      {reportType === 'customer' && customerReport && !generatingReport && (
        <div className="space-y-6">
          <StatGrid columns={4}>
            <StatCard label="Total Customers" value={customerReport.total_customers} icon={Users} color="blue" />
            <StatCard label="Buyers" value={customerReport.buyers} icon={TrendingUp} color="green" />
            <StatCard label="Total Revenue" value={`$${(customerReport.total_revenue / 1000000).toFixed(1)}M`} icon={DollarSign} color="teal" />
            <StatCard label="Avg. Purchase" value={`$${customerReport.average_purchase.toLocaleString()}`} icon={Activity} color="orange" />
          </StatGrid>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Customer Distribution</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="space-y-4">
                  {[
                    { label: 'Buyers', color: 'bg-green-500', count: customerReport.buyers },
                    { label: 'Interested', color: 'bg-blue-500', count: customerReport.interested },
                    { label: 'Leads', color: 'bg-yellow-500', count: customerReport.leads }
                  ].map(({ label, color, count }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-4 h-4 ${color} rounded mr-3`}></div>
                        <span className="text-gray-700">{label}</span>
                      </div>
                      <span className="font-semibold">{count} customers</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="space-y-3">
                  {[
                    { label: 'Buyers', color: 'bg-green-500', count: customerReport.buyers },
                    { label: 'Interested', color: 'bg-blue-500', count: customerReport.interested },
                    { label: 'Leads', color: 'bg-yellow-500', count: customerReport.leads }
                  ].map(({ label, color, count }) => (
                    <div key={label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600">{label}</span>
                        <span className="text-sm font-medium">{customerReport.total_customers > 0 ? ((count / customerReport.total_customers) * 100).toFixed(1) : '0'}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className={`${color} h-2 rounded-full`} style={{ width: `${customerReport.total_customers > 0 ? (count / customerReport.total_customers) * 100 : 0}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Customer Summary & Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-3">Customer Highlights</h3>
                <ul className="space-y-2 text-blue-800">
                  <li>• {customerReport.total_customers} total customers in database</li>
                  <li>• {customerReport.buyers} successful conversions to buyers</li>
                  <li>• {customerReport.total_customers > 0 ? ((customerReport.buyers / customerReport.total_customers) * 100).toFixed(1) : '0'}% conversion rate</li>
                  <li>• ${customerReport.average_purchase.toLocaleString()} average purchase value</li>
                </ul>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-3">Sales Opportunities</h3>
                <ul className="space-y-2 text-green-800">
                  <li>• {customerReport.interested} interested customers to nurture</li>
                  <li>• {customerReport.leads} new leads to follow up</li>
                  <li>• Focus on converting interested customers to buyers</li>
                  <li>• Develop targeted campaigns for lead segments</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesReports
