import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ProjectPhase } from '../../../../lib/supabase'
import { ProjectWithPhases, EditPhaseFormData } from '../types'
import { Modal, FormField, Input, Select, Button } from '../../../ui'

interface EditPhaseModalProps {
  visible: boolean
  onClose: () => void
  phase: ProjectPhase | null
  project: ProjectWithPhases
  onSubmit: (updates: EditPhaseFormData) => void
}

export const EditPhaseModal: React.FC<EditPhaseModalProps> = ({
  visible,
  onClose,
  phase,
  project,
  onSubmit
}) => {
  const { t } = useTranslation()
  const [formData, setFormData] = useState<EditPhaseFormData>({
    phase_name: '',
    budget_allocated: 0,
    start_date: '',
    end_date: '',
    status: 'planning'
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (phase) {
      setFormData({
        phase_name: phase.phase_name,
        budget_allocated: phase.budget_allocated,
        start_date: phase.start_date || '',
        end_date: phase.end_date || '',
        status: phase.status
      })
    }
  }, [phase])

  if (!visible || !phase) return null

  const otherPhasesTotalBudget = project.phases
    .filter(p => p.id !== phase.id)
    .reduce((sum, p) => sum + p.budget_allocated, 0)
  const newTotalAllocated = otherPhasesTotalBudget + formData.budget_allocated
  const projectBudgetDiff = newTotalAllocated - project.budget

  return (
    <Modal show={true} onClose={onClose} size="lg">
      <Modal.Header
        title={t('supervision.site_management.edit_phase.title')}
        subtitle={`${t('supervision.site_management.edit_phase.phase_label')} ${phase.phase_number} • ${t('supervision.site_management.edit_phase.budget_used')} €${phase.budget_used.toLocaleString('hr-HR')}`}
        onClose={onClose}
      />

      <Modal.Body>
        <div className="space-y-4">
          <FormField label={t('supervision.site_management.edit_phase.phase_name')} required error={fieldErrors.phase_name}>
            <Input
              type="text"
              value={formData.phase_name}
              onChange={(e) => setFormData({ ...formData, phase_name: e.target.value })}
              placeholder={t('supervision.site_management.edit_phase.phase_name_placeholder')}
            />
          </FormField>

          <FormField
            label={t('supervision.site_management.edit_phase.budget')}
            required
            helperText={
              formData.budget_allocated < phase.budget_used
                ? `${t('supervision.site_management.edit_phase.budget_warning')} (€${phase.budget_used.toLocaleString('hr-HR')})`
                : `${t('supervision.site_management.edit_phase.available_after')} €${(formData.budget_allocated - phase.budget_used).toLocaleString('hr-HR')}`
            }
            error={fieldErrors.budget_allocated ?? (formData.budget_allocated < phase.budget_used ? t('supervision.site_management.edit_phase.budget_less_error') : undefined)}
          >
            <Input
              type="number"
              value={formData.budget_allocated}
              onChange={(e) => setFormData({ ...formData, budget_allocated: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('supervision.site_management.edit_phase.start_date')}>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </FormField>
            <FormField label={t('supervision.site_management.edit_phase.end_date')}>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label={t('supervision.site_management.edit_phase.status')}>
            <Select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'planning' | 'active' | 'completed' | 'on_hold' })}
            >
              <option value="planning">{t('supervision.edit_phase_status.planning')}</option>
              <option value="active">{t('supervision.edit_phase_status.active')}</option>
              <option value="completed">{t('supervision.edit_phase_status.completed')}</option>
              <option value="on_hold">{t('supervision.edit_phase_status.on_hold')}</option>
            </Select>
          </FormField>

          {projectBudgetDiff !== 0 && (
            <div className={`p-4 rounded-lg border ${
              projectBudgetDiff > 0 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700' : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
            }`}>
              <p className={`text-sm ${projectBudgetDiff > 0 ? 'text-orange-800 dark:text-orange-400' : 'text-blue-800 dark:text-blue-200'}`}>
                <span className="font-medium">{t('supervision.site_management.edit_phase.note_prefix')}</span>
                ({' €' + newTotalAllocated.toLocaleString('hr-HR')}) {t('supervision.site_management.edit_phase.will_be')} {' '}
                {projectBudgetDiff > 0
                  ? `€${Math.abs(projectBudgetDiff).toLocaleString('hr-HR')} ${t('supervision.site_management.edit_phase.over')}`
                  : `€${Math.abs(projectBudgetDiff).toLocaleString('hr-HR')} ${t('supervision.site_management.edit_phase.under')}`
                } {t('supervision.site_management.edit_phase.budget_suffix')}
              </p>
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button onClick={() => {
          const errors: Record<string, string> = {}
          if (!formData.phase_name?.trim()) errors.phase_name = t('supervision.site_management.edit_phase.errors.name_required')
          if (!formData.budget_allocated && formData.budget_allocated !== 0) errors.budget_allocated = t('supervision.site_management.edit_phase.errors.budget_required')
          setFieldErrors(errors)
          if (Object.keys(errors).length > 0) return
          onSubmit(formData)
        }}>
          {t('supervision.site_management.edit_phase.update')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
