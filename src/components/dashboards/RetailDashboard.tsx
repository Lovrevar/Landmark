import React, { useState, useEffect } from 'react'
import { LoadingSpinner } from '../ui'
import { useTranslation } from 'react-i18next'
import StatCard from '../ui/StatCard'
import { BarChart3, FolderOpen, Users, DollarSign, TrendingUp, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import type { DashboardStats, OverdueInvoice } from './types/retailDashboardTypes'
import { fetchRetailDashboardData } from './services/retailDashboardService'

const defaultStats: DashboardStats = {
  total_projects: 0,
  total_customers: 0,
  total_invested: 0,
  total_costs: 0,
  total_revenue: 0,
  total_paid: 0,
  total_supplier_paid: 0,
  total_remaining: 0,
  profit: 0
}

const RetailDashboard: React.FC = () => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>(defaultStats)
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoice[]>([])

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    try {
      setLoading(true)
      const { stats: s, overdueInvoices: overdue } = await fetchRetailDashboardData()
      setStats(s)
      setOverdueInvoices(overdue)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fmt = (n: number) => `€${n.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (loading) {
    return <LoadingSpinner size="lg" message={t('dashboards.retail.loading')} />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('dashboards.retail.title')}</h1>
        <p className="text-gray-600 mt-1">{t('dashboards.retail.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label={t('dashboards.retail.projects')}
          value={stats.total_projects}
          subtitle={t('dashboards.retail.active_projects')}
          icon={FolderOpen}
          color="blue"
          size="lg"
        />
        <StatCard
          label={t('dashboards.retail.customers')}
          value={stats.total_customers}
          subtitle={t('dashboards.retail.active_customers')}
          icon={Users}
          color="green"
          size="lg"
        />
        <StatCard
          label={t('dashboards.retail.invested')}
          value={fmt(stats.total_invested)}
          subtitle={t('dashboards.retail.invested_sub')}
          icon={DollarSign}
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">{t('dashboards.retail.collection')}</h3>
            <DollarSign className="w-6 h-6 text-green-600" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">{t('dashboards.retail.paid')}</span>
              <span className="font-semibold text-green-600">{fmt(stats.total_supplier_paid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">{t('dashboards.retail.to_collect')}</span>
              <span className="font-semibold text-orange-600">{fmt(stats.total_remaining)}</span>
            </div>
            <div className="pt-3 border-t flex justify-between">
              <span className="text-sm font-medium text-gray-700">{t('dashboards.retail.total_invoiced')}</span>
              <span className="font-bold text-gray-900">{fmt(stats.total_supplier_paid + stats.total_remaining)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">{t('dashboards.retail.profit')}</h3>
            <TrendingUp className={`w-6 h-6 ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">{t('dashboards.retail.income')}</span>
              <span className="font-semibold text-green-600">{fmt(stats.total_paid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">{t('dashboards.retail.costs')}</span>
              <span className="font-semibold text-red-600">{fmt(stats.total_costs)}</span>
            </div>
            <div className="pt-3 border-t flex justify-between">
              <span className="text-sm font-medium text-gray-700">{t('dashboards.retail.profit')}:</span>
              <span className={`font-bold text-lg ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.profit >= 0 ? '+' : ''}{fmt(stats.profit)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">{t('dashboards.retail.averages')}</h3>
            <BarChart3 className="w-6 h-6 text-blue-600" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">{t('dashboards.retail.cost_per_project')}</span>
              <span className="font-semibold text-gray-900">
                {stats.total_projects > 0 ? fmt(stats.total_costs / stats.total_projects) : '€0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">{t('dashboards.retail.revenue_per_project')}</span>
              <span className="font-semibold text-gray-900">
                {stats.total_projects > 0 ? fmt(stats.total_revenue / stats.total_projects) : '€0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">{t('dashboards.retail.per_customer')}</span>
              <span className="font-semibold text-gray-900">
                {stats.total_customers > 0 ? fmt(stats.total_revenue / stats.total_customers) : '€0'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {overdueInvoices.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start space-x-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                {t('dashboards.retail.late_payments', { count: overdueInvoices.length })}
              </h3>
              <div className="space-y-2">
                {overdueInvoices.slice(0, 5).map((invoice) => (
                  <div key={invoice.id} className="bg-white rounded-lg p-4 border border-red-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{invoice.customer_name}</p>
                        <p className="text-sm text-gray-600">
                          {invoice.invoice_number} • {t('dashboards.retail.contract')} {invoice.contract_number}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t('dashboards.retail.due')} {format(new Date(invoice.due_date), 'dd.MM.yyyy')}
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          {invoice.days_overdue === 1
                            ? t('dashboards.retail.overdue_days_one', { count: invoice.days_overdue })
                            : t('dashboards.retail.overdue_days_other', { count: invoice.days_overdue })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">{fmt(invoice.remaining_amount)}</p>
                        <p className="text-xs text-gray-500">{t('dashboards.retail.to_collect_label')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {overdueInvoices.length > 5 && (
                <p className="text-sm text-red-700 mt-3">
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
