import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'
import { Subcontractor } from '../../../../lib/supabase'
import { fetchContractFormData } from '../services/siteService'
import { VAT_RATE_OPTIONS } from '../types'
import { useContractTypes } from '../hooks/useContractTypes'
import { useVATCalculation } from '../hooks/useVATCalculation'
import { Modal, FormField, Input, Select, Textarea, Button, Alert } from '../../../ui'
import { ContractDocumentUpload } from '../ContractDocumentUpload'
import { ContractDocumentViewer } from '../ContractDocumentViewer'
import { uploadSubcontractorDocuments } from '../services/siteService'
import { formatEuro } from '../../../../utils/formatters'
import { useToast } from '../../../../contexts/ToastContext'

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

type SubcontractorWithIds = Subcontractor & { subcontractor_id?: string; contract_id?: string }

const getContractId = (subcontractor: Subcontractor | null) =>
  subcontractor ? ((subcontractor as SubcontractorWithIds).contract_id || subcontractor.id) : null

const getTrueSubcontractorId = (subcontractor: Subcontractor | null) =>
  subcontractor ? ((subcontractor as SubcontractorWithIds).subcontractor_id || subcontractor.id) : ''

export const EditSubcontractorModal: React.FC<EditSubcontractorModalProps> = ({
  visible,
  onClose,
  subcontractor,
  onSubmit
}) => {
  const { t } = useTranslation()
  const toast = useToast()
  const { contractTypes, loading: loadingContractTypes, load: loadContractTypes } = useContractTypes()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [phases, setPhases] = useState<Phase[]>([])
  const [selectedPhaseId, setSelectedPhaseId] = useState('')
  const [hasContract, setHasContract] = useState(true)
  const [loadingPhases, setLoadingPhases] = useState(false)
  const [contractTypeId, setContractTypeId] = useState(0)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [baseAmount, setBaseAmount] = useState(0)
  const [vatRate, setVatRate] = useState(0)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [docViewerKey, setDocViewerKey] = useState(0)

  const { vatAmount, totalAmount } = useVATCalculation(baseAmount, vatRate)

  useEffect(() => {
    if (visible && subcontractor) {
      setHasContract((subcontractor as Subcontractor & { has_contract?: boolean; phase_id?: string }).has_contract !== false)
      setSelectedPhaseId((subcontractor as Subcontractor & { has_contract?: boolean; phase_id?: string }).phase_id || '')
      setName(subcontractor.name || '')
      setContact(subcontractor.contact || '')
      setJobDescription(subcontractor.job_description || '')
      setDeadline(subcontractor.deadline || '')

      loadContractFormData()
      loadContractTypes()
    }
  }, [visible, subcontractor])

  const loadContractFormData = async () => {
    if (!subcontractor) return
    const contractId = (subcontractor as Subcontractor & { contract_id?: string }).contract_id || subcontractor.id
    try {
      setLoadingPhases(true)
      const data = await fetchContractFormData(contractId)
      setPhases(data.phases)
      setContractTypeId(data.contract_type_id)
      setBaseAmount(data.base_amount)
      setVatRate(data.vat_rate)
    } catch (error) {
      console.error('Error loading contract form data:', error)
    } finally {
      setLoadingPhases(false)
    }
  }

  const handleUploadFiles = async () => {
    const contractId = getContractId(subcontractor)
    if (!subcontractor || pendingFiles.length === 0) return

    try {
      setUploadingFiles(true)
      await uploadSubcontractorDocuments(getTrueSubcontractorId(subcontractor), contractId, pendingFiles)
      setPendingFiles([])
      setDocViewerKey(k => k + 1)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Greška pri uploadu dokumenata')
    } finally {
      setUploadingFiles(false)
    }
  }

  if (!visible || !subcontractor) return null

  return (
    <Modal show={true} onClose={onClose} size="xl">
      <Modal.Header title={t('supervision.edit_subcontractor.title')} onClose={onClose} />

      <Modal.Body>
        <div className="space-y-4">
          <FormField label={t('supervision.edit_subcontractor.name')} required error={fieldErrors.name}>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>

          <FormField label={t('supervision.edit_subcontractor.contact')} required>
            <Input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={t('supervision.edit_subcontractor.contact_placeholder')}
            />
          </FormField>

          <div className="border-t border-gray-200 pt-4 mt-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('supervision.edit_subcontractor.project_phase')}</h3>

            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('supervision.edit_subcontractor.phase')} required error={fieldErrors.phase_id}>
                <Select
                  value={selectedPhaseId}
                  onChange={(e) => setSelectedPhaseId(e.target.value)}
                  disabled={loadingPhases}
                >
                  <option value="">{t('supervision.edit_subcontractor.select_phase')}</option>
                  {phases.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.phase_name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label={t('supervision.edit_subcontractor.contract_status')}>
                <div className="flex items-center h-10">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasContract}
                      onChange={(e) => setHasContract(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      {hasContract ? t('supervision.edit_subcontractor.with_contract') : t('supervision.edit_subcontractor.no_contract')}
                    </span>
                  </label>
                </div>
              </FormField>
            </div>

            <FormField
              label={t('supervision.edit_subcontractor.contract_category')}
              required
              helperText={t('supervision.edit_subcontractor.contract_category_help')}
            >
              <Select
                value={contractTypeId}
                onChange={(e) => setContractTypeId(parseInt(e.target.value))}
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
                <strong>{t('supervision.edit_subcontractor.no_contract_warning_title')}</strong> {t('supervision.edit_subcontractor.no_contract_warning_body')}
              </Alert>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4 mt-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('supervision.edit_subcontractor.job_details')}</h3>

            <FormField label={t('supervision.edit_subcontractor.job_description')} required error={fieldErrors.jobDescription}>
              <Textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={3}
              />
            </FormField>
          </div>

          {hasContract && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label={t('supervision.edit_subcontractor.base')}
                  helperText={t('supervision.edit_subcontractor.base_help')}
                  required
                >
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(parseFloat(e.target.value) || 0)}
                  />
                </FormField>

                <FormField label={t('supervision.edit_subcontractor.vat_rate')} required>
                  <Select
                    value={vatRate}
                    onChange={(e) => setVatRate(parseFloat(e.target.value))}
                  >
                    {VAT_RATE_OPTIONS.map(r => (
                      <option key={r} value={r}>{r}%</option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <div className="grid grid-cols-3 gap-4 bg-gray-50 p-3 rounded-lg">
                <div>
                  <label className="text-xs text-gray-600">{t('supervision.edit_subcontractor.vat_amount')}</label>
                  <p className="text-lg font-semibold text-gray-900">{formatEuro(vatAmount)}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-600">{t('supervision.edit_subcontractor.total')}</label>
                  <p className="text-lg font-bold text-blue-600">{formatEuro(totalAmount)}</p>
                </div>
                <FormField label={t('supervision.edit_subcontractor.deadline')} required>
                  <Input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </FormField>
              </div>
            </div>
          )}

          {hasContract && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700"><strong>{t('supervision.edit_subcontractor.payment_info')}</strong></p>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('supervision.edit_subcontractor.total_paid_base')}</span>
                  <span className="font-medium text-gray-900">{formatEuro(subcontractor.budget_realized)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('supervision.edit_subcontractor.remaining')}</span>
                  <span className="font-medium text-orange-600">
                    {formatEuro(Math.max(0, totalAmount - subcontractor.budget_realized))}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-blue-200 mt-2">
                  <span className="text-gray-600">{t('supervision.edit_subcontractor.progress')}</span>
                  <span className="font-medium text-gray-900">
                    {totalAmount > 0
                      ? Math.min(100, ((subcontractor.budget_realized / totalAmount) * 100)).toFixed(1)
                      : 0}%
                  </span>
                </div>
              </div>
              <div className="mt-3">
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${totalAmount > 0
                        ? Math.min(100, (subcontractor.budget_realized / totalAmount) * 100)
                        : 0}%`
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                {t('supervision.edit_subcontractor.progress_note')}
              </p>
            </div>
          )}

        {hasContract && (
          <div className="border-t border-gray-200 pt-4 mt-2">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">{t('supervision.edit_subcontractor.contract_docs')}</h3>
            </div>

            <div className="mb-4">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">{t('supervision.edit_subcontractor.existing_docs')}</p>
              <ContractDocumentViewer
                key={docViewerKey}
                subcontractorId={getTrueSubcontractorId(subcontractor)}
              />
            </div>

            <div>
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">{t('supervision.edit_subcontractor.add_docs')}</p>
              <ContractDocumentUpload
                files={pendingFiles}
                onChange={setPendingFiles}
              />
              {pendingFiles.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleUploadFiles}
                  loading={uploadingFiles}
                  className="mt-3"
                >
                  {t('supervision.edit_subcontractor.upload')} {pendingFiles.length} {pendingFiles.length === 1 ? t('supervision.edit_subcontractor.doc_singular') : t('supervision.edit_subcontractor.doc_plural')}
                </Button>
              )}
            </div>
          </div>
        )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={() => {
            const errors: Record<string, string> = {}
            if (!selectedPhaseId) errors.phase_id = t('supervision.edit_subcontractor.errors.phase_required')
            if (!name.trim()) errors.name = t('supervision.edit_subcontractor.errors.name_required')
            if (!jobDescription.trim()) errors.jobDescription = t('supervision.edit_subcontractor.errors.job_required')
            setFieldErrors(errors)
            if (Object.keys(errors).length > 0) return

            const updatedSubcontractor = {
              ...subcontractor,
              name,
              contact,
              job_description: jobDescription,
              deadline,
              cost: totalAmount,
              base_amount: baseAmount,
              vat_rate: vatRate,
              vat_amount: vatAmount,
              total_amount: totalAmount,
              phase_id: selectedPhaseId,
              contract_type_id: contractTypeId,
              has_contract: hasContract
            } as unknown as Subcontractor

            onSubmit(updatedSubcontractor)
          }}
        >
          {t('common.save_changes')}
        </Button>
        {subcontractor.has_contract !== false && (
          <Button variant="success">
            {t('supervision.edit_subcontractor.mark_completed')}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  )
}
