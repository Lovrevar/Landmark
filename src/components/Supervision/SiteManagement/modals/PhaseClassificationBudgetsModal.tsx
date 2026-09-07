import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Input, Button, Alert, LoadingSpinner } from '../../../ui'
import { ProjectPhase } from '../../../../lib/supabase'
import { CostClassification, PhaseClassificationBudget } from '../types'
import { formatPhaseLabel } from '../utils/phaseLabel'
import {
  fetchPhaseClassificationBudgets,
  bulkUpsertPhaseClassificationBudgets
} from '../services/siteService'

interface Props {
  visible: boolean
  phase: ProjectPhase | null
  classifications: CostClassification[]
  onClose: () => void
  onSaved: () => void
}

const money = (value: number) => `€${value.toLocaleString('hr-HR')}`

/**
 * Distributes a phase's budget across cost classifications — the screen where the planning
 * actually happens: one row per active classification, and a running total against the phase
 * budget.
 *
 * The total is deliberately allowed not to match. Sub-allocations are optional, and the
 * remainder is shown as "Neraspoređeno" rather than blocking the save.
 */
export const PhaseClassificationBudgetsModal: React.FC<Props> = ({
  visible,
  phase,
  classifications,
  onClose,
  onSaved
}) => {
  const { t } = useTranslation()
  const [amounts, setAmounts] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible || !phase) return
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const rows: PhaseClassificationBudget[] = await fetchPhaseClassificationBudgets([phase.id])
        if (cancelled) return
        setAmounts(Object.fromEntries(rows.map(r => [r.classification_id, r.budget_allocated])))
      } catch (e) {
        console.error('Error loading classification budgets:', e)
        if (!cancelled) setError(t('supervision.cost_classification.errors.save_error'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [visible, phase, t])

  if (!visible || !phase) return null

  const totalAllocated = Object.values(amounts).reduce((sum, v) => sum + (v || 0), 0)
  const difference = phase.budget_allocated - totalAllocated

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      await bulkUpsertPhaseClassificationBudgets(
        phase.id,
        classifications.map(c => ({
          classification_id: c.id,
          budget_allocated: amounts[c.id] || 0
        }))
      )
      onSaved()
      onClose()
    } catch (e) {
      console.error('Error saving classification budgets:', e)
      setError(t('supervision.cost_classification.errors.save_error'))
    } finally {
      setSaving(false)
    }
  }

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
          <div className="space-y-2">
            {classifications.map(c => (
              <div key={c.id} className="flex items-center gap-4">
                <span className="flex-1 text-sm text-gray-900 dark:text-white">{c.name}</span>
                <div className="w-48">
                  <Input
                    type="number"
                    value={amounts[c.id] ?? 0}
                    onChange={(e) =>
                      setAmounts(prev => ({ ...prev, [c.id]: parseFloat(e.target.value) || 0 }))
                    }
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>
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
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={handleSave} loading={saving} disabled={loading}>
          {t('supervision.site_management.classification_budgets.save')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
