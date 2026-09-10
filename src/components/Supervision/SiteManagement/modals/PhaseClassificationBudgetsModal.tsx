import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Button, Alert, LoadingSpinner } from '../../../ui'
import { ProjectPhase } from '../../../../lib/supabase'
import { CostClassification, PhaseClassificationBudget } from '../types'
import { formatPhaseLabel } from '../../../../utils/phaseLabel'
import {
  fetchPhaseClassificationBudgets,
  fetchTICClassificationTotals
} from '../services/siteService'
import type { ClassificationTotals } from '../../../Funding/TIC/utils/ticBudget'
import { formatEuroRounded as money } from '../../../../utils/formatters'

interface Props {
  visible: boolean
  phase: ProjectPhase | null
  classifications: CostClassification[]
  /** The project this phase belongs to — its TIC is the source of the planned amounts. */
  projectId: string
  /** Every phase of the project, so "already taken by other phases" can be computed. */
  projectPhaseIds: string[]
  onClose: () => void
}


/**
 * A phase's budget broken down by cost classification.
 *
 * Read-only: every figure here is derived from the project's TIC, which is the only writer of
 * planned budget. The "other phases" column is kept because on a multi-phase project it says
 * where the rest of a classification's plan went.
 */
export const PhaseClassificationBudgetsModal: React.FC<Props> = ({
  visible,
  phase,
  classifications,
  projectId,
  projectPhaseIds,
  onClose
}) => {
  const { t } = useTranslation()
  const [amounts, setAmounts] = useState<Record<number, number>>({})
  // The project's TIC plan, and every phase's existing sub-allocation — together these say how
  // much of each classification is still undistributed.
  const [ticTotals, setTicTotals] = useState<ClassificationTotals | null>(null)
  const [allPhaseRows, setAllPhaseRows] = useState<PhaseClassificationBudget[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible || !phase) return
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        // Every phase of the project, not just this one: "already taken by other phases" is what
        // makes the TIC remainder meaningful on a multi-phase project.
        const [rows, tic] = await Promise.all([
          fetchPhaseClassificationBudgets(projectPhaseIds),
          fetchTICClassificationTotals(projectId)
        ])
        if (cancelled) return
        setAllPhaseRows(rows)
        setTicTotals(tic)
        setAmounts(Object.fromEntries(
          rows.filter(r => r.phase_id === phase.id).map(r => [r.classification_id, r.budget_allocated])
        ))
      } catch (e) {
        console.error('Error loading classification budgets:', e)
        if (!cancelled) setError(t('supervision.cost_classification.errors.save_error'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [visible, phase, projectId, projectPhaseIds, t])

  if (!visible || !phase) return null

  const totalAllocated = Object.values(amounts).reduce((sum, v) => sum + (v || 0), 0)
  const difference = phase.budget_allocated - totalAllocated

  const takenElsewhere = (classificationId: number) =>
    allPhaseRows
      .filter(r => r.phase_id !== phase.id && r.classification_id === classificationId)
      .reduce((sum, r) => sum + r.budget_allocated, 0)

  const hasTicPlan = ticTotals !== null && ticTotals.total > 0

  return (
    <Modal show={visible} onClose={onClose} size="lg">
      <Modal.Header
        title={t('supervision.site_management.classification_budgets.title')}
        subtitle={`${formatPhaseLabel(phase, t('common.phase'))} — ${money(phase.budget_allocated)}`}
        onClose={onClose}
      />
      <Modal.Body>
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}

        {loading ? (
          <LoadingSpinner />
        ) : classifications.length === 0 ? (
          <Alert variant="info">
            {t('supervision.site_management.classification_budgets.no_classifications')}
          </Alert>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {hasTicPlan
                ? t('general_projects.budget_from_tic_hint')
                : t('supervision.site_management.classification_budgets.tic_missing')}
            </p>

            <div className="flex items-center gap-4 pb-1 text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
              <span className="flex-1">{t('supervision.site_management.phase_card.classification_label')}</span>
              <span className="w-28 text-right">{t('supervision.site_management.classification_budgets.tic_plan')}</span>
              <span className="w-28 text-right">{t('supervision.site_management.classification_budgets.other_phases')}</span>
              <span className="w-48 text-right">{t('supervision.site_management.classification_budgets.this_phase')}</span>
            </div>

            <div className="space-y-2">
              {classifications.map(c => {
                const planned = ticTotals?.byClassification.get(c.id)
                const elsewhere = takenElsewhere(c.id)
                return (
                  <div key={c.id} className="flex items-center gap-4">
                    <span className="flex-1 text-sm text-gray-900 dark:text-white">{c.name}</span>
                    {/* Read-only context: what the TIC plans, and how much of it other phases
                        have already taken. The editable figure is this phase's own share. */}
                    <span className="w-28 text-right text-sm tabular-nums text-gray-600 dark:text-gray-400">
                      {planned === undefined ? '—' : money(planned)}
                    </span>
                    <span className="w-28 text-right text-sm tabular-nums text-gray-500 dark:text-gray-500">
                      {elsewhere > 0 ? money(elsewhere) : '—'}
                    </span>
                    <span className="w-48 text-right text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                      {amounts[c.id] ? money(amounts[c.id]) : '—'}
                    </span>
                  </div>
                )
              })}
            </div>

            {ticTotals !== null && ticTotals.unmapped > 0 && (
              <Alert variant="warning" className="mt-4">
                {t('supervision.site_management.classification_budgets.tic_unmapped', {
                  amount: money(ticTotals.unmapped)
                })}
              </Alert>
            )}
          </>
        )}

        <div className="mt-6 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('supervision.site_management.classification_budgets.phase_budget')}
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{money(phase.budget_allocated)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('supervision.site_management.classification_budgets.total_allocated')}
              </p>
              <p className={`text-lg font-bold ${difference < 0 ? 'text-orange-600' : 'text-gray-900 dark:text-white'}`}>
                {money(totalAllocated)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('supervision.site_management.phase_card.unallocated')}
              </p>
              <p className={`text-lg font-bold ${difference < 0 ? 'text-red-600' : difference === 0 ? 'text-green-600' : 'text-blue-600'}`}>
                {money(difference)}
              </p>
            </div>
          </div>
          {difference < 0 && (
            <Alert variant="warning" className="mt-4">
              {t('supervision.site_management.classification_budgets.over_phase_budget')}
            </Alert>
          )}
          {difference > 0 && (
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              {t('supervision.site_management.classification_budgets.unallocated_note')}
            </p>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
