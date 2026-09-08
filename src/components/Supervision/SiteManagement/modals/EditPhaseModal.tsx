import React, { useState, useEffect } from 'react'
import { formatEuroRounded } from '../../../../utils/formatters'
import { useTranslation } from 'react-i18next'
import { ProjectPhase } from '../../../../lib/supabase'
import { EditPhaseFormData } from '../types'
import { Modal, FormField, Input, Select, Button } from '../../../ui'

interface EditPhaseModalProps {
  visible: boolean
  onClose: () => void
  phase: ProjectPhase | null
  onSubmit: (updates: EditPhaseFormData) => void
}

export const EditPhaseModal: React.FC<EditPhaseModalProps> = ({
  visible,
  onClose,
  phase,
  onSubmit
}) => {
  const { t } = useTranslation()
  const [formData, setFormData] = useState<EditPhaseFormData>({
    phase_name: '',
    start_date: '',
    end_date: '',
    status: 'planning'
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (phase) {
      setFormData({
        phase_name: phase.phase_name,
        start_date: phase.start_date || '',
        end_date: phase.end_date || '',
        status: phase.status
      })
    }
  }, [phase])

  if (!visible || !phase) return null

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

          {/* Read-only: the phase budget is that phase's share of the TIC. */}
          <FormField
            label={t('supervision.site_management.edit_phase.budget')}
            helperText={t('general_projects.budget_from_tic_hint')}
          >
            <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
              {phase.budget_allocated > 0 ? (
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatEuroRounded(phase.budget_allocated)}
                </span>
              ) : (
                <span className="text-gray-500 dark:text-gray-400">
                  {t('general_projects.budget_not_set')}
                </span>
              )}
            </div>
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

        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button onClick={() => {
          const errors: Record<string, string> = {}
          if (!formData.phase_name?.trim()) errors.phase_name = t('supervision.site_management.edit_phase.errors.name_required')
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
