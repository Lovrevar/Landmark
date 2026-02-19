import React, { useState, useEffect } from 'react'
import { LoadingSpinner } from '../ui'
import {
  Home,
  DollarSign,
  TrendingUp,
  Users,
  Building2,
  CheckCircle,
  Calendar,
  PieChart,
  BarChart3
} from 'lucide-react'
import { format } from 'date-fns'
import type { SalesDashboardStats, ProjectStats, MonthlyTrend, RecentSale } from './types/salesDashboardTypes'
import * as salesService from './services/salesDashboardService'

const defaultStats: SalesDashboardStats = {
  totalUnits: 0, availableUnits: 0, reservedUnits: 0, soldUnits: 0,
  totalRevenue: 0, avgSalePrice: 0, salesRate: 0, totalCustomers: 0,
  activeLeads: 0, monthlyRevenue: 0, monthlyTarget: 5000000
}

const SalesDashboard: React.FC = () => {
  const [stats, setStats] = useState<SalesDashboardStats>(defaultStats)
  const [projectStats, setProjectStats] = useState<ProjectStats[]>([])
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([])
  const [recentSales, setRecentSales] = useState<RecentSale[]>([])
  const [paymentMethodBreakdown, setPaymentMethodBreakdown] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    try {
      const { stats: s, projectStats: ps, monthlyTrends: mt, paymentMethodBreakdown: pm, recentSales: rs } =
        await salesService.fetchSalesDashboardData()
      setStats(s)
      setProjectStats(ps)
      setMonthlyTrends(mt)
      setPaymentMethodBreakdown(pm)
      setRecentSales(rs)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner size="lg" message="Loading sales dashboard..." />
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
