import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoadingSpinner, StatGrid, Button } from '../ui'
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
          <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-3xl font-bold text-green-600">{salesMetrics.sold_units}</p>
            <p className="text-sm text-gray-600">Sold Units</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <Clock className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
            <p className="text-3xl font-bold text-yellow-600">{salesMetrics.reserved_units}</p>
            <p className="text-sm text-gray-600">Reserved</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-3xl font-bold text-blue-600">{salesMetrics.available_units}</p>
            <p className="text-sm text-gray-600">Available</p>
          </div>
          <div className="text-center p-4 bg-teal-50 rounded-lg border border-teal-200">
            <Percent className="w-8 h-8 text-teal-600 mx-auto mb-2" />
            <p className="text-3xl font-bold text-teal-600">{salesMetrics.sales_rate.toFixed(1)}%</p>
            <p className="text-sm text-gray-600">Sales Rate</p>
          </div>
        </div>
        <StatGrid columns={3}>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Sales Revenue</p>
            <p className="text-2xl font-bold text-gray-900">€{(salesMetrics.total_sales_revenue / 1000000).toFixed(2)}M</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Avg Price per Unit</p>
            <p className="text-2xl font-bold text-gray-900">€{(salesMetrics.avg_price_per_unit / 1000).toFixed(0)}K</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Monthly Sales ({format(new Date(), 'MMM')})</p>
            <p className="text-2xl font-bold text-gray-900">
              {salesMetrics.monthly_sales_count} units / €{(salesMetrics.monthly_sales_revenue / 1000).toFixed(0)}K
            </p>
          </div>
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
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-600 mb-1">Total Subcontractors</p>
            <p className="text-3xl font-bold text-blue-600">{constructionMetrics.total_subcontractors}</p>
            <p className="text-xs text-gray-500 mt-1">{constructionMetrics.active_subcontractors} active contracts</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-sm text-gray-600 mb-1">Completed Contracts</p>
            <p className="text-3xl font-bold text-green-600">{constructionMetrics.completed_contracts}</p>
            <p className="text-xs text-gray-500 mt-1">Finished work</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <p className="text-sm text-gray-600 mb-1">Overdue Tasks</p>
            <p className="text-3xl font-bold text-red-600">{constructionMetrics.overdue_tasks}</p>
            <p className="text-xs text-gray-500 mt-1">Need attention</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <p className="text-sm text-gray-600 mb-1">Critical Deadlines</p>
            <p className="text-3xl font-bold text-orange-600">{constructionMetrics.critical_deadlines}</p>
            <p className="text-xs text-gray-500 mt-1">Within 7 days</p>
          </div>
        </div>
        <StatGrid columns={3}>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Contract Value</p>
            <p className="text-2xl font-bold text-gray-900">€{(constructionMetrics.total_contract_value / 1000000).toFixed(2)}M</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">€{(constructionMetrics.total_paid / 1000000).toFixed(2)}M</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Pending Payments</p>
            <p className="text-2xl font-bold text-orange-600">€{(constructionMetrics.pending_payments / 1000000).toFixed(2)}M</p>
          </div>
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
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <Users className="w-6 h-6 text-green-600 mb-2" />
            <p className="text-3xl font-bold text-green-600">{fundingMetrics.total_investors}</p>
            <p className="text-sm text-gray-600">Funded Projects</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <Building2 className="w-6 h-6 text-blue-600 mb-2" />
            <p className="text-3xl font-bold text-blue-600">{fundingMetrics.total_banks}</p>
            <p className="text-sm text-gray-600">Investors</p>
          </div>
          <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
            <Target className="w-6 h-6 text-teal-600 mb-2" />
            <p className="text-3xl font-bold text-teal-600">{fundingMetrics.credit_paid_out.toFixed(0)}%</p>
            <p className="text-sm text-gray-600">Credit Paid Out</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <Calendar className="w-6 h-6 text-orange-600 mb-2" />
            <p className="text-3xl font-bold text-orange-600">{fundingMetrics.upcoming_maturities}</p>
            <p className="text-sm text-gray-600">Upcoming Maturities</p>
          </div>
        </div>
        <StatGrid columns={4}>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Investments</p>
            <p className="text-xl font-bold text-gray-900">€{(fundingMetrics.total_bank_credit / 1000000).toFixed(1)}M</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Avg Interest Rate</p>
            <p className="text-xl font-bold text-blue-600">{fundingMetrics.avg_interest_rate.toFixed(2)}%</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Outstanding Debt</p>
            <p className="text-xl font-bold text-red-600">€{(fundingMetrics.outstanding_debt / 1000000).toFixed(1)}M</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Monthly Debt Service</p>
            <p className="text-xl font-bold text-orange-600">€{(fundingMetrics.monthly_debt_service / 1000).toFixed(0)}K</p>
          </div>
        </StatGrid>
      </div>

      <DirectorProjectsTable projects={projects} />
    </div>
  )
}

export default DirectorDashboard
