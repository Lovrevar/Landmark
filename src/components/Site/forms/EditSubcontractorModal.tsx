import React, { useState, useEffect } from 'react'
import { Subcontractor } from '../../../lib/supabase'
import { supabase } from '../../../lib/supabase'
import { ContractType } from '../types/siteTypes'
import { Modal, FormField, Input, Select, Textarea, Button, Alert } from '../../ui'

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
    <Modal show={true} onClose={onClose} size="xl">
      <Modal.Header title="Edit Subcontractor" onClose={onClose} />

      <Modal.Body>
        <div className="space-y-4">
          <FormField label="Name" required>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>

          <FormField label="Contact" required>
            <Input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Phone or email"
            />
          </FormField>

          <div className="border-t border-gray-200 pt-4 mt-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Projekt & Faza</h3>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Faza">
                <Select
                  value={selectedPhaseId}
                  onChange={(e) => setSelectedPhaseId(e.target.value)}
                  disabled={loadingPhases}
                >
                  <option value="">Odaberite fazu</option>
                  {phases.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.phase_name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Status ugovora">
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
              </FormField>
            </div>

            <FormField
              label="Kategorija ugovora"
              required
              helperText="Odaberite tip ugovora za ovu fazu"
            >
              <Select
                value={contractTypeId}
                onChange={(e) => setContractTypeId(parseInt(e.target.value))}
                required
                disabled={loadingContractTypes}
              >
                {contractTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </Select>
            </FormField>

            {!hasContract && (
              <Alert variant="warning">
                <strong>Bez ugovora:</strong> Dobavljač će biti označen kao bez formalnog ugovora.
                Budžet se prati samo kroz fakture.
              </Alert>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4 mt-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Detalji posla</h3>

            <FormField label="Job Description" required>
              <Textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={3}
              />
            </FormField>
          </div>

          {hasContract && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Osnovica (€)" required>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(parseFloat(e.target.value) || 0)}
                  />
                </FormField>

                <FormField label="PDV" required>
                  <Select
                    value={vatRate}
                    onChange={(e) => setVatRate(parseFloat(e.target.value))}
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="13">13%</option>
                    <option value="25">25%</option>
                  </Select>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Contracted ammount (€)"
                  helperText="Automatski izračunato: Osnovica + PDV"
                >
                  <Input
                    type="number"
                    value={calculateTotalCost().toFixed(2)}
                    readOnly
                    className="bg-gray-50 text-gray-700 font-semibold"
                  />
                </FormField>

                <FormField label="Deadline" required>
                  <Input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </FormField>
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

        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
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
            console.log(contractTypeId)
            onSubmit(updatedSubcontractor)
          }}
        >
          Save Changes
        </Button>
        {subcontractor.has_contract !== false && (
          <Button variant="success">
            Mark as Completed
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  )
}
