import React, { useState, useEffect } from 'react'
import { supabase, Investor, ProjectInvestment, Project } from '../lib/supabase'
import { Users, Plus, DollarSign, Calendar, Phone, Mail, TrendingUp, Building2, Target, CreditCard as Edit2, Trash2, Eye, X, PieChart, Briefcase, User, Building, Send, Edit } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { InvestorWirePaymentModal } from './Funding/forms/InvestorWirePaymentModal'
import { EditInvestmentModal } from './Funding/forms/EditInvestmentModal'

interface InvestorWithInvestments extends Investor {
  investments: ProjectInvestment[]
  total_committed: number
  active_investments: number
  portfolio_performance: number
  projects: Project[]
}

const InvestorsManagement: React.FC = () => {
  const [investors, setInvestors] = useState<InvestorWithInvestments[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedInvestor, setSelectedInvestor] = useState<InvestorWithInvestments | null>(null)
  const [showInvestorForm, setShowInvestorForm] = useState(false)
  const [showInvestmentForm, setShowInvestmentForm] = useState(false)
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null)
  const [newInvestor, setNewInvestor] = useState({
    name: '',
    type: 'individual' as const,
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    total_invested: 0,
    expected_return: 0,
    investment_start: '',
    risk_profile: 'moderate' as const,
    preferred_sectors: '',
    notes: ''
  })
  const [newInvestment, setNewInvestment] = useState({
    investor_id: '',
    project_id: '',
    investment_type: 'equity' as const,
    amount: 0,
    percentage_stake: 0,
    expected_return: 0,
    investment_date: '',
    maturity_date: '',
    payment_schedule: 'yearly' as 'monthly' | 'yearly',
    terms: '',
    mortgages_insurance: 0,
    notes: '',
    usage_expiration_date: '',
    grace_period: 0
  })
  const [loading, setLoading] = useState(true)
  const [showWirePaymentModal, setShowWirePaymentModal] = useState(false)
  const [selectedInvestment, setSelectedInvestment] = useState<ProjectInvestment | null>(null)
  const [wirePayment, setWirePayment] = useState({
    amount: 0,
    paymentDate: '',
    notes: ''
  })
  const [showEditInvestmentModal, setShowEditInvestmentModal] = useState(false)
  const [editingInvestment, setEditingInvestment] = useState<ProjectInvestment | null>(null)
  const [investmentPayments, setInvestmentPayments] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch investors
      const { data: investorsData, error: investorsError } = await supabase
        .from('investors')
        .select('*')
        .order('name')

      if (investorsError) throw investorsError

      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('name')

      if (projectsError) throw projectsError

      // Fetch project investments
      const { data: investmentsData, error: investmentsError } = await supabase
        .from('project_investments')
        .select(`
          *,
          projects(*)
        `)
        .order('investment_date', { ascending: false })

      if (investmentsError) throw investmentsError

      // Fetch all investor payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('investor_payments')
        .select('project_investment_id, amount')

      if (paymentsError) throw paymentsError

      // Calculate total paid per investment
      const paymentTotals: Record<string, number> = {}
      paymentsData?.forEach(payment => {
        if (!paymentTotals[payment.project_investment_id]) {
          paymentTotals[payment.project_investment_id] = 0
        }
        paymentTotals[payment.project_investment_id] += Number(payment.amount)
      })
      setInvestmentPayments(paymentTotals)

      // Process investors with investments
      const investorsWithInvestments = (investorsData || []).map(investor => {
        const investorInvestments = (investmentsData || []).filter(inv => inv.investor_id === investor.id)
        const total_committed = investorInvestments.reduce((sum, inv) => sum + inv.amount, 0)
        const active_investments = investorInvestments.filter(inv => inv.status === 'active').length
        const portfolio_performance = investorInvestments.length > 0
          ? investorInvestments.reduce((sum, inv) => sum + inv.expected_return, 0) / investorInvestments.length
          : 0

        const uniqueProjects = investorInvestments
          .filter(inv => inv.projects)
          .map(inv => inv.projects)
          .filter((project, index, self) => 
            index === self.findIndex(p => p.id === project.id)
          )

        return {
          ...investor,
          investments: investorInvestments,
          total_committed,
          active_investments,
          portfolio_performance,
          projects: uniqueProjects
        }
      })

      setInvestors(investorsWithInvestments)
      setProjects(projectsData || [])
    } catch (error) {
      console.error('Error fetching investors data:', error)
    } finally {
      setLoading(false)
    }
  }

  const addInvestor = async () => {
    if (!newInvestor.name.trim()) {
      alert('Please enter investor name')
      return
    }

    try {
      const { error } = await supabase
        .from('investors')
        .insert(newInvestor)

      if (error) throw error

      resetInvestorForm()
      await fetchData()
    } catch (error) {
      console.error('Error adding investor:', error)
      alert('Error adding investor. Please try again.')
    }
  }

  const updateInvestor = async () => {
    if (!editingInvestor || !newInvestor.name.trim()) return

    try {
      const { error } = await supabase
        .from('investors')
        .update(newInvestor)
        .eq('id', editingInvestor.id)

      if (error) throw error

      resetInvestorForm()
      await fetchData()
    } catch (error) {
      console.error('Error updating investor:', error)
      alert('Error updating investor.')
    }
  }

  const deleteInvestor = async (investorId: string) => {
    if (!confirm('Are you sure you want to delete this investor? This will also delete all associated investments.')) return

    try {
      const { error } = await supabase
        .from('investors')
        .delete()
        .eq('id', investorId)

      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('Error deleting investor:', error)
      alert('Error deleting investor.')
    }
  }

  const addInvestment = async () => {
    if (!newInvestment.investor_id || !newInvestment.project_id || !newInvestment.amount) {
      alert('Please fill in required fields')
      return
    }

    try {
      // Extract investment type and seniority from the combined value
      const [investmentType, seniority] = newInvestment.investment_type.split('_')
      
      const { error } = await supabase
        .from('project_investments')
        .insert({
          ...newInvestment,
          investment_type: investmentType,
          credit_seniority: seniority
        })

      if (error) throw error

      resetInvestmentForm()
      await fetchData()
    } catch (error) {
      console.error('Error adding investment:', error)
      alert('Error adding investment.')
    }
  }

  const resetInvestorForm = () => {
    setNewInvestor({
      name: '',
      type: 'individual',
      contact_person: '',
      contact_email: '',
      contact_phone: '',
      total_invested: 0,
      expected_return: 0,
      investment_start: '',
      risk_profile: 'moderate',
      preferred_sectors: '',
      notes: ''
    })
    setEditingInvestor(null)
    setShowInvestorForm(false)
  }

  const resetInvestmentForm = () => {
    setNewInvestment({
      investor_id: '',
      project_id: '',
      investment_type: 'equity_senior',
      amount: 0,
      percentage_stake: 0,
      expected_return: 0,
      investment_date: '',
      maturity_date: '',
      terms: '',
      mortgages_insurance: 0,
      notes: '',
      usage_expiration_date: '',
      grace_period: 0
    })
    setShowInvestmentForm(false)
  }

  const handleOpenWirePayment = (investment: ProjectInvestment) => {
    setSelectedInvestment(investment)
    setWirePayment({ amount: 0, paymentDate: '', notes: '' })
    setShowWirePaymentModal(true)
  }

  const handleCloseWirePayment = () => {
    setShowWirePaymentModal(false)
    setSelectedInvestment(null)
    setWirePayment({ amount: 0, paymentDate: '', notes: '' })
  }

  const handleRecordPayment = async () => {
    if (!selectedInvestment || !selectedInvestor || wirePayment.amount <= 0) {
      alert('Please enter a valid payment amount')
      return
    }

    try {
      const { error: paymentError } = await supabase
        .from('investor_payments')
        .insert({
          project_investment_id: selectedInvestment.id,
          investor_id: selectedInvestor.id,
          amount: wirePayment.amount,
          payment_date: wirePayment.paymentDate || null,
          notes: wirePayment.notes || null
        })

      if (paymentError) throw paymentError

      handleCloseWirePayment()
      await fetchData()
      alert('Payment recorded successfully')
    } catch (error) {
      console.error('Error recording payment:', error)
      alert('Failed to record payment. Please try again.')
    }
  }

  const handleOpenEditInvestment = (investment: ProjectInvestment) => {
    setEditingInvestment(investment)
    setShowEditInvestmentModal(true)
  }

  const handleCloseEditInvestment = () => {
    setShowEditInvestmentModal(false)
    setEditingInvestment(null)
  }

  const handleSaveInvestment = async (updatedInvestment: ProjectInvestment) => {
    try {
      const { error } = await supabase
        .from('project_investments')
        .update({
          investment_type: updatedInvestment.investment_type,
          amount: updatedInvestment.amount,
          percentage_stake: updatedInvestment.percentage_stake,
          expected_return: updatedInvestment.expected_return,
          investment_date: updatedInvestment.investment_date,
          maturity_date: updatedInvestment.maturity_date,
          usage_expiration_date: updatedInvestment.usage_expiration_date,
          grace_period: updatedInvestment.grace_period,
          mortgages_insurance: updatedInvestment.mortgages_insurance,
          credit_seniority: updatedInvestment.credit_seniority,
          status: updatedInvestment.status,
          terms: updatedInvestment.terms,
          notes: updatedInvestment.notes
        })
        .eq('id', updatedInvestment.id)

      if (error) throw error

      handleCloseEditInvestment()
      await fetchData()
      alert('Investment updated successfully')
    } catch (error) {
      console.error('Error updating investment:', error)
      alert('Failed to update investment. Please try again.')
    }
  }

  const handleEditInvestor = (investor: Investor) => {
    setEditingInvestor(investor)
    setNewInvestor({
      name: investor.name,
      type: investor.type,
      contact_person: investor.contact_person || '',
      contact_email: investor.contact_email || '',
      contact_phone: investor.contact_phone || '',
      total_invested: investor.total_invested,
      expected_return: investor.expected_return,
      investment_start: investor.investment_start || '',
      risk_profile: investor.risk_profile,
      preferred_sectors: investor.preferred_sectors || '',
      notes: investor.notes || ''
    })
    setShowInvestorForm(true)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'individual': return <User className="w-4 h-4" />
      case 'institutional': return <Building className="w-4 h-4" />
      case 'fund': return <Briefcase className="w-4 h-4" />
      case 'government': return <Building2 className="w-4 h-4" />
      default: return <Users className="w-4 h-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'individual': return 'bg-blue-100 text-blue-800'
      case 'institutional': return 'bg-purple-100 text-purple-800'
      case 'fund': return 'bg-green-100 text-green-800'
      case 'government': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRiskProfileColor = (profile: string) => {
    switch (profile) {
      case 'conservative': return 'bg-green-100 text-green-800'
      case 'moderate': return 'bg-yellow-100 text-yellow-800'
      case 'aggressive': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading investors...</div>
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Investment Partners</h1>
          <p className="text-gray-600 mt-2">Manage investor relationships and investment portfolios</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowInvestorForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Investor
          </button>
          <button
            onClick={() => setShowInvestmentForm(true)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Investment
          </button>
        </div>
      </div>

      {/* Investors Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {investors.map((investor) => (
          <div
            key={investor.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer"
            onClick={() => setSelectedInvestor(investor)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{investor.name}</h3>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(investor.type)}`}>
                    {getTypeIcon(investor.type)}
                    <span className="ml-1">{investor.type.toUpperCase()}</span>
                  </span>
                </div>
                <p className="text-sm text-gray-600">{investor.contact_person}</p>
                <p className="text-xs text-gray-500">{investor.contact_email}</p>
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedInvestor(investor)
                  }}
                  className="p-1 text-gray-400 hover:text-blue-600"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEditInvestor(investor)
                  }}
                  className="p-1 text-gray-400 hover:text-green-600"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteInvestor(investor.id)
                  }}
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Investment Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">€{(investor.total_committed / 1000000).toFixed(1)}M</p>
                <p className="text-xs text-gray-600">Committed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{investor.expected_return.toFixed(1)}%</p>
                <p className="text-xs text-gray-600">Expected ROI</p>
              </div>
            </div>

            {/* Risk Profile */}
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Risk Profile</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRiskProfileColor(investor.risk_profile)}`}>
                  {investor.risk_profile.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Additional Info */}
            <div className="border-t pt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Active Investments</span>
                <span className="text-sm font-medium text-gray-900">{investor.active_investments}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Portfolio Projects</span>
                <span className="text-sm font-medium text-gray-900">{investor.projects.length}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Investor Form Modal */}
      {showInvestorForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingInvestor ? 'Edit Investor' : 'Add New Investor'}
                </h3>
                <button
                  onClick={resetInvestorForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Investor Name *</label>
                  <input
                    type="text"
                    value={newInvestor.name}
                    onChange={(e) => setNewInvestor({ ...newInvestor, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Investor Type</label>
                  <select
                    value={newInvestor.type}
                    onChange={(e) => setNewInvestor({ ...newInvestor, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="individual">Individual</option>
                    <option value="institutional">Institutional</option>
                    <option value="fund">Investment Fund</option>
                    <option value="government">Government</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Risk Profile</label>
                  <select
                    value={newInvestor.risk_profile}
                    onChange={(e) => setNewInvestor({ ...newInvestor, risk_profile: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="conservative">Conservative</option>
                    <option value="moderate">Moderate</option>
                    <option value="aggressive">Aggressive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person</label>
                  <input
                    type="text"
                    value={newInvestor.contact_person}
                    onChange={(e) => setNewInvestor({ ...newInvestor, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
                  <input
                    type="email"
                    value={newInvestor.contact_email}
                    onChange={(e) => setNewInvestor({ ...newInvestor, contact_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Phone</label>
                  <input
                    type="tel"
                    value={newInvestor.contact_phone}
                    onChange={(e) => setNewInvestor({ ...newInvestor, contact_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Investment Start Date</label>
                  <input
                    type="date"
                    value={newInvestor.investment_start}
                    onChange={(e) => setNewInvestor({ ...newInvestor, investment_start: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Invested (€)</label>
                  <input
                    type="number"
                    value={newInvestor.total_invested}
                    onChange={(e) => setNewInvestor({ ...newInvestor, total_invested: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">IRR</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newInvestor.expected_return}
                    onChange={(e) => setNewInvestor({ ...newInvestor, expected_return: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Sectors</label>
                  <input
                    type="text"
                    value={newInvestor.preferred_sectors}
                    onChange={(e) => setNewInvestor({ ...newInvestor, preferred_sectors: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Residential, Commercial, Mixed-use"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={newInvestor.notes}
                    onChange={(e) => setNewInvestor({ ...newInvestor, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={resetInvestorForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={editingInvestor ? updateInvestor : addInvestor}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  {editingInvestor ? 'Update' : 'Add'} Investor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Investment Form Modal */}
      {showInvestmentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Add New Investment</h3>
                <button
                  onClick={resetInvestmentForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Investor *</label>
                  <select
                    value={newInvestment.investor_id}
                    onChange={(e) => setNewInvestment({ ...newInvestment, investor_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select investor</option>
                    {investors.map(investor => (
                      <option key={investor.id} value={investor.id}>
                        {investor.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project *</label>
                  <select
                    value={newInvestment.project_id}
                    onChange={(e) => setNewInvestment({ ...newInvestment, project_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select project</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Investment Type</label>
                  <select
                    value={newInvestment.investment_type}
                    onChange={(e) => setNewInvestment({ ...newInvestment, investment_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="equity_senior">Equity</option>
                    <option value="loan_senior">Loan</option>
                    <option value="grant_senior">Grant</option>
                    <option value="bond_senior">Bond</option>
                    <option value="bridge">Bridge</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount (€) *</label>
                  <input
                    type="number"
                    value={newInvestment.amount}
                    onChange={(e) => setNewInvestment({ ...newInvestment, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Percentage Stake (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newInvestment.percentage_stake}
                    onChange={(e) => setNewInvestment({ ...newInvestment, percentage_stake: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">IRR (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newInvestment.expected_return}
                    onChange={(e) => setNewInvestment({ ...newInvestment, expected_return: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Schedule</label>
                  <select
                    value={newInvestment.payment_schedule}
                    onChange={(e) => setNewInvestment({ ...newInvestment, payment_schedule: e.target.value as 'monthly' | 'yearly' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="yearly">Yearly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {newInvestment.payment_schedule === 'yearly' ? 'Yearly' : 'Monthly'} Cashflow (€)
                  </label>
                  <input
                    type="text"
                    value={(() => {
                      if (!newInvestment.amount || !newInvestment.investment_date || !newInvestment.maturity_date || !newInvestment.expected_return) {
                        return 'Enter amount, dates, and IRR to calculate'
                      }
                      
                      const principal = newInvestment.amount
                      const annualRate = newInvestment.expected_return / 100
                      const gracePeriodYears = newInvestment.grace_period / 365
                      const startDate = new Date(newInvestment.investment_date)
                      const maturityDate = new Date(newInvestment.maturity_date)
                      const totalYears = (maturityDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
                      
                      if (totalYears <= 0) return 'Invalid date range'
                      
                      const repaymentYears = Math.max(0.1, totalYears - gracePeriodYears)
                      
                      if (annualRate === 0) {
                        const payment = newInvestment.payment_schedule === 'yearly' 
                          ? principal / repaymentYears
                          : principal / (repaymentYears * 12)
                        return `€${payment.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                      }
                      
                      let payment
                      if (newInvestment.payment_schedule === 'yearly') {
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
                    {newInvestment.payment_schedule === 'yearly' ? 'Annual' : 'Monthly'} payment amount based on IRR and investment period minus grace period
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Money Multiple</label>
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
                    {(() => {
                      if (!newInvestment.amount || !newInvestment.investment_date || !newInvestment.maturity_date || !newInvestment.expected_return) {
                        return 'Enter amount, dates, and IRR to calculate'
                      }
                      
                      const principal = newInvestment.amount
                      const annualRate = newInvestment.expected_return / 100
                      const startDate = new Date(newInvestment.investment_date)
                      const maturityDate = new Date(newInvestment.maturity_date)
                      const years = (maturityDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
                      
                      if (years <= 0) return 'Invalid date range'
                      
                      // Calculate total return using compound interest
                      const totalReturn = principal * Math.pow(1 + annualRate, years)
                      const moneyMultiple = totalReturn / principal
                      
                      return `${moneyMultiple.toFixed(2)}x (${(moneyMultiple * 100).toFixed(0)}%)`
                    })()}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Total return multiple
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Investment Date *</label>
                  <input
                    type="date"
                    value={newInvestment.investment_date}
                    onChange={(e) => setNewInvestment({ ...newInvestment, investment_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Maturity Date</label>
                  <input
                    type="date"
                    value={newInvestment.maturity_date}
                    onChange={(e) => setNewInvestment({ ...newInvestment, maturity_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Usage Expiration Date</label>
                  <input
                    type="date"
                    value={newInvestment.usage_expiration_date}
                    onChange={(e) => setNewInvestment({ ...newInvestment, usage_expiration_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Grace Period (months)</label>
                  <input
                    type="number"
                    value={newInvestment.grace_period}
                    onChange={(e) => setNewInvestment({ ...newInvestment, grace_period: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mortgages (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newInvestment.mortgages_insurance}
                    onChange={(e) => setNewInvestment({ ...newInvestment, mortgages_insurance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Amount of mortgages/insurance"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mortages</label>
                  <textarea
                    value={newInvestment.terms}
                    onChange={(e) => setNewInvestment({ ...newInvestment, terms: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Terms and conditions of the investment..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={newInvestment.notes}
                    onChange={(e) => setNewInvestment({ ...newInvestment, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Additional notes about this investment..."
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end space-x-3">
                <button
                  onClick={resetInvestmentForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={addInvestment}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  Add Investment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Investor Details Modal */}
      {selectedInvestor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-2xl font-semibold text-gray-900">{selectedInvestor.name}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(selectedInvestor.type)}`}>
                      {getTypeIcon(selectedInvestor.type)}
                      <span className="ml-1">{selectedInvestor.type.toUpperCase()}</span>
                    </span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRiskProfileColor(selectedInvestor.risk_profile)}`}>
                      {selectedInvestor.risk_profile.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-gray-600 mt-1">{selectedInvestor.contact_person}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 text-gray-400 mr-1" />
                      <span className="text-sm text-gray-600">{selectedInvestor.contact_email}</span>
                    </div>
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 text-gray-400 mr-1" />
                      <span className="text-sm text-gray-600">{selectedInvestor.contact_phone}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedInvestor(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Investment Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-3">Investment Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-green-700">Total Committed:</span>
                      <span className="font-medium text-green-900">€{selectedInvestor.total_committed.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Total Paid:</span>
                      <span className="font-medium text-green-600">
                        €{selectedInvestor.investments.reduce((sum, inv) => sum + (investmentPayments[inv.id] || 0), 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Active Investments:</span>
                      <span className="font-medium text-green-900">{selectedInvestor.active_investments}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Portfolio Projects:</span>
                      <span className="font-medium text-green-900">{selectedInvestor.projects.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Expected ROI:</span>
                      <span className="font-medium text-green-900">{selectedInvestor.expected_return}%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-3">Relationship Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Since:</span>
                      <span className="font-medium text-blue-900">
                        {selectedInvestor.investment_start 
                          ? format(new Date(selectedInvestor.investment_start), 'MMM yyyy')
                          : 'N/A'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Risk Profile:</span>
                      <span className="font-medium text-blue-900">{selectedInvestor.risk_profile}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Sectors:</span>
                      <span className="font-medium text-blue-900 text-right text-xs">
                        {selectedInvestor.preferred_sectors || 'Any'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Relationship:</span>
                      <span className="font-medium text-blue-900">
                        {selectedInvestor.investment_start 
                          ? `${Math.floor(differenceInDays(new Date(), new Date(selectedInvestor.investment_start)) / 365)}y`
                          : 'New'
                        }
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-purple-900 mb-3">Performance</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-purple-700">Portfolio ROI:</span>
                      <span className="font-medium text-purple-900">{selectedInvestor.portfolio_performance.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">Avg. Investment:</span>
                      <span className="font-medium text-purple-900">
                        €{selectedInvestor.investments.length > 0 
                          ? (selectedInvestor.total_committed / selectedInvestor.investments.length).toLocaleString()
                          : '0'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">Diversification:</span>
                      <span className="font-medium text-purple-900">
                        {selectedInvestor.projects.length} project{selectedInvestor.projects.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Investment Portfolio */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-4">Investment Portfolio</h4>
                {selectedInvestor.investments.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <PieChart className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No investments with this investor yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedInvestor.investments.map((investment) => {
                      const isMaturing = investment.maturity_date && differenceInDays(new Date(investment.maturity_date), new Date()) <= 90
                      
                      return (
                        <div key={investment.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <p className="font-medium text-gray-900">
                                  {investment.projects?.name || 'Unknown Project'}
                                </p>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  investment.investment_type === 'equity' ? 'bg-green-100 text-green-800' :
                                  investment.investment_type === 'loan' ? 'bg-blue-100 text-blue-800' :
                                  'bg-purple-100 text-purple-800'
                                }`}>
                                  {investment.investment_type.toUpperCase()}
                                </span>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  investment.credit_seniority === 'senior' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                                }`}>
                                  {investment.credit_seniority?.toUpperCase() || 'SENIOR'}
                                </span>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  investment.status === 'active' ? 'bg-green-100 text-green-800' :
                                  investment.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {investment.status.toUpperCase()}
                                </span>
                                {isMaturing && (
                                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                                    MATURING SOON
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{investment.terms}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">€{investment.amount.toLocaleString()}</p>
                              <p className="text-sm text-gray-600">{investment.expected_return}% IRR</p>
                              {investment.mortgages_insurance > 0 && (
                                <p className="text-xs text-orange-600">+€{investment.mortgages_insurance.toLocaleString()} mortgages</p>
                              )}
                              <p className="text-xs text-blue-600">
                                {((1 + investment.expected_return / 100) * 100).toFixed(0)}% money multiple
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-gray-500">Investment Date</p>
                              <p className="text-sm font-medium text-gray-900">
                                {format(new Date(investment.investment_date), 'MMM dd, yyyy')}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Total Paid</p>
                              <p className="text-sm font-medium text-green-600">€{(investmentPayments[investment.id] || 0).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Ownership Stake</p>
                              <p className="text-sm font-medium text-gray-900">{investment.percentage_stake}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Credit Seniority</p>
                              <p className={`text-sm font-medium ${
                                investment.credit_seniority === 'senior' ? 'text-blue-600' : 'text-orange-600'
                              }`}>
                                {investment.credit_seniority?.charAt(0).toUpperCase() + investment.credit_seniority?.slice(1) || 'Senior'}
                              </p>
                            </div>
                          </div>
                          
                          {/* Additional Investment Details */}
                          {(investment.mortgages_insurance > 0 || investment.notes) && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              {investment.mortgages_insurance > 0 && (
                                <div className="mb-2">
                                  <p className="text-xs text-gray-500">Mortgages (Insurance)</p>
                                  <p className="text-sm font-medium text-orange-600">€{investment.mortgages_insurance.toLocaleString()}</p>
                                </div>
                              )}
                              {investment.notes && (
                                <div>
                                  <p className="text-xs text-gray-500">Notes</p>
                                  <p className="text-sm text-gray-700">{investment.notes}</p>
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                            <div>
                              <p className="text-xs text-gray-500">Maturity Date</p>
                              <p className={`text-sm font-medium ${isMaturing ? 'text-orange-600' : 'text-gray-900'}`}>
                                {investment.maturity_date ? format(new Date(investment.maturity_date), 'MMM dd, yyyy') : 'N/A'}
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-3 mt-3 border-t border-gray-200 grid grid-cols-2 gap-3">
                            <button
                              onClick={() => handleOpenEditInvestment(investment)}
                              className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleOpenWirePayment(investment)}
                              className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                            >
                              <Send className="w-4 h-4 mr-2" />
                              Wire Payment
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedInvestor.notes && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Notes</h4>
                  <p className="text-gray-700">{selectedInvestor.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wire Payment Modal */}
      <InvestorWirePaymentModal
        visible={showWirePaymentModal}
        onClose={handleCloseWirePayment}
        investment={selectedInvestment}
        investorName={selectedInvestor?.name || ''}
        amount={wirePayment.amount}
        paymentDate={wirePayment.paymentDate}
        notes={wirePayment.notes}
        onAmountChange={(amount) => setWirePayment({ ...wirePayment, amount })}
        onDateChange={(date) => setWirePayment({ ...wirePayment, paymentDate: date })}
        onNotesChange={(notes) => setWirePayment({ ...wirePayment, notes })}
        onSubmit={handleRecordPayment}
      />

      {/* Edit Investment Modal */}
      <EditInvestmentModal
        visible={showEditInvestmentModal}
        onClose={handleCloseEditInvestment}
        investment={editingInvestment}
        onSubmit={handleSaveInvestment}
      />
    </div>
  )
}

export default InvestorsManagement