import React from 'react'
import {
  MapPin,
  Users,
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  Briefcase,
  Target,
  ArrowUpRight
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RetailReportData } from './retailReportTypes'

interface Props {
  data: RetailReportData
  formatCurrency: (n: number) => string
}

export const PortfolioOverview: React.FC<Props> = ({ data, formatCurrency }) => {
  const { t } = useTranslation()
  const { portfolio, invoices } = data

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Building2 className="w-6 h-6" />}
          label={t('common.projects')}
          value={portfolio.total_projects.toString()}
          sub={t('reports.portfolio.active_count', { count: portfolio.active_projects })}
          color="blue"
        />
        <KpiCard
          icon={<MapPin className="w-6 h-6" />}
          label={t('reports.portfolio.land_plots')}
          value={portfolio.total_land_plots.toString()}
          sub={`${portfolio.total_land_area.toLocaleString('hr-HR')} m2`}
          color="emerald"
        />
        <KpiCard
          icon={<Users className="w-6 h-6" />}
          label={t('common.customers')}
          value={portfolio.total_customers.toString()}
          sub={t('reports.portfolio.suppliers_count', { count: portfolio.total_suppliers })}
          color="amber"
        />
        <KpiCard
          icon={<FileText className="w-6 h-6" />}
          label={t('common.invoices')}
          value={invoices.total.toString()}
          sub={invoices.overdue > 0 ? t('reports.portfolio.overdue_count', { count: invoices.overdue }) : t('reports.portfolio.no_overdue')}
          color={invoices.overdue > 0 ? 'red' : 'teal'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FinanceCard title={t('reports.portfolio.investments')} icon={<Briefcase className="w-5 h-5 text-blue-600" />}>
          <FinanceLine label={t('reports.portfolio.land')} value={formatCurrency(portfolio.total_land_investment)} />
          <FinanceLine label={t('reports.portfolio.development')} value={formatCurrency(portfolio.total_development_cost)} />
          <FinanceLine label={t('reports.portfolio.construction')} value={formatCurrency(portfolio.total_construction_cost)} />
          <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <FinanceLine label={t('reports.portfolio.total_costs')} value={formatCurrency(portfolio.total_costs)} bold />
          </div>
        </FinanceCard>

        <FinanceCard title={t('reports.portfolio.revenue')} icon={<DollarSign className="w-5 h-5 text-green-600" />}>
          <FinanceLine label={t('reports.portfolio.contracted')} value={formatCurrency(portfolio.total_sales_revenue)} />
          <FinanceLine
            label={t('reports.portfolio.collected')}
            value={formatCurrency(portfolio.total_collected)}
            valueClass="text-green-600"
          />
          <FinanceLine
            label={t('reports.portfolio.outstanding')}
            value={formatCurrency(portfolio.total_outstanding)}
            valueClass="text-orange-600"
          />
          <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <FinanceLine
              label={t('reports.portfolio.avg_price_m2')}
              value={formatCurrency(portfolio.avg_price_per_m2)}
              bold
            />
          </div>
        </FinanceCard>

        <FinanceCard
          title={t('reports.portfolio.profitability')}
          icon={portfolio.profit >= 0
            ? <TrendingUp className="w-5 h-5 text-green-600" />
            : <TrendingDown className="w-5 h-5 text-red-600" />
          }
        >
          <FinanceLine
            label={t('reports.portfolio.collected')}
            value={formatCurrency(portfolio.total_collected)}
            valueClass="text-green-600"
          />
          <FinanceLine
            label={t('reports.portfolio.total_costs')}
            value={formatCurrency(portfolio.total_costs)}
            valueClass="text-red-600"
          />
          <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <FinanceLine
              label={t('reports.portfolio.profit')}
              value={`${portfolio.profit >= 0 ? '+' : ''}${formatCurrency(portfolio.profit)}`}
              valueClass={portfolio.profit >= 0 ? 'text-green-600' : 'text-red-600'}
              bold
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">ROI</span>
              <span className={`text-sm font-semibold flex items-center gap-1 ${
                portfolio.roi >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {portfolio.roi >= 0 && <ArrowUpRight className="w-3 h-3" />}
                {portfolio.roi.toFixed(1)}%
              </span>
            </div>
          </div>
        </FinanceCard>
      </div>

      {invoices.overdue > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900 dark:text-red-300">
                {t('reports.portfolio.overdue_invoices_title', { count: invoices.overdue })}
              </p>
              <p className="text-sm text-red-700 dark:text-red-400">
                {t('reports.portfolio.overdue_amount_desc', { amount: formatCurrency(invoices.overdue_amount) })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const colorMap: Record<string, { bg: string; border: string; icon: string; label: string }> = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-700', icon: 'text-blue-600', label: 'text-blue-700 dark:text-blue-300' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700', icon: 'text-emerald-600', label: 'text-emerald-700 dark:text-emerald-400' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-700', icon: 'text-amber-600', label: 'text-amber-700 dark:text-amber-400' },
  teal: { bg: 'bg-teal-50 dark:bg-teal-900/20', border: 'border-teal-200 dark:border-teal-700', icon: 'text-teal-600', label: 'text-teal-700 dark:text-teal-400' },
  red: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', icon: 'text-red-600', label: 'text-red-700 dark:text-red-400' }
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: string
}) {
  const c = colorMap[color] || colorMap.blue
  return (
    <div className={`${c.bg} ${c.border} border rounded-xl p-5`}>
      <div className="flex items-center justify-between mb-3">
        <span className={c.icon}>{icon}</span>
        <span className={`text-xs font-medium ${c.label}`}>{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{sub}</p>
    </div>
  )
}

function FinanceCard({ title, icon, children }: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
        {icon}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function FinanceLine({ label, value, valueClass, bold }: {
  label: string
  value: string
  valueClass?: string
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${bold ? 'font-medium text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>{label}</span>
      <span className={`${bold ? 'font-bold text-base' : 'font-semibold text-sm'} ${valueClass || 'text-gray-900 dark:text-white'}`}>
        {value}
      </span>
    </div>
  )
}
