import React, { useState, useEffect } from 'react'
import { supabase, Bank, BankCredit, Project } from '../../../lib/supabase'
import { Building2, Plus, DollarSign, Calendar, Phone, Mail, TrendingUp, AlertTriangle, CheckCircle, CreditCard as Edit2, Trash2, Eye, X, CreditCard, Percent, Clock } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { PageHeader, LoadingSpinner } from '../../ui'

interface BankWithCredits extends Bank {
  credits: BankCredit[]
  total_credits: number
  active_credits: number
  credit_utilization: number
  credit_utilized: number
}

interface Company {
  id: string
  name: string
  oib: string
}

const BanksManagement: React.FC = () => {
  const [banks, setBanks] = useState<BankWithCredits[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedBank, setSelectedBank] = useState<BankWithCredits | null>(null)
  const [showBankForm, setShowBankForm] = useState(false)
  const [showCreditForm, setShowCreditForm] = useState(false)
  const [editingBank, setEditingBank] = useState<Bank | null>(null)
  const [editingCredit, setEditingCredit] = useState<BankCredit | null>(null)
  const [newBank, setNewBank] = useState({
    name: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    total_credit_limit: 0,
    outstanding_debt: 0,
    available_funds: 0,
    interest_rate: 0,
    relationship_start: '',
    notes: ''
  })
  const [newCredit, setNewCredit] = useState({
    bank_id: '',
    company_id: '',
    project_id: '',
    credit_name: '',
    credit_type: 'construction_loan_senior' as const,
    amount: 0,
    interest_rate: 0,
    start_date: '',
    maturity_date: '',
    outstanding_balance: 0,
    monthly_payment: 0,
    purpose: '',
    usage_expiration_date: '',
    grace_period: 0,
    repayment_type: 'monthly' as const,
    credit_seniority: 'senior' as const,
    principal_repayment_type: 'yearly' as 'monthly' | 'quarterly' | 'biyearly' | 'yearly',
    interest_repayment_type: 'monthly' as 'monthly' | 'quarterly' | 'biyearly' | 'yearly'
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (showBankForm || showCreditForm || selectedBank) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showBankForm, showCreditForm, selectedBank])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch banks
      const { data: banksData, error: banksError } = await supabase
        .from('banks')
        .select('*')
        .order('name')

      if (banksError) throw banksError

      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('name')

      if (projectsError) throw projectsError

      // Fetch companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('accounting_companies')
        .select('id, name, oib')
        .order('name')

      if (companiesError) throw companiesError

      // Fetch bank credits with used and repaid amounts
      const { data: creditsData, error: creditsError } = await supabase
        .from('bank_credits')
        .select(`
          *,
          used_amount,
          repaid_amount,
          projects(name),
          accounting_companies(name)
        `)
        .order('start_date', { ascending: false })

      if (creditsError) throw creditsError

      // Process banks with credits
      const banksWithCredits = (banksData || []).map(bank => {
        const bankCredits = (creditsData || []).filter(credit => credit.bank_id === bank.id)
        const total_credits = bankCredits.length
        const active_credits = bankCredits.filter(credit => credit.status === 'active').length

        // Calculate total utilized credit (sum of all credit amounts)
        const credit_utilized = bankCredits.reduce((sum, credit) => sum + Number(credit.amount || 0), 0)

        // Calculate actual outstanding debt from all credits
        const outstanding_debt = bankCredits.reduce((sum, credit) => sum + Number(credit.outstanding_balance || 0), 0)

        // Calculate available funds (limit - utilized)
        const available_funds = bank.total_credit_limit - credit_utilized

        // Calculate utilization based on utilized credit
        const credit_utilization = bank.total_credit_limit > 0
          ? (credit_utilized / bank.total_credit_limit) * 100
          : 0

        return {
          ...bank,
          credit_utilized,
          outstanding_debt,
          available_funds,
          credits: bankCredits,
          total_credits,
          active_credits,
          credit_utilization
        }
      })

      setBanks(banksWithCredits)
      setProjects(projectsData || [])
      setCompanies(companiesData || [])
    } catch (error) {
      console.error('Error fetching banks data:', error)
    } finally {
      setLoading(false)
    }
  }

  const addBank = async () => {
    if (!newBank.name.trim()) {
      alert('Please enter bank name')
      return
    }

    try {
      const { error } = await supabase
        .from('banks')
        .insert(newBank)

      if (error) throw error

      resetBankForm()
      await fetchData()
    } catch (error) {
      console.error('Error adding bank:', error)
      alert('Error adding bank. Please try again.')
    }
  }

  const updateBank = async () => {
    if (!editingBank || !newBank.name.trim()) return

    try {
      const { error } = await supabase
        .from('banks')
        .update(newBank)
        .eq('id', editingBank.id)

      if (error) throw error

      resetBankForm()
      await fetchData()
    } catch (error) {
      console.error('Error updating bank:', error)
      alert('Error updating bank.')
    }
  }

  const deleteBank = async (bankId: string) => {
    if (!confirm('Are you sure you want to delete this bank? This will also delete all associated credits.')) return

    try {
      const { error } = await supabase
        .from('banks')
        .delete()
        .eq('id', bankId)

      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('Error deleting bank:', error)
      alert('Error deleting bank.')
    }
  }

  const addCredit = async () => {
    if (editingCredit) {
      await handleUpdateCredit()
      return
    }

    if (!newCredit.bank_id || !newCredit.credit_name || !newCredit.amount || !newCredit.start_date) {
      alert('Please fill in required fields (Bank, Credit Name, Amount, Start Date)')
      return
    }

    // Calculate rate amount based on repayment type, grace period, and interest
    const calculateRateAmount = () => {
      const principal = newCredit.amount
      const annualRate = newCredit.interest_rate / 100
      const gracePeriodYears = newCredit.grace_period / 365
      
      // Calculate maturity period in years
      let maturityYears = 10 // default
      if (newCredit.maturity_date && newCredit.start_date) {
        const startDate = new Date(newCredit.start_date)
        const maturityDate = new Date(newCredit.maturity_date)
        maturityYears = (maturityDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      }
      
      // Effective repayment period (total period minus grace period)
      const repaymentYears = Math.max(0.1, maturityYears - gracePeriodYears)
      
      if (annualRate === 0) {
        // No interest case
        return newCredit.repayment_type === 'yearly' 
          ? principal / repaymentYears
          : principal / (repaymentYears * 12)
      }
      
      // With interest calculation
      if (newCredit.repayment_type === 'yearly') {
        // Annual payment calculation
        const yearlyRate = annualRate
        return (principal * yearlyRate * Math.pow(1 + yearlyRate, repaymentYears)) / 
               (Math.pow(1 + yearlyRate, repaymentYears) - 1)
      } else {
        // Monthly payment calculation
        const monthlyRate = annualRate / 12
        const totalMonths = repaymentYears * 12
        return (principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / 
               (Math.pow(1 + monthlyRate, totalMonths) - 1)
      }
    }

    try {
      // Parse credit_type which is in format: "construction_loan_senior" or "term_loan_junior"
      // Last part after last underscore is seniority, rest is credit_type
      const parts = newCredit.credit_type.split('_')
      const seniority = parts[parts.length - 1] // Last part is seniority (senior/junior)
      const actualCreditType = parts.slice(0, -1).join('_') // Everything before last underscore

      const { error } = await supabase
        .from('bank_credits')
        .insert({
          ...newCredit,
          company_id: newCredit.company_id || null,
          project_id: newCredit.project_id || null,
          credit_type: actualCreditType,
          credit_seniority: seniority,
          outstanding_balance: newCredit.outstanding_balance || newCredit.amount,
          monthly_payment: calculateRateAmount(),
          principal_repayment_type: newCredit.principal_repayment_type,
          interest_repayment_type: newCredit.interest_repayment_type
        })

      if (error) throw error

      resetCreditForm()
      await fetchData()
    } catch (error) {
      console.error('Error adding credit:', error)
      alert('Error adding credit facility.')
    }
  }

  const resetBankForm = () => {
    setNewBank({
      name: '',
      contact_person: '',
      contact_email: '',
      contact_phone: '',
      total_credit_limit: 0,
      outstanding_debt: 0,
      available_funds: 0,
      interest_rate: 0,
      relationship_start: '',
      notes: ''
    })
    setEditingBank(null)
    setShowBankForm(false)
  }

  const resetCreditForm = () => {
    setNewCredit({
      bank_id: '',
      company_id: '',
      project_id: '',
      credit_name: '',
      credit_type: 'construction_loan_senior',
      amount: 0,
      interest_rate: 0,
      start_date: '',
      maturity_date: '',
      outstanding_balance: 0,
      monthly_payment: 0,
      purpose: '',
      usage_expiration_date: '',
      grace_period: 0,
      repayment_type: 'monthly',
      credit_seniority: 'senior',
      principal_repayment_type: 'yearly',
      interest_repayment_type: 'monthly'
    })
    setEditingCredit(null)
    setShowCreditForm(false)
  }

  const handleEditCredit = (credit: BankCredit) => {
    setEditingCredit(credit)
    setNewCredit({
      bank_id: credit.bank_id,
      company_id: (credit as any).company_id || '',
      project_id: credit.project_id || '',
      credit_name: credit.credit_name || '',
      credit_type: `${credit.credit_type}_${credit.credit_seniority}`,
      amount: credit.amount,
      interest_rate: credit.interest_rate,
      start_date: credit.start_date,
      maturity_date: credit.maturity_date,
      outstanding_balance: credit.outstanding_balance,
      monthly_payment: credit.monthly_payment,
      purpose: credit.purpose || '',
      usage_expiration_date: credit.usage_expiration_date || '',
      grace_period: credit.grace_period || 0,
      repayment_type: credit.repayment_type,
      credit_seniority: credit.credit_seniority,
      principal_repayment_type: credit.principal_repayment_type || 'yearly',
      interest_repayment_type: credit.interest_repayment_type || 'monthly'
    })
    setSelectedBank(null)
    setShowCreditForm(true)
  }

  const handleDeleteCredit = async (creditId: string) => {
    if (!confirm('Are you sure you want to delete this credit facility?')) return

    try {
      const { error } = await supabase
        .from('bank_credits')
        .delete()
        .eq('id', creditId)

      if (error) throw error

      await fetchData()
    } catch (error) {
      console.error('Error deleting credit:', error)
      alert('Error deleting credit facility.')
    }
  }

  const handleUpdateCredit = async () => {
    if (!editingCredit) return

    if (!newCredit.bank_id || !newCredit.credit_name || !newCredit.amount || !newCredit.start_date || !newCredit.maturity_date) {
      alert('Please fill in all required fields')
      return
    }

    const calculateRateAmount = () => {
      const principal = newCredit.amount
      const annualRate = newCredit.interest_rate / 100
      const gracePeriodYears = newCredit.grace_period / 365

      let maturityYears = 10
      if (newCredit.maturity_date && newCredit.start_date) {
        const startDate = new Date(newCredit.start_date)
        const maturityDate = new Date(newCredit.maturity_date)
        maturityYears = (maturityDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      }

      const repaymentYears = Math.max(0.1, maturityYears - gracePeriodYears)

      if (annualRate === 0) {
        return newCredit.repayment_type === 'yearly'
          ? principal / repaymentYears
          : principal / (repaymentYears * 12)
      }

      if (newCredit.repayment_type === 'yearly') {
        const yearlyRate = annualRate
        return (principal * yearlyRate * Math.pow(1 + yearlyRate, repaymentYears)) /
               (Math.pow(1 + yearlyRate, repaymentYears) - 1)
      } else {
        const monthlyRate = annualRate / 12
        const totalMonths = repaymentYears * 12
        return (principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
               (Math.pow(1 + monthlyRate, totalMonths) - 1)
      }
    }

    try {
      // Parse credit_type which is in format: "construction_loan_senior" or "term_loan_junior"
      // Last part after last underscore is seniority, rest is credit_type
      const parts = newCredit.credit_type.split('_')
      const seniority = parts[parts.length - 1] // Last part is seniority (senior/junior)
      const actualCreditType = parts.slice(0, -1).join('_') // Everything before last underscore

      const { error } = await supabase
        .from('bank_credits')
        .update({
          bank_id: newCredit.bank_id,
          company_id: newCredit.company_id || null,
          project_id: newCredit.project_id || null,
          credit_name: newCredit.credit_name,
          credit_type: actualCreditType,
          credit_seniority: seniority,
          amount: newCredit.amount,
          interest_rate: newCredit.interest_rate,
          start_date: newCredit.start_date,
          maturity_date: newCredit.maturity_date,
          outstanding_balance: newCredit.outstanding_balance,
          monthly_payment: calculateRateAmount(),
          purpose: newCredit.purpose,
          usage_expiration_date: newCredit.usage_expiration_date || null,
          grace_period: newCredit.grace_period,
          repayment_type: newCredit.repayment_type,
          principal_repayment_type: newCredit.principal_repayment_type,
          interest_repayment_type: newCredit.interest_repayment_type
        })
        .eq('id', editingCredit.id)

      if (error) throw error

      resetCreditForm()
      await fetchData()
    } catch (error) {
      console.error('Error updating credit:', error)
      alert('Error updating credit facility.')
    }
  }


  const handleEditBank = (bank: Bank) => {
    setEditingBank(bank)
    setNewBank({
      name: bank.name,
      contact_person: bank.contact_person || '',
      contact_email: bank.contact_email || '',
      contact_phone: bank.contact_phone || '',
      total_credit_limit: bank.total_credit_limit,
      outstanding_debt: bank.outstanding_debt,
      available_funds: bank.available_funds,
      interest_rate: bank.interest_rate,
      relationship_start: bank.relationship_start || '',
      notes: bank.notes || ''
    })
    setShowBankForm(true)
  }

  const getPaymentFrequency = (type: string) => {
    switch (type) {
      case 'monthly': return 12
      case 'quarterly': return 4
      case 'biyearly': return 2
      case 'yearly': return 1
      default: return 12
    }
  }

  const calculatePayments = () => {
    if (!newCredit.start_date || !newCredit.maturity_date || !newCredit.amount) {
      return null
    }

    const startDate = new Date(newCredit.start_date)
    const endDate = new Date(newCredit.maturity_date)
    const gracePeriodMonths = newCredit.grace_period || 0

    const paymentStartDate = new Date(startDate)
    paymentStartDate.setMonth(paymentStartDate.getMonth() + gracePeriodMonths)

    if (paymentStartDate >= endDate) {
      return null
    }

    const totalYears = (endDate.getTime() - paymentStartDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)

    const principalFreq = getPaymentFrequency(newCredit.principal_repayment_type)
    const interestFreq = getPaymentFrequency(newCredit.interest_repayment_type)

    const totalPrincipalPayments = Math.floor(totalYears * principalFreq)
    const totalInterestPayments = Math.floor(totalYears * interestFreq)

    const principalPerPayment = totalPrincipalPayments > 0 ? newCredit.amount / totalPrincipalPayments : 0

    const annualInterest = newCredit.amount * (newCredit.interest_rate / 100)
    const interestPerPayment = totalInterestPayments > 0 ? annualInterest / interestFreq : 0

    return {
      principalPerPayment,
      interestPerPayment,
      totalPrincipalPayments,
      totalInterestPayments,
      paymentStartDate,
      principalFrequency: newCredit.principal_repayment_type,
      interestFrequency: newCredit.interest_repayment_type
    }
  }

  const getCreditTypeColor = (type: string) => {
    switch (type) {
      case 'construction_loan': return 'bg-blue-100 text-blue-800'
      case 'term_loan': return 'bg-green-100 text-green-800'
      case 'line_of_credit': return 'bg-purple-100 text-purple-800'
      case 'bridge_loan': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'paid': return 'bg-gray-100 text-gray-800'
      case 'defaulted': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading banks..." />
  }

  return (
    <div>
      <PageHeader
        title="Banking Relationships"
        description="Manage bank partnerships and credit facilities"
        actions={
          <div className="flex space-x-3">
            <button
              onClick={() => setShowBankForm(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Bank
            </button>
            <button
              onClick={() => setShowCreditForm(true)}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Credit
            </button>
          </div>
        }
      />

      {/* Banks Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {banks.map((bank) => (
          <div
            key={bank.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer"
            onClick={() => setSelectedBank(bank)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{bank.name}</h3>
                <p className="text-sm text-gray-600">{bank.contact_person}</p>
                <p className="text-xs text-gray-500">{bank.contact_email}</p>
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedBank(bank)
                  }}
                  className="p-1 text-gray-400 hover:text-blue-600"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEditBank(bank)
                  }}
                  className="p-1 text-gray-400 hover:text-green-600"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteBank(bank.id)
                  }}
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Credit Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center">
                <p className="text-xl font-bold text-blue-600">€{(bank.total_credit_limit / 1000000).toFixed(1)}M</p>
                <p className="text-xs text-gray-600">Credit Limit</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-green-600">€{(bank.credit_utilized / 1000000).toFixed(1)}M</p>
                <p className="text-xs text-gray-600">Credit Utilized</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-red-600">€{(bank.outstanding_debt / 1000000).toFixed(1)}M</p>
                <p className="text-xs text-gray-600">Outstanding</p>
              </div>
            </div>

            {/* Credit Utilization */}
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Credit Utilization</span>
                <span className="text-sm font-medium">{bank.credit_utilization.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    bank.credit_utilization > 80 ? 'bg-red-600' :
                    bank.credit_utilization > 60 ? 'bg-orange-600' :
                    'bg-green-600'
                  }`}
                  style={{ width: `${Math.min(100, bank.credit_utilization)}%` }}
                ></div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="border-t pt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Interest Rate</span>
                <span className="text-sm font-medium text-gray-900">{bank.interest_rate}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Active Credits</span>
                <span className="text-sm font-medium text-gray-900">{bank.active_credits}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bank Form Modal */}
      {showBankForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingBank ? 'Edit Bank' : 'Add New Bank'}
                </h3>
                <button
                  onClick={resetBankForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name *</label>
                  <input
                    type="text"
                    value={newBank.name}
                    onChange={(e) => setNewBank({ ...newBank, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person</label>
                  <input
                    type="text"
                    value={newBank.contact_person}
                    onChange={(e) => setNewBank({ ...newBank, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
                  <input
                    type="email"
                    value={newBank.contact_email}
                    onChange={(e) => setNewBank({ ...newBank, contact_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Phone</label>
                  <input
                    type="tel"
                    value={newBank.contact_phone}
                    onChange={(e) => setNewBank({ ...newBank, contact_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Relationship Start</label>
                  <input
                    type="date"
                    value={newBank.relationship_start}
                    onChange={(e) => setNewBank({ ...newBank, relationship_start: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Credit Limit (€)</label>
                  <input
                    type="number"
                    value={newBank.total_credit_limit}
                    onChange={(e) => setNewBank({ ...newBank, total_credit_limit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Outstanding Debt (€)</label>
                  <input
                    type="number"
                    value={newBank.outstanding_debt}
                    onChange={(e) => setNewBank({ ...newBank, outstanding_debt: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Available Funds (€)</label>
                  <input
                    type="number"
                    value={newBank.available_funds}
                    onChange={(e) => setNewBank({ ...newBank, available_funds: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newBank.interest_rate}
                    onChange={(e) => setNewBank({ ...newBank, interest_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={newBank.notes}
                    onChange={(e) => setNewBank({ ...newBank, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={resetBankForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={editingBank ? updateBank : addBank}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  {editingBank ? 'Update' : 'Add'} Bank
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credit Form Modal */}
      {showCreditForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">{editingCredit ? 'Edit Credit Facility' : 'Add New Credit Facility'}</h3>
                <button
                  onClick={resetCreditForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 max-h-[calc(90vh-180px)] overflow-y-auto">
              {(() => {
                const calculation = calculatePayments()
                if (calculation) {
                  return (
                    <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-900 mb-3">Payment Schedule Preview</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-blue-700 mb-1">Principal Payment</p>
                          <p className="text-xl font-bold text-blue-900">€{calculation.principalPerPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                          <p className="text-xs text-blue-600">Every {calculation.principalFrequency}</p>
                          <p className="text-xs text-blue-600 mt-1">{calculation.totalPrincipalPayments} total payments</p>
                        </div>
                        <div>
                          <p className="text-sm text-green-700 mb-1">Interest Payment</p>
                          <p className="text-xl font-bold text-green-900">€{calculation.interestPerPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                          <p className="text-xs text-green-600">Every {calculation.interestFrequency}</p>
                          <p className="text-xs text-green-600 mt-1">{calculation.totalInterestPayments} total payments</p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <p className="text-sm text-blue-700">Payments start: <span className="font-semibold">{format(calculation.paymentStartDate, 'MMM dd, yyyy')}</span></p>
                        <p className="text-xs text-blue-600 mt-1">After {newCredit.grace_period} month grace period</p>
                      </div>
                    </div>
                  )
                }
                return null
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bank *</label>
                  <select
                    value={newCredit.bank_id}
                    onChange={(e) => setNewCredit({ ...newCredit, bank_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select bank</option>
                    {banks.map(bank => (
                      <option key={bank.id} value={bank.id}>
                        {bank.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Credit Name *</label>
                  <input
                    type="text"
                    value={newCredit.credit_name}
                    onChange={(e) => setNewCredit({ ...newCredit, credit_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Kozara Construction Loan 2024"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                  <select
                    value={newCredit.company_id}
                    onChange={(e) => setNewCredit({ ...newCredit, company_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select company</option>
                    {companies.map(company => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Credit Type</label>
                  <select
                    value={newCredit.credit_type}
                    onChange={(e) => setNewCredit({ ...newCredit, credit_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="construction_loan_senior">Construction Loan</option>
                    <option value="term_loan_senior">Term Loan</option>
                    <option value="line_of_credit_senior">Line of Credit - Senior</option>
                    <option value="line_of_credit_junior">Line of Credit - Junior</option>
                    <option value="bridge_loan_senior">Bridge Loan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount (€) *</label>
                  <input
                    type="number"
                    value={newCredit.amount}
                    onChange={(e) => setNewCredit({ ...newCredit, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newCredit.interest_rate}
                    onChange={(e) => setNewCredit({ ...newCredit, interest_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Grace Period (months)</label>
                  <input
                    type="number"
                    value={newCredit.grace_period}
                    onChange={(e) => setNewCredit({ ...newCredit, grace_period: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Principal Repayment Type</label>
                  <select
                    value={newCredit.principal_repayment_type}
                    onChange={(e) => setNewCredit({ ...newCredit, principal_repayment_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="biyearly">Biyearly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">How often to repay principal</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Interest Repayment Type</label>
                  <select
                    value={newCredit.interest_repayment_type}
                    onChange={(e) => setNewCredit({ ...newCredit, interest_repayment_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="biyearly">Biyearly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">How often to pay interest</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                  <input
                    type="date"
                    value={newCredit.start_date}
                    onChange={(e) => setNewCredit({ ...newCredit, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Maturity Date</label>
                  <input
                    type="date"
                    value={newCredit.maturity_date}
                    onChange={(e) => setNewCredit({ ...newCredit, maturity_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Usage Expiration Date</label>
                  <input
                    type="date"
                    value={newCredit.usage_expiration_date}
                    onChange={(e) => setNewCredit({ ...newCredit, usage_expiration_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Purpose</label>
                  <textarea
                    value={newCredit.purpose}
                    onChange={(e) => setNewCredit({ ...newCredit, purpose: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="What is this credit facility for?"
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end space-x-3">
                <button
                  onClick={resetCreditForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={addCredit}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  Add Credit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bank Details Modal */}
      {selectedBank && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">{selectedBank.name}</h3>
                  <p className="text-gray-600 mt-1">{selectedBank.contact_person}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 text-gray-400 mr-1" />
                      <span className="text-sm text-gray-600">{selectedBank.contact_email}</span>
                    </div>
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 text-gray-400 mr-1" />
                      <span className="text-sm text-gray-600">{selectedBank.contact_phone}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBank(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Financial Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-3">Credit Facilities</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Total Limit:</span>
                      <span className="font-medium text-blue-900">€{selectedBank.total_credit_limit.toLocaleString('hr-HR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Credit Utilized:</span>
                      <span className="font-medium text-green-700">€{selectedBank.credit_utilized.toLocaleString('hr-HR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Outstanding:</span>
                      <span className="font-medium text-red-700">€{selectedBank.outstanding_debt.toLocaleString('hr-HR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Available:</span>
                      <span className="font-medium text-blue-900">€{selectedBank.available_funds.toLocaleString('hr-HR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Utilization:</span>
                      <span className="font-medium text-blue-900">{selectedBank.credit_utilization.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-3">Relationship Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-green-700">Since:</span>
                      <span className="font-medium text-green-900">
                        {selectedBank.relationship_start 
                          ? format(new Date(selectedBank.relationship_start), 'MMM yyyy')
                          : 'N/A'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Avg. Rate:</span>
                      <span className="font-medium text-green-900">{selectedBank.interest_rate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Active Credits:</span>
                      <span className="font-medium text-green-900">{selectedBank.active_credits}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Total Credits:</span>
                      <span className="font-medium text-green-900">{selectedBank.total_credits}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-orange-900 mb-3">Risk Assessment</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-orange-700">Credit Risk:</span>
                      <span className={`font-medium ${
                        selectedBank.credit_utilization > 80 ? 'text-red-600' :
                        selectedBank.credit_utilization > 60 ? 'text-orange-600' :
                        'text-green-600'
                      }`}>
                        {selectedBank.credit_utilization > 80 ? 'High' :
                         selectedBank.credit_utilization > 60 ? 'Medium' : 'Low'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-orange-700">Concentration:</span>
                      <span className="font-medium text-orange-900">
                        {banks.length > 0 
                          ? ((selectedBank.outstanding_debt / banks.reduce((sum, b) => sum + b.outstanding_debt, 0)) * 100).toFixed(1)
                          : '0'
                        }%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-orange-700">Relationship:</span>
                      <span className="font-medium text-orange-900">
                        {selectedBank.relationship_start 
                          ? `${Math.floor(differenceInDays(new Date(), new Date(selectedBank.relationship_start)) / 365)}y`
                          : 'New'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Credit Facilities */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-4">Credit Facilities</h4>
                {selectedBank.credits.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <CreditCard className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No credit facilities with this bank yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedBank.credits.map((credit) => {
                      const isMaturing = credit.maturity_date && differenceInDays(new Date(credit.maturity_date), new Date()) <= 90
                      const paymentRatio = credit.amount > 0 ? ((credit.amount - credit.outstanding_balance) / credit.amount) * 100 : 0
                      
                      return (
                        <div key={credit.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getCreditTypeColor(credit.credit_type)}`}>
                                  {credit.credit_type.replace('_', ' ').toUpperCase()}
                                </span>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  credit.credit_seniority === 'senior' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                                }`}>
                                  {credit.credit_seniority?.toUpperCase() || 'SENIOR'}
                                </span>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(credit.status)}`}>
                                  {credit.status.toUpperCase()}
                                </span>
                                {isMaturing && (
                                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                                    MATURING SOON
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{credit.purpose}</p>
                              {(credit as any).accounting_companies && (
                                <p className="text-xs text-gray-500 mb-1">Company: {(credit as any).accounting_companies.name}</p>
                              )}
                              
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">€{credit.amount.toLocaleString('hr-HR')}</p>
                              <p className="text-sm text-gray-600">{credit.interest_rate}% APR</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-gray-500">Used Amount</p>
                              <p className="text-sm font-medium text-blue-600">€{((credit as any).used_amount || 0).toLocaleString('hr-HR')}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {credit.amount > 0 ? (((credit as any).used_amount || 0) / credit.amount * 100).toFixed(1) : 0}% drawn
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Repaid to Bank</p>
                              <p className="text-sm font-medium text-green-600">€{((credit as any).repaid_amount || 0).toLocaleString('hr-HR')}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Outstanding Debt</p>
                              <p className="text-sm font-medium text-red-600">€{credit.outstanding_balance.toLocaleString('hr-HR')}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Available to Use</p>
                              <p className="text-sm font-medium text-gray-900">
                                €{(credit.amount - ((credit as any).used_amount || 0)).toLocaleString('hr-HR')}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3 pt-3 border-t border-gray-100">
                            <div>
                              <p className="text-xs text-gray-500">{credit.repayment_type === 'yearly' ? 'Annual' : 'Monthly'} Payment</p>
                              <p className="text-sm font-medium text-gray-900">€{credit.monthly_payment.toLocaleString('hr-HR')}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Maturity Date</p>
                              <p className={`text-sm font-medium ${isMaturing ? 'text-orange-600' : 'text-gray-900'}`}>
                                {credit.maturity_date ? format(new Date(credit.maturity_date), 'MMM dd, yyyy') : 'N/A'}
                              </p>
                            </div>
                          </div>

                          {/* Payment Progress */}
                          <div className="mb-3">
                            <div className="flex justify-between mb-1">
                              <span className="text-xs text-gray-600">Repayment Progress</span>
                              <span className="text-xs font-medium">{paymentRatio.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-green-600 h-2 rounded-full"
                                style={{ width: `${paymentRatio}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-3 border-t border-gray-200 flex gap-2">
                            <button
                              onClick={() => handleEditCredit(credit)}
                              className="flex-1 items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                            >
                              <Edit2 className="w-4 h-4 inline mr-2" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteCredit(credit.id)}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedBank.notes && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Notes</h4>
                  <p className="text-gray-700">{selectedBank.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default BanksManagement