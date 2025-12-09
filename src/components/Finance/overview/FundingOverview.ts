import React, { useState, useEffect } from 'react'
import { supabase, Project, ProjectInvestment, Investor, BankCredit, Bank, WirePayment } from '../../../lib/supabase'
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Users,
  Building2,
  ChevronDown,
  ChevronUp,
  Eye,
  X,
  Clock,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import { format, differenceInDays, isPast, isWithinInterval, addDays } from 'date-fns'

interface FundingSource {
  id: string
  type: 'investor' | 'bank'
  name: string
  totalAmount: number
  spentAmount: number
  availableAmount: number
  usageExpirationDate: string | null
  gracePeriod: number
  investmentDate: string
  maturityDate: string | null
  expectedReturn?: number
  interestRate?: number
  status: 'active' | 'expired' | 'expiring_soon' | 'depleted'
  project_id: string
  project_investment_id?: string
  bank_credit_id?: string
}

interface FundingTransaction {
  id: string
  date: string
  amount: number
  subcontractor: string
  contract: string
  notes: string | null
  milestone: string | null
}

interface ProjectFundingSummary {
  project: Project
  totalCommitted: number
  totalSpent: number
  totalAvailable: number
  fundingSources: FundingSource[]
  utilizationRate: number
  warnings: string[]
}

