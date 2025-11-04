import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Home,
  Banknote,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  BarChart3,
  PieChart,
  Activity,
  Wallet,
  CreditCard,
  FileText,
  HardHat,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  ShoppingCart,
  Percent
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths, differenceInDays, parseISO } from 'date-fns'

interface ProjectStats {
  id: string
  name: string
  location: string
  status: string
  budget: number
  total_expenses: number
  apartment_sales: number
  total_investment: number
  total_debt: number
  profit_margin: number
  completion_percentage: number
}

interface FinancialMetrics {
  total_revenue: number
  total_expenses: number
  total_profit: number
  profit_margin: number
  total_debt: number
  total_equity: number
  debt_to_equity_ratio: number
  cash_flow_current_month: number
  outstanding_receivables: number
  outstanding_payables: number
}

interface SalesMetrics {
  total_units: number
  sold_units: number
  reserved_units: number
  available_units: number
  sales_rate: number
  total_sales_revenue: number
  avg_price_per_unit: number
  monthly_sales_count: number
  monthly_sales_revenue: number
}

interface ConstructionMetrics {
  total_subcontractors: number
  active_subcontractors: number
  completed_contracts: number
  total_contract_value: number
  total_paid: number
  pending_payments: number
  overdue_tasks: number
  critical_deadlines: number
}

interface FundingMetrics {
  total_investors: number
  total_banks: number
  total_bank_credit: number
  available_credit: number
  credit_paid_out: number
  avg_interest_rate: number
  monthly_debt_service: number
  upcoming_maturities: number
}

interface Alert {
  type: 'critical' | 'warning' | 'info'
  title: string
  message: string
  date?: string
}

const DirectorDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectStats[]>([])
  const [financialMetrics, setFinancialMetrics] = useState<FinancialMetrics>({
    total_revenue: 0,
    total_expenses: 0,
    total_profit: 0,
    profit_margin: 0,
    total_debt: 0,
    total_equity: 0,
    debt_to_equity_ratio: 0,
    cash_flow_current_month: 0,
    outstanding_receivables: 0,
    outstanding_payables: 0
  })
  const [salesMetrics, setSalesMetrics] = useState<SalesMetrics>({
    total_units: 0,
    sold_units: 0,
    reserved_units: 0,
    available_units: 0,
    sales_rate: 0,
    total_sales_revenue: 0,
    avg_price_per_unit: 0,
    monthly_sales_count: 0,
    monthly_sales_revenue: 0
  })
  const [constructionMetrics, setConstructionMetrics] = useState<ConstructionMetrics>({
    total_subcontractors: 0,
    active_subcontractors: 0,
    completed_contracts: 0,
    total_contract_value: 0,
    total_paid: 0,
    pending_payments: 0,
    overdue_tasks: 0,
    critical_deadlines: 0
  })
  const [fundingMetrics, setFundingMetrics] = useState<FundingMetrics>({
    total_investors: 0,
    total_banks: 0,
    total_bank_credit: 0,
    available_credit: 0,
    credit_paid_out: 0,
    avg_interest_rate: 0,
    monthly_debt_service: 0,
    upcoming_maturities: 0
  })
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAllDashboardData()
  }, [])

  const fetchAllDashboardData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchProjectsData(),
        fetchFinancialData(),
        fetchSalesData(),
        fetchConstructionData(),
        fetchFundingData(),
        generateAlerts()
      ])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProjectsData = async () => {
    try {
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (projectsError) throw projectsError

      const projectsWithStats = await Promise.all(
        (projectsData || []).map(async (project) => {
          const { data: contracts } = await supabase
            .from('contracts')
            .select('id')
            .eq('project_id', project.id)

          const contractIds = contracts?.map(c => c.id) || []

          let totalExpenses = 0
          if (contractIds.length > 0) {
            const { data: payments } = await supabase
              .from('wire_payments')
              .select('amount')
              .in('contract_id', contractIds)
            totalExpenses = payments?.reduce((sum, p) => sum + p.amount, 0) || 0
          }

          const { data: apartments } = await supabase
            .from('apartments')
            .select('price, status')
            .eq('project_id', project.id)

          const apartmentSales = apartments?.filter(a => a.status === 'Sold').reduce((sum, apt) => sum + apt.price, 0) || 0

          const { data: projectInvestments } = await supabase
            .from('project_investments')
            .select('amount')
            .eq('project_id', project.id)
          const totalInvestment = projectInvestments?.reduce((sum, inv) => sum + inv.amount, 0) || 0

          const { data: bankCredits } = await supabase
            .from('bank_credits')
            .select('outstanding_balance')
            .eq('project_id', project.id)
          const totalDebt = bankCredits?.reduce((sum, bc) => sum + bc.outstanding_balance, 0) || 0

          const totalUnits = apartments?.length || 0
          const soldUnits = apartments?.filter(a => a.status === 'Sold').length || 0
          const completionPercentage = totalUnits > 0 ? (soldUnits / totalUnits) * 100 : 0

          const profit = apartmentSales - totalExpenses
          const profitMargin = apartmentSales > 0 ? (profit / apartmentSales) * 100 : 0

          return {
            id: project.id,
            name: project.name,
            location: project.location,
            status: project.status,
            budget: project.budget,
            total_expenses: totalExpenses,
            apartment_sales: apartmentSales,
            total_investment: totalInvestment,
            total_debt: totalDebt,
            profit_margin: profitMargin,
            completion_percentage: completionPercentage
          }
        })
      )

      setProjects(projectsWithStats)
    } catch (error) {
      console.error('Error fetching projects data:', error)
    }
  }

  const fetchFinancialData = async () => {
    try {
      const { data: sales } = await supabase.from('sales').select('sale_price')
      const { data: wirePayments } = await supabase.from('wire_payments').select('amount')
      const { data: apartmentPayments } = await supabase.from('apartment_payments').select('amount, payment_date')
      const { data: bankCredits } = await supabase.from('bank_credits').select('outstanding_balance')
      const { data: projectInvestments } = await supabase.from('project_investments').select('amount')

      const totalRevenue = sales?.reduce((sum, s) => sum + s.sale_price, 0) || 0
      const totalExpenses = wirePayments?.reduce((sum, p) => sum + p.amount, 0) || 0
      const totalProfit = totalRevenue - totalExpenses
      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
      const totalDebt = bankCredits?.reduce((sum, bc) => sum + bc.outstanding_balance, 0) || 0
      const totalEquity = projectInvestments?.reduce((sum, inv) => sum + inv.amount, 0) || 0
      const debtToEquityRatio = totalEquity > 0 ? totalDebt / totalEquity : 0

      const currentMonth = startOfMonth(new Date())
      const currentMonthPayments = apartmentPayments?.filter(p =>
        p.payment_date && new Date(p.payment_date) >= currentMonth
      ) || []
      const cashFlowCurrentMonth = currentMonthPayments.reduce((sum, p) => sum + p.amount, 0)

      const { data: apartmentsData } = await supabase
        .from('apartments')
        .select('price, status')
        .in('status', ['Sold', 'Reserved'])

      const outstandingReceivables = apartmentsData?.reduce((sum, apt) => {
        if (apt.status === 'Reserved') return sum + apt.price
        return sum
      }, 0) || 0

      const outstandingPayables = totalDebt

      setFinancialMetrics({
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        total_profit: totalProfit,
        profit_margin: profitMargin,
        total_debt: totalDebt,
        total_equity: totalEquity,
        debt_to_equity_ratio: debtToEquityRatio,
        cash_flow_current_month: cashFlowCurrentMonth,
        outstanding_receivables: outstandingReceivables,
        outstanding_payables: outstandingPayables
      })
    } catch (error) {
      console.error('Error fetching financial data:', error)
    }
  }

  const fetchSalesData = async () => {
    try {
      const { data: apartments } = await supabase.from('apartments').select('*')
      const { data: sales } = await supabase.from('sales').select('sale_price, sale_date')

      const totalUnits = apartments?.length || 0
      const soldUnits = apartments?.filter(a => a.status === 'Sold').length || 0
      const reservedUnits = apartments?.filter(a => a.status === 'Reserved').length || 0
      const availableUnits = apartments?.filter(a => a.status === 'Available').length || 0
      const salesRate = totalUnits > 0 ? (soldUnits / totalUnits) * 100 : 0
      const totalSalesRevenue = sales?.reduce((sum, s) => sum + s.sale_price, 0) || 0
      const avgPricePerUnit = soldUnits > 0 ? totalSalesRevenue / soldUnits : 0

      const currentMonth = startOfMonth(new Date())
      const monthlySales = sales?.filter(s => new Date(s.sale_date) >= currentMonth) || []
      const monthlySalesCount = monthlySales.length
      const monthlySalesRevenue = monthlySales.reduce((sum, s) => sum + s.sale_price, 0)

      setSalesMetrics({
        total_units: totalUnits,
        sold_units: soldUnits,
        reserved_units: reservedUnits,
        available_units: availableUnits,
        sales_rate: salesRate,
        total_sales_revenue: totalSalesRevenue,
        avg_price_per_unit: avgPricePerUnit,
        monthly_sales_count: monthlySalesCount,
        monthly_sales_revenue: monthlySalesRevenue
      })
    } catch (error) {
      console.error('Error fetching sales data:', error)
    }
  }

  const fetchConstructionData = async () => {
    try {
      const { data: subcontractors } = await supabase
        .from('subcontractors')
        .select('id, deadline, progress')

      const { data: contracts } = await supabase
        .from('contracts')
        .select('id, contract_amount, status')

      const { data: wirePayments } = await supabase
        .from('wire_payments')
        .select('amount, contract_id')

      const totalSubcontractors = subcontractors?.length || 0
      const activeSubcontractors = subcontractors?.filter(s => s.progress < 100).length || 0
      const completedContracts = contracts?.filter(c => c.status === 'completed').length || 0
      const totalContractValue = contracts?.reduce((sum, c) => sum + c.contract_amount, 0) || 0
      const totalPaid = wirePayments?.reduce((sum, p) => sum + p.amount, 0) || 0
      const pendingPayments = totalContractValue - totalPaid

      const today = new Date()
      const overdueTasks = subcontractors?.filter(s =>
        s.deadline && new Date(s.deadline) < today && s.progress < 100
      ).length || 0

      const criticalDeadlines = subcontractors?.filter(s => {
        if (!s.deadline || s.progress >= 100) return false
        const daysUntil = differenceInDays(new Date(s.deadline), today)
        return daysUntil >= 0 && daysUntil <= 7
      }).length || 0

      setConstructionMetrics({
        total_subcontractors: totalSubcontractors,
        active_subcontractors: activeSubcontractors,
        completed_contracts: completedContracts,
        total_contract_value: totalContractValue,
        total_paid: totalPaid,
        pending_payments: pendingPayments,
        overdue_tasks: overdueTasks,
        critical_deadlines: criticalDeadlines
      })
    } catch (error) {
      console.error('Error fetching construction data:', error)
    }
  }

  const fetchFundingData = async () => {
    try {
      const { data: investors } = await supabase.from('investors').select('*')
      const { data: banks } = await supabase.from('banks').select('*')
      const { data: bankCredits } = await supabase
        .from('bank_credits')
        .select('amount, outstanding_balance, interest_rate, monthly_payment, maturity_date')
      const { data: bankCreditPayments } = await supabase
        .from('bank_credit_payments')
        .select('amount')

      const { data: wirePayments } = await supabase
        .from('wire_payments')
        .select('amount')

      const totalInvestors = investors?.length || 0
      const totalBanks = banks?.length || 0
      const totalBankCredit = bankCredits?.reduce((sum, bc) => sum + bc.amount, 0) || 0
      const totalPaidToSubcontractors = wirePayments?.reduce((sum, p) => sum + p.amount, 0) || 0
      const availableCredit = (totalBankCredit - sum of outstanding_balance) / totalBankCredit × 100
      const totalPaidOut = bankCreditPayments?.reduce((sum, p) => sum + p.amount, 0) || 0
      const creditPaidOut = totalBankCredit > 0 ? (totalPaidOut / totalBankCredit) * 100 : 0

      const avgInterestRate = bankCredits?.length
        ? bankCredits.reduce((sum, bc) => sum + bc.interest_rate, 0) / bankCredits.length
        : 0

      const monthlyDebtService = bankCredits?.reduce((sum, bc) => sum + bc.monthly_payment, 0) || 0

      const upcomingMaturities = bankCredits?.filter(bc => {
        if (!bc.maturity_date) return false
        const daysUntil = differenceInDays(new Date(bc.maturity_date), new Date())
        return daysUntil >= 0 && daysUntil <= 90
      }).length || 0

      setFundingMetrics({
        total_investors: totalInvestors,
        total_banks: totalBanks,
        total_bank_credit: totalBankCredit,
        available_credit: availableCredit,
        credit_paid_out: creditPaidOut,
        avg_interest_rate: avgInterestRate,
        monthly_debt_service: monthlyDebtService,
        upcoming_maturities: upcomingMaturities
      })
    } catch (error) {
      console.error('Error fetching funding data:', error)
    }
  }

  const generateAlerts = async () => {
    const newAlerts: Alert[] = []

    try {
      const { data: subcontractors } = await supabase
        .from('subcontractors')
        .select('name, deadline, progress')

      const today = new Date()

      subcontractors?.forEach(sub => {
        if (sub.deadline && sub.progress < 100) {
          const daysUntil = differenceInDays(new Date(sub.deadline), today)
          if (daysUntil < 0) {
            newAlerts.push({
              type: 'critical',
              title: 'Overdue Task',
              message: `${sub.name} is ${Math.abs(daysUntil)} days overdue (${sub.progress}% complete)`,
              date: sub.deadline
            })
          } else if (daysUntil <= 3) {
            newAlerts.push({
              type: 'warning',
              title: 'Urgent Deadline',
              message: `${sub.name} due in ${daysUntil} days (${sub.progress}% complete)`,
              date: sub.deadline
            })
          }
        }
      })

      const { data: bankCredits } = await supabase
        .from('bank_credits')
        .select('maturity_date, amount, banks(name)')

      bankCredits?.forEach(credit => {
        if (credit.maturity_date) {
          const daysUntil = differenceInDays(new Date(credit.maturity_date), today)
          if (daysUntil >= 0 && daysUntil <= 30) {
            newAlerts.push({
              type: 'warning',
              title: 'Credit Maturity',
              message: `${credit.banks?.name || 'Bank'} credit of €${credit.amount.toLocaleString()} matures in ${daysUntil} days`,
              date: credit.maturity_date
            })
          }
        }
      })

      if (financialMetrics.debt_to_equity_ratio > 2) {
        newAlerts.push({
          type: 'warning',
          title: 'High Leverage',
          message: `Debt-to-Equity ratio is ${financialMetrics.debt_to_equity_ratio.toFixed(2)}x (recommended < 2x)`
        })
      }

      if (salesMetrics.sales_rate < 30 && salesMetrics.total_units > 0) {
        newAlerts.push({
          type: 'info',
          title: 'Low Sales Rate',
          message: `Only ${salesMetrics.sales_rate.toFixed(1)}% of units sold. Consider sales strategy review.`
        })
      }

      setAlerts(newAlerts.slice(0, 10))
    } catch (error) {
      console.error('Error generating alerts:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading comprehensive dashboard...</p>
        </div>
      </div>
    )
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

      {/* Critical Alerts Section */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Critical Alerts ({alerts.length})</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.slice(0, 6).map((alert, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  alert.type === 'critical'
                    ? 'bg-red-50 border-red-200'
                    : alert.type === 'warning'
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start">
                  {alert.type === 'critical' ? (
                    <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                  ) : alert.type === 'warning' ? (
                    <Clock className="w-5 h-5 text-orange-600 mr-2 mt-0.5" />
                  ) : (
                    <Activity className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-semibold text-sm ${
                      alert.type === 'critical' ? 'text-red-900' :
                      alert.type === 'warning' ? 'text-orange-900' : 'text-blue-900'
                    }`}>
                      {alert.title}
                    </p>
                    <p className={`text-xs mt-1 ${
                      alert.type === 'critical' ? 'text-red-700' :
                      alert.type === 'warning' ? 'text-orange-700' : 'text-blue-700'
                    }`}>
                      {alert.message}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Financial Overview - Top Priority */}
      <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl shadow-lg border border-blue-200 p-6">
        <div className="flex items-center mb-6">
          <DollarSign className="w-6 h-6 text-blue-600 mr-2" />
          <h2 className="text-2xl font-bold text-gray-900">Financial Overview</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total Revenue</p>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-600">
              €{(financialMetrics.total_revenue / 1000000).toFixed(2)}M
            </p>
            <p className="text-xs text-gray-500 mt-1">From all sales</p>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total Expenses</p>
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-red-600">
              €{(financialMetrics.total_expenses / 1000000).toFixed(2)}M
            </p>
            <p className="text-xs text-gray-500 mt-1">All payments made</p>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Net Profit</p>
              <Wallet className="w-5 h-5 text-blue-600" />
            </div>
            <p className={`text-3xl font-bold ${financialMetrics.total_profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              €{(financialMetrics.total_profit / 1000000).toFixed(2)}M
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {financialMetrics.profit_margin.toFixed(1)}% margin
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total Debt</p>
              <CreditCard className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-orange-600">
              €{(financialMetrics.total_debt / 1000000).toFixed(2)}M
            </p>
            <p className="text-xs text-gray-500 mt-1">Outstanding balance</p>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Cash Flow (Month)</p>
              <Activity className="w-5 h-5 text-teal-600" />
            </div>
            <p className="text-3xl font-bold text-teal-600">
              €{(financialMetrics.cash_flow_current_month / 1000).toFixed(0)}K
            </p>
            <p className="text-xs text-gray-500 mt-1">{format(new Date(), 'MMMM')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-600">Debt/Equity Ratio</p>
                <p className={`text-xl font-bold ${
                  financialMetrics.debt_to_equity_ratio > 2 ? 'text-red-600' :
                  financialMetrics.debt_to_equity_ratio > 1 ? 'text-orange-600' : 'text-green-600'
                }`}>
                  {financialMetrics.debt_to_equity_ratio.toFixed(2)}x
                </p>
              </div>
              <PieChart className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-600">Receivables</p>
                <p className="text-xl font-bold text-blue-600">
                  €{(financialMetrics.outstanding_receivables / 1000).toFixed(0)}K
                </p>
              </div>
              <ArrowUpRight className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-600">Payables</p>
                <p className="text-xl font-bold text-orange-600">
                  €{(financialMetrics.outstanding_payables / 1000).toFixed(0)}K
                </p>
              </div>
              <ArrowDownRight className="w-8 h-8 text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Sales Performance */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Home className="w-6 h-6 text-green-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900">Sales Performance</h2>
          </div>
          <button
            onClick={() => navigate('/sales-projects')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            View Details
          </button>
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
          <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
            <Percent className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <p className="text-3xl font-bold text-purple-600">{salesMetrics.sales_rate.toFixed(1)}%</p>
            <p className="text-sm text-gray-600">Sales Rate</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        </div>
      </div>

      {/* Construction & Site Management */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <HardHat className="w-6 h-6 text-orange-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900">Construction & Site Management</h2>
          </div>
          <button
            onClick={() => navigate('/site-management')}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            View Details
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-600 mb-1">Total Subcontractors</p>
            <p className="text-3xl font-bold text-blue-600">{constructionMetrics.total_subcontractors}</p>
            <p className="text-xs text-gray-500 mt-1">{constructionMetrics.active_subcontractors} active</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        </div>
      </div>

      {/* Funding & Investment */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Banknote className="w-6 h-6 text-purple-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900">Funding & Investment</h2>
          </div>
          <button
            onClick={() => navigate('/funding-overview')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            View Details
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <Users className="w-6 h-6 text-green-600 mb-2" />
            <p className="text-3xl font-bold text-green-600">{fundingMetrics.total_investors}</p>
            <p className="text-sm text-gray-600">Active Investors</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <Building2 className="w-6 h-6 text-blue-600 mb-2" />
            <p className="text-3xl font-bold text-blue-600">{fundingMetrics.total_banks}</p>
            <p className="text-sm text-gray-600">Banking Partners</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <Target className="w-6 h-6 text-purple-600 mb-2" />
            <p className="text-3xl font-bold text-purple-600">{fundingMetrics.credit_paid_out.toFixed(0)}%</p>
            <p className="text-sm text-gray-600">Credit Paid Out</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <Calendar className="w-6 h-6 text-orange-600 mb-2" />
            <p className="text-3xl font-bold text-orange-600">{fundingMetrics.upcoming_maturities}</p>
            <p className="text-sm text-gray-600">Upcoming Maturities</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Credits</p>
            <p className="text-xl font-bold text-gray-900">€{(fundingMetrics.total_bank_credit / 1000000).toFixed(1)}M</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Available Credit</p>
            <p className="text-xl font-bold text-green-600">€{(fundingMetrics.available_credit / 1000000).toFixed(1)}M</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Avg Interest Rate</p>
            <p className="text-xl font-bold text-blue-600">{fundingMetrics.avg_interest_rate.toFixed(2)}%</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Monthly Debt Service</p>
            <p className="text-xl font-bold text-orange-600">€{(fundingMetrics.monthly_debt_service / 1000).toFixed(0)}K</p>
          </div>
        </div>
      </div>

      {/* Projects Overview Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Projects Portfolio</h2>
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-600">{projects.length}</p>
              <p className="text-sm text-gray-600">Total Projects</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Budget</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Expenses</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Profit Margin</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Completion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">No projects available</p>
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/projects/${project.id}`)}>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">{project.name}</p>
                        <p className="text-sm text-gray-500">{project.location}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                        project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                        project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                        project.status === 'On Hold' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      €{(project.budget / 1000000).toFixed(2)}M
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-red-600">
                      €{(project.total_expenses / 1000000).toFixed(2)}M
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-green-600">
                      €{(project.apartment_sales / 1000000).toFixed(2)}M
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center text-sm font-semibold ${
                        project.profit_margin >= 20 ? 'text-green-600' :
                        project.profit_margin >= 10 ? 'text-blue-600' :
                        project.profit_margin >= 0 ? 'text-orange-600' : 'text-red-600'
                      }`}>
                        {project.profit_margin >= 0 ? '+' : ''}{project.profit_margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${project.completion_percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {project.completion_percentage.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default DirectorDashboard
