import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Building2, CreditCard, DollarSign, TrendingUp, TrendingDown, Plus, X, Edit2, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import DateInput from '../Common/DateInput'

interface BankCredit {
  id: string
  bank_id: string
  company_id?: string
  project_id?: string
  credit_type: string
  credit_seniority: string
  amount: number
  used_amount: number
  repaid_amount: number
  outstanding_balance: number
  interest_rate: number
  start_date: string
  maturity_date: string
  usage_expiration_date?: string
  grace_period?: number
  purpose?: string
  status: string
  repayment_type: string
  principal_repayment_type?: string
  interest_repayment_type?: string
  monthly_payment: number
  project?: {
    id: string
    name: string
  }
  accounting_companies?: {
    name: string
  }
}

interface BankWithCredits {
  id: string
  name: string
  oib: string
  is_bank: boolean
  bank_id: string
  total_credit_limit: number
  total_used: number
  total_repaid: number
  total_outstanding: number
  credits: BankCredit[]
}

interface Project {
  id: string
  name: string
}

interface Company {
  id: string
  name: string
  oib: string
}

const AccountingBanks: React.FC = () => {
  const [banks, setBanks] = useState<BankWithCredits[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreditForm, setShowCreditForm] = useState(false)
  const [editingCredit, setEditingCredit] = useState<BankCredit | null>(null)
  const [newCredit, setNewCredit] = useState({
    bank_id: '',
    company_id: '',
    project_id: '',
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

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (showCreditForm) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showCreditForm])

  const fetchData = async () => {
    try {
      setLoading(true)

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

      // Fetch all banks (companies marked as banks)
      const { data: banksData, error: banksError } = await supabase
        .from('accounting_companies')
        .select('id, name, oib, is_bank, bank_id')
        .eq('is_bank', true)
        .order('name')

      if (banksError) throw banksError

      // For each bank, fetch all credits
      const banksWithCredits: BankWithCredits[] = []

      for (const bank of banksData || []) {
        if (!bank.bank_id) continue

        const { data: creditsData, error: creditsError } = await supabase
          .from('bank_credits')
          .select(`
            *,
            used_amount,
            repaid_amount,
            projects(id, name),
            accounting_companies(name)
          `)
          .eq('bank_id', bank.bank_id)
          .order('start_date', { ascending: false })

        if (creditsError) throw creditsError

        const credits = creditsData || []
        const totalCreditLimit = credits.reduce((sum, c) => sum + c.amount, 0)
        const totalUsed = credits.reduce((sum, c) => sum + (c.used_amount || 0), 0)
        const totalRepaid = credits.reduce((sum, c) => sum + (c.repaid_amount || 0), 0)
        const totalOutstanding = credits.reduce((sum, c) => sum + c.outstanding_balance, 0)

        banksWithCredits.push({
          ...bank,
          total_credit_limit: totalCreditLimit,
          total_used: totalUsed,
          total_repaid: totalRepaid,
          total_outstanding: totalOutstanding,
          credits
        })
      }

      setBanks(banksWithCredits)
      setProjects(projectsData || [])
      setCompanies(companiesData || [])
    } catch (error) {
      console.error('Error fetching banks:', error)
    } finally {
      setLoading(false)
    }
  }

  const addCredit = async () => {
    if (editingCredit) {
      await handleUpdateCredit()
      return
    }

    if (!newCredit.bank_id || !newCredit.amount || !newCredit.start_date) {
      alert('Please fill in required fields')
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
      const parts = newCredit.credit_type.split('_')
      const seniority = parts[parts.length - 1]
      const actualCreditType = parts.slice(0, -1).join('_')

      const { error } = await supabase
        .from('bank_credits')
        .insert({
          ...newCredit,
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

  const handleUpdateCredit = async () => {
    if (!editingCredit) return

    if (!newCredit.bank_id || !newCredit.amount || !newCredit.start_date || !newCredit.maturity_date) {
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
      const parts = newCredit.credit_type.split('_')
      const seniority = parts[parts.length - 1]
      const actualCreditType = parts.slice(0, -1).join('_')

      const { error } = await supabase
        .from('bank_credits')
        .update({
          bank_id: newCredit.bank_id,
          project_id: newCredit.project_id || null,
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

  const handleEditCredit = (credit: BankCredit) => {
    setEditingCredit(credit)
    setNewCredit({
      bank_id: credit.bank_id,
      company_id: credit.company_id || '',
      project_id: credit.project_id || '',
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
    setShowCreditForm(true)
  }

  const resetCreditForm = () => {
    setNewCredit({
      bank_id: '',
      company_id: '',
      project_id: '',
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Učitavanje...</p>
        </div>
      </div>
    )
  }

  const totalCreditAcrossAllBanks = banks.reduce((sum, b) => sum + b.total_credit_limit, 0)
  const totalUsedAcrossAllBanks = banks.reduce((sum, b) => sum + b.total_used, 0)
  const totalRepaidAcrossAllBanks = banks.reduce((sum, b) => sum + b.total_repaid, 0)
  const totalOutstandingAcrossAllBanks = banks.reduce((sum, b) => sum + b.total_outstanding, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banke</h1>
          <p className="text-sm text-gray-600 mt-1">Pregled svih bankovnih kredita</p>
        </div>
        <button
          onClick={() => setShowCreditForm(true)}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Credit
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupan kredit limit</p>
              <p className="text-2xl font-bold text-gray-900">€{totalCreditAcrossAllBanks.toLocaleString('hr-HR')}</p>
            </div>
            <CreditCard className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno iskorišteno</p>
              <p className="text-2xl font-bold text-blue-600">€{totalUsedAcrossAllBanks.toLocaleString('hr-HR')}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno vraćeno</p>
              <p className="text-2xl font-bold text-green-600">€{totalRepaidAcrossAllBanks.toLocaleString('hr-HR')}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupan dug</p>
              <p className="text-2xl font-bold text-red-600">€{totalOutstandingAcrossAllBanks.toLocaleString('hr-HR')}</p>
            </div>
            <DollarSign className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Banks List */}
      {banks.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Nema banaka</h3>
          <p className="text-gray-600">Nema dodanih banaka u sustavu</p>
        </div>
      ) : (
        <div className="space-y-6">
          {banks.map((bank) => {
            const utilizationPercent = bank.total_credit_limit > 0
              ? (bank.total_used / bank.total_credit_limit) * 100
              : 0
            const availableCredit = bank.total_credit_limit - bank.total_used

            return (
              <div key={bank.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Building2 className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{bank.name}</h2>
                      <p className="text-sm text-gray-600">OIB: {bank.oib}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Broj kredita</p>
                    <p className="text-3xl font-bold text-blue-600">{bank.credits.length}</p>
                  </div>
                </div>

                {/* Bank Summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Kredit limit</p>
                    <p className="text-lg font-bold text-gray-900">€{bank.total_credit_limit.toLocaleString('hr-HR')}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-xs text-blue-700 mb-1">Iskorišteno</p>
                    <p className="text-lg font-bold text-blue-900">€{bank.total_used.toLocaleString('hr-HR')}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-xs text-green-700 mb-1">Dostupno</p>
                    <p className="text-lg font-bold text-green-900">€{availableCredit.toLocaleString('hr-HR')}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-xs text-green-700 mb-1">Vraćeno</p>
                    <p className="text-lg font-bold text-green-900">€{bank.total_repaid.toLocaleString('hr-HR')}</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-xs text-red-700 mb-1">Dug banci</p>
                    <p className="text-lg font-bold text-red-900">€{bank.total_outstanding.toLocaleString('hr-HR')}</p>
                  </div>
                </div>

                {/* Utilization Bar */}
                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">Ukupna iskorištenost kredita</span>
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

                {/* Credits List */}
                {bank.credits.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Krediti</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {bank.credits.map((credit) => {
                        const usedAmount = credit.used_amount || 0
                        const available = credit.amount - usedAmount
                        const creditUtilization = credit.amount > 0 ? (usedAmount / credit.amount) * 100 : 0
                        const isExpired = new Date(credit.maturity_date) < new Date()

                        return (
                          <div key={credit.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">{credit.credit_type.replace('_', ' ').toUpperCase()}</h4>
                                <span className={`inline-block mt-1 px-2 py-1 text-xs font-semibold rounded-full ${
                                  credit.credit_seniority === 'senior' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                                }`}>
                                  {credit.credit_seniority?.toUpperCase() || 'SENIOR'}
                                </span>
                                {credit.project && (
                                  <p className="text-xs text-blue-600 mt-1">
                                    Projekat: {credit.project.name}
                                  </p>
                                )}
                                {credit.accounting_companies && (
                                  <p className="text-xs text-gray-500 mt-1">Company: {credit.accounting_companies.name}</p>
                                )}
                              </div>
                              {isExpired && (
                                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">
                                  ISTEKAO
                                </span>
                              )}
                            </div>

                            <div className="space-y-2 mb-3">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Limit:</span>
                                <span className="font-medium text-gray-900">€{credit.amount.toLocaleString('hr-HR')}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Iskorišteno:</span>
                                <span className="font-medium text-blue-600">€{usedAmount.toLocaleString('hr-HR')}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Dostupno:</span>
                                <span className="font-medium text-green-600">€{available.toLocaleString('hr-HR')}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Vraćeno:</span>
                                <span className="font-medium text-green-600">€{(credit.repaid_amount || 0).toLocaleString('hr-HR')}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Dug:</span>
                                <span className="font-medium text-red-600">€{credit.outstanding_balance.toLocaleString('hr-HR')}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Kamata:</span>
                                <span className="font-medium text-gray-900">{credit.interest_rate}%</span>
                              </div>
                            </div>

                            <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  creditUtilization >= 90 ? 'bg-red-500' :
                                  creditUtilization >= 70 ? 'bg-orange-500' :
                                  'bg-blue-500'
                                }`}
                                style={{ width: `${Math.min(creditUtilization, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mb-3 text-right">{creditUtilization.toFixed(1)}%</p>

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
                  </div>
                )}
              </div>
            )
          })}
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
                      <option key={bank.bank_id} value={bank.bank_id}>
                        {bank.name}
                      </option>
                    ))}
                  </select>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
                  <select
                    value={newCredit.project_id}
                    onChange={(e) => setNewCredit({ ...newCredit, project_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select project (optional)</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.name}
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
                  <DateInput
                    value={newCredit.start_date}
                    onChange={(value) => setNewCredit({ ...newCredit, start_date: value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Maturity Date</label>
                  <DateInput
                    value={newCredit.maturity_date}
                    onChange={(value) => setNewCredit({ ...newCredit, maturity_date: value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Usage Expiration Date</label>
                  <DateInput
                    value={newCredit.usage_expiration_date || ''}
                    onChange={(value) => setNewCredit({ ...newCredit, usage_expiration_date: value })}
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
    </div>
  )
}

export default AccountingBanks