const FundingOverview: React.FC = () => {
  const [projects, setProjects] = useState<ProjectFundingSummary[]>([])
  const [selectedProject, setSelectedProject] = useState<ProjectFundingSummary | null>(null)
  const [selectedSource, setSelectedSource] = useState<FundingSource | null>(null)
  const [transactions, setTransactions] = useState<FundingTransaction[]>([])
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'notifications'>('overview')

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showSubcontractorPaymentModal, setShowSubcontractorPaymentModal] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<PaymentNotification | null>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentNotes, setPaymentNotes] = useState('')

  useEffect(() => {
    fetchFundingData()
  }, [])

  const fetchFundingData = async () => {
    setLoading(true)
    try {
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('start_date', { ascending: false })

      if (projectsError) throw projectsError

      const { data: investmentsData, error: investmentsError } = await supabase
        .from('project_investments')
        .select('*, investors(*)')

      if (investmentsError) throw investmentsError

      const { data: creditsData, error: creditsError } = await supabase
        .from('bank_credits')
        .select('*, banks(*)')

      if (creditsError) throw creditsError

      const { data: wirePaymentsData, error: paymentsError } = await supabase
        .from('subcontractor_payments')
        .select('*')

      if (paymentsError) throw paymentsError

      const projectsSummary = (projectsData || []).map(project => {
        const projectInvestments = (investmentsData || []).filter(inv => inv.project_id === project.id)
        const projectCredits = (creditsData || []).filter(credit => credit.project_id === project.id)
        const projectPayments = (wirePaymentsData || [])

        const fundingSources: FundingSource[] = []
        const warnings: string[] = []

        projectInvestments.forEach(investment => {
          if (!investment.investor_id) return

          const spentAmount = projectPayments
            .filter(p => p.paid_by_investor_id === investment.investor_id)
            .reduce((sum, p) => sum + Number(p.amount), 0)

          const availableAmount = investment.amount - spentAmount
          const utilizationRate = investment.amount > 0 ? (spentAmount / investment.amount) * 100 : 0

          let status: 'active' | 'expired' | 'expiring_soon' | 'depleted' = 'active'

          if (availableAmount <= 0) {
            status = 'depleted'
            warnings.push(`${investment.investors?.name}: Funds fully depleted`)
          } else if (investment.usage_expiration_date && isPast(new Date(investment.usage_expiration_date))) {
            status = 'expired'
            warnings.push(`${investment.investors?.name}: Usage period expired`)
          } else if (investment.usage_expiration_date) {
            const daysUntilExpiry = differenceInDays(new Date(investment.usage_expiration_date), new Date())
            if (daysUntilExpiry <= 30) {
              status = 'expiring_soon'
              warnings.push(`${investment.investors?.name}: Expires in ${daysUntilExpiry} days`)
            }
          }

          if (utilizationRate >= 80 && status === 'active') {
            warnings.push(`${investment.investors?.name}: ${utilizationRate.toFixed(0)}% utilized`)
          }

          fundingSources.push({
            id: investment.investor_id,
            type: 'investor',
            name: investment.investors?.name || 'Unknown Investor',
            totalAmount: investment.amount,
            spentAmount,
            availableAmount,
            usageExpirationDate: investment.usage_expiration_date,
            gracePeriod: investment.grace_period || 0,
            investmentDate: investment.investment_date,
            maturityDate: investment.maturity_date,
            expectedReturn: investment.expected_return,
            status,
            project_id: project.id,
            project_investment_id: investment.id
          })
        })

        projectCredits.forEach(credit => {
          if (!credit.bank_id) return

          const spentAmount = projectPayments
            .filter(p => p.paid_by_bank_id === credit.bank_id)
            .reduce((sum, p) => sum + Number(p.amount), 0)

          const availableAmount = credit.amount - spentAmount
          const utilizationRate = credit.amount > 0 ? (spentAmount / credit.amount) * 100 : 0

          let status: 'active' | 'expired' | 'expiring_soon' | 'depleted' = 'active'

          if (availableAmount <= 0) {
            status = 'depleted'
            warnings.push(`${credit.banks?.name}: Credit fully utilized`)
          } else if (credit.usage_expiration_date && isPast(new Date(credit.usage_expiration_date))) {
            status = 'expired'
            warnings.push(`${credit.banks?.name}: Usage period expired`)
          } else if (credit.usage_expiration_date) {
            const daysUntilExpiry = differenceInDays(new Date(credit.usage_expiration_date), new Date())
            if (daysUntilExpiry <= 30) {
              status = 'expiring_soon'
              warnings.push(`${credit.banks?.name}: Expires in ${daysUntilExpiry} days`)
            }
          }

          if (utilizationRate >= 80 && status === 'active') {
            warnings.push(`${credit.banks?.name}: ${utilizationRate.toFixed(0)}% utilized`)
          }

          fundingSources.push({
            id: credit.bank_id,
            type: 'bank',
            name: credit.banks?.name || 'Unknown Bank',
            totalAmount: credit.amount,
            spentAmount,
            availableAmount,
            usageExpirationDate: credit.usage_expiration_date,
            gracePeriod: credit.grace_period || 0,
            investmentDate: credit.start_date,
            maturityDate: credit.maturity_date,
            interestRate: credit.interest_rate,
            status,
            project_id: project.id,
            bank_credit_id: credit.id
          })
        })

        const totalCommitted = fundingSources.reduce((sum, source) => sum + source.totalAmount, 0)
        const totalSpent = fundingSources.reduce((sum, source) => sum + source.spentAmount, 0)
        const totalAvailable = fundingSources.reduce((sum, source) => sum + source.availableAmount, 0)
        const utilizationRate = totalCommitted > 0 ? (totalSpent / totalCommitted) * 100 : 0

        return {
          project,
          totalCommitted,
          totalSpent,
          totalAvailable,
          fundingSources,
          utilizationRate,
          warnings
        }
      }).filter(p => p.fundingSources.length > 0)

      setProjects(projectsSummary)
    } catch (error) {
      console.error('Error fetching funding data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSourceTransactions = async (source: FundingSource) => {
    try {
      const { data, error } = await supabase
        .from('subcontractor_payments')
        .select(`
          *,
          subcontractors(name),
          contracts(contract_number),
          subcontractor_milestones(milestone_name)
        `)
        .eq(source.type === 'investor' ? 'paid_by_investor_id' : 'paid_by_bank_id', source.id)
        .order('payment_date', { ascending: false })

      if (error) throw error

      const formattedTransactions: FundingTransaction[] = (data || []).map(payment => ({
        id: payment.id,
        date: payment.payment_date || payment.created_at,
        amount: payment.amount,
        subcontractor: payment.subcontractors?.name || 'Unknown',
        contract: payment.contracts?.contract_number || 'N/A',
        notes: payment.notes,
        milestone: payment.subcontractor_milestones?.milestone_name || null
      }))

      setTransactions(formattedTransactions)
    } catch (error) {
      console.error('Error fetching transactions:', error)
    }
  }

  const handleSourceClick = async (source: FundingSource) => {
    setSelectedSource(source)
    await fetchSourceTransactions(source)
  }

  const toggleProjectExpanded = (projectId: string) => {
    const newExpanded = new Set(expandedProjects)
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId)
    } else {
      newExpanded.add(projectId)
    }
    setExpandedProjects(newExpanded)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'expiring_soon': return 'bg-orange-100 text-orange-800'
      case 'expired': return 'bg-red-100 text-red-800'
      case 'depleted': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4" />
      case 'expiring_soon': return <Clock className="w-4 h-4" />
      case 'expired': return <AlertTriangle className="w-4 h-4" />
      case 'depleted': return <AlertTriangle className="w-4 h-4" />
      default: return null
    }
  }

  const handlePaymentClick = (notification: PaymentNotification) => {
    setSelectedNotification(notification)

    if (notification.payment_source === 'subcontractor') {
      // Open subcontractor payment modal
      setShowSubcontractorPaymentModal(true)
    } else {
      // Open bank payment modal
      setPaymentAmount(Number(notification.amount))
      setPaymentDate(new Date().toISOString().split('T')[0])
      setPaymentNotes(`Payment for ${notification.bank_name} - Payment #${notification.payment_number}`)
      setShowPaymentModal(true)
    }
  }

  const handleRecordPayment = async () => {
    if (!selectedNotification || !paymentAmount || paymentAmount <= 0) {
      alert('Please enter a valid payment amount')
      return
    }

    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) {
        alert('User not authenticated')
        return
      }

      const { data: creditData, error: creditError } = await supabase
        .from('bank_credits')
        .select('outstanding_balance')
        .eq('id', selectedNotification.bank_credit_id)
        .single()

      if (creditError) throw creditError

      const newOutstandingBalance = creditData.outstanding_balance - paymentAmount

      // Get active company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (companyError) throw companyError
      if (!company) throw new Error('No active company found')

      // Create invoice
      const invoiceNumber = `BANK-${Date.now()}`
      const { data: invoice, error: invoiceError } = await supabase
        .from('accounting_invoices')
        .insert({
          invoice_type: 'EXPENSE',
          invoice_category: 'BANK_CREDIT',
          company_id: company.id,
          bank_credit_id: selectedNotification.bank_credit_id,
          invoice_number: invoiceNumber,
          issue_date: paymentDate,
          due_date: paymentDate,
          base_amount: paymentAmount,
          vat_rate: 0,
          category: 'Bank Credit Payment',
          description: paymentNotes || 'Bank credit payment',
          created_by: userId
        })
        .select()
        .single()

      if (invoiceError) throw invoiceError

      // Create payment
      const { error: paymentError } = await supabase
        .from('accounting_payments')
        .insert({
          invoice_id: invoice.id,
          payment_date: paymentDate,
          amount: paymentAmount,
          payment_method: 'WIRE',
          reference_number: selectedNotification.bank_credit_id || '',
          description: paymentNotes || 'Bank credit payment',
          created_by: userId
        })

      if (paymentError) throw paymentError

      const { error: updateError } = await supabase
        .from('bank_credits')
        .update({
          outstanding_balance: newOutstandingBalance
        })
        .eq('id', selectedNotification.bank_credit_id)

      if (updateError) throw updateError

      // TODO: Re-implement payment notifications system later
      // const { error: notificationError } = await supabase
      //   .from('payment_notifications')
      //   .update({
      //     status: 'completed'
      //   })
      //   .eq('id', selectedNotification.id)
      //
      // if (notificationError) throw notificationError

      alert('Payment recorded successfully!')

      setShowPaymentModal(false)
      setSelectedNotification(null)
      setPaymentAmount(0)
      setPaymentDate(new Date().toISOString().split('T')[0])
      setPaymentNotes('')

      fetchFundingData()
    } catch (error) {
      console.error('Error recording payment:', error)
      alert('Failed to record payment')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading funding data...</div>
  }

  const totalStats = projects.reduce((acc, p) => ({
    committed: acc.committed + p.totalCommitted,
    spent: acc.spent + p.totalSpent,
    available: acc.available + p.totalAvailable,
    warnings: acc.warnings + p.warnings.length
  }), { committed: 0, spent: 0, available: 0, warnings: 0 })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Funding Overview</h1>
        <p className="text-gray-600 mt-2">Track funding sources, spending, and availability across all projects</p>
      </div>

      {/* Overall Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Committed</h3>
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">€{totalStats.committed.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">From all sources</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Spent</h3>
            <ArrowDownRight className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-600">€{totalStats.spent.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">
            {totalStats.committed > 0 ? ((totalStats.spent / totalStats.committed) * 100).toFixed(1) : '0'}% utilized
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Available Funds</h3>
            <ArrowUpRight className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">€{totalStats.available.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Ready to use</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Warnings</h3>
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-orange-600">{totalStats.warnings}</p>
          <p className="text-xs text-gray-500 mt-1">Require attention</p>
        </div>
      </div>

      {/* Projects List */}
      <div className="space-y-4">
        {projects.map((projectSummary) => {
          const isExpanded = expandedProjects.has(projectSummary.project.id)

          return (
            <div
              key={projectSummary.project.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Project Header */}
              <div
                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors duration-150"
                onClick={() => toggleProjectExpanded(projectSummary.project.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">{projectSummary.project.name}</h3>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                      {projectSummary.warnings.length > 0 && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                          {projectSummary.warnings.length} warning{projectSummary.warnings.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{projectSummary.project.location}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-600">Utilization Rate</p>
                    <p className={`text-2xl font-bold ${
                      projectSummary.utilizationRate >= 80 ? 'text-orange-600' :
                      projectSummary.utilizationRate >= 50 ? 'text-blue-600' :
                      'text-green-600'
                    }`}>
                      {projectSummary.utilizationRate.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-blue-700">Committed</p>
                    <p className="text-lg font-bold text-blue-900">€{projectSummary.totalCommitted.toLocaleString()}</p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <p className="text-xs text-red-700">Spent</p>
                    <p className="text-lg font-bold text-red-900">€{projectSummary.totalSpent.toLocaleString()}</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-xs text-green-700">Available</p>
                    <p className="text-lg font-bold text-green-900">€{projectSummary.totalAvailable.toLocaleString()}</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        projectSummary.utilizationRate >= 80 ? 'bg-orange-600' :
                        projectSummary.utilizationRate >= 50 ? 'bg-blue-600' :
                        'bg-green-600'
                      }`}
                      style={{ width: `${Math.min(100, projectSummary.utilizationRate)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-gray-200 bg-gray-50 p-6">
                  {/* Warnings */}
                  {projectSummary.warnings.length > 0 && (
                    <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
                        <h4 className="font-semibold text-orange-900">Warnings</h4>
                      </div>
                      <div className="space-y-1">
                        {projectSummary.warnings.map((warning, index) => (
                          <p key={index} className="text-sm text-orange-800">• {warning}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Funding Sources */}
                  <h4 className="font-semibold text-gray-900 mb-4">Funding Sources</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {projectSummary.fundingSources.map((source) => (
                      <div
                        key={`${source.type}-${source.id}`}
                        className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 cursor-pointer"
                        onClick={() => handleSourceClick(source)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              {source.type === 'investor' ? (
                                <Users className="w-5 h-5 text-blue-600" />
                              ) : (
                                <Building2 className="w-5 h-5 text-green-600" />
                              )}
                              <h5 className="font-semibold text-gray-900">{source.name}</h5>
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                source.type === 'investor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                              }`}>
                                {source.type.toUpperCase()}
                              </span>
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full flex items-center space-x-1 ${getStatusColor(source.status)}`}>
                                {getStatusIcon(source.status)}
                                <span className="ml-1">{source.status.replace('_', ' ').toUpperCase()}</span>
                              </span>
                            </div>
                          </div>
                          <Eye className="w-5 h-5 text-gray-400" />
                        </div>

                        <div className="grid grid-cols-4 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-gray-600">Total Amount</p>
                            <p className="text-sm font-bold text-gray-900">€{source.totalAmount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Spent</p>
                            <p className="text-sm font-bold text-red-600">€{source.spentAmount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Available</p>
                            <p className="text-sm font-bold text-green-600">€{source.availableAmount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Utilized</p>
                            <p className="text-sm font-bold text-blue-600">
                              {source.totalAmount > 0 ? ((source.spentAmount / source.totalAmount) * 100).toFixed(1) : '0'}%
                            </p>
                          </div>
                        </div>

                        {/* Source Progress Bar */}
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              source.status === 'depleted' ? 'bg-gray-400' :
                              source.status === 'expired' ? 'bg-red-600' :
                              (source.spentAmount / source.totalAmount) * 100 >= 80 ? 'bg-orange-600' :
                              'bg-blue-600'
                            }`}
                            style={{ width: `${Math.min(100, (source.spentAmount / source.totalAmount) * 100)}%` }}
                          ></div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
                          <div>
                            <span className="font-medium">Received:</span>
                            <p>{format(new Date(source.investmentDate), 'MMM dd, yyyy')}</p>
                          </div>
                          {source.usageExpirationDate && (
                            <div>
                              <span className="font-medium">Expires:</span>
                              <p className={isPast(new Date(source.usageExpirationDate)) ? 'text-red-600 font-semibold' : ''}>
                                {format(new Date(source.usageExpirationDate), 'MMM dd, yyyy')}
                              </p>
                            </div>
                          )}
                          {source.maturityDate && (
                            <div>
                              <span className="font-medium">Maturity:</span>
                              <p>{format(new Date(source.maturityDate), 'MMM dd, yyyy')}</p>
                            </div>
                          )}
                        </div>

                        {source.expectedReturn && (
                          <div className="mt-2 text-xs text-gray-600">
                            <span className="font-medium">Expected Return:</span> {source.expectedReturn}%
                          </div>
                        )}
                        {source.interestRate && (
                          <div className="mt-2 text-xs text-gray-600">
                            <span className="font-medium">Interest Rate:</span> {source.interestRate}%
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Source Transactions Modal */}
      {selectedSource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    {selectedSource.type === 'investor' ? (
                      <Users className="w-6 h-6 text-blue-600" />
                    ) : (
                      <Building2 className="w-6 h-6 text-green-600" />
                    )}
                    <h3 className="text-2xl font-semibold text-gray-900">{selectedSource.name}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedSource.type === 'investor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {selectedSource.type.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-gray-600">Transaction History</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedSource(null)
                    setTransactions([])
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-700 mb-1">Total Committed</p>
                  <p className="text-2xl font-bold text-blue-900">€{selectedSource.totalAmount.toLocaleString()}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-red-700 mb-1">Total Spent</p>
                  <p className="text-2xl font-bold text-red-900">€{selectedSource.spentAmount.toLocaleString()}</p>
                  <p className="text-xs text-red-600 mt-1">{transactions.length} transactions</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-700 mb-1">Available</p>
                  <p className="text-2xl font-bold text-green-900">€{selectedSource.availableAmount.toLocaleString()}</p>
                  <p className="text-xs text-green-600 mt-1">
                    {selectedSource.totalAmount > 0 ? ((selectedSource.availableAmount / selectedSource.totalAmount) * 100).toFixed(1) : '0'}% remaining
                  </p>
                </div>
              </div>

              {/* Transactions Table */}
              <h4 className="font-semibold text-gray-900 mb-4">Payments from this Source</h4>
              {transactions.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No transactions yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subcontractor</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contract</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Milestone</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {transactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {format(new Date(transaction.date), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{transaction.subcontractor}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{transaction.contract}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{transaction.milestone || '-'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-semibold text-red-600">
                            €{transaction.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                            {transaction.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FundingOverview
