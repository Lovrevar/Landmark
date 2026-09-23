import React from 'react'
import { LoadingSpinner } from '../ui'
import { useTranslation } from 'react-i18next'
import { useCachedData } from '../../lib/useCachedData'
import StatCard from '../ui/StatCard'
import { BarChart3, FolderOpen, Users, Euro, TrendingUp, AlertCircle } from 'lucide-react'
import { formatEuro, formatDate, NO_VALUE } from '../../utils/formatters'
import { EMPTY_RETAIL_TOTALS } from './utils/retailTotals'
import type { DashboardStats, OverdueInvoice } from './types/retailDashboardTypes'
import { fetchRetailDashboardData } from './services/retailDashboardService'
import DashboardError from './DashboardError'

const defaultStats: DashboardStats = {
  ...EMPTY_RETAIL_TOTALS,
  total_projects: 0,
  active_projects: 0,
  total_customers: 0
}

const RetailDashboard: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { data, loading, error, refetch } = useCachedData('dashboard:retail', fetchRetailDashboardData)

  const stats: DashboardStats = data?.stats ?? defaultStats
  const overdueInvoices: OverdueInvoice[] = data?.overdueInvoices ?? []

  const fmt = formatEuro

  if (loading && !data) {
    return <LoadingSpinner size="lg" message={t('dashboards.retail.loading')} />
  }

  if (error && !data) {
    return <DashboardError onRetry={refetch} />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('dashboards.retail.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">{t('dashboards.retail.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label={t('dashboards.retail.projects')}
          value={stats.total_projects}
          subtitle={t('dashboards.retail.active_projects', { count: stats.active_projects })}
          icon={FolderOpen}
          color="blue"
          size="lg"
        />
        <StatCard
          label={t('dashboards.retail.customers')}
          value={stats.total_customers}
          subtitle={t('dashboards.retail.total_customers_sub')}
          icon={Users}
          color="green"
          size="lg"
        />
        <StatCard
          label={t('dashboards.retail.invested')}
          value={fmt(stats.total_invested)}
          subtitle={t('dashboards.retail.invested_sub')}
          icon={Euro}
          color="orange"
          size="lg"
        />
        <StatCard
          label={t('dashboards.retail.revenue')}
          value={fmt(stats.total_revenue)}
          subtitle={t('dashboards.retail.total_sales')}
          icon={TrendingUp}
          color="teal"
          size="lg"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboards.retail.collection')}</h3>
            <Euro className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('dashboards.retail.collected')}</span>
              <span className="font-semibold text-green-600 dark:text-green-400">{fmt(stats.total_collected)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('dashboards.retail.to_collect')}</span>
              <span className="font-semibold text-orange-600 dark:text-orange-400">{fmt(stats.total_remaining)}</span>
            </div>
            <div className="pt-3 border-t dark:border-gray-600 flex justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('dashboards.retail.total_invoiced')}</span>
              <span className="font-bold text-gray-900 dark:text-white">{fmt(stats.total_invoiced)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboards.retail.profit')}</h3>
            <TrendingUp className={`w-6 h-6 ${stats.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('dashboards.retail.collected')}</span>
              <span className="font-semibold text-green-600 dark:text-green-400">{fmt(stats.total_collected)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('dashboards.retail.costs')}</span>
              <span className="font-semibold text-red-600 dark:text-red-400">{fmt(stats.total_costs)}</span>
            </div>
            <div className="pt-3 border-t dark:border-gray-600 flex justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('dashboards.retail.profit')}:</span>
              <span className={`font-bold text-lg ${stats.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {stats.profit >= 0 ? '+' : ''}{fmt(stats.profit)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboards.retail.averages')}</h3>
            <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('dashboards.retail.cost_per_project')}</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {stats.total_projects > 0 ? fmt(stats.total_costs / stats.total_projects) : NO_VALUE}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('dashboards.retail.revenue_per_project')}</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {stats.total_projects > 0 ? fmt(stats.total_revenue / stats.total_projects) : NO_VALUE}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('dashboards.retail.per_customer')}</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {stats.total_customers > 0 ? fmt(stats.total_revenue / stats.total_customers) : NO_VALUE}
              </span>
            </div>
          </div>
        </div>
      </div>

      {overdueInvoices.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <div className="flex items-start space-x-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-300 mb-2">
                {t('dashboards.retail.late_payments', { count: overdueInvoices.length })}
              </h3>
              <div className="space-y-2">
                {overdueInvoices.slice(0, 5).map((invoice) => (
                  <div key={invoice.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-red-200 dark:border-red-800">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{invoice.customer_name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {invoice.invoice_number} • {t('dashboards.retail.contract')} {invoice.contract_number}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('dashboards.retail.due')} {formatDate(invoice.due_date, i18n.language)}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {invoice.days_overdue === 1
                            ? t('dashboards.retail.overdue_days_one', { count: invoice.days_overdue })
                            : t('dashboards.retail.overdue_days_other', { count: invoice.days_overdue })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600 dark:text-red-400">{fmt(invoice.remaining_amount)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('dashboards.retail.to_collect_label')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {overdueInvoices.length > 5 && (
                <p className="text-sm text-red-700 dark:text-red-400 mt-3">
                  {t('dashboards.retail.more_delays', { count: overdueInvoices.length - 5 })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RetailDashboard
