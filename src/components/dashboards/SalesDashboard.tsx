import React, { useState, useEffect } from 'react'
import { LoadingSpinner } from '../ui'
import { useTranslation } from 'react-i18next'
import StatCard from '../ui/StatCard'
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
  const { t } = useTranslation()
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
    return <LoadingSpinner size="lg" message={t('dashboards.sales.loading')} />
  }

  const maxMonthlyRevenue = Math.max(...monthlyTrends.map(trend => trend.revenue), 1)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('dashboards.sales.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">{t('dashboards.sales.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label={t('dashboards.sales.total_revenue')}
          value={`€${(stats.totalRevenue / 1000000).toFixed(2)}M`}
          subtitle={`${stats.soldUnits} ${t('dashboards.sales.units_sold')}`}
          icon={DollarSign}
          color="green"
          size="lg"
        />
        <StatCard
          label={t('dashboards.sales.sales_rate')}
          value={`${stats.salesRate.toFixed(1)}%`}
          subtitle={`${stats.soldUnits} of ${stats.totalUnits}`}
          icon={TrendingUp}
          color="blue"
          size="lg"
        />
        <StatCard
          label={t('dashboards.sales.avg_sale_price')}
          value={`€${(stats.avgSalePrice / 1000).toFixed(0)}K`}
          subtitle={t('dashboards.sales.per_unit')}
          icon={Home}
          color="teal"
          size="lg"
        />
        <StatCard
          label={t('dashboards.sales.active_leads')}
          value={stats.activeLeads}
          subtitle={t('dashboards.sales.of_customers', { total: stats.totalCustomers })}
          icon={Users}
          color="orange"
          size="lg"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('dashboards.sales.monthly_target')}</h2>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            €{(stats.monthlyRevenue / 1000000).toFixed(2)}M / €{(stats.monthlyTarget / 1000000).toFixed(1)}M
          </span>
        </div>
        <div className="relative">
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-8">
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center mb-6">
            <BarChart3 className="w-5 h-5 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('dashboards.sales.six_month_trend')}</h2>
          </div>
          <div className="space-y-4">
            {monthlyTrends.map((trend, index) => (
              <div key={index}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">{trend.month}</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {trend.sales_count} sales - €{(trend.revenue / 1000).toFixed(0)}K
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${(trend.revenue / maxMonthlyRevenue) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center mb-6">
            <PieChart className="w-5 h-5 text-green-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('dashboards.sales.inventory_status')}</h2>
          </div>
          <div className="space-y-4">
            <StatCard
              label={t('dashboards.sales.sold')}
              value={`${stats.salesRate.toFixed(1)}%`}
              subtitle={`${stats.soldUnits} ${t('common.units').toLowerCase()}`}
              icon={CheckCircle}
              color="green"
              size="md"
            />
            <StatCard
              label={t('dashboards.sales.reserved')}
              value={`${stats.totalUnits > 0 ? ((stats.reservedUnits / stats.totalUnits) * 100).toFixed(1) : '0'}%`}
              subtitle={`${stats.reservedUnits} ${t('common.units').toLowerCase()}`}
              icon={Calendar}
              color="yellow"
              size="md"
            />
            <StatCard
              label={t('dashboards.sales.available')}
              value={`${stats.totalUnits > 0 ? ((stats.availableUnits / stats.totalUnits) * 100).toFixed(1) : '0'}%`}
              subtitle={`${stats.availableUnits} ${t('common.units').toLowerCase()}`}
              icon={Home}
              color="blue"
              size="md"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center mb-6">
          <Building2 className="w-5 h-5 text-blue-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('dashboards.sales.project_performance')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.project')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('dashboards.sales.total_units')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('dashboards.sales.sold')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('dashboards.sales.reserved')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('dashboards.sales.available')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('dashboards.sales.sales_rate')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {projectStats.map((project) => (
                <tr key={project.project_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{project.project_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{project.total_units}</td>
                  <td className="px-6 py-4 text-sm text-green-600 font-medium">{project.sold_units}</td>
                  <td className="px-6 py-4 text-sm text-yellow-600 font-medium">{project.reserved_units}</td>
                  <td className="px-6 py-4 text-sm text-blue-600 font-medium">{project.available_units}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2 mr-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${project.sales_rate}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{project.sales_rate.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    €{(project.total_revenue / 1000000).toFixed(2)}M
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center mb-6">
            <DollarSign className="w-5 h-5 text-green-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('dashboards.sales.payment_methods')}</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(paymentMethodBreakdown).map(([method, count]) => {
              const total = Object.values(paymentMethodBreakdown).reduce((a, b) => a + b, 0)
              const percentage = total > 0 ? (count / total) * 100 : 0
              return (
                <div key={method}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-200 capitalize">{method.replace('_', ' ')}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{count} ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
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

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center mb-6">
            <CheckCircle className="w-5 h-5 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('dashboards.sales.recent_sales')}</h2>
          </div>
          <div className="space-y-3">
            {recentSales.slice(0, 5).map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{sale.customer_name}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {sale.project_name} - {t('dashboards.sales.unit')} {sale.apartment_number}
                  </p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">€{(sale.sale_price / 1000).toFixed(0)}K</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{format(new Date(sale.sale_date), 'MMM dd')}</p>
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
