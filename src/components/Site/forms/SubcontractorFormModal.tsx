import React, { useState, useEffect } from 'react'
import { Building2, User } from 'lucide-react'
import { ProjectPhase, Subcontractor } from '../../../lib/supabase'
import { SubcontractorFormData, ContractType } from '../types/siteTypes'
import { fetchProjectFunders } from '../services/siteService'
import { supabase } from '../../../lib/supabase'
import { Modal, FormField, Input, Select, Textarea, Button, Alert } from '../../ui'

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
  const [hasContract, setHasContract] = useState(true)
  const [formData, setFormData] = useState<SubcontractorFormData>({
    existing_subcontractor_id: '',
    name: '',
    contact: '',
    job_description: '',
    deadline: '',
    cost: 0,
    base_amount: 0,
    vat_rate: 0,
    vat_amount: 0,
    total_amount: 0,
    phase_id: '',
    contract_type_id: 0,
    financed_by_type: null,
    financed_by_investor_id: null,
    financed_by_bank_id: null,
    has_contract: true
  })
  const [investors, setInvestors] = useState<Funder[]>([])
  const [banks, setBanks] = useState<Funder[]>([])
  const [contractTypes, setContractTypes] = useState<ContractType[]>([])
  const [loadingFunders, setLoadingFunders] = useState(false)
  const [loadingContractTypes, setLoadingContractTypes] = useState(false)

  useEffect(() => {
    if (!hasContract) {
      setFormData(prev => ({ ...prev, cost: 0, base_amount: 0, vat_amount: 0, total_amount: 0, has_contract: false }))
    } else {
      setFormData(prev => ({ ...prev, has_contract: true }))
    }
  }, [hasContract])

  useEffect(() => {
    const vatAmount = Math.round(formData.base_amount * formData.vat_rate) / 100
    const totalAmount = formData.base_amount + vatAmount
    setFormData(prev => ({
      ...prev,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      cost: totalAmount
    }))
  }, [formData.base_amount, formData.vat_rate])

  useEffect(() => {
    if (phase) {
      setFormData(prev => ({ ...prev, phase_id: phase.id }))
    }
  }, [phase])

  useEffect(() => {
    if (visible && projectId) {
      loadFunders()
      loadContractTypes()
    }
  }, [visible, projectId])

  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [visible])

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
    <Modal show={true} onClose={onClose} size="xl">
      <Modal.Header
        title="Add New Subcontractor"
        subtitle={`${phase.phase_name} • Available Budget: €${availableBudget.toLocaleString('hr-HR')}`}
        onClose={onClose}
      />

      <Modal.Body>
        <Alert variant="warning">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={!hasContract}
              onChange={(e) => setHasContract(!e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm font-medium text-gray-900">Bez ugovora</span>
          </label>
          <p className="text-xs text-gray-600 mt-1 ml-6">
            {hasContract
              ? 'Subkontraktor ima formalan ugovor - unesite osnovicu bez PDV-a'
              : 'Subkontraktor nema formalan ugovor - računi se dodaju naknadno kroz Accounting modul'}
          </p>
        </Alert>

        <FormField
          label="Kategorija ugovora"
          required
          helperText="Odaberite tip ugovora za ovu fazu"
        >
          <Select
            value={formData.contract_type_id}
            onChange={(e) => setFormData({ ...formData, contract_type_id: parseInt(e.target.value) })}
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
            <FormField label="Select Subcontractor" required>
              <Select
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
                required
              >
                <option value="">Choose existing subcontractor</option>
                {existingSubcontractors.map(subcontractor => (
                  <option key={subcontractor.id} value={subcontractor.id}>
                    {subcontractor.name} - {subcontractor.contact}
                  </option>
                ))}
              </Select>
            </FormField>

{hasContract && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Osnovica (€)"
                    helperText="Base amount without VAT"
                    required
                  >
                    <Input
                      type="number"
                      value={formData.base_amount}
                      onChange={(e) => setFormData({ ...formData, base_amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      step="0.01"
                      required
                    />
                  </FormField>
                  <FormField label="PDV stopa" required>
                    <Select
                      value={formData.vat_rate}
                      onChange={(e) => setFormData({ ...formData, vat_rate: parseFloat(e.target.value) })}
                      required
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="13">13%</option>
                      <option value="25">25%</option>
                    </Select>
                  </FormField>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-3 rounded-lg">
                  <div>
                    <label className="text-xs text-gray-600">Iznos PDV</label>
                    <p className="text-lg font-semibold text-gray-900">€{formData.vat_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Ukupno</label>
                    <p className="text-lg font-bold text-blue-600">€{formData.total_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <FormField label="Deadline" required>
                    <Input
                      type="date"
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      required
                    />
                  </FormField>
                </div>
              </div>
            )}

            {!hasContract && (
              <FormField label="Deadline (opcionalno)">
                <Input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </FormField>
            )}

            <FormField label="Job Description for this Phase">
              <Textarea
                value={formData.job_description}
                onChange={(e) => setFormData({ ...formData, job_description: e.target.value })}
                rows={3}
                placeholder="Describe the work for this specific phase..."
              />
            </FormField>

            {(investors.length > 0 || banks.length > 0) && (
              <FormField
                label="Financed By (Optional)"
                helperText="Select which investor or bank is financing this contract"
              >
                <Select
                  value={getFunderValue()}
                  onChange={(e) => handleFunderChange(e.target.value)}
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
                </Select>
              </FormField>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FormField label="Company Name" required>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter company name"
                  required
                />
              </FormField>
            </div>
            <FormField label="Contact Information" required>
              <Input
                type="text"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                placeholder="Email or phone"
                required
              />
            </FormField>
            {hasContract && (
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Osnovica (€)"
                    helperText="Base amount without VAT"
                    required
                  >
                    <Input
                      type="number"
                      value={formData.base_amount}
                      onChange={(e) => setFormData({ ...formData, base_amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      step="0.01"
                      required
                    />
                  </FormField>
                  <FormField label="PDV stopa" required>
                    <Select
                      value={formData.vat_rate}
                      onChange={(e) => setFormData({ ...formData, vat_rate: parseFloat(e.target.value) })}
                      required
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="13">13%</option>
                      <option value="25">25%</option>
                    </Select>
                  </FormField>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-3 rounded-lg">
                  <div>
                    <label className="text-xs text-gray-600">Iznos PDV</label>
                    <p className="text-lg font-semibold text-gray-900">€{formData.vat_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Ukupno</label>
                    <p className="text-lg font-bold text-blue-600">€{formData.total_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <FormField label="Deadline">
                    <Input
                      type="date"
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    />
                  </FormField>
                </div>
              </div>
            )}
            {!hasContract && (
              <FormField label="Deadline (opcionalno)">
                <Input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </FormField>
            )}
            <div className="md:col-span-2">
              <FormField label="Job Description">
                <Textarea
                  value={formData.job_description}
                  onChange={(e) => setFormData({ ...formData, job_description: e.target.value })}
                  rows={3}
                  placeholder="Describe the work package and responsibilities..."
                />
              </FormField>
            </div>
            {(investors.length > 0 || banks.length > 0) && (
              <div className="md:col-span-2">
                <FormField
                  label="Financed By (Optional)"
                  helperText="Select which investor or bank is financing this contract"
                >
                  <Select
                    value={getFunderValue()}
                    onChange={(e) => handleFunderChange(e.target.value)}
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
                  </Select>
                </FormField>
              </div>
            )}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="success"
          onClick={handleSubmit}
          disabled={formData.cost > availableBudget}
        >
          Add Subcontractor
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
