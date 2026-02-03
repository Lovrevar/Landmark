import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  Building2,
  DollarSign,
  TrendingUp,
  Banknote,
  PieChart,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Calendar,
  CreditCard
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'

interface Project {
  id: string
  name: string
  location: string
  budget: number
  status: string
  investor: string
  start_date: string
  end_date: string
}

interface Company {
  id: string
  name: string
  oib: string
}

interface Bank {
  id: string
  name: string
  contact_person?: string
  contact_email?: string
}

interface BankCredit {
  id: string
  credit_name: string
  company_id: string
  project_id: string | null
  amount: number
  used_amount: number
  repaid_amount: number
  outstanding_balance: number
  interest_rate: number
  start_date: string
  maturity_date: string | null
  usage_expiration_date: string | null
  status: string
  credit_type: string
  company?: Company
  project?: Project
}

interface FinancialSummary {
  total_portfolio_value: number
  total_debt: number
  total_equity: number
  debt_to_equity_ratio: number
  weighted_avg_interest: number
  upcoming_maturities: number
  total_credit_lines: number
  available_credit: number
  total_used_credit: number
  total_repaid_credit: number
}

interface RecentActivity {
  id: string
  type: 'credit' | 'maturity' | 'usage_expiring'
  title: string
  description: string
  date: string
  amount?: number
}

const InvestmentDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [bankCredits, setBankCredits] = useState<BankCredit[]>([])
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary>({
    total_portfolio_value: 0,
    total_debt: 0,
    total_equity: 0,
    debt_to_equity_ratio: 0,
    weighted_avg_interest: 0,
    upcoming_maturities: 0,
    total_credit_lines: 0,
    available_credit: 0,
    total_used_credit: 0,
    total_repaid_credit: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [
        { data: projectsData },
        { data: companiesData },
        { data: banksData },
        { data: creditsData }
      ] = await Promise.all([
        supabase.from('projects').select('*').order('start_date', { ascending: false }),
        supabase.from('accounting_companies').select('*').order('name'),
        supabase.from('banks').select('*').order('name'),
        supabase.from('bank_credits').select(`
          *,
          company:accounting_companies(id, name, oib),
          project:projects(id, name, location, budget, status)
        `).order('created_at', { ascending: false })
      ])

      const projects = projectsData || []
      const companies = companiesData || []
      const banks = banksData || []
      const credits = creditsData || []

      const total_portfolio_value = projects.reduce((sum, p) => sum + Number(p.budget), 0)
      const total_credit_lines = credits.reduce((sum, c) => sum + Number(c.amount), 0)
      const total_used_credit = credits.reduce((sum, c) => sum + Number(c.used_amount || 0), 0)
      const total_repaid_credit = credits.reduce((sum, c) => sum + Number(c.repaid_amount || 0), 0)
      const total_outstanding_debt = credits.reduce((sum, c) => sum + Number(c.outstanding_balance || 0), 0)
      const available_credit = total_credit_lines - total_used_credit

      const weighted_avg_interest = credits.length > 0
        ? credits.reduce((sum, c) => sum + Number(c.interest_rate || 0), 0) / credits.length
        : 0

      const upcoming_maturities = credits.filter(c =>
        c.maturity_date && differenceInDays(new Date(c.maturity_date), new Date()) <= 90 && differenceInDays(new Date(c.maturity_date), new Date()) > 0
      ).length

      const upcoming_usage_expirations = credits.filter(c =>
        c.usage_expiration_date && differenceInDays(new Date(c.usage_expiration_date), new Date()) <= 90 && differenceInDays(new Date(c.usage_expiration_date), new Date()) > 0
      ).length

      const activities: RecentActivity[] = []

      credits
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3)
        .forEach(credit => {
          activities.push({
            id: credit.id,
            type: 'credit',
            title: 'Credit facility approved',
            description: `${credit.company?.name || 'Company'} - €${(Number(credit.amount) / 1000000).toFixed(1)}M ${credit.credit_type.replace('_', ' ')}${credit.project ? ` for ${credit.project.name}` : ''}`,
            date: credit.start_date,
            amount: Number(credit.amount)
          })
        })

      credits
        .filter(c => c.maturity_date && differenceInDays(new Date(c.maturity_date), new Date()) <= 90 && differenceInDays(new Date(c.maturity_date), new Date()) > 0)
        .sort((a, b) => new Date(a.maturity_date!).getTime() - new Date(b.maturity_date!).getTime())
        .slice(0, 3)
        .forEach(credit => {
          const daysUntil = differenceInDays(new Date(credit.maturity_date!), new Date())
          activities.push({
            id: credit.id + '_maturity',
            type: 'maturity',
            title: 'Upcoming loan maturity',
            description: `${credit.credit_name || credit.company?.name || 'Credit'} matures in ${daysUntil} days`,
            date: credit.maturity_date!
          })
        })

      credits
        .filter(c => c.usage_expiration_date && differenceInDays(new Date(c.usage_expiration_date), new Date()) <= 90 && differenceInDays(new Date(c.usage_expiration_date), new Date()) > 0)
        .sort((a, b) => new Date(a.usage_expiration_date!).getTime() - new Date(b.usage_expiration_date!).getTime())
        .slice(0, 2)
        .forEach(credit => {
          const daysUntil = differenceInDays(new Date(credit.usage_expiration_date!), new Date())
          activities.push({
            id: credit.id + '_usage',
            type: 'usage_expiring',
            title: 'Credit usage period expiring',
            description: `${credit.credit_name || credit.company?.name || 'Credit'} usage expires in ${daysUntil} days`,
            date: credit.usage_expiration_date!
          })
        })

      activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      setProjects(projects)
      setCompanies(companies)
      setBanks(banks)
      setBankCredits(credits)
      setRecentActivities(activities.slice(0, 5))
      setFinancialSummary({
        total_portfolio_value,
        total_debt: total_outstanding_debt,
        total_equity: 0,
        debt_to_equity_ratio: 0,
        weighted_avg_interest,
        upcoming_maturities,
        total_credit_lines,
        available_credit,
        total_used_credit,
        total_repaid_credit
      })
    } catch (error) {
      console.error('Error fetching investment data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Investment Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of funding, credits, and financial metrics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Portfolio Value</p>
              <p className="text-2xl font-bold text-gray-900">
                €{(financialSummary.total_portfolio_value / 1000000).toFixed(1)}M
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <ArrowDownRight className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Outstanding Debt</p>
              <p className="text-2xl font-bold text-gray-900">
                €{(financialSummary.total_debt / 1000000).toFixed(1)}M
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Available Credit</p>
              <p className="text-2xl font-bold text-gray-900">
                €{(financialSummary.available_credit / 1000000).toFixed(1)}M
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <PieChart className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Credit Utilization</p>
              <p className="text-2xl font-bold text-gray-900">
                {financialSummary.total_credit_lines > 0
                  ? ((financialSummary.total_used_credit / financialSummary.total_credit_lines) * 100).toFixed(1)
                  : '0'}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Credit Overview</h3>
            <Banknote className="w-5 h-5 text-blue-600" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Credit Lines:</span>
              <span className="font-medium">€{(financialSummary.total_credit_lines / 1000000).toFixed(1)}M</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Used Amount:</span>
              <span className="font-medium text-blue-600">€{(financialSummary.total_used_credit / 1000000).toFixed(1)}M</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Repaid Amount:</span>
              <span className="font-medium text-green-600">€{(financialSummary.total_repaid_credit / 1000000).toFixed(1)}M</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Avg. Interest Rate:</span>
              <span className="font-medium">{financialSummary.weighted_avg_interest.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Banking Partners</h3>
            <CreditCard className="w-5 h-5 text-green-600" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Active Banks:</span>
              <span className="font-medium">{banks.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Active Credits:</span>
              <span className="font-medium">{bankCredits.filter(c => c.status === 'active').length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Companies:</span>
              <span className="font-medium">{companies.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Upcoming Maturities:</span>
              <span className={`font-medium ${financialSummary.upcoming_maturities > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {financialSummary.upcoming_maturities}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Critical Alerts</h3>
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <div className="space-y-3">
            {financialSummary.upcoming_maturities > 0 && (
              <div className="flex items-center p-2 bg-orange-50 border border-orange-200 rounded">
                <Clock className="w-4 h-4 text-orange-600 mr-2 flex-shrink-0" />
                <span className="text-sm text-orange-800">
                  {financialSummary.upcoming_maturities} credit(s) maturing soon
                </span>
              </div>
            )}

            {bankCredits.filter(c => c.usage_expiration_date && differenceInDays(new Date(c.usage_expiration_date), new Date()) <= 90 && differenceInDays(new Date(c.usage_expiration_date), new Date()) > 0).length > 0 && (
              <div className="flex items-center p-2 bg-yellow-50 border border-yellow-200 rounded">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2 flex-shrink-0" />
                <span className="text-sm text-yellow-800">
                  {bankCredits.filter(c => c.usage_expiration_date && differenceInDays(new Date(c.usage_expiration_date), new Date()) <= 90).length} usage period(s) expiring
                </span>
              </div>
            )}

            {financialSummary.upcoming_maturities === 0 &&
             bankCredits.filter(c => c.usage_expiration_date && differenceInDays(new Date(c.usage_expiration_date), new Date()) <= 90).length === 0 && (
              <div className="flex items-center p-2 bg-green-50 border border-green-200 rounded">
                <CheckCircle className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
                <span className="text-sm text-green-800">No critical issues</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Active Credits & Expiration Dates</h2>
            <button
              onClick={() => navigate('/accounting-credits')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View All Credits
            </button>
          </div>
        </div>
        <div className="p-6">
          {bankCredits.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Credits Found</h3>
              <p className="text-gray-600">No bank credits available.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bankCredits.map((credit) => {
                const utilizationPercent = credit.amount > 0 ? (Number(credit.used_amount || 0) / Number(credit.amount)) * 100 : 0
                const maturityDays = credit.maturity_date ? differenceInDays(new Date(credit.maturity_date), new Date()) : null
                const usageDays = credit.usage_expiration_date ? differenceInDays(new Date(credit.usage_expiration_date), new Date()) : null
                const maturityWarning = maturityDays !== null && maturityDays <= 90 && maturityDays > 0
                const usageWarning = usageDays !== null && usageDays <= 90 && usageDays > 0

                return (
                  <div key={credit.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {credit.credit_name || `${credit.company?.name || 'Credit'} - ${credit.credit_type.replace('_', ' ')}`}
                          </h3>
                          {credit.project && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                              {credit.project.name}
                            </span>
                          )}
                          {maturityWarning && (
                            <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full">
                              Maturing Soon
                            </span>
                          )}
                          {usageWarning && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                              Usage Expiring
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600">{credit.company?.name || 'Unknown Company'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">€{Number(credit.amount).toLocaleString('hr-HR')}</p>
                        <p className="text-sm text-gray-600">Credit Limit</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-xs text-blue-700">Used</p>
                        <p className="text-lg font-bold text-blue-900">€{Number(credit.used_amount || 0).toLocaleString('hr-HR')}</p>
                      </div>

                      <div className="bg-purple-50 p-3 rounded-lg">
                        <p className="text-xs text-purple-700">Repaid</p>
                        <p className="text-lg font-bold text-purple-900">€{Number(credit.repaid_amount || 0).toLocaleString('hr-HR')}</p>
                      </div>

                      <div className="bg-green-50 p-3 rounded-lg">
                        <p className="text-xs text-green-700">Available</p>
                        <p className="text-lg font-bold text-green-900">
                          €{(Number(credit.amount) - Number(credit.used_amount || 0)).toLocaleString('hr-HR')}
                        </p>
                      </div>

                      <div className="bg-red-50 p-3 rounded-lg">
                        <p className="text-xs text-red-700">Outstanding</p>
                        <p className="text-lg font-bold text-red-900">€{Number(credit.outstanding_balance || 0).toLocaleString('hr-HR')}</p>
                      </div>

                      <div className="bg-orange-50 p-3 rounded-lg">
                        <p className="text-xs text-orange-700">Interest Rate</p>
                        <p className="text-lg font-bold text-orange-900">{Number(credit.interest_rate || 0).toFixed(2)}%</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                      <div>
                        <span className="text-gray-600 flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>Start Date:</span>
                        </span>
                        <p className="font-medium text-gray-900">{format(new Date(credit.start_date), 'MMM dd, yyyy')}</p>
                      </div>
                      {credit.maturity_date && (
                        <div>
                          <span className="text-gray-600 flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>Maturity Date:</span>
                          </span>
                          <p className={`font-medium ${maturityWarning ? 'text-orange-600' : 'text-gray-900'}`}>
                            {format(new Date(credit.maturity_date), 'MMM dd, yyyy')}
                            {maturityDays !== null && maturityDays > 0 && (
                              <span className="text-xs ml-1">({maturityDays}d)</span>
                            )}
                          </p>
                        </div>
                      )}
                      {credit.usage_expiration_date && (
                        <div>
                          <span className="text-gray-600 flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>Usage Expires:</span>
                          </span>
                          <p className={`font-medium ${usageWarning ? 'text-yellow-600' : 'text-gray-900'}`}>
                            {format(new Date(credit.usage_expiration_date), 'MMM dd, yyyy')}
                            {usageDays !== null && usageDays > 0 && (
                              <span className="text-xs ml-1">({usageDays}d)</span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-600">Utilization</span>
                        <span className="font-semibold text-gray-900">{utilizationPercent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            utilizationPercent >= 90 ? 'bg-red-500' :
                            utilizationPercent >= 70 ? 'bg-orange-500' :
                            'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="p-6">
          {recentActivities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivities.map((activity) => {
                const isMaturity = activity.type === 'maturity'
                const isUsageExpiring = activity.type === 'usage_expiring'
                const bgColor = activity.type === 'credit' ? 'bg-blue-50 border-blue-200' :
                                activity.type === 'usage_expiring' ? 'bg-yellow-50 border-yellow-200' :
                                'bg-orange-50 border-orange-200'
                const iconBg = activity.type === 'credit' ? 'bg-blue-100' :
                               activity.type === 'usage_expiring' ? 'bg-yellow-100' :
                               'bg-orange-100'
                const iconColor = activity.type === 'credit' ? 'text-blue-600' :
                                  activity.type === 'usage_expiring' ? 'text-yellow-600' :
                                  'text-orange-600'
                const Icon = activity.type === 'credit' ? Banknote :
                            activity.type === 'usage_expiring' ? Clock :
                            Calendar

                return (
                  <div key={activity.id} className={`flex items-center space-x-4 p-4 border rounded-lg ${bgColor}`}>
                    <div className={`p-2 rounded-lg ${iconBg}`}>
                      <Icon className={`w-4 h-4 ${iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{activity.title}</p>
                      <p className="text-sm text-gray-600">{activity.description}</p>
                    </div>
                    <span className="text-sm text-gray-500">
                      {isMaturity || isUsageExpiring ? format(new Date(activity.date), 'MMM dd, yyyy') : format(new Date(activity.date), 'MMM dd')}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default InvestmentDashboard
