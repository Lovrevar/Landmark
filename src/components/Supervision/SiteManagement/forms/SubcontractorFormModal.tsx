import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, FileText } from 'lucide-react'
import { ProjectPhase, Subcontractor } from '../../../../lib/supabase'
import { SubcontractorFormData } from '../types'
import { fetchProjectFunders } from '../services/siteService'
import { useContractTypes } from '../hooks/useContractTypes'
import { useVATCalculation } from '../hooks/useVATCalculation'
import { Modal, FormField, Input, Select, Textarea, Button, Alert } from '../../../ui'
import { ContractDocumentUpload } from '../ContractDocumentUpload'
import { ContractFormFields } from './ContractFormFields'
import { ContractTypeFormModal } from '../modals/ContractTypeFormModal'
import { formatEuro } from '../../../../utils/formatters'

interface SubcontractorFormModalProps {
  visible: boolean
  onClose: () => void
  phase: ProjectPhase | null
  existingSubcontractors: Subcontractor[]
  onSubmit: (data: SubcontractorFormData, useExisting: boolean, pendingFiles: File[]) => Promise<void>
  projectId: string
}

interface Funder {
  id: string
  name: string
}

export const SubcontractorFormModal: React.FC<SubcontractorFormModalProps> = ({
  visible,
  onClose,
  phase,
  existingSubcontractors,
  onSubmit,
  projectId
}) => {
  const { t } = useTranslation()
  const [useExistingSubcontractor, setUseExistingSubcontractor] = useState(false)
  const [hasContract, setHasContract] = useState(true)
  const [formData, setFormData] = useState<SubcontractorFormData>({
    existing_subcontractor_id: '',
    name: '',
    contact: '',
    job_description: '',
    start_date: '',
    deadline: '',
    cost: 0,
    base_amount: 0,
    vat_rate: 0,
    vat_amount: 0,
    total_amount: 0,
    phase_id: '',
    contract_type_id: 0,
    financed_by_type: null,
    financed_by_bank_id: null,
    has_contract: true
  })
  const { contractTypes, loading: loadingContractTypes, load: loadContractTypes } = useContractTypes()
  const { vatAmount, totalAmount } = useVATCalculation(formData.base_amount, formData.vat_rate)
  const [banks, setBanks] = useState<Funder[]>([])
  const [loadingFunders, setLoadingFunders] = useState(false)
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const merge = (updates: Partial<SubcontractorFormData>) =>
    setFormData(prev => ({ ...prev, ...updates }))

  useEffect(() => {
    merge({
      has_contract: hasContract,
      ...(!hasContract && { cost: 0, base_amount: 0, vat_amount: 0, total_amount: 0 })
    })
  }, [hasContract])

  useEffect(() => {
    if (phase) merge({ phase_id: phase.id })
  }, [phase])

  useEffect(() => {
    if (visible && projectId) {
      loadFunders()
      loadContractTypes()
      setFieldErrors({})
    }
  }, [visible, projectId])

  useEffect(() => {
    document.body.style.overflow = visible ? 'hidden' : 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [visible])

  const loadFunders = async () => {
    try {
      setLoadingFunders(true)
      const funders = await fetchProjectFunders(projectId)
      setBanks(funders.banks)
    } catch (error) {
      console.error('Error loading funders:', error)
    } finally {
      setLoadingFunders(false)
    }
  }

  const handleSubmit = async () => {
    if (isSubmitting) return
    const errors: Record<string, string> = {}
    if (!formData.contract_type_id) errors.contract_type_id = t('supervision.subcontractor_form.errors.select_category')
    if (!useExistingSubcontractor && !formData.name?.trim()) errors.name = t('supervision.subcontractors.form.errors.name_required')
    if (!useExistingSubcontractor && !formData.contact?.trim()) errors.contact = t('supervision.subcontractors.form.errors.contact_required')
    if (useExistingSubcontractor && !formData.existing_subcontractor_id) errors.existing_subcontractor_id = t('supervision.subcontractor_form.errors.select_subcontractor')
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    setIsSubmitting(true)
    try {
      await onSubmit(
        { ...formData, vat_amount: vatAmount, total_amount: totalAmount, cost: totalAmount },
        useExistingSubcontractor,
        pendingFiles
      )
    } catch (e) {
      setFieldErrors({ _form: e instanceof Error ? e.message : t('supervision.subcontractor_form.errors.add_error') })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!visible || !phase) return null

  const availableBudget = phase.budget_allocated - phase.budget_used

  const funderSelect = banks.length > 0 ? (
    <FormField label={t('supervision.subcontractor_form.financed_by')} helperText={t('supervision.subcontractor_form.financed_by_help')}>
      <Select
        value={formData.financed_by_bank_id || ''}
        onChange={(e) => merge({
          financed_by_type: e.target.value ? 'bank' : null,
          financed_by_bank_id: e.target.value || null
        })}
        disabled={loadingFunders}
      >
        <option value="">{t('supervision.subcontractor_form.no_financing')}</option>
        {banks.map(bank => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
      </Select>
    </FormField>
  ) : null

  return (
    <Modal show={true} onClose={onClose} size="xl">
      <Modal.Header
        title={t('supervision.subcontractor_form.title')}
        subtitle={`${phase.phase_name} • ${t('supervision.subcontractor_form.available_budget')} ${formatEuro(availableBudget)}`}
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
            <span className="ml-2 text-sm font-medium text-gray-900">{t('supervision.subcontractor_form.no_contract')}</span>
          </label>
          <p className="text-xs text-gray-600 mt-1 ml-6">
            {hasContract
              ? t('supervision.subcontractor_form.with_contract_help')
              : t('supervision.subcontractor_form.no_contract_help')}
          </p>
        </Alert>

        {fieldErrors._form && (
          <Alert variant="error" className="mb-2">{fieldErrors._form}</Alert>
        )}

        <FormField label={t('supervision.subcontractor_form.contract_category')} required helperText={t('supervision.subcontractor_form.contract_category_help')} error={fieldErrors.contract_type_id}>
          <div className="flex gap-2">
            <Select
              value={formData.contract_type_id}
              onChange={(e) => merge({ contract_type_id: parseInt(e.target.value) })}
              disabled={loadingContractTypes}
              className="flex-1"
            >
              <option value="">{t('supervision.subcontractor_form.select_category')}</option>
              {contractTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </Select>
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowNewCategoryModal(true)} className="px-3">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </FormField>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">{t('supervision.subcontractor_form.selection')}</label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input type="radio" checked={!useExistingSubcontractor} onChange={() => setUseExistingSubcontractor(false)} className="mr-2" />
              <span className="text-sm text-gray-700">{t('supervision.subcontractor_form.create_new')}</span>
            </label>
            <label className="flex items-center">
              <input type="radio" checked={useExistingSubcontractor} onChange={() => setUseExistingSubcontractor(true)} className="mr-2" />
              <span className="text-sm text-gray-700">{t('supervision.subcontractor_form.select_existing')}</span>
            </label>
          </div>
        </div>

        {useExistingSubcontractor ? (
          <div className="grid grid-cols-1 gap-4">
            <FormField label={t('supervision.subcontractor_form.select_label')} required error={fieldErrors.existing_subcontractor_id}>
              <Select
                value={formData.existing_subcontractor_id}
                onChange={(e) => {
                  const sub = existingSubcontractors.find(s => s.id === e.target.value)
                  merge({
                    existing_subcontractor_id: e.target.value,
                    name: sub?.name || '',
                    contact: sub?.contact || '',
                    job_description: sub?.job_description || ''
                  })
                }}
              >
                <option value="">{t('supervision.subcontractor_form.select_placeholder')}</option>
                {existingSubcontractors.map(s => (
                  <option key={s.id} value={s.id}>{s.name} - {s.contact}</option>
                ))}
              </Select>
            </FormField>

            {hasContract && (
              <ContractFormFields
                formData={formData}
                vatAmount={vatAmount}
                totalAmount={totalAmount}
                onChange={merge}
                deadlineRequired
              />
            )}
            {!hasContract && (
              <FormField label={t('supervision.subcontractor_form.deadline_optional')}>
                <Input type="date" value={formData.deadline} onChange={(e) => merge({ deadline: e.target.value })} />
              </FormField>
            )}

            <FormField label={t('supervision.subcontractor_form.job_description')}>
              <Textarea
                value={formData.job_description}
                onChange={(e) => merge({ job_description: e.target.value })}
                rows={3}
                placeholder={t('supervision.subcontractor_form.job_description_placeholder')}
              />
            </FormField>
            {funderSelect}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FormField label={t('supervision.subcontractor_form.company_name')} required error={fieldErrors.name}>
                <Input type="text" value={formData.name} onChange={(e) => merge({ name: e.target.value })} placeholder={t('supervision.subcontractor_form.company_placeholder')} />
              </FormField>
            </div>
            <FormField label={t('supervision.subcontractor_form.contact_info')} required error={fieldErrors.contact}>
              <Input type="text" value={formData.contact} onChange={(e) => merge({ contact: e.target.value })} placeholder={t('supervision.subcontractor_form.contact_placeholder')} />
            </FormField>

            {hasContract && (
              <div className="md:col-span-2">
                <ContractFormFields
                  formData={formData}
                  vatAmount={vatAmount}
                  totalAmount={totalAmount}
                  onChange={merge}
                />
              </div>
            )}
            {!hasContract && (
              <FormField label={t('supervision.subcontractor_form.deadline_optional')}>
                <Input type="date" value={formData.deadline} onChange={(e) => merge({ deadline: e.target.value })} />
              </FormField>
            )}

            <div className="md:col-span-2">
              <FormField label={t('supervision.subcontractor_form.job_description')}>
                <Textarea
                  value={formData.job_description}
                  onChange={(e) => merge({ job_description: e.target.value })}
                  rows={3}
                  placeholder={t('supervision.subcontractor_form.job_description_new_placeholder')}
                />
              </FormField>
            </div>
            {banks.length > 0 && <div className="md:col-span-2">{funderSelect}</div>}
          </div>
        )}

        {hasContract && (
          <div className="mt-6 border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">{t('supervision.subcontractor_form.contract_docs')}</h3>
              <span className="text-xs text-gray-500">{t('supervision.subcontractor_form.optional_label')}</span>
            </div>
            <ContractDocumentUpload files={pendingFiles} onChange={setPendingFiles} />
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="success" onClick={handleSubmit} disabled={isSubmitting || totalAmount > availableBudget}>
          {isSubmitting ? t('supervision.subcontractor_form.adding') : t('supervision.subcontractor_form.add')}
        </Button>
      </Modal.Footer>

      <ContractTypeFormModal
        visible={showNewCategoryModal}
        onClose={() => setShowNewCategoryModal(false)}
        onCreated={(newId) => {
          loadContractTypes()
          merge({ contract_type_id: newId })
        }}
      />
    </Modal>
  )
}
