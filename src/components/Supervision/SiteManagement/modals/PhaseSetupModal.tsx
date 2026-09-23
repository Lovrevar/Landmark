import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ProjectWithPhases, PhaseFormInput } from '../types'
import { Modal, FormField, Input, Select, Button, ConfirmDialog } from '../../../ui'
import { ProjectPhase } from '../../../../lib/supabase'
import { findRemovedPhases } from '../utils/phaseSetup'

interface PhaseSetupModalProps {
  visible: boolean
  onClose: () => void
  project: ProjectWithPhases
  /** Resolves to whether the save succeeded; the parent closes the modal on success. */
  onSubmit: (phases: PhaseFormInput[]) => Promise<boolean> | void
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
  // Saved phases the submitted list would delete, awaiting the user's confirmation.
  const [pendingRemoved, setPendingRemoved] = useState<ProjectPhase[] | null>(null)
  const [confirmingRemoval, setConfirmingRemoval] = useState(false)

  // Initialise the phase list when the modal opens. Intentionally keyed on
  // `visible` only — we do not want to rebuild when initializePhases' inputs
  // (editMode/project.phases/phaseCount) change, which would clobber edits.
  useEffect(() => {
    if (visible) {
      initializePhases()
      setPendingRemoved(null)
      setConfirmingRemoval(false)
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

  const handleSubmit = () => {
    // Saving deletes every existing phase missing from the list (lowering the count slices
    // rows off). Ask first, naming them, rather than dropping them silently.
    if (editMode) {
      const removed = findRemovedPhases(project.phases ?? [], phases)
      if (removed.length > 0) {
        setPendingRemoved(removed)
        return
      }
    }
    return onSubmit(phases)
  }

  const confirmRemoval = async () => {
    setConfirmingRemoval(true)
    try {
      await onSubmit(phases)
    } finally {
      setConfirmingRemoval(false)
      setPendingRemoved(null)
    }
  }

  if (!visible) return null


  return (
    <Modal show={true} onClose={onClose} size="xl">
      <Modal.Header
        title={editMode ? t('supervision.site_management.phase_setup.title_edit') : t('supervision.site_management.phase_setup.title_create')}
        subtitle={project.name}
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
        <Button onClick={handleSubmit}>
          {editMode ? t('supervision.site_management.phase_setup.update') : t('supervision.site_management.phase_setup.create')}
        </Button>
      </Modal.Footer>

      <ConfirmDialog
        show={!!pendingRemoved}
        title={t('common.confirm_delete')}
        message={t('supervision.site_management.phase_setup.confirm_remove_message', {
          names: (pendingRemoved ?? []).map(p => p.phase_name).join(', ')
        })}
        confirmLabel={t('common.yes_delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmRemoval}
        onCancel={() => { if (!confirmingRemoval) setPendingRemoved(null) }}
        loading={confirmingRemoval}
      />
    </Modal>
  )
}
