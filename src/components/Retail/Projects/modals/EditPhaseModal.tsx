import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RetailProjectPhase, RetailProjectWithPhases } from '../../../../types/retail'
import { Button, Modal, FormField, Input, Select, Textarea, Form } from '../../../ui'
import { retailProjectService } from '../services/retailProjectService'
import { useToast } from '../../../../contexts/ToastContext'

interface EditPhaseModalProps {
  phase: RetailProjectPhase
  project: RetailProjectWithPhases
  onClose: () => void
  onSuccess: () => void
}

export const EditPhaseModal: React.FC<EditPhaseModalProps> = ({
  phase,
  project,
  onClose,
  onSuccess
}) => {
  const { t } = useTranslation()
  const toast = useToast()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState({
    phase_name: phase.phase_name,
    budget_allocated: phase.budget_allocated,
    status: phase.status,
    start_date: phase.start_date || '',
    end_date: phase.end_date || '',
    notes: phase.notes || ''
  })
  const [loading, setLoading] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hr-HR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors: Record<string, string> = {}
    if (!formData.phase_name.trim()) {
      errors.phase_name = t('retail_projects.phase_form.phase_name_error')
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setLoading(true)

    try {
      await retailProjectService.updatePhase(phase.id, {
        phase_name: formData.phase_name,
        budget_allocated: formData.budget_allocated,
        status: formData.status,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        notes: formData.notes || null,
        updated_at: new Date().toISOString()
      })

      onSuccess()
    } catch (error) {
      console.error('Error updating phase:', error)
      toast.error(t('retail_projects.phase_form.error_update'))
    } finally {
      setLoading(false)
    }
  }

  const otherPhasesTotal = project.phases
    .filter(p => p.id !== phase.id)
    .reduce((sum, p) => sum + p.budget_allocated, 0)

  const availableBudget = project.purchase_price - otherPhasesTotal

  return (
    <Modal show={true} onClose={onClose} size="lg">
      <Modal.Header
        title={t('retail_projects.phase_form.title')}
        subtitle={phase.phase_type !== 'sales' ? t('retail_projects.phase_form.available_budget', { amount: formatCurrency(availableBudget) }) : undefined}
        onClose={onClose}
      />
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <FormField label={t('retail_projects.phase_form.phase_name_label')} required error={fieldErrors.phase_name}>
            <Input
              type="text"
              value={formData.phase_name}
              onChange={(e) => setFormData({ ...formData, phase_name: e.target.value })}
            />
          </FormField>

          {phase.phase_type !== 'sales' && (
            <FormField label={t('retail_projects.phase_form.budget_label')}>
              <Input
                type="number"
                value={formData.budget_allocated}
                onChange={(e) => setFormData({ ...formData, budget_allocated: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.01"
              />
              {formData.budget_allocated > availableBudget && (
                <p className="text-xs text-red-600 mt-1">
                  {t('retail_projects.phase_form.budget_warning', { amount: formatCurrency(formData.budget_allocated - availableBudget) })}
                </p>
              )}
            </FormField>
          )}

          <FormField label={t('retail_projects.phase_form.status_label')}>
            <Select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as RetailProjectPhase['status'] })}
            >
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('retail_projects.phase_form.start_date')}>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </FormField>

            <FormField label={t('retail_projects.phase_form.end_date')}>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label={t('retail_projects.phase_form.notes_label')}>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder={t('retail_projects.phase_form.notes_placeholder')}
            />
          </FormField>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={loading}>
            {t('common.save_changes')}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
