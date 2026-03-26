import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { retailProjectService } from '../services/retailProjectService'
import { Button, Modal, FormField, Input, Textarea } from '../../../ui'

interface MilestoneFormData {
  contract_id: string
  milestone_name: string
  description: string
  percentage: number
  due_date: string | null
}

interface MilestoneFormModalProps {
  visible: boolean
  onClose: () => void
  onSubmit: (data: MilestoneFormData) => void
  contractId: string
  supplierName: string
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
  supplierName,
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
      const validation = await retailProjectService.validateMilestonePercentagesForContract(
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
    if (!formData.milestone_name.trim()) errors.milestone_name = t('retail_projects.milestones.form.name_error')
    if (formData.percentage <= 0) errors.percentage = t('retail_projects.milestones.form.percentage_error_zero')
    else if (formData.percentage > remainingPercentage + (editingMilestone?.percentage || 0)) {
      errors.percentage = t('retail_projects.milestones.form.percentage_error_max', { max: (remainingPercentage + (editingMilestone?.percentage || 0)).toFixed(2) })
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    onSubmit(formData)
  }

  const calculateAmount = () => {
    return (contractCost * formData.percentage) / 100
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hr-HR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  return (
    <Modal show={visible} onClose={onClose} size="lg">
      <Modal.Header
        title={editingMilestone ? t('retail_projects.milestones.form.edit_title') : t('retail_projects.milestones.form.add_title')}
        subtitle={`${projectName} \u2022 ${phaseName} \u2022 ${supplierName}`}
        onClose={onClose}
      />
      <Modal.Body>
        <p className="text-sm text-gray-500">
          {t('retail_projects.milestones.form.available_info', { amount: formatCurrency(contractCost), percent: remainingPercentage.toFixed(2) })}
        </p>

        <div className="grid grid-cols-1 gap-4">
          <FormField label={t('retail_projects.milestones.form.name_label')} error={fieldErrors.milestone_name}>
            <Input
              type="text"
              value={formData.milestone_name}
              onChange={(e) => setFormData({ ...formData, milestone_name: e.target.value })}
              placeholder={t('retail_projects.milestones.form.name_placeholder')}
            />
          </FormField>

          <FormField label={t('retail_projects.milestones.form.description')}>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder={t('retail_projects.milestones.form.description_placeholder')}
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('retail_projects.milestones.form.percentage_label')} error={fieldErrors.percentage}>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.percentage}
                onChange={(e) => setFormData({ ...formData, percentage: parseFloat(e.target.value) || 0 })}
                placeholder="30.00"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('retail_projects.milestones.form.max_label', { percent: (remainingPercentage + (editingMilestone?.percentage || 0)).toFixed(2) })}
              </p>
            </FormField>

            <FormField label={t('retail_projects.milestones.form.calculated_amount')}>
              <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-semibold">
                {formatCurrency(calculateAmount())}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t('retail_projects.milestones.form.percentage_of', { percent: formData.percentage, amount: formatCurrency(contractCost) })}
              </p>
            </FormField>
          </div>

          <FormField label={t('retail_projects.milestones.form.due_date')}>
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
          {editingMilestone ? t('common.save_changes') : t('retail_projects.milestones.form.add_title')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
