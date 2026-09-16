import React from 'react'
import { Euro, TrendingUp, TrendingDown, Wallet, CreditCard, Activity, PieChart, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { StatGrid } from '../../ui'
import StatCard from '../../ui/StatCard'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { formatEuroCompact } from '../../../utils/formatters'
import type { FinancialMetrics } from '../types/directorTypes'

interface Props {
  metrics: FinancialMetrics
}

const DirectorFinancialSection: React.FC<Props> = ({ metrics }) => {
  const { t } = useTranslation()
  return (
    <div className="bg-gradient-to-br from-blue-50 dark:from-blue-900/20 to-green-50 dark:to-green-900/20 rounded-xl shadow-lg border border-blue-200 dark:border-blue-700 p-6">
      <div className="flex items-center mb-6">
        <Euro className="w-6 h-6 text-blue-600 mr-2" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboards.director.financial_overview')}</h2>
      </div>
      <StatGrid columns={5}>
        <StatCard
          label={t('dashboards.director.total_revenue')}
          value={formatEuroCompact(metrics.total_revenue)}
          subtitle={t('dashboards.director.from_all_sales')}
          icon={TrendingUp}
          color="white"
          size="lg"
        />
        <StatCard
          label={t('dashboards.director.total_expenses')}
          value={formatEuroCompact(metrics.total_expenses)}
          subtitle={t('dashboards.director.all_payments_made')}
          icon={TrendingDown}
          color="white"
          size="lg"
        />
        <StatCard
          label={t('dashboards.director.net_profit')}
          value={formatEuroCompact(metrics.total_profit)}
          subtitle={t('dashboards.director.margin', { value: metrics.profit_margin.toFixed(1) })}
          icon={Wallet}
          color="white"
          size="lg"
        />
        <StatCard
          label={t('dashboards.director.total_debt')}
          value={formatEuroCompact(metrics.total_debt)}
          subtitle={t('dashboards.director.outstanding_balance')}
          icon={CreditCard}
          color="white"
          size="lg"
        />
        <StatCard
          label={t('dashboards.director.cash_flow_month', { month: format(new Date(), 'MMMM') })}
          value={formatEuroCompact(metrics.cash_flow_current_month)}
          subtitle={t('dashboards.director.current_month')}
          icon={Activity}
          color="white"
          size="lg"
        />
      </StatGrid>
      <StatGrid columns={3} className="mt-4">
        <StatCard
          label={t('dashboards.director.debt_equity_ratio')}
          value={`${metrics.debt_to_equity_ratio.toFixed(2)}x`}
          icon={PieChart}
          color="white"
          size="md"
        />
        <StatCard
          label={t('dashboards.director.receivables')}
          value={formatEuroCompact(metrics.outstanding_receivables)}
          icon={ArrowUpRight}
          color="white"
          size="md"
        />
        <StatCard
          label={t('dashboards.director.payables')}
          value={formatEuroCompact(metrics.outstanding_payables)}
          icon={ArrowDownRight}
          color="white"
          size="md"
        />
      </StatGrid>
    </div>
  )
}

export default DirectorFinancialSection
