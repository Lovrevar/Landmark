import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ProjectPhase } from '../../../../lib/supabase'
import { ProjectWithPhases, PhaseFormInput } from '../types'
import * as siteService from '../services/siteService'
import { useToast } from '../../../../contexts/ToastContext'
import { toErrorMessage } from '../../../../lib/errorMessage'

export type PendingConfirm = {
  title: string
  message: string
  variant?: 'danger' | 'primary'
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export const useProjectPhases = (fetchProjects: () => Promise<void>) => {
  const { t } = useTranslation()
  const toast = useToast()
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)

  const requestConfirm = (title: string, message: string, variant: 'danger' | 'primary' = 'primary', confirmLabel?: string): Promise<boolean> =>
    new Promise<boolean>(resolve => {
      setPendingConfirm({
        title,
        message,
        variant,
        confirmLabel,
        onConfirm: () => { setPendingConfirm(null); resolve(true) },
        onCancel:  () => { setPendingConfirm(null); resolve(false) }
      })
    })

  const recalculateAllPhaseBudgets = async () => {
    try {
      await siteService.recalculateAllPhaseBudgets()
      return true
    } catch (error) {
      console.error('Error recalculating phase budgets:', error)
      // Silence here left every phase budget on screen stale with nothing to say so.
      toast.error(toErrorMessage(error, t('supervision.site_management.recalculate_budgets_failed')))
      return false
    }
  }

  /** Toasts a phase-setup save failure, naming the phases that still have dependants when that is the cause. */
  const toastPhaseSaveError = (error: unknown, fallbackKey: string) => {
    if (error instanceof siteService.PhaseHasDependentsError) {
      const detail = error.phases
        .map(p => t('supervision.site_management.phase_setup.errors.dependent_item', {
          name: p.name, contracts: p.contracts, workLogs: p.workLogs
        }))
        .join(', ')
      toast.error(t('supervision.site_management.phase_setup.errors.has_dependents', { detail }))
    } else {
      toast.error(t(fallbackKey))
    }
  }

  const createProjectPhases = async (projectId: string, phases: PhaseFormInput[]) => {
    try {
      await siteService.createPhases(projectId, phases)
      await fetchProjects()
      return true
    } catch (error) {
      console.error('Error creating phases:', error)
      toastPhaseSaveError(error, 'supervision.site_management.phase_setup.errors.create_failed')
      return false
    }
  }

  const updatePhase = async (
    phase: ProjectPhase,
    updates: {
      phase_name: string
      start_date: string | null
      end_date: string | null
      status: 'planning' | 'active' | 'completed' | 'on_hold'
    }
  ) => {
    if (!updates.phase_name.trim()) {
      toast.warning('Phase name is required')
      return false
    }

    try {
      await siteService.updatePhase(phase.id, {
        phase_name: updates.phase_name,
        start_date: updates.start_date || null,
        end_date: updates.end_date || null,
        status: updates.status
      })
      await fetchProjects()
      return true
    } catch (error) {
      console.error('Error updating phase:', error)
      toast.error('Error updating phase. Please try again.')
      return false
    }
  }

  const deletePhase = async (phase: ProjectPhase, _project: ProjectWithPhases) => {
    // Count the actual dependants rather than trusting `budget_used`, which is a derived column
    // refreshed only by recalculate_all_phase_budgets() and therefore reads 0 for a phase that
    // does have contracts whenever the recalc has not run since they were added. Getting this
    // wrong detaches every contract on the phase, silently, via ON DELETE SET NULL.
    try {
      const { contracts, workLogs } = await siteService.countPhaseDependents(phase.id)
      if (contracts > 0 || workLogs > 0) {
        toast.warning(t('supervision.site_management.delete_phase.has_dependents', {
          name: phase.phase_name, contracts, workLogs
        }))
        return false
      }
    } catch (error) {
      console.error('Error checking phase dependents:', error)
      toast.error(t('supervision.site_management.delete_phase.check_failed'))
      return false
    }

    const confirmed = await requestConfirm(
      t('common.confirm_delete'),
      t('supervision.site_management.delete_phase.confirm_message', { name: phase.phase_name }),
      'danger',
      t('common.yes_delete')
    )
    if (!confirmed) return false

    try {
      await siteService.deletePhase(phase.id)
      const remainingPhases = _project.phases
        .filter(p => p.id !== phase.id)
        .sort((a, b) => a.phase_number - b.phase_number)
      await siteService.resequencePhases(remainingPhases)
      await fetchProjects()
      return true
    } catch (error) {
      console.error('Error deleting phase:', error)
      toast.error('Error deleting phase. Please try again.')
      return false
    }
  }

  const updateProjectPhases = async (projectId: string, phases: PhaseFormInput[]) => {
    try {
      await siteService.updateProjectPhases(projectId, phases)
      await fetchProjects()
      return true
    } catch (error) {
      console.error('Error updating phases:', error)
      toastPhaseSaveError(error, 'supervision.site_management.phase_setup.errors.update_failed')
      return false
    }
  }

  return { recalculateAllPhaseBudgets, createProjectPhases, updatePhase, deletePhase, updateProjectPhases, pendingConfirm }
}
