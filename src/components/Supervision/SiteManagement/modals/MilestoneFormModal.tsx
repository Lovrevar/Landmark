import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MilestoneFormData } from '../types'
import { validateMilestonePercentagesForContract } from '../services/siteService'
import { Modal, FormField, Input, Textarea, Button } from '../../../ui'

interface MilestoneFormModalProps {
  visible: boolean
  onClose: () => void
  onSubmit: (data: MilestoneFormData) => void
  contractId: string
  subcontractorName: string
  projectName: string
  phaseName: string
  contractCost: number
  editingMilestone?: {
    id: string
    milestone_name: string
    description: string
    percentage: number
    due_date: string | null
  } | null
}

export const MilestoneFormModal: React.FC<MilestoneFormModalProps> = ({
  visible,
  onClose,
  onSubmit,
  contractId,
  subcontractorName,
  projectName,
  phaseName,
  contractCost,
  editingMilestone
}) => {
  const [formData, setFormData] = useState<MilestoneFormData>({
    contract_id: contractId,
    milestone_name: '',
    description: '',
    percentage: 0,
    due_date: null
  })

  const { t } = useTranslation()
  const [remainingPercentage, setRemainingPercentage] = useState(100)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (visible) {
      if (editingMilestone) {
        setFormData({
          contract_id: contractId,
          milestone_name: editingMilestone.milestone_name,
          description: editingMilestone.description,
          percentage: editingMilestone.percentage,
          due_date: editingMilestone.due_date
        })
      } else {
        setFormData({
          contract_id: contractId,
          milestone_name: '',
          description: '',
          percentage: 0,
          due_date: null
        })
      }
      loadRemainingPercentage()
    }
  }, [visible, contractId, editingMilestone])

  const loadRemainingPercentage = async () => {
    try {
      const validation = await validateMilestonePercentagesForContract(
        contractId,
        editingMilestone?.id
      )
      setRemainingPercentage(validation.remainingPercentage)
    } catch (error) {
      console.error('Error loading remaining percentage:', error)
    }
  }

  const handleSubmit = () => {
    const errors: Record<string, string> = {}
    if (!formData.milestone_name.trim()) errors.milestone_name = t('supervision.milestone_form.errors.name_required')
    if (formData.percentage <= 0) errors.percentage = t('supervision.milestone_form.errors.percentage_zero')
    else if (formData.percentage > remainingPercentage + (editingMilestone?.percentage || 0)) {
      errors.percentage = `${t('supervision.milestone_form.errors.percentage_exceeds')} ${(remainingPercentage + (editingMilestone?.percentage || 0)).toFixed(2)}%`
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    onSubmit(formData)
  }

  const calculateAmount = () => {
    return (contractCost * formData.percentage) / 100
  }

  if (!visible) return null

  return (
    <Modal show={true} onClose={onClose} size="lg">
      <Modal.Header
        title={editingMilestone ? t('supervision.milestone_form.title_edit') : t('supervision.milestone_form.title_add')}
        subtitle={`${projectName} • ${phaseName} • ${subcontractorName} | ${t('common.contract')} (Base): €${contractCost.toLocaleString('hr-HR')} • ${t('supervision.milestone_form.available')} ${remainingPercentage.toFixed(2)}%`}
        onClose={onClose}
      />

      <Modal.Body>
        <div className="grid grid-cols-1 gap-4 mt-4">
          <FormField label={t('supervision.milestone_form.name')} required error={fieldErrors.milestone_name}>
            <Input
              type="text"
              value={formData.milestone_name}
              onChange={(e) => setFormData({ ...formData, milestone_name: e.target.value })}
              placeholder={t('supervision.milestone_form.name_placeholder')}
            />
          </FormField>

          <FormField label={t('supervision.milestone_form.description')}>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder={t('supervision.milestone_form.description_placeholder')}
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label={t('supervision.milestone_form.percentage')}
              required
              helperText={`${t('supervision.milestone_form.max')} ${(remainingPercentage + (editingMilestone?.percentage || 0)).toFixed(2)}%`}
              error={fieldErrors.percentage}
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.percentage}
                onChange={(e) => setFormData({ ...formData, percentage: parseFloat(e.target.value) || 0 })}
                placeholder="30.00"
              />
            </FormField>

            <FormField
              label={t('supervision.milestone_form.calculated_amount')}
              helperText={`${formData.percentage}% ${t('supervision.milestone_form.of')} €${contractCost.toLocaleString('hr-HR')}`}
            >
              <div className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-semibold">
                €{calculateAmount().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </FormField>
          </div>

          <FormField label={t('supervision.milestone_form.due_date')}>
            <Input
              type="date"
              value={formData.due_date || ''}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value || null })}
            />
          </FormField>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSubmit}>
          {editingMilestone ? t('supervision.milestone_form.update') : t('supervision.milestone_form.add')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
