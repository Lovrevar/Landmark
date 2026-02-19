import React from 'react'
import { Calendar } from 'lucide-react'
import { StatGrid } from '../../ui'
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
        <div className="bg-white rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Planirani budžet</p>
          <p className="text-2xl font-bold text-blue-600">
            €{budgetAmount.toLocaleString('en-US')}
          </p>
          <p className="text-xs text-gray-500 mt-1">Maksimalni troškovi</p>
        </div>
        <div className="bg-white rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Trenutno potrošeno</p>
          <p className="text-2xl font-bold text-gray-900">
            €{cashFlowStats.currentMonthOutgoing.toLocaleString('en-US')}
          </p>
          <p className="text-xs text-gray-500 mt-1">Ukupni troškovi ovog mjeseca</p>
        </div>
        <div className="bg-white rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">
            {remaining >= 0 ? 'Preostalo u budžetu' : 'Prekoračenje budžeta'}
          </p>
          <p className={`text-2xl font-bold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            €{Math.abs(remaining).toLocaleString('en-US')}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {remaining >= 0 ? 'Još možeš potrošiti' : 'Preko limita'}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Status budžeta</p>
          <div className="flex items-center mt-2">
            <div className={`w-3 h-3 rounded-full mr-2 animate-pulse ${withinBudget ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={`text-lg font-bold ${withinBudget ? 'text-green-600' : 'text-red-600'}`}>
              {withinBudget ? 'U redu' : 'Prekoračenje'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{usagePercent}% budžeta iskorišteno</p>
        </div>
      </StatGrid>
    </div>
  )
}

export default AccountingBudgetSection
