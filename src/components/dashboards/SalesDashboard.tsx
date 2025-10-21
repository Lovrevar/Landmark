import React, { useState, useEffect } from 'react'
import { supabase, Apartment, Project, Sale, Customer } from '../../lib/supabase'
import {
  Home,
  DollarSign,
  TrendingUp,
  Users,
  Building2,
  CheckCircle,
  Calendar,
  Target,
  PieChart,
  BarChart3
} from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

interface ProjectStats {
  project_id: string
  project_name: string
  total_units: number
  sold_units: number
  reserved_units: number
  available_units: number
  total_revenue: number
  sales_rate: number
}

interface MonthlyTrend {
  month: string
  sales_count: number
  revenue: number
}

interface RecentSale extends Sale {
  apartment_number: string
  project_name: string
  customer_name: string
}

const SalesDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalUnits: 0,
    availableUnits: 0,
    reservedUnits: 0,
    soldUnits: 0,
    totalRevenue: 0,
    avgSalePrice: 0,
    salesRate: 0,
    totalCustomers: 0,
    activeLeads: 0,
    monthlyRevenue: 0,
    monthlyTarget: 5000000
  })
  const [projectStats, setProjectStats] = useState<ProjectStats[]>([])
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([])
  const [recentSales, setRecentSales] = useState<RecentSale[]>([])
  const [paymentMethodBreakdown, setPaymentMethodBreakdown] = useState<{[key: string]: number}>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const [
        apartmentsData,
        salesData,
        customersData,
        projectsData
      ] = await Promise.all([
        supabase.from('apartments').select('*'),
        supabase.from('sales').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('projects').select('*')
      ])

      if (apartmentsData.error) throw apartmentsData.error
      if (salesData.error) throw salesData.error
      if (customersData.error) throw customersData.error
      if (projectsData.error) throw projectsData.error

      const apartments = apartmentsData.data || []
      const sales = salesData.data || []
      const customers = customersData.data || []
      const projects = projectsData.data || []

      const totalUnits = apartments.length
      const availableUnits = apartments.filter(a => a.status === 'Available').length
      const reservedUnits = apartments.filter(a => a.status === 'Reserved').length
      const soldUnits = apartments.filter(a => a.status === 'Sold').length
      const totalRevenue = sales.reduce((sum, s) => sum + s.sale_price, 0)
      const avgSalePrice = sales.length > 0 ? totalRevenue / sales.length : 0
      const salesRate = totalUnits > 0 ? (soldUnits / totalUnits) * 100 : 0
      const totalCustomers = customers.length
      const activeLeads = customers.filter(c => c.status === 'lead' || c.status === 'interested').length

      const currentMonth = startOfMonth(new Date())
      const monthlySales = sales.filter(s =>
        new Date(s.sale_date) >= currentMonth
      )
      const monthlyRevenue = monthlySales.reduce((sum, s) => sum + s.sale_price, 0)

      setStats({
        totalUnits,
        availableUnits,
        reservedUnits,
        soldUnits,
        totalRevenue,
        avgSalePrice,
        salesRate,
        totalCustomers,
        activeLeads,
        monthlyRevenue,
        monthlyTarget: 5000000
      })

      const projectStatsMap = new Map<string, ProjectStats>()

      projects.forEach(project => {
        const projectApartments = apartments.filter(a => a.project_id === project.id)
        const projectSales = sales.filter(s => {
          const apt = apartments.find(a => a.id === s.apartment_id)
          return apt && apt.project_id === project.id
        })

        const total = projectApartments.length
        const sold = projectApartments.filter(a => a.status === 'Sold').length
        const reserved = projectApartments.filter(a => a.status === 'Reserved').length
        const available = projectApartments.filter(a => a.status === 'Available').length
        const revenue = projectSales.reduce((sum, s) => sum + s.sale_price, 0)

        if (total > 0) {
          projectStatsMap.set(project.id, {
            project_id: project.id,
            project_name: project.name,
            total_units: total,
            sold_units: sold,
            reserved_units: reserved,
            available_units: available,
            total_revenue: revenue,
            sales_rate: (sold / total) * 100
          })
        }
      })

      setProjectStats(Array.from(projectStatsMap.values()))

      const last6Months = []
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i)
        const monthStart = startOfMonth(monthDate)
        const monthEnd = endOfMonth(monthDate)

        const monthSales = sales.filter(s => {
          const saleDate = new Date(s.sale_date)
          return saleDate >= monthStart && saleDate <= monthEnd
        })

        last6Months.push({
          month: format(monthDate, 'MMM'),
          sales_count: monthSales.length,
          revenue: monthSales.reduce((sum, s) => sum + s.sale_price, 0)
        })
      }

      setMonthlyTrends(last6Months)

      const paymentBreakdown: {[key: string]: number} = {}
      sales.forEach(sale => {
        paymentBreakdown[sale.payment_method] = (paymentBreakdown[sale.payment_method] || 0) + 1
      })
      setPaymentMethodBreakdown(paymentBreakdown)

      const recentSalesWithDetails = await Promise.all(
        sales.slice(-10).reverse().map(async (sale) => {
          const [aptData, custData] = await Promise.all([
            supabase.from('apartments').select('number, project_id').eq('id', sale.apartment_id).maybeSingle(),
            supabase.from('customers').select('name, surname').eq('id', sale.customer_id).maybeSingle()
          ])

          const apt = aptData.data
          const cust = custData.data

          let projectName = 'Unknown'
          if (apt) {
            const projData = await supabase.from('projects').select('name').eq('id', apt.project_id).maybeSingle()
            if (projData.data) projectName = projData.data.name
          }

          return {
            ...sale,
            apartment_number: apt?.number || 'N/A',
            project_name: projectName,
            customer_name: cust ? `${cust.name} ${cust.surname}` : 'Unknown'
          }
        })
      )

      setRecentSales(recentSalesWithDetails)

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>
  }

  const maxMonthlyRevenue = Math.max(...monthlyTrends.map(t => t.revenue), 1)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sales Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of sales performance and metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">€{(stats.totalRevenue / 1000000).toFixed(2)}M</p>
              <p className="text-xs text-gray-500 mt-1">{stats.soldUnits} units sold</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Sales Rate</p>
              <p className="text-2xl font-bold text-gray-900">{stats.salesRate.toFixed(1)}%</p>
              <p className="text-xs text-gray-500 mt-1">{stats.soldUnits} of {stats.totalUnits}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Sale Price</p>
              <p className="text-2xl font-bold text-gray-900">€{(stats.avgSalePrice / 1000).toFixed(0)}K</p>
              <p className="text-xs text-gray-500 mt-1">Per unit</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Home className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Leads</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeLeads}</p>
              <p className="text-xs text-gray-500 mt-1">Of {stats.totalCustomers} customers</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Monthly Target Progress</h2>
          <span className="text-sm text-gray-600">
            €{(stats.monthlyRevenue / 1000000).toFixed(2)}M / €{(stats.monthlyTarget / 1000000).toFixed(1)}M
          </span>
        </div>
        <div className="relative">
          <div className="w-full bg-gray-200 rounded-full h-8">
            <div
              className="bg-gradient-to-r from-blue-500 to-green-500 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
              style={{ width: `${Math.min((stats.monthlyRevenue / stats.monthlyTarget) * 100, 100)}%` }}
            >
              {((stats.monthlyRevenue / stats.monthlyTarget) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <BarChart3 className="w-5 h-5 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">6-Month Sales Trend</h2>
          </div>
          <div className="space-y-4">
            {monthlyTrends.map((trend, index) => (
              <div key={index}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{trend.month}</span>
                  <span className="font-medium text-gray-900">
                    {trend.sales_count} sales - €{(trend.revenue / 1000).toFixed(0)}K
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${(trend.revenue / maxMonthlyRevenue) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <PieChart className="w-5 h-5 text-green-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Inventory Status</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">Sold</p>
                  <p className="text-sm text-gray-600">{stats.soldUnits} units</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">{stats.salesRate.toFixed(1)}%</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center">
                <Calendar className="w-5 h-5 text-yellow-600 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">Reserved</p>
                  <p className="text-sm text-gray-600">{stats.reservedUnits} units</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.totalUnits > 0 ? ((stats.reservedUnits / stats.totalUnits) * 100).toFixed(1) : '0'}%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <Home className="w-5 h-5 text-blue-600 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">Available</p>
                  <p className="text-sm text-gray-600">{stats.availableUnits} units</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">
                  {stats.totalUnits > 0 ? ((stats.availableUnits / stats.totalUnits) * 100).toFixed(1) : '0'}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-6">
          <Building2 className="w-5 h-5 text-blue-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">Project Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Units</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sold</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reserved</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {projectStats.map((project) => (
                <tr key={project.project_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{project.project_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{project.total_units}</td>
                  <td className="px-6 py-4 text-sm text-green-600 font-medium">{project.sold_units}</td>
                  <td className="px-6 py-4 text-sm text-yellow-600 font-medium">{project.reserved_units}</td>
                  <td className="px-6 py-4 text-sm text-blue-600 font-medium">{project.available_units}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${project.sales_rate}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{project.sales_rate.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    €{(project.total_revenue / 1000000).toFixed(2)}M
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <DollarSign className="w-5 h-5 text-green-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Payment Methods</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(paymentMethodBreakdown).map(([method, count]) => {
              const total = Object.values(paymentMethodBreakdown).reduce((a, b) => a + b, 0)
              const percentage = total > 0 ? (count / total) * 100 : 0
              return (
                <div key={method}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 capitalize">{method.replace('_', ' ')}</span>
                    <span className="font-medium text-gray-900">{count} ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <CheckCircle className="w-5 h-5 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Recent Sales</h2>
          </div>
          <div className="space-y-3">
            {recentSales.slice(0, 5).map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{sale.customer_name}</p>
                  <p className="text-xs text-gray-600">
                    {sale.project_name} - Unit {sale.apartment_number}
                  </p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-bold text-gray-900">€{(sale.sale_price / 1000).toFixed(0)}K</p>
                  <p className="text-xs text-gray-500">{format(new Date(sale.sale_date), 'MMM dd')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SalesDashboard
