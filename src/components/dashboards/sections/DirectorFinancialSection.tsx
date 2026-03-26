import React from 'react'
import { DollarSign, TrendingUp, TrendingDown, Wallet, CreditCard, Activity, PieChart, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { StatGrid } from '../../ui'
import StatCard from '../../ui/StatCard'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import type { FinancialMetrics } from '../types/directorTypes'

interface Props {
  metrics: FinancialMetrics
}

const DirectorFinancialSection: React.FC<Props> = ({ metrics }) => {
  const { t } = useTranslation()
  return (
    <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl shadow-lg border border-blue-200 p-6">
      <div className="flex items-center mb-6">
        <DollarSign className="w-6 h-6 text-blue-600 mr-2" />
        <h2 className="text-2xl font-bold text-gray-900">{t('dashboards.director.financial_overview')}</h2>
      </div>
      <StatGrid columns={5}>
        <StatCard
          label={t('dashboards.director.total_revenue')}
          value={`€${(metrics.total_revenue / 1000000).toFixed(2)}M`}
          subtitle={t('dashboards.director.from_all_sales')}
          icon={TrendingUp}
          color="white"
          size="lg"
        />
        <StatCard
          label={t('dashboards.director.total_expenses')}
          value={`€${(metrics.total_expenses / 1000000).toFixed(2)}M`}
          subtitle={t('dashboards.director.all_payments_made')}
          icon={TrendingDown}
          color="white"
          size="lg"
        />
        <StatCard
          label={t('dashboards.director.net_profit')}
          value={`€${(metrics.total_profit / 1000000).toFixed(2)}M`}
          subtitle={t('dashboards.director.margin', { value: metrics.profit_margin.toFixed(1) })}
          icon={Wallet}
          color="white"
          size="lg"
        />
        <StatCard
          label={t('dashboards.director.total_debt')}
          value={`€${(metrics.total_debt / 1000000).toFixed(2)}M`}
          subtitle={t('dashboards.director.outstanding_balance')}
          icon={CreditCard}
          color="white"
          size="lg"
        />
        <StatCard
          label={t('dashboards.director.cash_flow_month', { month: format(new Date(), 'MMMM') })}
          value={`€${(metrics.cash_flow_current_month / 1000).toFixed(0)}K`}
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
          value={`€${(metrics.outstanding_receivables / 1000).toFixed(0)}K`}
          icon={ArrowUpRight}
          color="white"
          size="md"
        />
        <StatCard
          label={t('dashboards.director.payables')}
          value={`€${(metrics.outstanding_payables / 1000000).toFixed(3)}M`}
          icon={ArrowDownRight}
          color="white"
          size="md"
        />
      </StatGrid>
    </div>
  )
}

export default DirectorFinancialSection
