import React, { useState, useEffect } from 'react'
import { supabase, Project, ProjectInvestment, Investor, Bank, BankCredit } from '../../lib/supabase'
import { 
  Building2, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Calendar,
  PieChart,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Eye,
  X,
  Banknote,
  UserCheck
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'

interface ProjectWithFinancials extends Project {
  total_investment: number
  total_debt: number
  equity_investments: ProjectInvestment[]
  debt_financing: BankCredit[]
  investors: Investor[]
  banks: Bank[]
  funding_ratio: number
  debt_to_equity: number
  expected_roi: number
  risk_level: 'Low' | 'Medium' | 'High'
}

const InvestmentProjects: React.FC = () => {
  const [projects, setProjects] = useState<ProjectWithFinancials[]>([])
  const [selectedProject, setSelectedProject] = useState<ProjectWithFinancials | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'funding'>('overview')
  const [fundingUtilization, setFundingUtilization] = useState<any[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('start_date', { ascending: false })

      if (projectsError) throw projectsError

      // Fetch project investments with investor details
      const { data: investmentsData, error: investmentsError } = await supabase
        .from('project_investments')
        .select(`
          *,
          investors(*),
          banks(*)
        `)

      if (investmentsError) throw investmentsError

      // Fetch bank credits with bank details
      const { data: creditsData, error: creditsError } = await supabase
        .from('bank_credits')
        .select(`
          *,
          banks(*)
        `)

      if (creditsError) throw creditsError

      // Process projects with financial data
      const projectsWithFinancials = (projectsData || []).map(project => {
        const projectInvestments = (investmentsData || []).filter(inv => inv.project_id === project.id)
        const projectCredits = (creditsData || []).filter(credit => credit.project_id === project.id)

        const total_investment = projectInvestments.reduce((sum, inv) => sum + inv.amount, 0)
        const total_debt = projectCredits.reduce((sum, credit) => sum + credit.amount, 0)
        const funding_ratio = project.budget > 0 ? ((total_investment + total_debt) / project.budget) * 100 : 0
        const debt_to_equity = total_investment > 0 ? total_debt / total_investment : 0
        const expected_roi = projectInvestments.length > 0 
          ? projectInvestments.reduce((sum, inv) => sum + inv.expected_return, 0) / projectInvestments.length 
          : 0

        // Get unique investors and banks
        const uniqueInvestors = projectInvestments
          .filter(inv => inv.investors)
          .map(inv => inv.investors)
          .filter((investor, index, self) => 
            index === self.findIndex(i => i.id === investor.id)
          )

        const uniqueBanks = projectCredits
          .filter(credit => credit.banks)
          .map(credit => credit.banks)
          .filter((bank, index, self) => 
            index === self.findIndex(b => b.id === bank.id)
          )

        // Calculate risk level
        const debtRatio = project.budget > 0 ? (total_debt / project.budget) * 100 : 0
        const timeOverrun = project.end_date ? differenceInDays(new Date(), new Date(project.end_date)) : 0
        
        let risk_level: 'Low' | 'Medium' | 'High' = 'Low'
        if (debtRatio > 70 || timeOverrun > 30 || funding_ratio < 80) risk_level = 'High'
        else if (debtRatio > 50 || timeOverrun > 0 || funding_ratio < 90) risk_level = 'Medium'

        return {
          ...project,
          total_investment,
          total_debt,
          equity_investments: projectInvestments,
          debt_financing: projectCredits,
          investors: uniqueInvestors,
          banks: uniqueBanks,
          funding_ratio,
          debt_to_equity,
          expected_roi,
          risk_level
        }
      })

      setProjects(projectsWithFinancials)
    } catch (error) {
      console.error('Error fetching investment projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'High': return 'bg-red-100 text-red-800'
      case 'Medium': return 'bg-orange-100 text-orange-800'
      case 'Low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getFundingColor = (ratio: number) => {
    if (ratio >= 100) return 'text-green-600'
    if (ratio >= 80) return 'text-blue-600'
    return 'text-orange-600'
  }

  const fetchFundingUtilization = async (projectId: string) => {
    try {
      const { data: investmentsData, error: investmentsError } = await supabase
        .from('project_investments')
        .select('*, investors(*)')
        .eq('project_id', projectId)

      if (investmentsError) throw investmentsError

      const { data: creditsData, error: creditsError } = await supabase
        .from('bank_credits')
        .select('*, banks(*)')
        .eq('project_id', projectId)

      if (creditsError) throw creditsError

      const { data: wirePaymentsData, error: paymentsError } = await supabase
        .from('wire_payments')
        .select('*')

      if (paymentsError) throw paymentsError

      const utilization: any[] = []

      investmentsData?.forEach(investment => {
        if (!investment.investor_id) return

        const spent = (wirePaymentsData || [])
          .filter(p => p.paid_by_investor_id === investment.investor_id)
          .reduce((sum, p) => sum + Number(p.amount), 0)

        utilization.push({
          id: investment.investor_id,
          type: 'investor',
          name: investment.investors?.name || 'Unknown',
          totalAmount: investment.amount,
          spentAmount: spent,
          availableAmount: investment.amount - spent,
          usageExpirationDate: investment.usage_expiration_date,
          investmentDate: investment.investment_date
        })
      })

      creditsData?.forEach(credit => {
        if (!credit.bank_id) return

        const spent = (wirePaymentsData || [])
          .filter(p => p.paid_by_bank_id === credit.bank_id)
          .reduce((sum, p) => sum + Number(p.amount), 0)

        utilization.push({
          id: credit.bank_id,
          type: 'bank',
          name: credit.banks?.name || 'Unknown',
          totalAmount: credit.amount,
          spentAmount: spent,
          availableAmount: credit.amount - spent,
          usageExpirationDate: credit.usage_expiration_date,
          investmentDate: credit.start_date
        })
      })

      setFundingUtilization(utilization)
    } catch (error) {
      console.error('Error fetching funding utilization:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading investment projects...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Investment Projects</h1>
        <p className="text-gray-600 mt-2">Monitor project financing, investments, and financial performance</p>
      </div>

      {/* Projects Grid */}
      <div className="space-y-6">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200"
          >
            {/* Project Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-xl font-semibold text-gray-900">{project.name}</h3>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                    project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {project.status}
                  </span>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRiskColor(project.risk_level)}`}>
                    {project.risk_level} Risk
                  </span>
                </div>
                <p className="text-gray-600 mb-1">{project.location}</p>
                <p className="text-sm text-gray-500">
                  {format(new Date(project.start_date), 'MMM dd, yyyy')} - 
                  {project.end_date ? format(new Date(project.end_date), 'MMM dd, yyyy') : 'TBD'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">€{project.budget.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Total Budget</p>
                <button
                  onClick={() => setSelectedProject(project)}
                  className="mt-2 px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md text-sm font-medium transition-colors duration-200"
                >
                  <Eye className="w-4 h-4 mr-1 inline" />
                  View Details
                </button>
              </div>
            </div>

            {/* Financial Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-green-700">Equity Investment</span>
                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-lg font-bold text-green-900">€{project.total_investment.toLocaleString()}</p>
                <p className="text-xs text-green-600">
                  {project.budget > 0 ? ((project.total_investment / project.budget) * 100).toFixed(1) : '0'}% of budget
                </p>
              </div>

              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-red-700">Debt Financing</span>
                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-lg font-bold text-red-900">€{project.total_debt.toLocaleString()}</p>
                <p className="text-xs text-red-600">
                  {project.budget > 0 ? ((project.total_debt / project.budget) * 100).toFixed(1) : '0'}% of budget
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-blue-700">Expected ROI</span>
                  <Target className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-lg font-bold text-blue-900">{project.expected_roi.toFixed(1)}%</p>
                <p className="text-xs text-blue-600">Weighted average</p>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-purple-700">Funding Status</span>
                  <PieChart className="w-4 h-4 text-purple-600" />
                </div>
                <p className={`text-lg font-bold ${getFundingColor(project.funding_ratio)}`}>
                  {project.funding_ratio.toFixed(1)}%
                </p>
                <p className="text-xs text-purple-600">
                  {project.funding_ratio >= 100 ? 'Fully funded' : 'Needs funding'}
                </p>
              </div>
            </div>

            {/* Funding Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Total Funding Progress</span>
                <span className="text-sm font-medium">{project.funding_ratio.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all duration-300 ${
                    project.funding_ratio >= 100 ? 'bg-green-600' : 
                    project.funding_ratio >= 80 ? 'bg-blue-600' : 'bg-orange-600'
                  }`}
                  style={{ width: `${Math.min(100, project.funding_ratio)}%` }}
                ></div>
              </div>
            </div>

            {/* Investors and Banks Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Investment Partners</span>
                  <Users className="w-4 h-4 text-gray-400" />
                </div>
                <div className="space-y-1">
                  {project.investors.length === 0 ? (
                    <p className="text-xs text-gray-500">No equity investors</p>
                  ) : (
                    project.investors.slice(0, 3).map((investor, index) => (
                      <p key={investor.id} className="text-xs text-gray-700">
                        • {investor.name} ({investor.type})
                      </p>
                    ))
                  )}
                  {project.investors.length > 3 && (
                    <p className="text-xs text-gray-500">+{project.investors.length - 3} more</p>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Banking Partners</span>
                  <Building2 className="w-4 h-4 text-gray-400" />
                </div>
                <div className="space-y-1">
                  {project.banks.length === 0 ? (
                    <p className="text-xs text-gray-500">No debt financing</p>
                  ) : (
                    project.banks.slice(0, 3).map((bank, index) => (
                      <p key={bank.id} className="text-xs text-gray-700">
                        • {bank.name}
                      </p>
                    ))
                  )}
                  {project.banks.length > 3 && (
                    <p className="text-xs text-gray-500">+{project.banks.length - 3} more</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Project Details Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">{selectedProject.name}</h3>
                  <p className="text-gray-600 mt-1">{selectedProject.location}</p>
                  <div className="flex items-center space-x-3 mt-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedProject.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      selectedProject.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedProject.status}
                    </span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRiskColor(selectedProject.risk_level)}`}>
                      {selectedProject.risk_level} Risk
                    </span>
                    <span className="text-sm text-gray-500">
                      Budget: €{selectedProject.budget.toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <div className="flex space-x-8 px-6">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === 'overview'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={async () => {
                    setActiveTab('funding')
                    await fetchFundingUtilization(selectedProject.project.id)
                  }}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === 'funding'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Funding Utilization
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {activeTab === 'overview' && (
                <>
              {/* Financial Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-blue-700">Total Budget</span>
                    <DollarSign className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-xl font-bold text-blue-900">€{selectedProject.budget.toLocaleString()}</p>
                  <p className="text-xs text-blue-600">Project value</p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-green-700">Equity Investment</span>
                    <ArrowUpRight className="w-4 h-4 text-green-600" />
                  </div>
                  <p className="text-xl font-bold text-green-900">€{selectedProject.total_investment.toLocaleString()}</p>
                  <p className="text-xs text-green-600">
                    {selectedProject.budget > 0 ? ((selectedProject.total_investment / selectedProject.budget) * 100).toFixed(1) : '0'}% of budget
                  </p>
                </div>

                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-red-700">Debt Financing</span>
                    <ArrowDownRight className="w-4 h-4 text-red-600" />
                  </div>
                  <p className="text-xl font-bold text-red-900">€{selectedProject.total_debt.toLocaleString()}</p>
                  <p className="text-xs text-red-600">
                    {selectedProject.budget > 0 ? ((selectedProject.total_debt / selectedProject.budget) * 100).toFixed(1) : '0'}% of budget
                  </p>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-purple-700">Expected ROI</span>
                    <Target className="w-4 h-4 text-purple-600" />
                  </div>
                  <p className="text-xl font-bold text-purple-900">{selectedProject.expected_roi.toFixed(1)}%</p>
                  <p className="text-xs text-purple-600">Weighted average</p>
                </div>
              </div>

              {/* Funding Breakdown */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-4">Funding Breakdown</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Equity Investments */}
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h5 className="font-medium text-green-900 mb-3 flex items-center">
                      <UserCheck className="w-4 h-4 mr-2" />
                      Equity Investments
                    </h5>
                    {selectedProject.equity_investments.length === 0 ? (
                      <p className="text-sm text-green-700">No equity investments</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedProject.equity_investments.map((investment) => (
                          <div key={investment.id} className="bg-white p-3 rounded border border-green-200">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {investment.investors?.name || 'Unknown Investor'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {investment.investors?.type} • {investment.percentage_stake}% stake
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-green-600">€{investment.amount.toLocaleString()}</p>
                                <p className="text-xs text-green-600">{investment.expected_return}Expected Return</p>
                              </div>
                            </div>
                            <p className="text-xs text-gray-600">
                              Invested: {format(new Date(investment.investment_date), 'MMM dd, yyyy')}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Debt Financing */}
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h5 className="font-medium text-red-900 mb-3 flex items-center">
                      <Banknote className="w-4 h-4 mr-2" />
                      Debt Financing
                    </h5>
                    {selectedProject.debt_financing.length === 0 ? (
                      <p className="text-sm text-red-700">No debt financing</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedProject.debt_financing.map((credit) => (
                          <div key={credit.id} className="bg-white p-3 rounded border border-red-200">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {credit.banks?.name || 'Unknown Bank'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {credit.credit_type.replace('_', ' ')} • {credit.interest_rate}% APR
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-red-600">€{credit.amount.toLocaleString()}</p>
                                <p className="text-xs text-gray-500">Credit Amount</p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-xs text-gray-600">Outstanding Balance:</p>
                              <p className="text-xs font-medium text-red-600">€{credit.outstanding_balance.toLocaleString()}</p>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                              <p className="text-xs text-gray-600">{credit.repayment_type === 'yearly' ? 'Annual' : 'Monthly'} Payment:</p>
                              <p className="text-xs font-medium text-gray-900">€{credit.monthly_payment.toLocaleString()}</p>
                            </div>
                            <p className="text-xs text-gray-600">
                              {credit.maturity_date
                                ? `Matures: ${format(new Date(credit.maturity_date), 'MMM dd, yyyy')}`
                                : 'No maturity date'
                              }
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white border border-gray-200 p-4 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-3">Leverage Analysis</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Debt-to-Equity:</span>
                      <span className={`font-medium ${
                        selectedProject.debt_to_equity > 2 ? 'text-red-600' :
                        selectedProject.debt_to_equity > 1 ? 'text-orange-600' :
                        'text-green-600'
                      }`}>
                        {selectedProject.debt_to_equity.toFixed(2)}x
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Equity Ratio:</span>
                      <span className="font-medium text-gray-900">
                        {selectedProject.budget > 0 ? ((selectedProject.total_investment / selectedProject.budget) * 100).toFixed(1) : '0'}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Debt Ratio:</span>
                      <span className="font-medium text-gray-900">
                        {selectedProject.budget > 0 ? ((selectedProject.total_debt / selectedProject.budget) * 100).toFixed(1) : '0'}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 p-4 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-3">Return Analysis</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Expected ROI:</span>
                      <span className="font-medium text-green-600">{selectedProject.expected_roi.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Investment Period:</span>
                      <span className="font-medium text-gray-900">
                        {selectedProject.end_date 
                          ? `${differenceInDays(new Date(selectedProject.end_date), new Date(selectedProject.start_date)) / 365 | 0} years`
                          : 'TBD'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Risk Level:</span>
                      <span className={`font-medium ${
                        selectedProject.risk_level === 'High' ? 'text-red-600' :
                        selectedProject.risk_level === 'Medium' ? 'text-orange-600' :
                        'text-green-600'
                      }`}>
                        {selectedProject.risk_level}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 p-4 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-3">Timeline</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Start Date:</span>
                      <span className="font-medium text-gray-900">
                        {format(new Date(selectedProject.start_date), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Target End:</span>
                      <span className="font-medium text-gray-900">
                        {selectedProject.end_date ? format(new Date(selectedProject.end_date), 'MMM dd, yyyy') : 'TBD'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Days Remaining:</span>
                      <span className={`font-medium ${
                        selectedProject.end_date && differenceInDays(new Date(selectedProject.end_date), new Date()) < 0 
                          ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {selectedProject.end_date 
                          ? differenceInDays(new Date(selectedProject.end_date), new Date())
                          : 'N/A'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk Factors */}
              {selectedProject.risk_level !== 'Low' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h5 className="font-medium text-orange-900 mb-3 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Risk Factors
                  </h5>
                  <div className="space-y-2">
                    {selectedProject.debt_to_equity > 2 && (
                      <div className="flex items-center text-orange-800">
                        <span className="w-2 h-2 bg-orange-600 rounded-full mr-2"></span>
                        High leverage ratio ({selectedProject.debt_to_equity.toFixed(2)}x)
                      </div>
                    )}
                    {selectedProject.funding_ratio < 90 && (
                      <div className="flex items-center text-orange-800">
                        <span className="w-2 h-2 bg-orange-600 rounded-full mr-2"></span>
                        Underfunded project ({selectedProject.funding_ratio.toFixed(1)}%)
                      </div>
                    )}
                    {selectedProject.end_date && differenceInDays(new Date(selectedProject.end_date), new Date()) < 0 && (
                      <div className="flex items-center text-orange-800">
                        <span className="w-2 h-2 bg-orange-600 rounded-full mr-2"></span>
                        Project timeline overrun
                      </div>
                    )}
                  </div>
                </div>
              )}
                </>
              )}

              {/* Funding Utilization Tab */}
              {activeTab === 'funding' && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">Funding Sources Utilization</h4>

                  {fundingUtilization.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No funding sources for this project</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {fundingUtilization.map((source) => {
                        const utilizationRate = source.totalAmount > 0 ? (source.spentAmount / source.totalAmount) * 100 : 0
                        const isExpiringSoon = source.usageExpirationDate && differenceInDays(new Date(source.usageExpirationDate), new Date()) <= 30

                        return (
                          <div key={`${source.type}-${source.id}`} className="bg-white border border-gray-200 rounded-lg p-5">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  {source.type === 'investor' ? (
                                    <UserCheck className="w-5 h-5 text-blue-600" />
                                  ) : (
                                    <Banknote className="w-5 h-5 text-green-600" />
                                  )}
                                  <h5 className="text-lg font-semibold text-gray-900">{source.name}</h5>
                                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    source.type === 'investor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                  }`}>
                                    {source.type.toUpperCase()}
                                  </span>
                                  {isExpiringSoon && (
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 flex items-center">
                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                      EXPIRING SOON
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600">
                                  Received: {format(new Date(source.investmentDate), 'MMM dd, yyyy')}
                                  {source.usageExpirationDate && (
                                    <> • Expires: <span className={isExpiringSoon ? 'text-orange-600 font-medium' : ''}>
                                      {format(new Date(source.usageExpirationDate), 'MMM dd, yyyy')}
                                    </span></>
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4 mb-4">
                              <div className="bg-blue-50 p-3 rounded-lg">
                                <p className="text-xs text-blue-700 mb-1">Total Committed</p>
                                <p className="text-lg font-bold text-blue-900">€{source.totalAmount.toLocaleString()}</p>
                              </div>
                              <div className="bg-red-50 p-3 rounded-lg">
                                <p className="text-xs text-red-700 mb-1">Spent</p>
                                <p className="text-lg font-bold text-red-900">€{source.spentAmount.toLocaleString()}</p>
                              </div>
                              <div className="bg-green-50 p-3 rounded-lg">
                                <p className="text-xs text-green-700 mb-1">Available</p>
                                <p className="text-lg font-bold text-green-900">€{source.availableAmount.toLocaleString()}</p>
                              </div>
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-700 mb-1">Utilization</p>
                                <p className={`text-lg font-bold ${
                                  utilizationRate >= 80 ? 'text-orange-600' :
                                  utilizationRate >= 50 ? 'text-blue-600' :
                                  'text-green-600'
                                }`}>
                                  {utilizationRate.toFixed(1)}%
                                </p>
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-3">
                              <div className="flex justify-between mb-1">
                                <span className="text-xs text-gray-600">Funding Utilization</span>
                                <span className="text-xs font-medium text-gray-900">
                                  €{source.spentAmount.toLocaleString()} / €{source.totalAmount.toLocaleString()}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                  className={`h-3 rounded-full transition-all duration-300 ${
                                    utilizationRate >= 90 ? 'bg-red-600' :
                                    utilizationRate >= 80 ? 'bg-orange-600' :
                                    utilizationRate >= 50 ? 'bg-blue-600' :
                                    'bg-green-600'
                                  }`}
                                  style={{ width: `${Math.min(100, utilizationRate)}%` }}
                                ></div>
                              </div>
                            </div>

                            {/* Warnings */}
                            {(utilizationRate >= 80 || isExpiringSoon || source.availableAmount <= 0) && (
                              <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                <div className="flex items-center mb-2">
                                  <AlertTriangle className="w-4 h-4 text-orange-600 mr-2" />
                                  <span className="text-sm font-medium text-orange-900">Warnings</span>
                                </div>
                                <div className="space-y-1">
                                  {source.availableAmount <= 0 && (
                                    <p className="text-sm text-orange-800">• Funds fully depleted</p>
                                  )}
                                  {utilizationRate >= 80 && source.availableAmount > 0 && (
                                    <p className="text-sm text-orange-800">• High utilization rate ({utilizationRate.toFixed(0)}%)</p>
                                  )}
                                  {isExpiringSoon && (
                                    <p className="text-sm text-orange-800">
                                      • Usage period expires in {differenceInDays(new Date(source.usageExpirationDate!), new Date())} days
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Summary Stats */}
                  {fundingUtilization.length > 0 && (
                    <div className="mt-6 grid grid-cols-3 gap-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-700 mb-1">Total Committed</p>
                        <p className="text-2xl font-bold text-blue-900">
                          €{fundingUtilization.reduce((sum, s) => sum + s.totalAmount, 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm text-red-700 mb-1">Total Spent</p>
                        <p className="text-2xl font-bold text-red-900">
                          €{fundingUtilization.reduce((sum, s) => sum + s.spentAmount, 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm text-green-700 mb-1">Total Available</p>
                        <p className="text-2xl font-bold text-green-900">
                          €{fundingUtilization.reduce((sum, s) => sum + s.availableAmount, 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InvestmentProjects