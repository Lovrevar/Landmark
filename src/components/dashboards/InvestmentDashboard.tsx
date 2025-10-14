import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, Project, Bank, Investor, ProjectInvestment, BankCredit } from '../../lib/supabase'
import { 
  Building2, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Banknote,
  PieChart,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Calendar
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'

interface ProjectWithInvestments extends Project {
  total_investment: number
  total_debt: number
  equity_percentage: number
  expected_roi: number
  investors: Investor[]
  bank_credits: BankCredit[]
  project_investments: ProjectInvestment[]
}

interface FinancialSummary {
  total_portfolio_value: number
  total_debt: number
  total_equity: number
  debt_to_equity_ratio: number
  weighted_avg_interest: number
  total_monthly_payments: number
  upcoming_maturities: number
}

const InvestmentDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectWithInvestments[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [investors, setInvestors] = useState<Investor[]>([])
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary>({
    total_portfolio_value: 0,
    total_debt: 0,
    total_equity: 0,
    debt_to_equity_ratio: 0,
    weighted_avg_interest: 0,
    total_monthly_payments: 0,
    upcoming_maturities: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch projects with investment data
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('start_date', { ascending: false })

      if (projectsError) throw projectsError

      // Fetch banks
      const { data: banksData, error: banksError } = await supabase
        .from('banks')
        .select('*')
        .order('name')

      if (banksError) throw banksError

      // Fetch investors
      const { data: investorsData, error: investorsError } = await supabase
        .from('investors')
        .select('*')
        .order('name')

      if (investorsError) throw investorsError

      // Fetch project investments
      const { data: projectInvestmentsData, error: investmentsError } = await supabase
        .from('project_investments')
        .select(`
          *,
          investors(*),
          banks(*)
        `)

      if (investmentsError) throw investmentsError

      // Fetch bank credits
      const { data: bankCreditsData, error: creditsError } = await supabase
        .from('bank_credits')
        .select(`
          *,
          banks(*),
          projects(*)
        `)

      if (creditsError) throw creditsError

      // Process projects with investment details
      const projectsWithInvestments = (projectsData || []).map(project => {
        const projectInvestments = (projectInvestmentsData || []).filter(inv => inv.project_id === project.id)
        const projectCredits = (bankCreditsData || []).filter(credit => credit.project_id === project.id)
        
        const total_investment = projectInvestments.reduce((sum, inv) => sum + inv.amount, 0)
        const total_debt = projectCredits.reduce((sum, credit) => sum + credit.outstanding_balance, 0)
        const equity_percentage = project.budget > 0 ? (total_investment / project.budget) * 100 : 0
        const expected_roi = projectInvestments.length > 0 
          ? projectInvestments.reduce((sum, inv) => sum + inv.expected_return, 0) / projectInvestments.length 
          : 0

        const uniqueInvestors = projectInvestments
          .filter(inv => inv.investors)
          .map(inv => inv.investors)
          .filter((investor, index, self) => 
            index === self.findIndex(i => i.id === investor.id)
          )

        return {
          ...project,
          total_investment,
          total_debt,
          equity_percentage,
          expected_roi,
          investors: uniqueInvestors,
          bank_credits: projectCredits,
          project_investments: projectInvestments
        }
      })

      // Calculate financial summary
      const total_portfolio_value = projectsWithInvestments.reduce((sum, p) => sum + p.budget, 0)
      const total_debt = (banksData || []).reduce((sum, bank) => sum + bank.outstanding_debt, 0)
      const total_equity = projectsWithInvestments.reduce((sum, p) => sum + p.total_investment, 0)
      const debt_to_equity_ratio = total_equity > 0 ? total_debt / total_equity : 0
      const total_monthly_payments = (bankCreditsData || []).reduce((sum, credit) => sum + credit.monthly_payment, 0)
      
      const weighted_avg_interest = (bankCreditsData || []).length > 0
        ? (bankCreditsData || []).reduce((sum, credit) => sum + credit.interest_rate, 0) / (bankCreditsData || []).length
        : 0

      const upcoming_maturities = (bankCreditsData || []).filter(credit => 
        credit.maturity_date && differenceInDays(new Date(credit.maturity_date), new Date()) <= 90
      ).length

      setProjects(projectsWithInvestments)
      setBanks(banksData || [])
      setInvestors(investorsData || [])
      setFinancialSummary({
        total_portfolio_value,
        total_debt,
        total_equity,
        debt_to_equity_ratio,
        weighted_avg_interest,
        total_monthly_payments,
        upcoming_maturities
      })
    } catch (error) {
      console.error('Error fetching investment data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getProjectRiskLevel = (project: ProjectWithInvestments) => {
    const debtRatio = project.budget > 0 ? (project.total_debt / project.budget) * 100 : 0
    const timeOverrun = project.end_date ? differenceInDays(new Date(), new Date(project.end_date)) : 0
    
    if (debtRatio > 70 || timeOverrun > 30) return { level: 'High', color: 'text-red-600', bg: 'bg-red-50' }
    if (debtRatio > 50 || timeOverrun > 0) return { level: 'Medium', color: 'text-orange-600', bg: 'bg-orange-50' }
    return { level: 'Low', color: 'text-green-600', bg: 'bg-green-50' }
  }

  if (loading) {
    return <div className="text-center py-12">Loading investment dashboard...</div>
  }

  return (
    <div className="space-y-6">
      {/* Financial Overview Cards */}
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
              <p className="text-sm text-gray-600">Total Debt</p>
              <p className="text-2xl font-bold text-gray-900">
                €{(financialSummary.total_debt / 1000000).toFixed(1)}M
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <ArrowUpRight className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Equity</p>
              <p className="text-2xl font-bold text-gray-900">
                €{(financialSummary.total_equity / 1000000).toFixed(1)}M
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
              <p className="text-sm text-gray-600">Debt/Equity Ratio</p>
              <p className="text-2xl font-bold text-gray-900">
                {financialSummary.debt_to_equity_ratio.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Financing Overview</h3>
            <Banknote className="w-5 h-5 text-blue-600" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Active Banks:</span>
              <span className="font-medium">{banks.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Avg. Interest Rate:</span>
              <span className="font-medium">{financialSummary.weighted_avg_interest.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Monthly Payments:</span>
              <span className="font-medium">€{financialSummary.total_monthly_payments.toLocaleString()}</span>
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
            <h3 className="text-lg font-semibold text-gray-900">Investment Partners</h3>
            <Users className="w-5 h-5 text-green-600" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Active Investors:</span>
              <span className="font-medium">{investors.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Invested:</span>
              <span className="font-medium">€{(financialSummary.total_equity / 1000000).toFixed(1)}M</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Avg. Expected Return:</span>
              <span className="font-medium">
                {investors.length > 0 
                  ? (investors.reduce((sum, inv) => sum + inv.expected_return, 0) / investors.length).toFixed(1)
                  : '0'
                }%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Portfolio Diversity:</span>
              <span className="font-medium">
                {new Set(investors.map(inv => inv.type)).size} types
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Risk Assessment</h3>
            <Target className="w-5 h-5 text-orange-600" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">High Risk Projects:</span>
              <span className="font-medium text-red-600">
                {projects.filter(p => getProjectRiskLevel(p).level === 'High').length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Leverage Ratio:</span>
              <span className={`font-medium ${
                financialSummary.debt_to_equity_ratio > 2 ? 'text-red-600' : 
                financialSummary.debt_to_equity_ratio > 1 ? 'text-orange-600' : 'text-green-600'
              }`}>
                {financialSummary.debt_to_equity_ratio.toFixed(2)}x
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Credit Utilization:</span>
              <span className="font-medium">
                {banks.length > 0 
                  ? ((banks.reduce((sum, bank) => sum + bank.outstanding_debt, 0) / 
                     banks.reduce((sum, bank) => sum + bank.total_credit_limit, 0)) * 100).toFixed(1)
                  : '0'
                }%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Available Credit:</span>
              <span className="font-medium text-green-600">
                €{(banks.reduce((sum, bank) => sum + bank.available_funds, 0) / 1000000).toFixed(1)}M
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Investment Overview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Project Investment Portfolio</h2>
            <button
              onClick={() => navigate('/investment-projects')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              View All Projects
            </button>
          </div>
        </div>
        <div className="p-6">
          {projects.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Projects Found</h3>
              <p className="text-gray-600">No investment projects available.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.slice(0, 5).map((project) => {
                const riskLevel = getProjectRiskLevel(project)
                const fundingRatio = project.budget > 0 ? ((project.total_investment + project.total_debt) / project.budget) * 100 : 0
                
                return (
                  <div key={project.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-all duration-200">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                            project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {project.status}
                          </span>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${riskLevel.bg} ${riskLevel.color}`}>
                            {riskLevel.level} Risk
                          </span>
                        </div>
                        <p className="text-gray-600 mb-2">{project.location}</p>
                        <p className="text-sm text-gray-500">Investor: {project.investor || 'Multiple'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">€{project.budget.toLocaleString()}</p>
                        <p className="text-sm text-gray-600">Total Budget</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-xs text-blue-700">Equity Investment</p>
                        <p className="text-lg font-bold text-blue-900">€{project.total_investment.toLocaleString()}</p>
                        <p className="text-xs text-blue-600">{project.equity_percentage.toFixed(1)}% of budget</p>
                      </div>
                      
                      <div className="bg-red-50 p-3 rounded-lg">
                        <p className="text-xs text-red-700">Debt Financing</p>
                        <p className="text-lg font-bold text-red-900">€{project.total_debt.toLocaleString()}</p>
                        <p className="text-xs text-red-600">{project.budget > 0 ? ((project.total_debt / project.budget) * 100).toFixed(1) : '0'}% of budget</p>
                      </div>
                      
                      <div className="bg-green-50 p-3 rounded-lg">
                        <p className="text-xs text-green-700">Expected ROI</p>
                        <p className="text-lg font-bold text-green-900">{project.expected_roi.toFixed(1)}%</p>
                        <p className="text-xs text-green-600">Weighted average</p>
                      </div>
                      
                      <div className="bg-purple-50 p-3 rounded-lg">
                        <p className="text-xs text-purple-700">Funding Status</p>
                        <p className="text-lg font-bold text-purple-900">{fundingRatio.toFixed(1)}%</p>
                        <p className="text-xs text-purple-600">
                          {fundingRatio >= 100 ? 'Fully funded' : 'Needs funding'}
                        </p>
                      </div>
                    </div>

                    {/* Funding Progress Bar */}
                    <div className="mt-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-600">Funding Progress</span>
                        <span className="text-sm font-medium">{fundingRatio.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            fundingRatio >= 100 ? 'bg-green-600' : 
                            fundingRatio >= 80 ? 'bg-blue-600' : 'bg-orange-600'
                          }`}
                          style={{ width: `${Math.min(100, fundingRatio)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Banking Relationships</h3>
            <Banknote className="w-5 h-5 text-blue-600" />
          </div>
          <div className="space-y-3 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Active Banks:</span>
              <span className="font-medium">{banks.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Credit Lines:</span>
              <span className="font-medium">
                €{(banks.reduce((sum, bank) => sum + bank.total_credit_limit, 0) / 1000000).toFixed(1)}M
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Available Credit:</span>
              <span className="font-medium text-green-600">
                €{(banks.reduce((sum, bank) => sum + bank.available_funds, 0) / 1000000).toFixed(1)}M
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate('/banks')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Manage Banks
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Investment Partners</h3>
            <Users className="w-5 h-5 text-green-600" />
          </div>
          <div className="space-y-3 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Active Investors:</span>
              <span className="font-medium">{investors.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Committed:</span>
              <span className="font-medium">
                €{(investors.reduce((sum, inv) => sum + inv.total_invested, 0) / 1000000).toFixed(1)}M
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Institutional:</span>
              <span className="font-medium">
                {investors.filter(inv => inv.type === 'institutional').length}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate('/investors')}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
          >
            Manage Investors
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Critical Alerts</h3>
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <div className="space-y-3">
            {financialSummary.upcoming_maturities > 0 && (
              <div className="flex items-center p-2 bg-orange-50 border border-orange-200 rounded">
                <Clock className="w-4 h-4 text-orange-600 mr-2" />
                <span className="text-sm text-orange-800">
                  {financialSummary.upcoming_maturities} credit(s) maturing soon
                </span>
              </div>
            )}
            
            {financialSummary.debt_to_equity_ratio > 2 && (
              <div className="flex items-center p-2 bg-red-50 border border-red-200 rounded">
                <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
                <span className="text-sm text-red-800">High leverage ratio</span>
              </div>
            )}
            
            {projects.filter(p => getProjectRiskLevel(p).level === 'High').length > 0 && (
              <div className="flex items-center p-2 bg-red-50 border border-red-200 rounded">
                <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
                <span className="text-sm text-red-800">
                  {projects.filter(p => getProjectRiskLevel(p).level === 'High').length} high-risk project(s)
                </span>
              </div>
            )}

            {financialSummary.upcoming_maturities === 0 && 
             financialSummary.debt_to_equity_ratio <= 2 && 
             projects.filter(p => getProjectRiskLevel(p).level === 'High').length === 0 && (
              <div className="flex items-center p-2 bg-green-50 border border-green-200 rounded">
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                <span className="text-sm text-green-800">No critical issues</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Recent Investment Activity</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {/* Sample recent activities - in real app this would come from an activity log */}
            <div className="flex items-center space-x-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="p-2 bg-green-100 rounded-lg">
                <ArrowUpRight className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">New equity investment secured</p>
                <p className="text-sm text-gray-600">Pacific Real Estate Group invested €2.5M in Sunset Towers</p>
              </div>
              <span className="text-sm text-gray-500">{format(new Date(), 'MMM dd')}</span>
            </div>
            
            <div className="flex items-center space-x-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Banknote className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Credit facility approved</p>
                <p className="text-sm text-gray-600">First National Bank approved €1.2M construction loan</p>
              </div>
              <span className="text-sm text-gray-500">{format(new Date(), 'MMM dd')}</span>
            </div>
            
            <div className="flex items-center space-x-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calendar className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Upcoming loan maturity</p>
                <p className="text-sm text-gray-600">Metro Commercial Bank loan matures in 45 days</p>
              </div>
              <span className="text-sm text-gray-500">Due Soon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InvestmentDashboard