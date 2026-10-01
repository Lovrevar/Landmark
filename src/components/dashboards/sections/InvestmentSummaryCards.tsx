import React from 'react'
import { Building2, TrendingUp, ArrowDownRight, PieChart } from 'lucide-react'
import StatCard from '../../ui/StatCard'
import { useTranslation } from 'react-i18next'
import { formatEuroCompact } from '../../../utils/formatters'
import type { FinancialSummary } from '../../../types/investment'

interface Props {
  financialSummary: FinancialSummary
}

const InvestmentSummaryCards: React.FC<Props> = ({ financialSummary }) => {
  const { t } = useTranslation()
  const utilization = financialSummary.total_credit_lines > 0
    ? ((financialSummary.total_used_credit / financialSummary.total_credit_lines) * 100).toFixed(1)
    : '0'

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <StatCard
        label={t('dashboards.investment.portfolio_value')}
        value={formatEuroCompact(financialSummary.total_portfolio_value)}
        icon={Building2}
        color="blue"
        size="lg"
      />
      <StatCard
        label={t('dashboards.investment.outstanding_debt')}
        value={formatEuroCompact(financialSummary.total_debt)}
        icon={ArrowDownRight}
        color="red"
        size="lg"
      />
      <StatCard
        label={t('dashboards.investment.available_investments')}
        value={formatEuroCompact(financialSummary.available_credit)}
        icon={TrendingUp}
        color="green"
        size="lg"
      />
      <StatCard
        label={t('dashboards.investment.investment_utilization')}
        value={`${utilization}%`}
        icon={PieChart}
        color="teal"
        size="lg"
      />
    </div>
  )
}

export default InvestmentSummaryCards
