import React, { useState, useEffect } from 'react'
import { supabase, Project, Apartment, Customer } from '../lib/supabase'
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Home, 
  Users, 
  Calendar,
  Download,
  FileText,
  PieChart,
  Activity
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns'

interface SalesData {
  month: string
  sales: number
  revenue: number
  units_sold: number
}

interface ProjectSalesReport {
  project: Project
  total_units: number
  sold_units: number
  available_units: number
  reserved_units: number
  total_revenue: number
  average_price: number
  sales_rate: number
  monthly_sales: SalesData[]
}

const SalesReports: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [reportData, setReportData] = useState<ProjectSalesReport | null>(null)
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
      generateReport()
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

  const generateReport = async () => {
    if (!selectedProject) return

    setGeneratingReport(true)
    try {
      const project = projects.find(p => p.id === selectedProject)
      if (!project) return

      // Fetch apartments for the selected project
      const { data: apartmentsData, error } = await supabase
        .from('apartments')
        .select('*')
        .eq('project_id', selectedProject)

      if (error) throw error

      const apartments = apartmentsData || []
      
      // Calculate project statistics
      const total_units = apartments.length
      const sold_units = apartments.filter(apt => apt.status === 'Sold').length
      const available_units = apartments.filter(apt => apt.status === 'Available').length
      const reserved_units = apartments.filter(apt => apt.status === 'Reserved').length
      const total_revenue = apartments
        .filter(apt => apt.status === 'Sold')
        .reduce((sum, apt) => sum + apt.price, 0)
      const average_price = total_units > 0 
        ? apartments.reduce((sum, apt) => sum + apt.price, 0) / total_units 
        : 0
      const sales_rate = total_units > 0 ? (sold_units / total_units) * 100 : 0

      // Generate monthly sales data (simulated for demo)
      const startDate = new Date(dateRange.start)
      const endDate = new Date(dateRange.end)
      const months = eachMonthOfInterval({ start: startDate, end: endDate })
      
      const monthly_sales: SalesData[] = months.map(month => {
        // Simulate sales data - in real app, you'd query actual sales by date
        const salesCount = Math.floor(Math.random() * 5) + 1
        const monthRevenue = salesCount * (average_price * (0.8 + Math.random() * 0.4))
        
        return {
          month: format(month, 'MMM yyyy'),
          sales: salesCount,
          revenue: monthRevenue,
          units_sold: salesCount
        }
      })

      setReportData({
        project,
        total_units,
        sold_units,
        available_units,
        reserved_units,
        total_revenue,
        average_price,
        sales_rate,
        monthly_sales
      })
    } catch (error) {
      console.error('Error generating report:', error)
    } finally {
      setGeneratingReport(false)
    }
  }

  const generatePDFReport = async () => {
    if (!reportData) return

    // In a real app, you'd use a PDF generation library like jsPDF
    const reportContent = `
SALES REPORT - ${reportData.project.name}
Generated: ${format(new Date(), 'MMMM dd, yyyy')}

PROJECT OVERVIEW:
- Location: ${reportData.project.location}
- Status: ${reportData.project.status}
- Total Units: ${reportData.total_units}
- Units Sold: ${reportData.sold_units}
- Sales Rate: ${reportData.sales_rate.toFixed(1)}%

FINANCIAL SUMMARY:
- Total Revenue: $${reportData.total_revenue.toLocaleString()}
- Average Price: $${reportData.average_price.toLocaleString()}
- Available Units: ${reportData.available_units}
- Reserved Units: ${reportData.reserved_units}

MONTHLY SALES DATA:
${reportData.monthly_sales.map(month => 
  `${month.month}: ${month.units_sold} units, $${month.revenue.toLocaleString()}`
).join('\n')}
    `

    // Create and download the report
    const blob = new Blob([reportContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Sales_Report_${reportData.project.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="text-center py-12">Loading reports...</div>
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Reports</h1>
          <p className="text-gray-600 mt-2">Generate comprehensive sales analytics and reports</p>
        </div>
        {reportData && (
          <button
            onClick={generatePDFReport}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </button>
        )}
      </div>

      {/* Report Filters */}
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

      {reportData && !generatingReport && (
        <div className="space-y-6">
          {/* Project Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Project Overview</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                reportData.project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                reportData.project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {reportData.project.status}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">{reportData.project.name}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Location:</span>
                    <span className="font-medium">{reportData.project.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Start Date:</span>
                    <span className="font-medium">{format(new Date(reportData.project.start_date), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Budget:</span>
                    <span className="font-medium">${reportData.project.budget.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Investor:</span>
                    <span className="font-medium">{reportData.project.investor || 'N/A'}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Sales Performance</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sales Rate:</span>
                    <span className="font-bold text-green-600">{reportData.sales_rate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Revenue:</span>
                    <span className="font-bold text-blue-600">${reportData.total_revenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Average Price:</span>
                    <span className="font-medium">${reportData.average_price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Units Sold:</span>
                    <span className="font-medium">{reportData.sold_units} / {reportData.total_units}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Home className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Total Units</p>
                  <p className="text-2xl font-bold text-gray-900">{reportData.total_units}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Units Sold</p>
                  <p className="text-2xl font-bold text-gray-900">{reportData.sold_units}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">${(reportData.total_revenue / 1000000).toFixed(1)}M</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Activity className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Sales Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{reportData.sales_rate.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sales Distribution Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Unit Status Distribution</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-green-500 rounded mr-3"></div>
                      <span className="text-gray-700">Sold</span>
                    </div>
                    <span className="font-semibold">{reportData.sold_units} units</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-blue-500 rounded mr-3"></div>
                      <span className="text-gray-700">Available</span>
                    </div>
                    <span className="font-semibold">{reportData.available_units} units</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-yellow-500 rounded mr-3"></div>
                      <span className="text-gray-700">Reserved</span>
                    </div>
                    <span className="font-semibold">{reportData.reserved_units} units</span>
                  </div>
                </div>
              </div>
              
              <div>
                {/* Simple visual representation */}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Sold</span>
                      <span className="text-sm font-medium">{((reportData.sold_units / reportData.total_units) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${(reportData.sold_units / reportData.total_units) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Available</span>
                      <span className="text-sm font-medium">{((reportData.available_units / reportData.total_units) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(reportData.available_units / reportData.total_units) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Reserved</span>
                      <span className="text-sm font-medium">{((reportData.reserved_units / reportData.total_units) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-500 h-2 rounded-full"
                        style={{ width: `${(reportData.reserved_units / reportData.total_units) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Sales Trend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Monthly Sales Trend</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units Sold</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg. Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportData.monthly_sales.map((month, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{month.month}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{month.units_sold}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">${month.revenue.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        ${month.units_sold > 0 ? (month.revenue / month.units_sold).toLocaleString() : '0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary & Insights */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Summary & Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-3">Performance Highlights</h3>
                <ul className="space-y-2 text-blue-800">
                  <li>• {reportData.sales_rate > 70 ? 'Excellent' : reportData.sales_rate > 50 ? 'Good' : 'Needs Improvement'} sales performance at {reportData.sales_rate.toFixed(1)}%</li>
                  <li>• Generated ${reportData.total_revenue.toLocaleString()} in total revenue</li>
                  <li>• Average unit price of ${reportData.average_price.toLocaleString()}</li>
                  <li>• {reportData.available_units} units still available for sale</li>
                </ul>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-3">Recommendations</h3>
                <ul className="space-y-2 text-green-800">
                  {reportData.sales_rate < 50 && <li>• Consider marketing campaigns to boost sales</li>}
                  {reportData.available_units > reportData.sold_units && <li>• Focus on converting leads for remaining units</li>}
                  {reportData.reserved_units > 0 && <li>• Follow up with reserved customers to close sales</li>}
                  <li>• Analyze successful sales patterns for future projects</li>
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