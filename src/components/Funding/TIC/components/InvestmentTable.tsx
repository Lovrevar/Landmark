import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Button, ConfirmDialog, Input, Select } from '../../../ui'
import {
  formatNumber,
  formatPercentage,
  calculateRowPercentages,
  type LineItem,
  type LineItemPhaseAmount,
  type TICTotals,
} from '../utils/ticFormatters'
import type { CostClassification } from '../../../../lib/supabase'
import type { ClassificationTotals } from '../utils/ticBudget'
import { lineItemPhaseTotal, isPhased, hasPhaseSplitMismatch } from '../utils/ticBudget'
import PhaseSplitModal from '../modals/PhaseSplitModal'

const CELL = 'border border-gray-300 dark:border-gray-600'

interface InvestmentTableProps {
  lineItems: LineItem[]
  totals: TICTotals
  grandTotal: number
  /** Active cost classifications, for the per-row select that drives the phase budgets. */
  classifications: CostClassification[]
  /** Derived per-classification totals, shown under the table. */
  classificationTotals: ClassificationTotals
  /** Phase ordinals the TIC plans, ascending. Empty for an unphased TIC. */
  phaseNumbers: number[]
  onUpdate: (index: number, patch: Partial<LineItem>) => void
  onAdd: () => void
  onRemove: (index: number) => void
  onMove: (index: number, direction: -1 | 1) => void
  /** Replaces one row's split; `undefined` marks the cost as project-level rather than phased. */
  onSetPhases: (index: number, phases: LineItemPhaseAmount[] | undefined) => void
  onAddPhase: () => void
  onRemovePhase: (phaseNumber: number) => void
}

