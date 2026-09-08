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
  const [phaseCount, setPhaseCount] = useState(1)
  const [phases, setPhases] = useState<PhaseFormInput[]>([])

  // Initialise the phase list when the modal opens. Intentionally keyed on
  // `visible` only — we do not want to rebuild when initializePhases' inputs
  // (editMode/project.phases/phaseCount) change, which would clobber edits.
  useEffect(() => {
    if (visible) {
      initializePhases()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  // Rebuild the default phase list when the count changes — create mode only.
  // `editMode`/`initializePhases`/`visible` are intentionally excluded so this
  // never disturbs edit-mode entries or double-fires with the open effect above.
  useEffect(() => {
    if (visible && !editMode) {
      initializePhases()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseCount])

  const initializePhases = () => {
    if (editMode && project.phases && project.phases.length > 0) {
      const existingPhases = project.phases
        .sort((a, b) => a.phase_number - b.phase_number)
        .map(phase => ({
          id: phase.id,
          phase_name: phase.phase_name,
          start_date: phase.start_date || '',
          end_date: phase.end_date || ''
        }))
      setPhases(existingPhases)
      setPhaseCount(existingPhases.length)
    } else {
      // Phases are named "Faza 1", "Faza 2", ... and nothing else.
      //
      // These slots used to be pre-filled with the seven cost bucket names (Zemljište,
      // Priprema i razvoj, ...). That is what conflated the two concepts in the first place:
      // users accepted the defaults and a project could then never have a second real phase.
      // Those names now live in the cost_classifications table and are chosen per contract.
      setPhases(
        Array.from({ length: phaseCount }, (_, i) => ({
          phase_name: t('supervision.site_management.phase_setup.default_phase_name', { n: i + 1 }),
          start_date: '',
          end_date: ''
        }))
      )
    }
  }

  const updatePhaseCount = (count: number) => {
    setPhaseCount(count)
    const currentCount = phases.length

    if (count > currentCount) {
      const newPhases = [...phases]
      for (let i = currentCount; i < count; i++) {
        newPhases.push({
          phase_name: t('supervision.site_management.phase_setup.default_phase_name', { n: i + 1 }),
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

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {t('supervision.site_management.phase_setup.classification_hint')}
          </p>
        </div>

        <div className="space-y-4 mt-6">
          {phases.map((phase, index) => (
            <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">{t('common.phase')} {index + 1}</h4>
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

        {/* The over/under summary is gone: phase budgets are no longer typed here, so there is
            nothing left to reconcile against the project total. Both come from the TIC. */}
        <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {t('general_projects.budget_from_tic_hint')}
          </p>
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
