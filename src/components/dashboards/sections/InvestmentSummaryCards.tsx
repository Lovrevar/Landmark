import React from 'react'
import { Building2, TrendingUp, ArrowDownRight, PieChart } from 'lucide-react'
import StatCard from '../../ui/StatCard'
import type { FinancialSummary } from '../../../types/investment'

interface Props {
  financialSummary: FinancialSummary
}

const InvestmentSummaryCards: React.FC<Props> = ({ financialSummary }) => {
  const utilization = financialSummary.total_credit_lines > 0
    ? ((financialSummary.total_used_credit / financialSummary.total_credit_lines) * 100).toFixed(1)
    : '0'

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <StatCard
        label="Portfolio Value"
        value={`€${(financialSummary.total_portfolio_value / 1000000).toFixed(1)}M`}
        icon={Building2}
        color="blue"
        size="lg"
      />
      <StatCard
        label="Outstanding Debt"
        value={`€${(financialSummary.total_debt / 1000000).toFixed(1)}M`}
        icon={ArrowDownRight}
        color="red"
        size="lg"
      />
      <StatCard
        label="Available Investments"
        value={`€${(financialSummary.available_credit / 1000000).toFixed(1)}M`}
        icon={TrendingUp}
        color="green"
        size="lg"
      />
      <StatCard
        label="Investment Utilization"
        value={`${utilization}%`}
        icon={PieChart}
        color="teal"
        size="lg"
      />
    </div>
  )
}

export default InvestmentSummaryCards
