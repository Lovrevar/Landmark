import React, { useState, useEffect } from 'react'
import { supabase, Bank, BankCredit, Project } from '../../../lib/supabase'
import { Plus, Phone, Mail, CreditCard as Edit2, Trash2, Eye, CreditCard } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { PageHeader, LoadingSpinner, Modal, FormField, Input, Select, Textarea, Button, Badge, EmptyState } from '../../ui'

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
  const [showEquityForm, setShowEquityForm] = useState(false)
  const [editingBank, setEditingBank] = useState<Bank | null>(null)
  const [editingCredit, setEditingCredit] = useState<BankCredit | null>(null)
  const [newBank, setNewBank] = useState({
    name: '',
    contact_person: '',
    contact_email: '',
    contact_phone: ''
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
    interest_repayment_type: 'monthly' as 'monthly' | 'quarterly' | 'biyearly' | 'yearly',
    disbursed_to_account: false,
    disbursed_to_bank_account_id: ''
  })
  const [companyBankAccounts, setCompanyBankAccounts] = useState<any[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newEquity, setNewEquity] = useState({
    bank_id: '',
    company_id: '',
    investment_type: 'equity' as const,
    amount: 0,
    percentage_stake: 0,
    expected_return: 0,
    investment_date: '',
    maturity_date: '',
    payment_schedule: 'yearly' as 'monthly' | 'yearly' | 'custom',
    terms: '',
    notes: '',
    usage_expiration_date: '',
    grace_period: 0,
    custom_payment_count: 0,
    custom_payments: [] as { date: string; amount: number }[]
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (newCredit.company_id && newCredit.disbursed_to_account) {
      fetchCompanyBankAccounts(newCredit.company_id)
    } else {
      setCompanyBankAccounts([])
    }
  }, [newCredit.company_id, newCredit.disbursed_to_account])

  const fetchCompanyBankAccounts = async (companyId: string) => {
    try {
      setLoadingAccounts(true)
      const { data, error } = await supabase
        .from('company_bank_accounts')
        .select(`
          id,
          company_id,
          bank_name,
          account_number,
          current_balance
        `)
        .eq('company_id', companyId)

      if (error) throw error
      setCompanyBankAccounts(data || [])
    } catch (error) {
      console.error('Error fetching company bank accounts:', error)
      setCompanyBankAccounts([])
    } finally {
      setLoadingAccounts(false)
    }
  }


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

  const addEquity = async () => {
    if (!newEquity.bank_id || !newEquity.amount || !newEquity.investment_date) {
      alert('Please fill in required fields (Bank, Amount, Investment Date)')
      return
    }

    try {
      const { error } = await supabase
        .from('bank_credits')
        .insert({
          bank_id: newEquity.bank_id,
          company_id: newEquity.company_id || null,
          project_id: null,
          credit_name: `Equity Investment ${format(new Date(newEquity.investment_date), 'MMM yyyy')}`,
          credit_type: 'equity',
          credit_seniority: 'junior',
          amount: newEquity.amount,
          interest_rate: newEquity.expected_return,
          start_date: newEquity.investment_date,
          maturity_date: newEquity.maturity_date || null,
          usage_expiration_date: newEquity.usage_expiration_date || null,
          outstanding_balance: newEquity.amount,
          status: 'active',
          purpose: newEquity.terms || null,
          grace_period: newEquity.grace_period || 0,
          repayment_type: newEquity.payment_schedule === 'monthly' ? 'monthly' : 'yearly',
          principal_repayment_type: newEquity.payment_schedule === 'monthly' ? 'monthly' : 'yearly',
          interest_repayment_type: newEquity.payment_schedule === 'monthly' ? 'monthly' : 'yearly',
          monthly_payment: 0
        })

      if (error) throw error

      setShowEquityForm(false)
      setNewEquity({
        bank_id: '',
        company_id: '',
        investment_type: 'equity',
        amount: 0,
        percentage_stake: 0,
        expected_return: 0,
        investment_date: '',
        maturity_date: '',
        payment_schedule: 'yearly',
        terms: '',
        notes: '',
        usage_expiration_date: '',
        grace_period: 0,
        custom_payment_count: 0,
        custom_payments: []
      })
      await fetchData()
      alert('Equity investment added successfully')
    } catch (error) {
      console.error('Error adding equity:', error)
      alert('Error adding equity investment.')
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
          disbursed_to_bank_account_id: newCredit.disbursed_to_account && newCredit.disbursed_to_bank_account_id ? newCredit.disbursed_to_bank_account_id : null,
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
      contact_phone: ''
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
      interest_repayment_type: 'monthly',
      disbursed_to_account: false,
      disbursed_to_bank_account_id: ''
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
      interest_repayment_type: credit.interest_repayment_type || 'monthly',
      disbursed_to_account: (credit as any).disbursed_to_account || false,
      disbursed_to_bank_account_id: (credit as any).disbursed_to_bank_account_id || ''
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
          interest_repayment_type: newCredit.interest_repayment_type,
          disbursed_to_account: newCredit.disbursed_to_account || false,
          disbursed_to_bank_account_id: newCredit.disbursed_to_account && newCredit.disbursed_to_bank_account_id ? newCredit.disbursed_to_bank_account_id : null
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
      contact_phone: bank.contact_phone || ''
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
            <Button icon={Plus} onClick={() => setShowBankForm(true)}>Add Investor</Button>
            <Button icon={Plus} variant="success" onClick={() => setShowCreditForm(true)}>Add Credit</Button>
            <Button icon={Plus} variant="primary" onClick={() => setShowEquityForm(true)}>Add Equity</Button>
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
                <Button
                  size="icon-sm"
                  variant="ghost"
                  icon={Eye}
                  onClick={(e) => { e.stopPropagation(); setSelectedBank(bank) }}
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  icon={Edit2}
                  onClick={(e) => { e.stopPropagation(); handleEditBank(bank) }}
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  icon={Trash2}
                  onClick={(e) => { e.stopPropagation(); deleteBank(bank.id) }}
                />
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
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Active Credits</span>
                <span className="text-sm font-medium text-gray-900">{bank.active_credits}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal show={showBankForm} onClose={resetBankForm} size="md">
        <Modal.Header title={editingBank ? 'Edit Bank' : 'Add New Bank'} onClose={resetBankForm} />
        <Modal.Body>
          <div className="space-y-4">
            <FormField label="Bank Name" required>
              <Input
                type="text"
                value={newBank.name}
                onChange={(e) => setNewBank({ ...newBank, name: e.target.value })}
                placeholder="Enter bank name"
              />
            </FormField>
            <FormField label="Contact Person">
              <Input
                type="text"
                value={newBank.contact_person}
                onChange={(e) => setNewBank({ ...newBank, contact_person: e.target.value })}
                placeholder="Enter contact person name"
              />
            </FormField>
            <FormField label="Contact Email">
              <Input
                type="email"
                value={newBank.contact_email}
                onChange={(e) => setNewBank({ ...newBank, contact_email: e.target.value })}
                placeholder="Enter contact email"
              />
            </FormField>
            <FormField label="Contact Phone">
              <Input
                type="tel"
                value={newBank.contact_phone}
                onChange={(e) => setNewBank({ ...newBank, contact_phone: e.target.value })}
                placeholder="Enter contact phone"
              />
            </FormField>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={resetBankForm}>Cancel</Button>
          <Button onClick={editingBank ? updateBank : addBank}>
            {editingBank ? 'Update' : 'Add'} Bank
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showCreditForm} onClose={resetCreditForm} size="lg">
        <Modal.Header title={editingCredit ? 'Edit Credit Facility' : 'Add New Credit Facility'} onClose={resetCreditForm} />
        <Modal.Body>
          {(() => {
            const calculation = calculatePayments()
            if (calculation) {
              return (
                <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-3">Payment Schedule Preview</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-blue-700 mb-1">Principal Payment</p>
                      <p className="text-xl font-bold text-blue-900">{calculation.principalPerPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      <p className="text-xs text-blue-600">Every {calculation.principalFrequency}</p>
                      <p className="text-xs text-blue-600 mt-1">{calculation.totalPrincipalPayments} total payments</p>
                    </div>
                    <div>
                      <p className="text-sm text-green-700 mb-1">Interest Payment</p>
                      <p className="text-xl font-bold text-green-900">{calculation.interestPerPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
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
            <FormField label="Bank" required>
              <Select
                value={newCredit.bank_id}
                onChange={(e) => setNewCredit({ ...newCredit, bank_id: e.target.value })}
              >
                <option value="">Select bank</option>
                {banks.map(bank => (
                  <option key={bank.id} value={bank.id}>{bank.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Credit Name" required>
              <Input
                type="text"
                value={newCredit.credit_name}
                onChange={(e) => setNewCredit({ ...newCredit, credit_name: e.target.value })}
                placeholder="e.g., Kozara Construction Loan 2024"
              />
            </FormField>
            <FormField label="Company">
              <Select
                value={newCredit.company_id}
                onChange={(e) => setNewCredit({ ...newCredit, company_id: e.target.value })}
              >
                <option value="">Select company</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Credit Type">
              <Select
                value={newCredit.credit_type}
                onChange={(e) => setNewCredit({ ...newCredit, credit_type: e.target.value as any })}
              >
                <option value="construction_loan_senior">Construction Loan</option>
                <option value="term_loan_senior">Term Loan</option>
                <option value="line_of_credit_senior">Line of Credit - Senior</option>
                <option value="line_of_credit_junior">Line of Credit - Junior</option>
                <option value="bridge_loan_senior">Bridge Loan</option>
              </Select>
            </FormField>
            <FormField label="Amount" required>
              <Input
                type="number"
                value={newCredit.amount}
                onChange={(e) => setNewCredit({ ...newCredit, amount: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Interest Rate (%)">
              <Input
                type="number"
                step="0.1"
                value={newCredit.interest_rate}
                onChange={(e) => setNewCredit({ ...newCredit, interest_rate: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Grace Period (months)">
              <Input
                type="number"
                value={newCredit.grace_period}
                onChange={(e) => setNewCredit({ ...newCredit, grace_period: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </FormField>
            <FormField label="Principal Repayment Type" helperText="How often to repay principal">
              <Select
                value={newCredit.principal_repayment_type}
                onChange={(e) => setNewCredit({ ...newCredit, principal_repayment_type: e.target.value as any })}
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="biyearly">Biyearly</option>
                <option value="yearly">Yearly</option>
              </Select>
            </FormField>
            <FormField label="Interest Repayment Type" helperText="How often to pay interest">
              <Select
                value={newCredit.interest_repayment_type}
                onChange={(e) => setNewCredit({ ...newCredit, interest_repayment_type: e.target.value as any })}
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="biyearly">Biyearly</option>
                <option value="yearly">Yearly</option>
              </Select>
            </FormField>
            <FormField label="Start Date" required>
              <Input
                type="date"
                value={newCredit.start_date}
                onChange={(e) => setNewCredit({ ...newCredit, start_date: e.target.value })}
              />
            </FormField>
            <FormField label="Maturity Date">
              <Input
                type="date"
                value={newCredit.maturity_date}
                onChange={(e) => setNewCredit({ ...newCredit, maturity_date: e.target.value })}
              />
            </FormField>
            <FormField label="Usage Expiration Date">
              <Input
                type="date"
                value={newCredit.usage_expiration_date}
                onChange={(e) => setNewCredit({ ...newCredit, usage_expiration_date: e.target.value })}
              />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Purpose">
                <Textarea
                  value={newCredit.purpose}
                  onChange={(e) => setNewCredit({ ...newCredit, purpose: e.target.value })}
                  rows={3}
                  placeholder="What is this credit facility for?"
                />
              </FormField>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 p-4 rounded-lg">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newCredit.disbursed_to_account}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setNewCredit({
                      ...newCredit,
                      disbursed_to_account: checked,
                      disbursed_to_bank_account_id: checked ? newCredit.disbursed_to_bank_account_id : ''
                    })
                  }}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-900">Isplata na račun</span>
                  <p className="text-sm text-gray-600 mt-1">
                    Kada je označeno, ceo iznos kredita će automatski biti isplaćen na odabrani bankovni račun firme.
                  </p>
                </div>
              </label>

              {newCredit.disbursed_to_account && (
                <div className="mt-4">
                  {!newCredit.company_id ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-800">Molimo prvo odaberite firmu da biste videli dostupne bankovne račune.</p>
                    </div>
                  ) : loadingAccounts ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-600">Učitavanje računa...</p>
                    </div>
                  ) : companyBankAccounts.length === 0 ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-800">Odabrana firma nema bankovnih računa. Molimo dodajte račun u "Moje firme" prvo.</p>
                    </div>
                  ) : (
                    <FormField label="Bankovni račun" required>
                      <Select
                        value={newCredit.disbursed_to_bank_account_id}
                        onChange={(e) => setNewCredit({ ...newCredit, disbursed_to_bank_account_id: e.target.value })}
                        required={newCredit.disbursed_to_account}
                      >
                        <option value="">Odaberite račun</option>
                        {companyBankAccounts.map((account: any) => (
                          <option key={account.id} value={account.id}>
                            {account.bank_name || 'Nepoznata banka'} {account.account_number ? `- ${account.account_number}` : ''} (Saldo: €{Number(account.current_balance).toLocaleString('hr-HR')})
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  )}
                </div>
              )}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={resetCreditForm}>Cancel</Button>
          <Button variant="success" onClick={addCredit}>
            {editingCredit ? 'Update' : 'Add'} Credit
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={!!selectedBank} onClose={() => setSelectedBank(null)} size="xl">
        {selectedBank && (
          <>
            <Modal.Header
              title={selectedBank.name}
              subtitle={selectedBank.contact_person}
              onClose={() => setSelectedBank(null)}
            />
            
            <Modal.Body>
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex items-center">
                  <Mail className="w-4 h-4 text-gray-400 mr-1" />
                  <span className="text-sm text-gray-600">{selectedBank.contact_email}</span>
                </div>
                <div className="flex items-center">
                  <Phone className="w-4 h-4 text-gray-400 mr-1" />
                  <span className="text-sm text-gray-600">{selectedBank.contact_phone}</span>
                </div>
              </div>

              {/* Financial Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-3">Credit Facilities</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Credit Utilized:</span>
                      <span className="font-medium text-green-700">€{selectedBank.credit_utilized.toLocaleString('hr-HR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Outstanding:</span>
                      <span className="font-medium text-red-700">€{selectedBank.outstanding_debt.toLocaleString('hr-HR')}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-3">Credit Overview</h4>
                  <div className="space-y-2">
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
                  </div>
                </div>
              </div>

              {/* Credit Facilities */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-4">Credit Facilities</h4>
                {selectedBank.credits.length === 0 ? (
                  <EmptyState
                    icon={CreditCard}
                    title="No credit facilities"
                    description="No credit facilities with this bank yet"
                  />
                ) : (
                  <div className="space-y-3">
                    {selectedBank.credits.map((credit) => {
                      const isMaturing = credit.maturity_date && differenceInDays(new Date(credit.maturity_date), new Date()) <= 90
                      const paymentRatio = credit.amount > 0 ? ((credit.amount - credit.outstanding_balance) / credit.amount) * 100 : 0
                      
                      return (
                        <div key={credit.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2 flex-wrap gap-y-1">
                                {credit.credit_type === 'equity' ? (
                                  <Badge variant="purple" size="sm">EQUITY</Badge>
                                ) : (
                                  <Badge variant={
                                    credit.credit_type === 'construction_loan' ? 'blue' :
                                    credit.credit_type === 'term_loan' ? 'green' :
                                    credit.credit_type === 'bridge_loan' ? 'orange' : 'gray'
                                  } size="sm">
                                    {credit.credit_type.replace('_', ' ').toUpperCase()}
                                  </Badge>
                                )}
                                <Badge variant={credit.credit_seniority === 'senior' ? 'blue' : 'orange'} size="sm">
                                  {credit.credit_seniority?.toUpperCase() || 'SENIOR'}
                                </Badge>
                                <Badge variant={
                                  credit.status === 'active' ? 'green' :
                                  credit.status === 'defaulted' ? 'red' : 'gray'
                                } size="sm">
                                  {credit.status.toUpperCase()}
                                </Badge>
                                {isMaturing && (
                                  <Badge variant="orange" size="sm">MATURING SOON</Badge>
                                )}
                              </div>
                              {(credit as any).credit_name && (
                                <p className="text-base font-semibold text-gray-900 mb-1">{(credit as any).credit_name}</p>
                              )}
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

                          <div className="pt-3 border-t border-gray-200 flex gap-2">
                            <Button icon={Edit2} onClick={() => handleEditCredit(credit)} size="sm">Edit</Button>
                            <Button icon={Trash2} variant="danger" onClick={() => handleDeleteCredit(credit.id)} size="sm" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </Modal.Body>
          </>
        )}
      </Modal>

      <Modal show={showEquityForm} onClose={() => setShowEquityForm(false)} size="lg">
        <Modal.Header title="Add New Investment" onClose={() => setShowEquityForm(false)} />
        <Modal.Body>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Bank" required>
              <Select
                value={newEquity.bank_id}
                onChange={(e) => setNewEquity({ ...newEquity, bank_id: e.target.value })}
              >
                <option value="">Select bank</option>
                {banks.map(bank => (
                  <option key={bank.id} value={bank.id}>{bank.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Company">
              <Select
                value={newEquity.company_id}
                onChange={(e) => setNewEquity({ ...newEquity, company_id: e.target.value })}
              >
                <option value="">Select company</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Amount" required>
              <Input
                type="number"
                value={newEquity.amount}
                onChange={(e) => setNewEquity({ ...newEquity, amount: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="IRR (%)">
              <Input
                type="number"
                step="0.1"
                value={newEquity.expected_return}
                onChange={(e) => setNewEquity({ ...newEquity, expected_return: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Payment Schedule">
              <Select
                value={newEquity.payment_schedule}
                onChange={(e) => {
                  const newSchedule = e.target.value as 'monthly' | 'yearly' | 'custom'
                  setNewEquity({
                    ...newEquity,
                    payment_schedule: newSchedule,
                    custom_payment_count: newSchedule === 'custom' ? 0 : 0,
                    custom_payments: []
                  })
                }}
              >
                <option value="yearly">Yearly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom</option>
              </Select>
            </FormField>

            {newEquity.payment_schedule === 'custom' && (
              <>
                <FormField label="Number of Payments" required>
                  <Input
                    type="number"
                    min="1"
                    value={newEquity.custom_payment_count || ''}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0
                      const newPayments = Array.from({ length: count }, (_, i) =>
                        newEquity.custom_payments[i] || { date: '', amount: 0 }
                      )
                      setNewEquity({
                        ...newEquity,
                        custom_payment_count: count,
                        custom_payments: newPayments
                      })
                    }}
                    placeholder="Enter number of payments"
                  />
                </FormField>

                {newEquity.custom_payment_count > 0 && (
                  <div className="md:col-span-2 space-y-4">
                    <h4 className="font-medium text-gray-900">Payment Schedule Details</h4>
                    {newEquity.custom_payments.map((payment, index) => (
                      <div key={index} className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                        <FormField label={`Payment ${index + 1} - Date`} required>
                          <Input
                            type="date"
                            value={payment.date}
                            onChange={(e) => {
                              const updatedPayments = [...newEquity.custom_payments]
                              updatedPayments[index] = { ...updatedPayments[index], date: e.target.value }
                              setNewEquity({ ...newEquity, custom_payments: updatedPayments })
                            }}
                          />
                        </FormField>
                        <FormField label={`Payment ${index + 1} - Amount`} required>
                          <Input
                            type="number"
                            value={payment.amount || ''}
                            onChange={(e) => {
                              const updatedPayments = [...newEquity.custom_payments]
                              updatedPayments[index] = { ...updatedPayments[index], amount: parseFloat(e.target.value) || 0 }
                              setNewEquity({ ...newEquity, custom_payments: updatedPayments })
                            }}
                            placeholder="Amount"
                          />
                        </FormField>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {newEquity.payment_schedule !== 'custom' && (
              <FormField
                label={`${newEquity.payment_schedule === 'yearly' ? 'Yearly' : 'Monthly'} Cashflow`}
                helperText={`${newEquity.payment_schedule === 'yearly' ? 'Annual' : 'Monthly'} payment amount based on IRR and investment period minus grace period`}
              >
              <Input
                type="text"
                value={(() => {
                  if (!newEquity.amount || !newEquity.investment_date || !newEquity.maturity_date || !newEquity.expected_return) {
                    return 'Enter amount, dates, and IRR to calculate'
                  }
                  const principal = newEquity.amount
                  const annualRate = newEquity.expected_return / 100
                  const gracePeriodYears = newEquity.grace_period / 365
                  const startDate = new Date(newEquity.investment_date)
                  const maturityDate = new Date(newEquity.maturity_date)
                  const totalYears = (maturityDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
                  if (totalYears <= 0) return 'Invalid date range'
                  const repaymentYears = Math.max(0.1, totalYears - gracePeriodYears)
                  if (annualRate === 0) {
                    const payment = newEquity.payment_schedule === 'yearly'
                      ? principal / repaymentYears
                      : principal / (repaymentYears * 12)
                    return `${payment.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  }
                  let payment
                  if (newEquity.payment_schedule === 'yearly') {
                    payment = (principal * annualRate * Math.pow(1 + annualRate, repaymentYears)) /
                             (Math.pow(1 + annualRate, repaymentYears) - 1)
                  } else {
                    const monthlyRate = annualRate / 12
                    const totalMonths = repaymentYears * 12
                    payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
                             (Math.pow(1 + monthlyRate, totalMonths) - 1)
                  }
                  return `${payment.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                })()}
                readOnly
                className="bg-gray-50"
              />
            </FormField>
            )}
            <FormField label="Money Multiple" helperText="Total return multiple">
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
                {(() => {
                  if (!newEquity.amount || !newEquity.investment_date || !newEquity.maturity_date || !newEquity.expected_return) {
                    return 'Enter amount, dates, and IRR to calculate'
                  }
                  const principal = newEquity.amount
                  const annualRate = newEquity.expected_return / 100
                  const startDate = new Date(newEquity.investment_date)
                  const maturityDate = new Date(newEquity.maturity_date)
                  const years = (maturityDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
                  if (years <= 0) return 'Invalid date range'
                  const totalReturn = principal * Math.pow(1 + annualRate, years)
                  const moneyMultiple = totalReturn / principal
                  return `${moneyMultiple.toFixed(2)}x (${(moneyMultiple * 100).toFixed(0)}%)`
                })()}
              </div>
            </FormField>
            <FormField label="Investment Date" required>
              <Input
                type="date"
                value={newEquity.investment_date}
                onChange={(e) => setNewEquity({ ...newEquity, investment_date: e.target.value })}
              />
            </FormField>
            <FormField label="Exit Date">
              <Input
                type="date"
                value={newEquity.maturity_date}
                onChange={(e) => setNewEquity({ ...newEquity, maturity_date: e.target.value })}
              />
            </FormField>
            <FormField label="Usage Expiration Date">
              <Input
                type="date"
                value={newEquity.usage_expiration_date}
                onChange={(e) => setNewEquity({ ...newEquity, usage_expiration_date: e.target.value })}
              />
            </FormField>
            <FormField label="Grace Period (months)">
              <Input
                type="number"
                value={newEquity.grace_period}
                onChange={(e) => setNewEquity({ ...newEquity, grace_period: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Mortgages">
                <Textarea
                  value={newEquity.terms}
                  onChange={(e) => setNewEquity({ ...newEquity, terms: e.target.value })}
                  rows={3}
                  placeholder="Terms and conditions of the investment..."
                />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Notes">
                <Textarea
                  value={newEquity.notes}
                  onChange={(e) => setNewEquity({ ...newEquity, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes about this investment..."
                />
              </FormField>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEquityForm(false)}>Cancel</Button>
          <Button variant="success" onClick={addEquity}>
            Add Investment
          </Button>
        </Modal.Footer>
      </Modal>

    </div>
  )
}

export default BanksManagement