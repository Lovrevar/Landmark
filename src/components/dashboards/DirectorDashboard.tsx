import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
    return <LoadingSpinner size="lg" message="Loading comprehensive dashboard..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">General Dashboard</h1>
          <p className="text-gray-600 mt-1">Comprehensive overview of all business operations</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Last updated</p>
          <p className="text-lg font-semibold text-gray-900">{format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
        </div>
      </div>

      <DirectorAlertsSection alerts={alerts} />
      <DirectorFinancialSection metrics={financialMetrics} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Home className="w-6 h-6 text-green-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900">Sales Performance</h2>
          </div>
          <Button variant="success" onClick={() => navigate('/sales-projects')}>View Details</Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Sold Units" value={salesMetrics.sold_units} icon={CheckCircle} color="green" size="lg" />
          <StatCard label="Reserved" value={salesMetrics.reserved_units} icon={Clock} color="yellow" size="lg" />
          <StatCard label="Available" value={salesMetrics.available_units} icon={Package} color="blue" size="lg" />
          <StatCard label="Sales Rate" value={`${salesMetrics.sales_rate.toFixed(1)}%`} icon={Percent} color="teal" size="lg" />
        </div>
        <StatGrid columns={3}>
          <StatCard label="Total Sales Revenue" value={`€${(salesMetrics.total_sales_revenue / 1000000).toFixed(2)}M`} color="gray" size="md" />
          <StatCard label="Avg Price per Unit" value={`€${(salesMetrics.avg_price_per_unit / 1000).toFixed(0)}K`} color="gray" size="md" />
          <StatCard
            label={`Monthly Sales (${format(new Date(), 'MMM')})`}
            value={`${salesMetrics.monthly_sales_count} units`}
            subtitle={`€${(salesMetrics.monthly_sales_revenue / 1000).toFixed(0)}K revenue`}
            color="gray"
            size="md"
          />
        </StatGrid>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <HardHat className="w-6 h-6 text-orange-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900">Construction & Site Management</h2>
          </div>
          <Button variant="amber" onClick={() => navigate('/site-management')}>View Details</Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Subcontractors"
            value={constructionMetrics.total_subcontractors}
            subtitle={`${constructionMetrics.active_subcontractors} active contracts`}
            color="blue"
            size="lg"
          />
          <StatCard label="Completed Contracts" value={constructionMetrics.completed_contracts} subtitle="Finished work" color="green" size="lg" />
          <StatCard label="Overdue Tasks" value={constructionMetrics.overdue_tasks} subtitle="Need attention" color="red" size="lg" />
          <StatCard label="Critical Deadlines" value={constructionMetrics.critical_deadlines} subtitle="Within 7 days" color="orange" size="lg" />
        </div>
        <StatGrid columns={3}>
          <StatCard label="Total Contract Value" value={`€${(constructionMetrics.total_contract_value / 1000000).toFixed(2)}M`} color="gray" size="md" />
          <StatCard label="Total Paid" value={`€${(constructionMetrics.total_paid / 1000000).toFixed(2)}M`} color="gray" size="md" />
          <StatCard label="Pending Payments" value={`€${(constructionMetrics.pending_payments / 1000000).toFixed(2)}M`} color="gray" size="md" />
        </StatGrid>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Banknote className="w-6 h-6 text-blue-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900">Funding & Investment</h2>
          </div>
          <Button variant="primary" onClick={() => navigate('/funding-overview')}>View Details</Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Funded Projects" value={fundingMetrics.total_investors} icon={Users} color="green" size="lg" />
          <StatCard label="Investors" value={fundingMetrics.total_banks} icon={Building2} color="blue" size="lg" />
          <StatCard label="Credit Paid Out" value={`${fundingMetrics.credit_paid_out.toFixed(0)}%`} icon={Target} color="teal" size="lg" />
          <StatCard label="Upcoming Maturities" value={fundingMetrics.upcoming_maturities} icon={Calendar} color="orange" size="lg" />
        </div>
        <StatGrid columns={4}>
          <StatCard label="Total Investments" value={`€${(fundingMetrics.total_bank_credit / 1000000).toFixed(1)}M`} color="gray" size="md" />
          <StatCard label="Avg Interest Rate" value={`${fundingMetrics.avg_interest_rate.toFixed(2)}%`} color="gray" size="md" />
          <StatCard label="Outstanding Debt" value={`€${(fundingMetrics.outstanding_debt / 1000000).toFixed(1)}M`} color="gray" size="md" />
          <StatCard label="Monthly Debt Service" value={`€${(fundingMetrics.monthly_debt_service / 1000).toFixed(0)}K`} color="gray" size="md" />
        </StatGrid>
      </div>

      <DirectorProjectsTable projects={projects} />
    </div>
  )
}

export default DirectorDashboard
