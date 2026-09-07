import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Button, Input } from '../../../ui'
import {
  formatNumber,
  formatPercentage,
  calculateRowPercentages,
  type LineItem,
  type TICTotals,
} from '../utils/ticFormatters'

const CELL = 'border border-gray-300 dark:border-gray-600'

interface InvestmentTableProps {
  lineItems: LineItem[]
  totals: TICTotals
  grandTotal: number
  onUpdate: (index: number, patch: Partial<LineItem>) => void
  onAdd: () => void
  onRemove: (index: number) => void
  onMove: (index: number, direction: -1 | 1) => void
}

const InvestmentTable: React.FC<InvestmentTableProps> = ({
  lineItems,
  totals,
  grandTotal,
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
              <th className={`${CELL} px-4 py-3 text-center font-bold text-gray-900 dark:text-white`} colSpan={2}>
                {t('tic.col_own_funds')}
              </th>
              <th className={`${CELL} px-4 py-3 text-center font-bold text-gray-900 dark:text-white`} colSpan={2}>
                {t('tic.col_credit_funds')}
              </th>
              <th className={`${CELL} px-4 py-3 text-center font-bold text-gray-900 dark:text-white`}>
                {t('tic.col_total_investment')}
              </th>
              <th className={`${CELL} px-2 py-3 w-px`}>
                <span className="sr-only">{t('tic.col_actions')}</span>
              </th>
            </tr>
            <tr className="bg-gray-50 dark:bg-gray-700/50">
              <th className={`${CELL} px-4 py-2`}></th>
              <th className={`${CELL} px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200`}>EUR</th>
              <th className={`${CELL} px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200`}>(%)</th>
              <th className={`${CELL} px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200`}>EUR</th>
              <th className={`${CELL} px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200`}>(%)</th>
              <th className={`${CELL} px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200`}>EUR</th>
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
    </div>
  )
}

export default InvestmentTable
