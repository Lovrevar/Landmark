import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Button, Input, Select } from '../../../ui'
import {
  formatNumber,
  formatPercentage,
  calculateRowPercentages,
  type LineItem,
  type TICTotals,
} from '../utils/ticFormatters'
import type { CostClassification } from '../../../../lib/supabase'
import type { ClassificationTotals } from '../utils/ticBudget'
import { lineItemPhaseTotal, isPhased } from '../utils/ticBudget'

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
}) => {
  const { t } = useTranslation()

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
                  {t('common.phase')} {n}
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
                    {formatNumber(rowTotal)}
                  </td>
                  {phaseNumbers.map(n => (
                    <td key={n} className={`${CELL} px-4 py-2 text-right whitespace-nowrap ${
                      isPhased(item) ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-600'
                    }`}>
                      {/* A cost incurred once for the whole project belongs to no phase. Showing
                          it as "—" rather than repeating the full figure is the difference
                          between a plan that adds up and one that overstates itself. */}
                      {isPhased(item) ? formatNumber(lineItemPhaseTotal(item, n)) : '—'}
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

      <div className="mt-4">
        <Button variant="secondary" size="sm" icon={Plus} onClick={onAdd}>
          {t('tic.add_row')}
        </Button>
      </div>

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
