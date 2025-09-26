import React, { useState, useEffect } from 'react'
import { supabase, Bank, BankCredit, Project } from '../lib/supabase'
import { Building2, Plus, DollarSign, Calendar, Phone, Mail, TrendingUp, AlertTriangle, CheckCircle, CreditCard as Edit2, Trash2, Eye, X, CreditCard, Percent, Clock } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'

interface BankWithCredits extends Bank {
  credits: BankCredit[]
  total_credits: number
  active_credits: number
  credit_utilization: number
}

const BanksManagement: React.FC = () => {
  const [banks, setBanks] = useState<BankWithCredits[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedBank, setSelectedBank] = useState<BankWithCredits | null>(null)
  const [showBankForm, setShowBankForm] = useState(false)
  const [showCreditForm, setShowCreditForm] = useState(false)
  const [editingBank, setEditingBank] = useState<Bank | null>(null)
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
    project_id: '',
    credit_type: 'construction_loan' as const,
    amount: 0,
    interest_rate: 0,
    start_date: '',
    maturity_date: '',
    outstanding_balance: 0,
    monthly_payment: 0,
    purpose: '',
    usage_expiration_date: '',
    grace_period: 0,
    purpose: '',
    repayment_type: 'monthly',
    repayment_type: 'monthly' as const,
    const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

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

      // Fetch bank credits
      const { data: creditsData, error: creditsError } = await supabase
        .from('bank_credits')
        .select(`
          *,
          projects(name)
        `)
        .order('start_date', { ascending: false })

      if (creditsError) throw creditsError

      // Process banks with credits
      const banksWithCredits = (banksData || []).map(bank => {
        const bankCredits = (creditsData || []).filter(credit => credit.bank_id === bank.id)
        const total_credits = bankCredits.length
        const active_credits = bankCredits.filter(credit => credit.status === 'active').length
        const credit_utilization = bank.total_credit_limit > 0 
          ? (bank.outstanding_debt / bank.total_credit_limit) * 100 
          : 0

        return {
          ...bank,
          credits: bankCredits,
          total_credits,
          active_credits,
          credit_utilization
        }
      })

      setBanks(banksWithCredits)
      setProjects(projectsData || [])
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
      fetchData()
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
      fetchData()
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
      fetchData()
    } catch (error) {
      console.error('Error deleting bank:', error)
      alert('Error deleting bank.')
    }
  }

  const addCredit = async () => {
    if (!newCredit.bank_id || !newCredit.amount || !newCredit.start_date) {
      alert('Please fill in required fields')
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
      const { error } = await supabase
        .from('bank_credits')
        .insert({
          ...newCredit,
          outstanding_balance: newCredit.outstanding_balance || newCredit.amount,
          monthly_payment: calculateRateAmount()
        })

      if (error) throw error

      resetCreditForm()
      fetchData()
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
      project_id: '',
      credit_type: 'construction_loan',
      amount: 0,
      interest_rate: 0,
      start_date: '',
      maturity_date: '',
      outstanding_balance: 0,
      monthly_payment: 0,
      purpose: '',
      repayment_type: 'monthly'
    })
    setShowCreditForm(false)
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
    return <div className="text-center py-12">Loading banks...</div>
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Banking Relationships</h1>
          <p className="text-gray-600 mt-2">Manage bank partnerships and credit facilities</p>
        </div>
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
      </div>

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
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">€{(bank.total_credit_limit / 1000000).toFixed(1)}M</p>
                <p className="text-xs text-gray-600">Credit Limit</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">€{(bank.outstanding_debt / 1000000).toFixed(1)}M</p>
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
                <h3 className="text-xl font-semibold text-gray-900">Add New Credit Facility</h3>
                <button
                  onClick={resetCreditForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 max-h-[calc(90vh-180px)] overflow-y-auto">
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
                    <option value="construction_loan">Construction Loan</option>
                    <option value="term_loan">Term Loan</option>
                    <option value="line_of_credit">Line of Credit</option>
                    <option value="bridge_loan">Bridge Loan</option>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Credit Repayment Type</label>
                  <select
                    value={newCredit.repayment_type}
                    onChange={(e) => setNewCredit({ ...newCredit, repayment_type: e.target.value as 'monthly' | 'yearly' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rate Amount (€) - {newCredit.repayment_type === 'yearly' ? 'Annual' : 'Monthly'} Payment
                  </label>
                  <input
                    type="text"
                    value={(() => {
                      if (!newCredit.amount || !newCredit.start_date) return 'Enter amount and dates to calculate'
                      
                      const principal = newCredit.amount
                      const annualRate = newCredit.interest_rate / 100
                      const gracePeriodYears = newCredit.grace_period / 365
                      
                      let maturityYears = 10 // default
                      if (newCredit.maturity_date && newCredit.start_date) {
                        const startDate = new Date(newCredit.start_date)
                        const maturityDate = new Date(newCredit.maturity_date)
                        maturityYears = (maturityDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
                      }
                      
                      const repaymentYears = Math.max(0.1, maturityYears - gracePeriodYears)
                      
                      if (annualRate === 0) {
                        const payment = newCredit.repayment_type === 'yearly' 
                          ? principal / repaymentYears
                          : principal / (repaymentYears * 12)
                        return `€${payment.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                      }
                      
                      let payment
                      if (newCredit.repayment_type === 'yearly') {
                        payment = (principal * annualRate * Math.pow(1 + annualRate, repaymentYears)) / 
                                 (Math.pow(1 + annualRate, repaymentYears) - 1)
                      } else {
                        const monthlyRate = annualRate / 12
                        const totalMonths = repaymentYears * 12
                        payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / 
                                 (Math.pow(1 + monthlyRate, totalMonths) - 1)
                      }
                      
                      return `€${payment.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    })()}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Calculated based on amount, interest rate, maturity period minus grace period
                  </p>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Grace Period (days)</label>
                  <input
                    type="number"
                    value={newCredit.grace_period}
                    onChange={(e) => setNewCredit({ ...newCredit, grace_period: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Credit Seniority</label>
                  <select
                    value={newCredit.credit_seniority}
                    onChange={(e) => setNewCredit({ ...newCredit, credit_seniority: e.target.value as 'junior' | 'senior' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="senior">Senior</option>
                    <option value="junior">Junior</option>
                  </select>
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
                      <span className="font-medium text-blue-900">€{selectedBank.total_credit_limit.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Outstanding:</span>
                      <span className="font-medium text-blue-900">€{selectedBank.outstanding_debt.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Available:</span>
                      <span className="font-medium text-blue-900">€{selectedBank.available_funds.toLocaleString()}</span>
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
                          ? `${differenceInDays(new Date(), new Date(selectedBank.relationship_start)) / 365 | 0}y`
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
                              {credit.projects && (
                                <p className="text-xs text-gray-500">Project: {credit.projects.name}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">${credit.amount.toLocaleString()}</p>
                              <p className="text-sm text-gray-600">{credit.interest_rate}% APR</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-gray-500">Outstanding Balance</p>
                              <p className="text-sm font-medium text-red-600">${credit.outstanding_balance.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Monthly Payment</p>
                              <p className="text-sm font-medium text-gray-900">${credit.monthly_payment.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Maturity Date</p>
                              <p className={`text-sm font-medium ${isMaturing ? 'text-orange-600' : 'text-gray-900'}`}>
                                {credit.maturity_date ? format(new Date(credit.maturity_date), 'MMM dd, yyyy') : 'N/A'}
                              </p>
                            </div>
                          </div>

                          {/* Payment Progress */}
                          <div>
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