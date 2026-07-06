import React from 'react'
import { LoadingSpinner } from '../ui'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { useCachedData } from '../../lib/useCachedData'
import type { VATStats, CashFlowStats, TopCompany, MonthlyData, MonthlyBudget } from './types/accountingDashboardTypes'
import * as accountingService from './services/accountingDashboardService'
import DashboardError from './DashboardError'
import AccountingVATSection from './sections/AccountingVATSection'
import AccountingBudgetSection from './sections/AccountingBudgetSection'
import AccountingCashFlowSection from './sections/AccountingCashFlowSection'
import AccountingCompaniesSection from './sections/AccountingCompaniesSection'
import AccountingMonthlyTrendsSection from './sections/AccountingMonthlyTrendsSection'

const defaultVAT: VATStats = {
  totalVATCollected: 0, totalVATPaid: 0, netVAT: 0,
  currentMonthVATCollected: 0, currentMonthVATPaid: 0
}

const defaultCashFlow: CashFlowStats = {
  totalIncoming: 0, totalOutgoing: 0, netCashFlow: 0,
  currentMonthIncoming: 0, currentMonthOutgoing: 0,
  previousMonthIncoming: 0, previousMonthOutgoing: 0
}

const AccountingDashboard: React.FC = () => {
  const { t } = useTranslation()
  const { data, loading, error, refetch } = useCachedData('dashboard:accounting', async () => {
    const [vat, cashFlow, companies, trends, budget] = await Promise.all([
      accountingService.fetchVATStats(),
      accountingService.fetchCashFlowStats(),
      accountingService.fetchTopCompanies(),
      accountingService.fetchMonthlyTrends(),
      accountingService.fetchMonthlyBudget()
    ])
    return { vat, cashFlow, companies, trends, budget }
  })

  const vatStats: VATStats = data?.vat ?? defaultVAT
  const cashFlowStats: CashFlowStats = data?.cashFlow ?? defaultCashFlow
  const topCompanies: TopCompany[] = data?.companies ?? []
  const monthlyData: MonthlyData[] = data?.trends ?? []
  const monthlyBudget: MonthlyBudget | null = data?.budget ?? null

  if (loading && !data) {
    return <LoadingSpinner size="lg" message={t('dashboards.accounting.loading')} />
  }

  if (error && !data) {
    return <DashboardError onRetry={refetch} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('dashboards.accounting.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('dashboards.accounting.subtitle')}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboards.accounting.current_period')}</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{format(new Date(), 'MMMM yyyy')}</p>
        </div>
      </div>

      <AccountingVATSection vatStats={vatStats} />

      {monthlyBudget && (
        <AccountingBudgetSection monthlyBudget={monthlyBudget} cashFlowStats={cashFlowStats} />
      )}

      <AccountingCashFlowSection cashFlowStats={cashFlowStats} />

      <AccountingCompaniesSection topCompanies={topCompanies} />

      <AccountingMonthlyTrendsSection monthlyData={monthlyData} />
    </div>
  )
}

export default AccountingDashboard
