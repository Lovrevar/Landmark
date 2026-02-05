import React, { useState, useEffect } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { Subcontractor } from '../../../lib/supabase'
import { supabase } from '../../../lib/supabase'
import { ContractType } from '../types/siteTypes'

interface Phase {
  id: string
  phase_name: string
  project_id: string
}

interface EditSubcontractorModalProps {
  visible: boolean
  onClose: () => void
  subcontractor: Subcontractor | null
  onChange: (updated: Subcontractor) => void
  onSubmit: (updated: Subcontractor) => void
}

export const EditSubcontractorModal: React.FC<EditSubcontractorModalProps> = ({
  visible,
  onClose,
  subcontractor,
  onChange,
  onSubmit
}) => {
  const [baseAmount, setBaseAmount] = useState(0)
  const [vatRate, setVatRate] = useState(0)
  const [phases, setPhases] = useState<Phase[]>([])
  const [selectedPhaseId, setSelectedPhaseId] = useState('')
  const [hasContract, setHasContract] = useState(true)
  const [loadingPhases, setLoadingPhases] = useState(false)
  const [contractTypes, setContractTypes] = useState<ContractType[]>([])
  const [contractTypeId, setContractTypeId] = useState(0)
  const [loadingContractTypes, setLoadingContractTypes] = useState(false)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [deadline, setDeadline] = useState('')

  useEffect(() => {
    if (visible && subcontractor) {
      const possibleVatRates = [0, 5, 13, 25]
      let foundVat = 0
      let foundBase = subcontractor.cost

      for (const rate of possibleVatRates) {
        const calculatedBase = subcontractor.cost / (1 + rate / 100)
        const calculatedVat = calculatedBase * (rate / 100)
        const calculatedTotal = calculatedBase + calculatedVat

        if (Math.abs(calculatedTotal - subcontractor.cost) < 0.01) {
          foundVat = rate
          foundBase = calculatedBase
          break
        }
      }

      setBaseAmount(foundBase)
      setVatRate(foundVat)
      setHasContract((subcontractor as any).has_contract !== false)
      setSelectedPhaseId((subcontractor as any).phase_id || '')
      setName(subcontractor.name)
      setContact(subcontractor.contact)
      setJobDescription(subcontractor.job_description)
      setDeadline(subcontractor.deadline)

      loadPhases()
      loadContractTypes()
      loadContractTypeId()
    }
  }, [visible, subcontractor])

  const loadPhases = async () => {
    if (!subcontractor) return

    const contractId = (subcontractor as any).contract_id || subcontractor.id

    try {
      setLoadingPhases(true)

      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .select('project_id')
        .eq('id', contractId)
        .single()

      if (contractError) throw contractError

      const { data: phasesData, error: phasesError } = await supabase
        .from('project_phases')
        .select('id, phase_name, project_id')
        .eq('project_id', contractData.project_id)
        .order('phase_number')

      if (phasesError) throw phasesError

      setPhases(phasesData || [])
    } catch (error) {
      console.error('Error loading phases:', error)
    } finally {
      setLoadingPhases(false)
    }
  }

  const loadContractTypes = async () => {
    try {
      setLoadingContractTypes(true)
      const { data, error } = await supabase
        .from('contract_types')
        .select('*')
        .eq('is_active', true)
        .order('id')

      if (error) throw error
      setContractTypes(data || [])
    } catch (error) {
      console.error('Error loading contract types:', error)
    } finally {
      setLoadingContractTypes(false)
    }
  }

  const loadContractTypeId = async () => {
    if (!subcontractor) return

    const contractId = (subcontractor as any).contract_id || subcontractor.id

    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('contract_type_id')
        .eq('id', contractId)
        .single()

      if (error) throw error
      setContractTypeId(data?.contract_type_id || 0)
    } catch (error) {
      console.error('Error loading contract type:', error)
      setContractTypeId(0)
    }
  }

  const calculateTotalCost = () => {
    const vatAmount = baseAmount * (vatRate / 100)
    return baseAmount + vatAmount
  }

  if (!visible || !subcontractor) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">Edit Subcontractor</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contact *</label>
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Phone or email"
            />
          </div>

          <div className="border-t border-gray-200 pt-4 mt-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Projekt & Faza</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Faza</label>
                <select
                  value={selectedPhaseId}
                  onChange={(e) => setSelectedPhaseId(e.target.value)}
                  disabled={loadingPhases}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Odaberite fazu</option>
                  {phases.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.phase_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status ugovora</label>
                <div className="flex items-center h-10">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasContract}
                      onChange={(e) => setHasContract(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      {hasContract ? 'Sa ugovorom' : 'Bez ugovora'}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kategorija ugovora *
              </label>
              <select
                value={contractTypeId}
                onChange={(e) => setContractTypeId(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loadingContractTypes}
              >
                {contractTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Odaberite tip ugovora za ovu fazu
              </p>
            </div>

            {!hasContract && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <strong>Bez ugovora:</strong> Dobavljač će biti označen kao bez formalnog ugovora.
                  Budžet se prati samo kroz fakture.
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4 mt-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Detalji posla</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Job Description *</label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {hasContract && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Osnovica (€) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PDV *</label>
                  <select
                    value={vatRate}
                    onChange={(e) => setVatRate(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="13">13%</option>
                    <option value="25">25%</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contract Cost (€)</label>
                  <input
                    type="number"
                    value={calculateTotalCost().toFixed(2)}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-semibold"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Automatski izračunato: Osnovica + PDV
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Deadline *</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </>
          )}

          {hasContract && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700"><strong>Payment Info (Read-only)</strong></p>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Paid:</span>
                  <span className="font-medium text-gray-900">€{subcontractor.budget_realized.toLocaleString('hr-HR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Remaining:</span>
                  <span className="font-medium text-orange-600">
                    €{Math.max(0, calculateTotalCost() - subcontractor.budget_realized).toLocaleString('hr-HR')}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-blue-200 mt-2">
                  <span className="text-gray-600">Progress:</span>
                  <span className="font-medium text-gray-900">
                    {calculateTotalCost() > 0
                      ? Math.min(100, ((subcontractor.budget_realized / calculateTotalCost()) * 100)).toFixed(1)
                      : 0}%
                  </span>
                </div>
              </div>
              <div className="mt-3">
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${calculateTotalCost() > 0
                        ? Math.min(100, (subcontractor.budget_realized / calculateTotalCost()) * 100)
                        : 0}%`
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                Progress is automatically calculated based on payments
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!selectedPhaseId) {
                  alert('Molimo odaberite fazu')
                  return
                }

                const updatedSubcontractor = {
                  ...subcontractor,
                  name,
                  contact,
                  job_description: jobDescription,
                  deadline,
                  cost: calculateTotalCost(),
                  phase_id: selectedPhaseId,
                  contract_type_id: contractTypeId,
                  has_contract: hasContract
                } as any

                onSubmit(updatedSubcontractor)
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
