import React from 'react'
import { DollarSign, TrendingUp, TrendingDown, Wallet, CreditCard, Activity, PieChart, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { StatGrid } from '../../ui'
import StatCard from '../../ui/StatCard'
import { format } from 'date-fns'
import type { FinancialMetrics } from '../types/directorTypes'

interface Props {
  metrics: FinancialMetrics
}

const DirectorFinancialSection: React.FC<Props> = ({ metrics }) => (
  <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl shadow-lg border border-blue-200 p-6">
    <div className="flex items-center mb-6">
      <DollarSign className="w-6 h-6 text-blue-600 mr-2" />
      <h2 className="text-2xl font-bold text-gray-900">Financial Overview</h2>
    </div>
    <StatGrid columns={5}>
      <StatCard
        label="Total Revenue"
        value={`€${(metrics.total_revenue / 1000000).toFixed(2)}M`}
        subtitle="From all sales"
        icon={TrendingUp}
        color="white"
        size="lg"
      />
      <StatCard
        label="Total Expenses"
        value={`€${(metrics.total_expenses / 1000000).toFixed(2)}M`}
        subtitle="All payments made"
        icon={TrendingDown}
        color="white"
        size="lg"
      />
      <StatCard
        label="Net Profit"
        value={`€${(metrics.total_profit / 1000000).toFixed(2)}M`}
        subtitle={`${metrics.profit_margin.toFixed(1)}% margin`}
        icon={Wallet}
        color="white"
        size="lg"
      />
      <StatCard
        label="Total Debt"
        value={`€${(metrics.total_debt / 1000000).toFixed(2)}M`}
        subtitle="Outstanding balance"
        icon={CreditCard}
        color="white"
        size="lg"
      />
      <StatCard
        label={`Cash Flow (${format(new Date(), 'MMMM')})`}
        value={`€${(metrics.cash_flow_current_month / 1000).toFixed(0)}K`}
        subtitle="Current month"
        icon={Activity}
        color="white"
        size="lg"
      />
    </StatGrid>
    <StatGrid columns={3} className="mt-4">
      <StatCard
        label="Debt/Equity Ratio"
        value={`${metrics.debt_to_equity_ratio.toFixed(2)}x`}
        icon={PieChart}
        color="white"
        size="md"
      />
      <StatCard
        label="Receivables"
        value={`€${(metrics.outstanding_receivables / 1000).toFixed(0)}K`}
        icon={ArrowUpRight}
        color="white"
        size="md"
      />
      <StatCard
        label="Payables"
        value={`€${(metrics.outstanding_payables / 1000000).toFixed(3)}M`}
        icon={ArrowDownRight}
        color="white"
        size="md"
      />
    </StatGrid>
  </div>
)

export default DirectorFinancialSection