const InvestmentTable: React.FC<InvestmentTableProps> = ({
  lineItems,
  totals,
  grandTotal,
  classifications,
  classificationTotals,
  phaseNumbers,
  onUpdate,
  onAdd,
  onRemove,
  onMove,
  onSetPhases,
  onAddPhase,
  onRemovePhase,
}) => {
  const { t } = useTranslation()
  // Which row's phase split is open. An index rather than the row itself, so the modal always
  // reads the live figures after an edit in the table behind it.
  const [editingPhasesFor, setEditingPhasesFor] = useState<number | null>(null)
  const editingItem = editingPhasesFor === null ? null : lineItems[editingPhasesFor] ?? null
  // Dropping a phase takes its amounts out of every row at once, so it is confirmed the same way
  // removing a whole GRAĐENJE section is.
  const [phasePendingRemoval, setPhasePendingRemoval] = useState<number | null>(null)
  const rowsInPendingPhase =
    phasePendingRemoval === null
      ? 0
      : lineItems.filter(i => i.phases?.some(p => p.phase_number === phasePendingRemoval)).length

  return (
    <div>
      <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white mb-6 uppercase">
        {t('tic.table_heading')}
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className={`${CELL} px-4 py-3 text-left font-bold text-gray-900 dark:text-white`}>
                {t('tic.col_purpose')}
              </th>
              <th className={`${CELL} px-4 py-3 text-left font-bold text-gray-900 dark:text-white`}>
                {t('tic.col_classification')}
              </th>
              <th className={`${CELL} px-4 py-3 text-center font-bold text-gray-900 dark:text-white`} colSpan={2}>
                {t('tic.col_own_funds')}
              </th>
              <th className={`${CELL} px-4 py-3 text-center font-bold text-gray-900 dark:text-white`} colSpan={2}>
                {t('tic.col_credit_funds')}
              </th>
              <th className={`${CELL} px-4 py-3 text-center font-bold text-gray-900 dark:text-white`}>
                {t('tic.col_total_investment')}
              </th>
              {phaseNumbers.map(n => (
                <th key={n} className={`${CELL} px-4 py-3 text-center font-bold text-gray-900 dark:text-white`}>
                  <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                    <span>{t('common.phase')} {n}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      icon={Trash2}
                      onClick={() => setPhasePendingRemoval(n)}
                      title={t('tic.phases.remove_phase', { number: n })}
                      aria-label={t('tic.phases.remove_phase', { number: n })}
                    />
                  </div>
                </th>
              ))}
              <th className={`${CELL} px-2 py-3 w-px`}>
                <span className="sr-only">{t('tic.col_actions')}</span>
              </th>
            </tr>
            <tr className="bg-gray-50 dark:bg-gray-700/50">
              <th className={`${CELL} px-4 py-2`}></th>
              <th className={`${CELL} px-4 py-2`}></th>
              <th className={`${CELL} px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200`}>EUR</th>
              <th className={`${CELL} px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200`}>(%)</th>
              <th className={`${CELL} px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200`}>EUR</th>
              <th className={`${CELL} px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200`}>(%)</th>
              <th className={`${CELL} px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200`}>EUR</th>
              {phaseNumbers.map(n => (
                <th key={n} className={`${CELL} px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200`}>EUR</th>
              ))}
              <th className={`${CELL} px-2 py-2`}></th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => {
              const rowTotal = item.vlastita + item.kreditna
              const vlastitaPercent = calculateRowPercentages(item.vlastita, grandTotal)
              const kreditnaPercent = calculateRowPercentages(item.kreditna, grandTotal)

              return (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className={`${CELL} px-2 py-2 min-w-[16rem]`}>
                    <Input
                      value={item.name}
                      onChange={(e) => onUpdate(index, { name: e.target.value })}
                      placeholder={t('tic.row_name_placeholder')}
                      className="px-2 py-1 border-gray-200 dark:border-gray-600"
                    />
                  </td>
                  <td className={`${CELL} px-2 py-2 min-w-[12rem]`}>
                    <Select
                      value={item.classification_id ?? ''}
                      onChange={(e) =>
                        onUpdate(index, { classification_id: e.target.value ? parseInt(e.target.value) : null })
                      }
                      className="px-2 py-1 border-gray-200 dark:border-gray-600"
                    >
                      <option value="">{t('tic.classification_unmapped')}</option>
                      {classifications.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Select>
                  </td>
                  <td className={`${CELL} px-2 py-2`}>
                    <Input
                      type="number"
                      value={item.vlastita}
                      onChange={(e) => onUpdate(index, { vlastita: parseFloat(e.target.value) || 0 })}
                      className="px-2 py-1 text-right border-gray-200 dark:border-gray-600"
                      step="0.01"
                    />
                  </td>
                  <td className={`${CELL} px-4 py-2 text-right text-gray-700 dark:text-gray-200`}>
                    {formatPercentage(vlastitaPercent)}%
                  </td>
                  <td className={`${CELL} px-2 py-2`}>
                    <Input
                      type="number"
                      value={item.kreditna}
                      onChange={(e) => onUpdate(index, { kreditna: parseFloat(e.target.value) || 0 })}
                      className="px-2 py-1 text-right border-gray-200 dark:border-gray-600"
                      step="0.01"
                    />
                  </td>
                  <td className={`${CELL} px-4 py-2 text-right text-gray-700 dark:text-gray-200`}>
                    {formatPercentage(kreditnaPercent)}%
                  </td>
                  <td className={`${CELL} px-4 py-2 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap`}>
                    <span className="inline-flex items-center justify-end gap-1.5">
                      {/* Editing a row's funds after splitting it pulls the two apart. Neither
                          side is corrected automatically — only the author knows which is wrong. */}
                      {hasPhaseSplitMismatch(item) && (
                        <span title={t('tic.phases.row_mismatch')} aria-label={t('tic.phases.row_mismatch')}>
                          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        </span>
                      )}
                      {formatNumber(rowTotal)}
                    </span>
                  </td>
                  {phaseNumbers.map(n => (
                    <td key={n} className={`${CELL} p-0`}>
                      {/* A cost incurred once for the whole project belongs to no phase. Showing
                          it as "—" rather than repeating the full figure is the difference
                          between a plan that adds up and one that overstates itself. */}
                      <button
                        type="button"
                        onClick={() => setEditingPhasesFor(index)}
                        title={isPhased(item) ? t('tic.phases.edit_cell_title') : t('tic.phases.unphased_cell_title')}
                        className={`w-full px-4 py-2 text-right whitespace-nowrap hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                          isPhased(item) ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-600'
                        }`}
                      >
                        {isPhased(item) ? formatNumber(lineItemPhaseTotal(item, n)) : '—'}
                      </button>
                    </td>
                  ))}
                  <td className={`${CELL} px-2 py-2`}>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        icon={ChevronUp}
                        disabled={index === 0}
                        onClick={() => onMove(index, -1)}
                        title={t('tic.move_up')}
                        aria-label={t('tic.move_up')}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        icon={ChevronDown}
                        disabled={index === lineItems.length - 1}
                        onClick={() => onMove(index, 1)}
                        title={t('tic.move_down')}
                        aria-label={t('tic.move_down')}
                      />
                      <Button
                        variant="outline-danger"
                        size="icon-sm"
                        icon={Trash2}
                        onClick={() => onRemove(index)}
                        title={t('tic.remove_row')}
                        aria-label={t('tic.remove_row')}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
            <tr className="bg-blue-50 dark:bg-blue-900/30 font-bold">
              <td className={`${CELL} px-4 py-3 text-gray-900 dark:text-white uppercase`}>{t('tic.total_row')}</td>
              <td className={`${CELL} px-4 py-3`}></td>
              <td className={`${CELL} px-4 py-3 text-right text-blue-900 dark:text-blue-100`}>
                {formatNumber(totals.vlastita)}
              </td>
              <td className={`${CELL} px-4 py-3 text-right text-blue-900 dark:text-blue-100`}>
                {formatPercentage(calculateRowPercentages(totals.vlastita, grandTotal))}%
              </td>
              <td className={`${CELL} px-4 py-3 text-right text-blue-900 dark:text-blue-100`}>
                {formatNumber(totals.kreditna)}
              </td>
              <td className={`${CELL} px-4 py-3 text-right text-blue-900 dark:text-blue-100`}>
                {formatPercentage(calculateRowPercentages(totals.kreditna, grandTotal))}%
              </td>
              <td className={`${CELL} px-4 py-3 text-right text-blue-900 dark:text-blue-100`}>
                {formatNumber(grandTotal)}
              </td>
              {phaseNumbers.map(n => (
                <td key={n} className={`${CELL} px-4 py-3 text-right text-blue-900 dark:text-blue-100`}>
                  {formatNumber(lineItems.reduce((sum, i) => sum + lineItemPhaseTotal(i, n), 0))}
                </td>
              ))}
              <td className={`${CELL} px-2 py-3`}></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" icon={Plus} onClick={onAdd}>
          {t('tic.add_row')}
        </Button>
        <Button variant="secondary" size="sm" icon={Plus} onClick={onAddPhase}>
          {t('tic.phases.add_phase')}
        </Button>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {phaseNumbers.length === 0 ? t('tic.phases.unphased_hint') : t('tic.phases.edit_hint')}
        </p>
      </div>

      <ConfirmDialog
        show={phasePendingRemoval !== null}
        title={t('tic.phases.remove_phase_title', { number: phasePendingRemoval ?? 0 })}
        message={t('tic.phases.remove_phase_confirm', {
          number: phasePendingRemoval ?? 0,
          count: rowsInPendingPhase,
        })}
        onConfirm={() => {
          if (phasePendingRemoval !== null) onRemovePhase(phasePendingRemoval)
          setPhasePendingRemoval(null)
        }}
        onCancel={() => setPhasePendingRemoval(null)}
      />

      {editingItem && (
        <PhaseSplitModal
          show
          onClose={() => setEditingPhasesFor(null)}
          itemName={editingItem.name}
          vlastita={editingItem.vlastita}
          kreditna={editingItem.kreditna}
          phaseCount={phaseNumbers.length}
          phases={editingItem.phases}
          onSave={(phases) => onSetPhases(editingPhasesFor!, phases)}
        />
      )}

      {/* What Site Management will populate the phase budgets from. Shown here so the effect of
          a classification choice is visible where the choice is made, rather than only on
          another screen in another module. */}
      <div className="mt-6 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
          {t('tic.classification_summary')}
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {classifications.map((c) => {
            const amount = classificationTotals.byClassification.get(c.id)
            if (amount === undefined) return null
            return (
              <div key={c.id}>
                <p className="text-xs text-gray-600 dark:text-gray-400">{c.name}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatNumber(amount)} €
                </p>
              </div>
            )
          })}
          {classificationTotals.unmapped > 0 && (
            <div>
              <p className="text-xs text-orange-600 dark:text-orange-400">
                {t('tic.classification_unmapped_total')}
              </p>
              <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                {formatNumber(classificationTotals.unmapped)} €
              </p>
            </div>
          )}
        </div>
        {classificationTotals.unmapped > 0 && (
          <p className="mt-3 text-xs text-orange-700 dark:text-orange-400">
            {t('tic.classification_unmapped_hint')}
          </p>
        )}
      </div>
    </div>
  )
}

export default InvestmentTable
