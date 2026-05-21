import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addDays, format, parseISO } from 'date-fns'
import { Modal, Button, FormField, Input, Alert, Select } from '../../../ui'
import SegmentedControl from '../../../ui/SegmentedControl'
import {
  RESIDENTIAL_HR_TEMPLATE,
  type ConstructionPhaseId,
  type MilestoneTemplate,
  type MilestoneTemplateItem
} from '../data/milestoneTemplates'

type Scope = 'all' | 'phase' | 'pick'
type DateStrategy = 'empty' | 'auto'

interface Props {
  show: boolean
  onClose: () => void
  projectId: string
  projectStartDate: string | null
  onSubmit: (rows: Array<{ name: string; due_date: string | null; phase: string | null }>) => Promise<void>
}

interface SelectedItem {
  phaseId: ConstructionPhaseId
  phaseLabel: string
  item: MilestoneTemplateItem
}

const itemKey = (phaseId: ConstructionPhaseId, index: number) => `${phaseId}::${index}`

function MilestoneTemplateModal({ show, onClose, projectStartDate, onSubmit }: Props) {
  const { t } = useTranslation()
  const template: MilestoneTemplate = RESIDENTIAL_HR_TEMPLATE

  const [scope, setScope] = useState<Scope>('all')
  const [selectedPhaseId, setSelectedPhaseId] = useState<ConstructionPhaseId>(template.phases[0].id)
  const [pickedItems, setPickedItems] = useState<Set<string>>(new Set())
  const [dateStrategy, setDateStrategy] = useState<DateStrategy>('empty')
  const [startDateInput, setStartDateInput] = useState<string>(projectStartDate ?? '')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!show) return
    setScope('all')
    setSelectedPhaseId(template.phases[0].id)
    setPickedItems(new Set())
    setDateStrategy('empty')
    setStartDateInput(projectStartDate ?? '')
    setSubmitting(false)
  }, [show, projectStartDate, template.phases])

  const selectedItems: SelectedItem[] = useMemo(() => {
    if (scope === 'all') {
      return template.phases.flatMap(phase =>
        phase.items.map(item => ({ phaseId: phase.id, phaseLabel: phase.phaseLabel, item }))
      )
    }
    if (scope === 'phase') {
      const phase = template.phases.find(p => p.id === selectedPhaseId)
      if (!phase) return []
      return phase.items.map(item => ({ phaseId: phase.id, phaseLabel: phase.phaseLabel, item }))
    }
    const out: SelectedItem[] = []
    template.phases.forEach(phase => {
      phase.items.forEach((item, idx) => {
        if (pickedItems.has(itemKey(phase.id, idx))) {
          out.push({ phaseId: phase.id, phaseLabel: phase.phaseLabel, item })
        }
      })
    })
    return out
  }, [scope, selectedPhaseId, pickedItems, template.phases])

  const perPhaseCounts = useMemo(() => {
    const map = new Map<string, { phaseLabel: string; count: number }>()
    for (const sel of selectedItems) {
      const existing = map.get(sel.phaseId)
      if (existing) existing.count += 1
      else map.set(sel.phaseId, { phaseLabel: sel.phaseLabel, count: 1 })
    }
    return Array.from(map.values())
  }, [selectedItems])

  const startDateValid = dateStrategy !== 'auto' || (startDateInput !== '' && !Number.isNaN(parseISO(startDateInput).getTime()))

  const dateRange = useMemo(() => {
    if (dateStrategy !== 'auto' || !startDateValid || selectedItems.length === 0) return null
    const start = parseISO(startDateInput)
    const offsets = selectedItems.map(s => s.item.offsetDays)
    const minOffset = Math.min(...offsets)
    const maxOffset = Math.max(...offsets)
    return {
      min: format(addDays(start, minOffset), 'd. MMM yyyy.'),
      max: format(addDays(start, maxOffset), 'd. MMM yyyy.')
    }
  }, [dateStrategy, startDateInput, selectedItems, startDateValid])

  const togglePicked = (phaseId: ConstructionPhaseId, index: number) => {
    setPickedItems(prev => {
      const next = new Set(prev)
      const key = itemKey(phaseId, index)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const togglePhaseSelectAll = (phaseId: ConstructionPhaseId) => {
    const phase = template.phases.find(p => p.id === phaseId)
    if (!phase) return
    const keys = phase.items.map((_, idx) => itemKey(phase.id, idx))
    const allSelected = keys.every(k => pickedItems.has(k))
    setPickedItems(prev => {
      const next = new Set(prev)
      if (allSelected) keys.forEach(k => next.delete(k))
      else keys.forEach(k => next.add(k))
      return next
    })
  }

  const submitDisabled = submitting || selectedItems.length === 0 || (dateStrategy === 'auto' && !startDateValid)

  const handleSubmit = async () => {
    if (submitDisabled) return
    setSubmitting(true)
    try {
      const start = dateStrategy === 'auto' ? parseISO(startDateInput) : null
      const rows = selectedItems.map(({ phaseLabel, item }) => ({
        name: item.name,
        phase: phaseLabel,
        due_date: start ? format(addDays(start, item.offsetDays), 'yyyy-MM-dd') : null
      }))
      await onSubmit(rows)
      onClose()
    } catch {
      setSubmitting(false)
    }
  }

  const scopeOptions = [
    { value: 'all' as Scope, label: t('general_projects.milestone_template.scope_all') },
    { value: 'phase' as Scope, label: t('general_projects.milestone_template.scope_phase') },
    { value: 'pick' as Scope, label: t('general_projects.milestone_template.scope_pick') }
  ]

  const dateOptions = [
    { value: 'empty' as DateStrategy, label: t('general_projects.milestone_template.date_empty') },
    { value: 'auto' as DateStrategy, label: t('general_projects.milestone_template.date_auto') }
  ]

  return (
    <Modal show={show} onClose={onClose} size="lg">
      <Modal.Header
        title={t('general_projects.milestone_template.modal_title')}
        subtitle={t('general_projects.milestone_template.modal_subtitle')}
        onClose={onClose}
      />
      <Modal.Body>
        <FormField label={t('general_projects.milestone_template.template_label')}>
          <div className="text-sm text-gray-700 dark:text-gray-200 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-md">
            {t(template.labelKey)}
          </div>
        </FormField>

        <FormField label={t('general_projects.milestone_template.scope_label')}>
          <SegmentedControl<Scope> value={scope} onChange={setScope} options={scopeOptions} />
        </FormField>

        {scope === 'phase' && (
          <FormField label={t('general_projects.milestone_template.phase_label')}>
            <Select
              value={selectedPhaseId}
              onChange={(e) => setSelectedPhaseId(e.target.value as ConstructionPhaseId)}
            >
              {template.phases.map(phase => (
                <option key={phase.id} value={phase.id}>
                  {phase.phaseLabel} ({phase.items.length})
                </option>
              ))}
            </Select>
          </FormField>
        )}

        {scope === 'pick' && (
          <div className="space-y-3">
            {template.phases.map(phase => {
              const phaseKeys = phase.items.map((_, idx) => itemKey(phase.id, idx))
              const allSelected = phaseKeys.every(k => pickedItems.has(k))
              const someSelected = phaseKeys.some(k => pickedItems.has(k))
              return (
                <div key={phase.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-700/50">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={el => { if (el) el.indeterminate = !allSelected && someSelected }}
                        onChange={() => togglePhaseSelectAll(phase.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                      />
                      <span className="ml-2 text-sm font-semibold text-gray-900 dark:text-white">{phase.phaseLabel}</span>
                    </label>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {phaseKeys.filter(k => pickedItems.has(k)).length}/{phase.items.length}
                    </span>
                  </div>
                  <div className="px-4 py-2 space-y-1.5 bg-white dark:bg-gray-800">
                    {phase.items.map((item, idx) => {
                      const key = itemKey(phase.id, idx)
                      return (
                        <label key={key} className="flex items-center cursor-pointer text-sm text-gray-700 dark:text-gray-200">
                          <input
                            type="checkbox"
                            checked={pickedItems.has(key)}
                            onChange={() => togglePicked(phase.id, idx)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                          />
                          <span className="ml-2">{item.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <FormField label={t('general_projects.milestone_template.date_label')}>
          <SegmentedControl<DateStrategy> value={dateStrategy} onChange={setDateStrategy} options={dateOptions} />
        </FormField>

        {dateStrategy === 'auto' && (
          <FormField
            label={t('general_projects.milestone_template.start_date_label')}
            error={!startDateValid ? t('general_projects.milestone_template.start_date_required') : undefined}
            helperText={t('general_projects.milestone_template.date_auto_hint')}
          >
            <Input
              type="date"
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
            />
          </FormField>
        )}

        <Alert variant="info">
          <p className="font-semibold mb-2">
            {t('general_projects.milestone_template.preview_count', {
              count: selectedItems.length,
              phases: perPhaseCounts.length
            })}
          </p>
          {perPhaseCounts.length > 0 && (
            <ul className="space-y-0.5 list-disc list-inside">
              {perPhaseCounts.map(p => (
                <li key={p.phaseLabel}>
                  {p.phaseLabel}: {t('general_projects.milestone_template.preview_phase_count', { count: p.count })}
                </li>
              ))}
            </ul>
          )}
          {dateRange && (
            <p className="mt-2">
              {t('general_projects.milestone_template.preview_date_range', {
                min: dateRange.min,
                max: dateRange.max
              })}
            </p>
          )}
        </Alert>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSubmit} disabled={submitDisabled} loading={submitting}>
          {t('general_projects.milestone_template.submit')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default MilestoneTemplateModal
