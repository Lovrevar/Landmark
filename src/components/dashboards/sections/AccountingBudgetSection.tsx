import React from 'react'
import { Calendar } from 'lucide-react'
import { StatGrid } from '../../ui'
import StatCard from '../../ui/StatCard'
import { format } from 'date-fns'
import type { CashFlowStats, MonthlyBudget } from '../types/accountingDashboardTypes'

interface Props {
  monthlyBudget: MonthlyBudget
  cashFlowStats: CashFlowStats
}

const AccountingBudgetSection: React.FC<Props> = ({ monthlyBudget, cashFlowStats }) => {
  const budgetAmount = parseFloat(monthlyBudget.budget_amount.toString())
  const remaining = budgetAmount - cashFlowStats.currentMonthOutgoing
  const usagePercent = budgetAmount > 0
    ? ((cashFlowStats.currentMonthOutgoing / budgetAmount) * 100).toFixed(1)
    : '0'
  const withinBudget = cashFlowStats.currentMonthOutgoing <= budgetAmount

  return (
    <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl p-6 border border-teal-200">
      <div className="flex items-center mb-4">
        <Calendar className="w-6 h-6 text-teal-600 mr-2" />
        <h2 className="text-xl font-semibold text-gray-900">
          Mjesečni Budžet - {format(new Date(), 'MMMM yyyy')}
        </h2>
      </div>
      <StatGrid columns={4} className="gap-6">
        <StatCard
          label="Planirani budžet"
          value={`€${budgetAmount.toLocaleString('en-US')}`}
          subtitle="Maksimalni troškovi"
          color="white"
          size="md"
        />
        <StatCard
          label="Trenutno potrošeno"
          value={`€${cashFlowStats.currentMonthOutgoing.toLocaleString('en-US')}`}
          subtitle="Ukupni troškovi ovog mjeseca"
          color="white"
          size="md"
        />
        <StatCard
          label={remaining >= 0 ? 'Preostalo u budžetu' : 'Prekoračenje budžeta'}
          value={`€${Math.abs(remaining).toLocaleString('en-US')}`}
          subtitle={remaining >= 0 ? 'Još možeš potrošiti' : 'Preko limita'}
          color="white"
          size="md"
        />
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-600 mb-1">Status budžeta</p>
          <div className="flex items-center mt-2">
            <div className={`w-3 h-3 rounded-full mr-2 animate-pulse ${withinBudget ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={`text-xl font-bold ${withinBudget ? 'text-green-600' : 'text-red-600'}`}>
              {withinBudget ? 'U redu' : 'Prekoračenje'}
            </span>
          </div>
          <p className="text-xs mt-1 text-gray-600 opacity-75">{usagePercent}% budžeta iskorišteno</p>
        </div>
      </StatGrid>
    </div>
  )
}

export default AccountingBudgetSection
