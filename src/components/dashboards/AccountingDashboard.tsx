import React, { useState, useEffect } from 'react'
import { LoadingSpinner } from '../ui'
import { format } from 'date-fns'
import type { VATStats, CashFlowStats, TopCompany, MonthlyData, MonthlyBudget } from './types/accountingDashboardTypes'
import * as accountingService from './services/accountingDashboardService'
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
  const [loading, setLoading] = useState(true)
  const [vatStats, setVatStats] = useState<VATStats>(defaultVAT)
  const [cashFlowStats, setCashFlowStats] = useState<CashFlowStats>(defaultCashFlow)
  const [topCompanies, setTopCompanies] = useState<TopCompany[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [monthlyBudget, setMonthlyBudget] = useState<MonthlyBudget | null>(null)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [vat, cashFlow, companies, trends, budget] = await Promise.all([
        accountingService.fetchVATStats(),
        accountingService.fetchCashFlowStats(),
        accountingService.fetchTopCompanies(),
        accountingService.fetchMonthlyTrends(),
        accountingService.fetchMonthlyBudget()
      ])
      setVatStats(vat)
      setCashFlowStats(cashFlow)
      setTopCompanies(companies)
      setMonthlyData(trends)
      setMonthlyBudget(budget)
    } catch (error) {
      console.error('Error fetching accounting dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner size="lg" message="Loading accounting dashboard..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Accounting Dashboard</h1>
          <p className="text-gray-600 mt-1">Comprehensive financial overview and insights</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Current Period</p>
          <p className="text-lg font-semibold text-gray-900">{format(new Date(), 'MMMM yyyy')}</p>
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
