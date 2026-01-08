import React, { useState, useEffect } from 'react'
import { X, Building2, User } from 'lucide-react'
import { ProjectPhase, Subcontractor } from '../../../lib/supabase'
import { SubcontractorFormData } from '../types/siteTypes'
import { fetchProjectFunders } from '../services/siteService'

interface SubcontractorFormModalProps {
  visible: boolean
  onClose: () => void
  phase: ProjectPhase | null
  existingSubcontractors: Subcontractor[]
  onSubmit: (data: SubcontractorFormData, useExisting: boolean) => void
  projectId: string
}

interface Funder {
  id: string
  name: string
  type?: string
}

export const SubcontractorFormModal: React.FC<SubcontractorFormModalProps> = ({
  visible,
  onClose,
  phase,
  existingSubcontractors,
  onSubmit,
  projectId
}) => {
  const [useExistingSubcontractor, setUseExistingSubcontractor] = useState(false)
  const [baseAmount, setBaseAmount] = useState(0)
  const [vatRate, setVatRate] = useState(0)
  const [formData, setFormData] = useState<SubcontractorFormData>({
    existing_subcontractor_id: '',
    name: '',
    contact: '',
    job_description: '',
    deadline: '',
    cost: 0,
    phase_id: '',
    financed_by_type: null,
    financed_by_investor_id: null,
    financed_by_bank_id: null
  })
  const [investors, setInvestors] = useState<Funder[]>([])
  const [banks, setBanks] = useState<Funder[]>([])
  const [loadingFunders, setLoadingFunders] = useState(false)

  const calculateTotalCost = (base: number, vat: number) => {
    const vatAmount = base * (vat / 100)
    return base + vatAmount
  }

  useEffect(() => {
    const totalCost = calculateTotalCost(baseAmount, vatRate)
    setFormData(prev => ({ ...prev, cost: totalCost }))
  }, [baseAmount, vatRate])

  useEffect(() => {
    if (phase) {
      setFormData(prev => ({ ...prev, phase_id: phase.id }))
    }
  }, [phase])

  useEffect(() => {
    if (!visible) {
      setBaseAmount(0)
      setVatRate(0)
    }
  }, [visible])

  useEffect(() => {
    if (visible && projectId) {
      loadFunders()
    }
  }, [visible, projectId])

  const loadFunders = async () => {
    try {
      setLoadingFunders(true)
      const funders = await fetchProjectFunders(projectId)
      setInvestors(funders.investors)
      setBanks(funders.banks)
    } catch (error) {
      console.error('Error loading funders:', error)
    } finally {
      setLoadingFunders(false)
    }
  }

  const handleFunderChange = (value: string) => {
    if (!value) {
      setFormData({
        ...formData,
        financed_by_type: null,
        financed_by_investor_id: null,
        financed_by_bank_id: null
      })
      return
    }

    const [type, id] = value.split(':')
    if (type === 'investor') {
      setFormData({
        ...formData,
        financed_by_type: 'investor',
        financed_by_investor_id: id,
        financed_by_bank_id: null
      })
    } else if (type === 'bank') {
      setFormData({
        ...formData,
        financed_by_type: 'bank',
        financed_by_bank_id: id,
        financed_by_investor_id: null
      })
    }
  }

  const getFunderValue = () => {
    if (formData.financed_by_type === 'investor' && formData.financed_by_investor_id) {
      return `investor:${formData.financed_by_investor_id}`
    }
    if (formData.financed_by_type === 'bank' && formData.financed_by_bank_id) {
      return `bank:${formData.financed_by_bank_id}`
    }
    return ''
  }

  const handleSubmit = () => {
    onSubmit(formData, useExistingSubcontractor)
  }

  if (!visible || !phase) return null

  const availableBudget = phase.budget_allocated - phase.budget_used

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Add Subcontractor</h3>
              <p className="text-gray-600 mt-1">
                {phase.phase_name} • Available Budget: €{availableBudget.toLocaleString('hr-HR')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Subcontractor Selection
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={!useExistingSubcontractor}
                  onChange={() => setUseExistingSubcontractor(false)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Create New Subcontractor</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={useExistingSubcontractor}
                  onChange={() => setUseExistingSubcontractor(true)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Select Existing Subcontractor</span>
              </label>
            </div>
          </div>

          {useExistingSubcontractor ? (
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Subcontractor *
                </label>
                <select
                  value={formData.existing_subcontractor_id}
                  onChange={(e) => {
                    const selectedSub = existingSubcontractors.find(sub => sub.id === e.target.value)
                    setFormData({
                      ...formData,
                      existing_subcontractor_id: e.target.value,
                      name: selectedSub?.name || '',
                      contact: selectedSub?.contact || '',
                      job_description: selectedSub?.job_description || ''
                    })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Choose existing subcontractor</option>
                  {existingSubcontractors.map(subcontractor => (
                    <option key={subcontractor.id} value={subcontractor.id}>
                      {subcontractor.name} - {subcontractor.contact}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Osnovica (€) *
                  </label>
                  <input
                    type="number"
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PDV *
                  </label>
                  <select
                    value={vatRate}
                    onChange={(e) => setVatRate(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="0">0%</option>
                    <option value="13">13%</option>
                    <option value="25">25%</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contract Cost (€)
                  </label>
                  <input
                    type="number"
                    value={formData.cost.toFixed(2)}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-semibold"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Automatski izračunato: Osnovica + PDV
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deadline *
                  </label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job Description for this Phase
                </label>
                <textarea
                  value={formData.job_description}
                  onChange={(e) => setFormData({ ...formData, job_description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe the work for this specific phase..."
                />
              </div>

              {(investors.length > 0 || banks.length > 0) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Financed By (Optional)
                  </label>
                  <select
                    value={getFunderValue()}
                    onChange={(e) => handleFunderChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loadingFunders}
                  >
                    <option value="">No financing source selected</option>
                    {investors.length > 0 && (
                      <optgroup label="Investors">
                        {investors.map(investor => (
                          <option key={investor.id} value={`investor:${investor.id}`}>
                            {investor.name} {investor.type && `(${investor.type})`}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {banks.length > 0 && (
                      <optgroup label="Banks">
                        {banks.map(bank => (
                          <option key={bank.id} value={`bank:${bank.id}`}>
                            {bank.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select which investor or bank is financing this contract
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter company name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Information *</label>
                <input
                  type="text"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Email or phone"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Osnovica (€) *</label>
                <input
                  type="number"
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">PDV *</label>
                <select
                  value={vatRate}
                  onChange={(e) => setVatRate(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="0">0%</option>
                  <option value="13">13%</option>
                  <option value="25">25%</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contract Cost (€)</label>
                <input
                  type="number"
                  value={formData.cost.toFixed(2)}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-semibold"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Automatski izračunato: Osnovica + PDV
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Deadline</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Job Description</label>
                <textarea
                  value={formData.job_description}
                  onChange={(e) => setFormData({ ...formData, job_description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe the work package and responsibilities..."
                />
              </div>
              {(investors.length > 0 || banks.length > 0) && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Financed By (Optional)
                  </label>
                  <select
                    value={getFunderValue()}
                    onChange={(e) => handleFunderChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loadingFunders}
                  >
                    <option value="">No financing source selected</option>
                    {investors.length > 0 && (
                      <optgroup label="Investors">
                        {investors.map(investor => (
                          <option key={investor.id} value={`investor:${investor.id}`}>
                            {investor.name} {investor.type && `(${investor.type})`}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {banks.length > 0 && (
                      <optgroup label="Banks">
                        {banks.map(bank => (
                          <option key={bank.id} value={`bank:${bank.id}`}>
                            {bank.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select which investor or bank is financing this contract
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={formData.cost > availableBudget}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Add Subcontractor
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
