import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ProjectWithPhases, PhaseFormInput } from '../types'
import { Modal, FormField, Input, Select, Button } from '../../../ui'

interface PhaseSetupModalProps {
  visible: boolean
  onClose: () => void
  project: ProjectWithPhases
  onSubmit: (phases: PhaseFormInput[]) => void
  editMode?: boolean
}

export const PhaseSetupModal: React.FC<PhaseSetupModalProps> = ({
  visible,
  onClose,
  project,
  onSubmit,
  editMode = false
}) => {
  const { t } = useTranslation()
  const [phaseCount, setPhaseCount] = useState(4)
  const [phases, setPhases] = useState<PhaseFormInput[]>([])

  useEffect(() => {
    if (visible) {
      initializePhases()
    }
  }, [visible])

  useEffect(() => {
    if (visible && !editMode) {
      initializePhases()
    }
  }, [phaseCount])

  const initializePhases = () => {
    if (editMode && project.phases && project.phases.length > 0) {
      const existingPhases = project.phases
        .sort((a, b) => a.phase_number - b.phase_number)
        .map(phase => ({
          id: phase.id,
          phase_name: phase.phase_name,
          budget_allocated: phase.budget_allocated,
          start_date: phase.start_date || '',
          end_date: phase.end_date || ''
        }))
      setPhases(existingPhases)
      setPhaseCount(existingPhases.length)
    } else {
      const defaultPhases = [
        { phase_name: 'Zemljište', budget_allocated: 0, start_date: '', end_date: '' },
        { phase_name: 'Priprema i razvoj', budget_allocated: 0, start_date: '', end_date: '' },
        { phase_name: 'Izgradnja i uređenje', budget_allocated: 0, start_date: '', end_date: '' },
        { phase_name: 'Opremanje', budget_allocated: 0, start_date: '', end_date: '' },
        { phase_name: 'Kontrola', budget_allocated: 0, start_date: '', end_date: '' },
        { phase_name: 'Financiranje i nadzor', budget_allocated: 0, start_date: '', end_date: '' },
        { phase_name: 'Nepredviđeni troškovi', budget_allocated: 0, start_date: '', end_date: '' }
      ]
      setPhases(defaultPhases.slice(0, phaseCount))
    }
  }

  const updatePhaseCount = (count: number) => {
    setPhaseCount(count)
    const currentCount = phases.length

    if (count > currentCount) {
      const newPhases = [...phases]
      for (let i = currentCount; i < count; i++) {
        newPhases.push({
          phase_name: `${t('common.phase')} ${i + 1}`,
          budget_allocated: 0,
          start_date: '',
          end_date: ''
        })
      }
      setPhases(newPhases)
    } else if (count < currentCount) {
      setPhases(phases.slice(0, count))
    }
  }

  if (!visible) return null

  const totalAllocated = phases.reduce((sum, p) => sum + p.budget_allocated, 0)
  const difference = project.budget - totalAllocated

  return (
    <Modal show={true} onClose={onClose} size="xl">
      <Modal.Header
        title={editMode ? t('supervision.site_management.phase_setup.title_edit') : t('supervision.site_management.phase_setup.title_create')}
        subtitle={`${t('supervision.site_management.phase_setup.distribute')} €${project.budget.toLocaleString('hr-HR')} ${t('supervision.site_management.phase_setup.budget_across')}`}
        onClose={onClose}
      />

      <Modal.Body>
        <FormField label={t('supervision.site_management.phase_setup.num_phases')}>
          <Select
            value={phaseCount}
            onChange={(e) => updatePhaseCount(parseInt(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(count => (
              <option key={count} value={count}>{count} {t('common.phase')}</option>
            ))}
          </Select>
        </FormField>

        <div className="space-y-4 mt-6">
          {phases.map((phase, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">{t('common.phase')} {index + 1}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label={t('supervision.site_management.phase_setup.phase_name')}>
                  <Input
                    type="text"
                    value={phase.phase_name}
                    onChange={(e) => {
                      const newPhases = [...phases]
                      newPhases[index].phase_name = e.target.value
                      setPhases(newPhases)
                    }}
                    placeholder={`${t('common.phase')} ${index + 1} ${t('common.name').toLowerCase()}`}
                  />
                </FormField>
                <FormField label={t('supervision.site_management.phase_setup.budget_allocated')}>
                  <Input
                    type="number"
                    value={phase.budget_allocated}
                    onChange={(e) => {
                      const newPhases = [...phases]
                      newPhases[index].budget_allocated = parseFloat(e.target.value) || 0
                      setPhases(newPhases)
                    }}
                    placeholder="0"
                  />
                </FormField>
                <FormField label={t('supervision.site_management.phase_setup.start_date')}>
                  <Input
                    type="date"
                    value={phase.start_date}
                    onChange={(e) => {
                      const newPhases = [...phases]
                      newPhases[index].start_date = e.target.value
                      setPhases(newPhases)
                    }}
                  />
                </FormField>
                <FormField label={t('supervision.site_management.phase_setup.end_date')}>
                  <Input
                    type="date"
                    value={phase.end_date}
                    onChange={(e) => {
                      const newPhases = [...phases]
                      newPhases[index].end_date = e.target.value
                      setPhases(newPhases)
                    }}
                  />
                </FormField>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">{t('supervision.site_management.phase_setup.budget_summary')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">{t('supervision.site_management.phase_setup.total_budget')}</p>
              <p className="text-lg font-bold text-gray-900">€{project.budget.toLocaleString('hr-HR')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('supervision.site_management.phase_setup.total_allocated')}</p>
              <p className={`text-lg font-bold ${
                totalAllocated === project.budget
                  ? 'text-green-600'
                  : totalAllocated > project.budget
                  ? 'text-orange-600'
                  : 'text-blue-600'
              }`}>
                €{totalAllocated.toLocaleString('hr-HR')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('supervision.site_management.phase_setup.difference')}</p>
              <p className={`text-lg font-bold ${
                difference === 0
                  ? 'text-green-600'
                  : difference < 0
                  ? 'text-orange-600'
                  : 'text-blue-600'
              }`}>
                {difference === 0
                  ? t('supervision.site_management.phase_setup.matched')
                  : difference > 0
                  ? `€${difference.toLocaleString('hr-HR')} ${t('supervision.site_management.phase_setup.under')}`
                  : `€${Math.abs(difference).toLocaleString('hr-HR')} ${t('supervision.site_management.phase_setup.over')}`
                }
              </p>
            </div>
          </div>
          {difference !== 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                {t('supervision.site_management.phase_setup.mismatch_note')}
              </p>
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button onClick={() => onSubmit(phases)}>
          {editMode ? t('supervision.site_management.phase_setup.update') : t('supervision.site_management.phase_setup.create')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
