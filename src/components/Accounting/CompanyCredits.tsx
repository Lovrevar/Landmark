import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { CreditCard, Plus, Calendar, Percent, DollarSign, Clock, Edit, Trash2, X } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'

interface Company {
  id: string
  name: string
  oib: string
}

interface Project {
  id: string
  name: string
}

interface Credit {
  id: string
  company_id: string
  project_id: string | null
  credit_name: string
  start_date: string
  end_date: string
  grace_period_months: number
  interest_rate: number
  initial_amount: number
  current_balance: number
  created_at: string
}

interface CreditWithCompany extends Credit {
  company: Company
  project?: Project
}

const CompanyCredits: React.FC = () => {
  const [credits, setCredits] = useState<CreditWithCompany[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCredit, setEditingCredit] = useState<Credit | null>(null)

  const [formData, setFormData] = useState({
    company_id: '',
    project_id: '',
    credit_name: '',
    start_date: '',
    end_date: '',
    grace_period_months: 0,
    interest_rate: 0,
    initial_amount: 0
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showModal])

  const fetchData = async () => {
    try {
      setLoading(true)

      const [{ data: companiesData }, { data: projectsData }, { data: creditsData }] = await Promise.all([
        supabase.from('accounting_companies').select('*').order('name'),
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('bank_credits').select(`
          *,
          company:accounting_companies(id, name, oib),
          project:projects(id, name)
        `).order('created_at', { ascending: false })
      ])

      setCompanies(companiesData || [])
      setProjects(projectsData || [])
      setCredits(creditsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      company_id: '',
      project_id: '',
      credit_name: '',
      start_date: '',
      end_date: '',
      grace_period_months: 0,
      interest_rate: 0,
      initial_amount: 0
    })
    setEditingCredit(null)
  }

  const handleOpenModal = (credit?: Credit) => {
    if (credit) {
      setEditingCredit(credit)
      setFormData({
        company_id: credit.company_id,
        project_id: credit.project_id || '',
        credit_name: credit.credit_name,
        start_date: credit.start_date,
        end_date: credit.end_date,
        grace_period_months: credit.grace_period_months,
        interest_rate: credit.interest_rate,
        initial_amount: credit.initial_amount
      })
    } else {
      resetForm()
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingCredit) {
        const { error } = await supabase
          .from('bank_credits')
          .update({
            company_id: formData.company_id,
            project_id: formData.project_id || null,
            credit_name: formData.credit_name,
            start_date: formData.start_date,
            end_date: formData.end_date,
            grace_period_months: formData.grace_period_months,
            interest_rate: formData.interest_rate,
            initial_amount: formData.initial_amount,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCredit.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('bank_credits')
          .insert([{
            ...formData,
            project_id: formData.project_id || null,
            current_balance: 0
          }])

        if (error) throw error
      }

      await fetchData()
      handleCloseModal()
    } catch (error) {
      console.error('Error saving credit:', error)
      alert('Error saving credit')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this credit?')) return

    try {
      const { error } = await supabase
        .from('bank_credits')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('Error deleting credit:', error)
      alert('Error deleting credit')
    }
  }

  const getUtilizationPercentage = (credit: Credit) => {
    if (credit.initial_amount === 0) return 0
    return (credit.current_balance / credit.initial_amount) * 100
  }

  const isExpiringSoon = (endDate: string) => {
    const daysUntilExpiry = differenceInDays(new Date(endDate), new Date())
    return daysUntilExpiry > 0 && daysUntilExpiry <= 90
  }

  const isExpired = (endDate: string) => {
    return new Date(endDate) < new Date()
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
          <h2 className="text-2xl font-bold text-gray-900">Company Credits</h2>
          <p className="text-gray-600 mt-1">Manage company credit lines and loans</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Credit</span>
        </button>
      </div>

      <div className="grid gap-6">
        {credits.map((credit) => {
          const utilizationPercent = getUtilizationPercentage(credit)
          const expiringSoon = isExpiringSoon(credit.end_date)
          const expired = isExpired(credit.end_date)
          const remaining = credit.initial_amount - credit.current_balance

          return (
            <div key={credit.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <CreditCard className="w-6 h-6 text-blue-600" />
                    <h3 className="text-xl font-bold text-gray-900">{credit.credit_name}</h3>
                    {credit.project && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                        {credit.project.name}
                      </span>
                    )}
                    {expired && (
                      <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                        EXPIRED
                      </span>
                    )}
                    {!expired && expiringSoon && (
                      <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full">
                        EXPIRING SOON
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600">
                    {credit.company.name} ({credit.company.oib})
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleOpenModal(credit)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(credit.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 text-gray-600 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm">Credit Limit</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">€{credit.initial_amount.toLocaleString()}</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 text-blue-600 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm">Used</span>
                  </div>
                  <p className="text-xl font-bold text-blue-900">€{credit.current_balance.toLocaleString()}</p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 text-green-600 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm">Available</span>
                  </div>
                  <p className="text-xl font-bold text-green-900">€{remaining.toLocaleString()}</p>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 text-orange-600 mb-1">
                    <Percent className="w-4 h-4" />
                    <span className="text-sm">Interest Rate</span>
                  </div>
                  <p className="text-xl font-bold text-orange-900">{credit.interest_rate}%</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>Start Date:</span>
                  </span>
                  <p className="font-medium text-gray-900">{format(new Date(credit.start_date), 'MMM dd, yyyy')}</p>
                </div>
                <div>
                  <span className="text-gray-600 flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>End Date:</span>
                  </span>
                  <p className="font-medium text-gray-900">{format(new Date(credit.end_date), 'MMM dd, yyyy')}</p>
                </div>
                <div>
                  <span className="text-gray-600 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>Grace Period:</span>
                  </span>
                  <p className="font-medium text-gray-900">{credit.grace_period_months} months</p>
                </div>
              </div>

              <div className="mt-4">
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

        {credits.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Credits Yet</h3>
            <p className="text-gray-600 mb-4">Add your first credit line to start tracking credit utilization</p>
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Credit</span>
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingCredit ? 'Edit Credit' : 'Add New Credit'}
                </h3>
                <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <select
                  value={formData.company_id}
                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Company</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name} ({company.oib})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project (Optional)</label>
                <select
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No Project (General Credit)</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Link credit to a specific project for tracking expenses</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credit Name</label>
                <input
                  type="text"
                  value={formData.credit_name}
                  onChange={(e) => setFormData({ ...formData, credit_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Bank Loan 2024"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grace Period (months)</label>
                  <input
                    type="number"
                    value={formData.grace_period_months}
                    onChange={(e) => setFormData({ ...formData, grace_period_months: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.interest_rate}
                    onChange={(e) => setFormData({ ...formData, interest_rate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.initial_amount}
                  onChange={(e) => setFormData({ ...formData, initial_amount: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingCredit ? 'Update Credit' : 'Add Credit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CompanyCredits
