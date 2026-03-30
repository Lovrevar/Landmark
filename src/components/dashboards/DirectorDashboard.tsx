import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LoadingSpinner, StatGrid, Button } from '../ui'
import StatCard from '../ui/StatCard'
import {
  Home,
  Banknote,
  HardHat,
  CheckCircle,
  Clock,
  Package,
  Percent,
  Users,
  Building2,
  Target,
  Calendar
} from 'lucide-react'
import { format } from 'date-fns'
import type { ProjectStats, FinancialMetrics, SalesMetrics, ConstructionMetrics, FundingMetrics, Alert } from './types/directorTypes'
import * as directorService from './services/directorService'
import DirectorAlertsSection from './sections/DirectorAlertsSection'
import DirectorFinancialSection from './sections/DirectorFinancialSection'
import DirectorProjectsTable from './sections/DirectorProjectsTable'

const defaultFinancial: FinancialMetrics = {
  total_revenue: 0, total_expenses: 0, total_profit: 0, profit_margin: 0,
  total_debt: 0, total_equity: 0, debt_to_equity_ratio: 0,
  cash_flow_current_month: 0, outstanding_receivables: 0, outstanding_payables: 0
}
const defaultSales: SalesMetrics = {
  total_units: 0, sold_units: 0, reserved_units: 0, available_units: 0,
  sales_rate: 0, total_sales_revenue: 0, avg_price_per_unit: 0,
  monthly_sales_count: 0, monthly_sales_revenue: 0
}
const defaultConstruction: ConstructionMetrics = {
  total_subcontractors: 0, active_subcontractors: 0, completed_contracts: 0,
  total_contract_value: 0, total_paid: 0, pending_payments: 0,
  overdue_tasks: 0, critical_deadlines: 0
}
const defaultFunding: FundingMetrics = {
  total_investors: 0, total_banks: 0, total_bank_credit: 0,
  outstanding_debt: 0, credit_paid_out: 0, avg_interest_rate: 0,
  monthly_debt_service: 0, upcoming_maturities: 0
}

const DirectorDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [projects, setProjects] = useState<ProjectStats[]>([])
  const [financialMetrics, setFinancialMetrics] = useState<FinancialMetrics>(defaultFinancial)
  const [salesMetrics, setSalesMetrics] = useState<SalesMetrics>(defaultSales)
  const [constructionMetrics, setConstructionMetrics] = useState<ConstructionMetrics>(defaultConstruction)
  const [fundingMetrics, setFundingMetrics] = useState<FundingMetrics>(defaultFunding)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [projectsData, financial, sales, construction, funding] = await Promise.all([
        directorService.fetchProjectsData(),
        directorService.fetchFinancialMetrics(),
        directorService.fetchSalesMetrics(),
        directorService.fetchConstructionMetrics(),
        directorService.fetchFundingMetrics()
      ])
      setProjects(projectsData)
      setFinancialMetrics(financial)
      setSalesMetrics(sales)
      setConstructionMetrics(construction)
      setFundingMetrics(funding)
      const alertsData = await directorService.fetchAlerts(financial, sales)
      setAlerts(alertsData)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner size="lg" message={t('dashboards.director.loading')} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('dashboards.director.general_dashboard')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('dashboards.director.comprehensive_overview')}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboards.director.last_updated')}</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
        </div>
      </div>

      <DirectorAlertsSection alerts={alerts} />
      <DirectorFinancialSection metrics={financialMetrics} />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Home className="w-6 h-6 text-green-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboards.director.sales_performance')}</h2>
          </div>
          <Button variant="success" onClick={() => navigate('/sales-projects')}>{t('dashboards.director.view_details')}</Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label={t('dashboards.director.sold_units')} value={salesMetrics.sold_units} icon={CheckCircle} color="green" size="lg" />
          <StatCard label={t('dashboards.director.reserved')} value={salesMetrics.reserved_units} icon={Clock} color="yellow" size="lg" />
          <StatCard label={t('dashboards.director.available')} value={salesMetrics.available_units} icon={Package} color="blue" size="lg" />
          <StatCard label={t('dashboards.director.sales_rate')} value={`${salesMetrics.sales_rate.toFixed(1)}%`} icon={Percent} color="teal" size="lg" />
        </div>
        <StatGrid columns={3}>
          <StatCard label={t('dashboards.director.total_sales_revenue')} value={`€${(salesMetrics.total_sales_revenue / 1000000).toFixed(2)}M`} color="gray" size="md" />
          <StatCard label={t('dashboards.director.avg_price_per_unit')} value={`€${(salesMetrics.avg_price_per_unit / 1000).toFixed(0)}K`} color="gray" size="md" />
          <StatCard
            label={t('dashboards.director.monthly_sales', { month: format(new Date(), 'MMM') })}
            value={`${salesMetrics.monthly_sales_count} ${t('dashboards.director.units')}`}
            subtitle={`€${(salesMetrics.monthly_sales_revenue / 1000).toFixed(0)}K revenue`}
            color="gray"
            size="md"
          />
        </StatGrid>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <HardHat className="w-6 h-6 text-orange-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboards.director.construction_site')}</h2>
          </div>
          <Button variant="amber" onClick={() => navigate('/site-management')}>{t('dashboards.director.view_details')}</Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label={t('dashboards.director.total_subcontractors')}
            value={constructionMetrics.total_subcontractors}
            subtitle={`${constructionMetrics.active_subcontractors} ${t('dashboards.director.active_contracts')}`}
            color="blue"
            size="lg"
          />
          <StatCard label={t('dashboards.director.completed_contracts')} value={constructionMetrics.completed_contracts} subtitle={t('dashboards.director.finished_work')} color="green" size="lg" />
          <StatCard label={t('dashboards.director.overdue_tasks')} value={constructionMetrics.overdue_tasks} subtitle={t('dashboards.director.need_attention')} color="red" size="lg" />
          <StatCard label={t('dashboards.director.critical_deadlines')} value={constructionMetrics.critical_deadlines} subtitle={t('dashboards.director.within_7_days')} color="orange" size="lg" />
        </div>
        <StatGrid columns={3}>
          <StatCard label={t('dashboards.director.total_contract_value')} value={`€${(constructionMetrics.total_contract_value / 1000000).toFixed(2)}M`} color="gray" size="md" />
          <StatCard label={t('dashboards.director.total_paid')} value={`€${(constructionMetrics.total_paid / 1000000).toFixed(2)}M`} color="gray" size="md" />
          <StatCard label={t('dashboards.director.pending_payments')} value={`€${(constructionMetrics.pending_payments / 1000000).toFixed(2)}M`} color="gray" size="md" />
        </StatGrid>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Banknote className="w-6 h-6 text-blue-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboards.director.funding_investment')}</h2>
          </div>
          <Button variant="primary" onClick={() => navigate('/funding-overview')}>{t('dashboards.director.view_details')}</Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label={t('dashboards.director.funded_projects')} value={fundingMetrics.total_investors} icon={Users} color="green" size="lg" />
          <StatCard label={t('dashboards.director.investors')} value={fundingMetrics.total_banks} icon={Building2} color="blue" size="lg" />
          <StatCard label={t('dashboards.director.credit_paid_out')} value={`${fundingMetrics.credit_paid_out.toFixed(0)}%`} icon={Target} color="teal" size="lg" />
          <StatCard label={t('dashboards.director.upcoming_maturities')} value={fundingMetrics.upcoming_maturities} icon={Calendar} color="orange" size="lg" />
        </div>
        <StatGrid columns={4}>
          <StatCard label={t('dashboards.director.total_investments')} value={`€${(fundingMetrics.total_bank_credit / 1000000).toFixed(1)}M`} color="gray" size="md" />
          <StatCard label={t('dashboards.director.avg_interest_rate')} value={`${fundingMetrics.avg_interest_rate.toFixed(2)}%`} color="gray" size="md" />
          <StatCard label={t('dashboards.director.outstanding_debt')} value={`€${(fundingMetrics.outstanding_debt / 1000000).toFixed(1)}M`} color="gray" size="md" />
          <StatCard label={t('dashboards.director.monthly_debt_service')} value={`€${(fundingMetrics.monthly_debt_service / 1000).toFixed(0)}K`} color="gray" size="md" />
        </StatGrid>
      </div>

      <DirectorProjectsTable projects={projects} />
    </div>
  )
}

export default DirectorDashboard
