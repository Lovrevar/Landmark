import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { Modal, Button, Badge, Alert, Input, LoadingSpinner } from '../../../ui'
import { CostClassification } from '../types'
import {
  fetchCostClassifications,
  updateCostClassification,
  deleteCostClassification,
  countClassificationUsage
} from '../services/siteService'
import { CostClassificationFormModal } from './CostClassificationFormModal'

interface Props {
  visible: boolean
  onClose: () => void
  onChanged: () => void
}

/**
 * Manage the global cost classification list.
 *
 * The seven seeded rows are system rows: their name is read-only and they cannot be deleted.
 * That is enforced by a database trigger; the read-only treatment here is so the UI explains
 * why rather than surfacing a raw error. Deactivating a system row IS allowed, so a company
 * that never buys land can hide "Zemljište" without losing its history.
 */
export const ManageCostClassificationsModal: React.FC<Props> = ({ visible, onClose, onChanged }) => {
  const { t } = useTranslation()
  const [rows, setRows] = useState<CostClassification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      setRows(await fetchCostClassifications(true))
    } catch (e) {
      console.error('Error loading cost classifications:', e)
      setError(t('supervision.cost_classification.errors.save_error'))
    } finally {
      setLoading(false)
    }
  }

  // `load` is recreated each render; depending on it would refetch in a loop. Reloading when the
  // modal opens is the intended behaviour.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (visible) load() }, [visible])

  const toggleActive = async (row: CostClassification) => {
    try {
      await updateCostClassification(row.id, { is_active: !row.is_active })
      await load()
      onChanged()
    } catch (e) {
      console.error('Error updating cost classification:', e)
      setError(t('supervision.cost_classification.errors.save_error'))
    }
  }

  const remove = async (row: CostClassification) => {
    try {
      setError(null)
      const usage = await countClassificationUsage(row.id)
      if (usage.contracts > 0 || usage.budgets > 0) {
        setError(t('supervision.cost_classification.errors.in_use'))
        return
      }
      await deleteCostClassification(row.id)
      await load()
      onChanged()
    } catch (e) {
      console.error('Error deleting cost classification:', e)
      setError(t('supervision.cost_classification.errors.in_use'))
    }
  }

  if (!visible) return null

  return (
    <Modal show={visible} onClose={onClose} size="lg">
      <Modal.Header
        title={t('supervision.cost_classification.manage_title')}
        subtitle={t('supervision.cost_classification.subtitle')}
        onClose={onClose}
      />
      <Modal.Body>
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}

        {loading ? <LoadingSpinner /> : (
          <div className="space-y-2">
            {rows.map(row => (
              <div
                key={row.id}
                className="flex items-center gap-3 py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <span className={`flex-1 text-sm ${row.is_active ? 'text-gray-900 dark:text-white' : 'text-gray-400 line-through'}`}>
                  {row.name}
                </span>
                {row.is_system && (
                  <Badge variant="gray" size="sm">{t('supervision.cost_classification.system_badge')}</Badge>
                )}
                <div className="w-20">
                  <Input
                    type="number"
                    value={row.sort_order}
                    onChange={(e) => {
                      const sort_order = parseInt(e.target.value) || 0
                      setRows(prev => prev.map(r => (r.id === row.id ? { ...r, sort_order } : r)))
                    }}
                    onBlur={() => updateCostClassification(row.id, { sort_order: row.sort_order }).then(onChanged)}
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={() => toggleActive(row)}>
                  {row.is_active ? t('common.deactivate') : t('common.activate')}
                </Button>
                {!row.is_system && (
                  <Button variant="outline-danger" size="icon-sm" icon={Trash2} onClick={() => remove(row)} />
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          {t('supervision.cost_classification.system_hint')}
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          {t('supervision.cost_classification.title_create')}
        </Button>
      </Modal.Footer>

      <CostClassificationFormModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { load(); onChanged() }}
      />
    </Modal>
  )
}
