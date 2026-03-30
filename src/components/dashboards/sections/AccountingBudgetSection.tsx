import React from 'react'
import { Calendar } from 'lucide-react'
import { StatGrid } from '../../ui'
import StatCard from '../../ui/StatCard'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import type { CashFlowStats, MonthlyBudget } from '../types/accountingDashboardTypes'

interface Props {
  monthlyBudget: MonthlyBudget
  cashFlowStats: CashFlowStats
}

const AccountingBudgetSection: React.FC<Props> = ({ monthlyBudget, cashFlowStats }) => {
  const { t } = useTranslation()
  const budgetAmount = parseFloat(monthlyBudget.budget_amount.toString())
  const remaining = budgetAmount - cashFlowStats.currentMonthOutgoing
  const usagePercent = budgetAmount > 0
    ? ((cashFlowStats.currentMonthOutgoing / budgetAmount) * 100).toFixed(1)
    : '0'
  const withinBudget = cashFlowStats.currentMonthOutgoing <= budgetAmount

  return (
    <div className="bg-gradient-to-br from-teal-50 dark:from-teal-900/20 to-teal-100 dark:to-teal-900/30 rounded-xl p-6 border border-teal-200 dark:border-teal-700">
      <div className="flex items-center mb-4">
        <Calendar className="w-6 h-6 text-teal-600 mr-2" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('dashboards.accounting.monthly_budget', { month: format(new Date(), 'MMMM yyyy') })}
        </h2>
      </div>
      <StatGrid columns={4} className="gap-6">
        <StatCard
          label={t('dashboards.accounting.planned_budget')}
          value={`€${budgetAmount.toLocaleString('en-US')}`}
          subtitle={t('dashboards.accounting.max_costs')}
          color="white"
          size="md"
        />
        <StatCard
          label={t('dashboards.accounting.current_spent')}
          value={`€${cashFlowStats.currentMonthOutgoing.toLocaleString('en-US')}`}
          subtitle={t('dashboards.accounting.monthly_costs')}
          color="white"
          size="md"
        />
        <StatCard
          label={remaining >= 0 ? t('dashboards.accounting.budget_remaining') : t('dashboards.accounting.budget_overage')}
          value={`€${Math.abs(remaining).toLocaleString('en-US')}`}
          subtitle={remaining >= 0 ? t('dashboards.accounting.still_can_spend') : t('dashboards.accounting.over_limit')}
          color="white"
          size="md"
        />
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{t('dashboards.accounting.budget_status')}</p>
          <div className="flex items-center mt-2">
            <div className={`w-3 h-3 rounded-full mr-2 animate-pulse ${withinBudget ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={`text-xl font-bold ${withinBudget ? 'text-green-600' : 'text-red-600'}`}>
              {withinBudget ? t('dashboards.accounting.within_budget') : t('dashboards.accounting.over_budget')}
            </span>
          </div>
          <p className="text-xs mt-1 text-gray-600 dark:text-gray-400 opacity-75">{t('dashboards.accounting.budget_used_pct', { pct: usagePercent })}</p>
        </div>
      </StatGrid>
    </div>
  )
}

export default AccountingBudgetSection
