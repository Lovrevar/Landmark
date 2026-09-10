import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Button, ConfirmDialog, Input } from '../../../ui'
import {
  formatNumber,
  formatPercentage,
  calculateRowPercentages,
  calculateSectionTotals,
  type ConstructionItem,
  type ConstructionSection,
  type TICTotals,
} from '../utils/ticFormatters'

const CELL = 'border border-gray-300 dark:border-gray-600'

interface ConstructionTableProps {
  sections: ConstructionSection[]
  totals: TICTotals
  grandTotal: number
  onUpdateSection: (sectionIndex: number, patch: Partial<Omit<ConstructionSection, 'items'>>) => void
  onAddSection: () => void
  onRemoveSection: (sectionIndex: number) => void
  onMoveSection: (sectionIndex: number, direction: -1 | 1) => void
  onUpdateItem: (sectionIndex: number, itemIndex: number, patch: Partial<ConstructionItem>) => void
  onAddItem: (sectionIndex: number) => void
  onRemoveItem: (sectionIndex: number, itemIndex: number) => void
  onMoveItem: (sectionIndex: number, itemIndex: number, direction: -1 | 1) => void
}

const ConstructionTable: React.FC<ConstructionTableProps> = ({
  sections,
  totals,
  grandTotal,
  onUpdateSection,
  onAddSection,
  onRemoveSection,
  onMoveSection,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
  onMoveItem,
}) => {
  const { t } = useTranslation()
  const [sectionPendingRemoval, setSectionPendingRemoval] = useState<number | null>(null)

  const pendingSection = sectionPendingRemoval !== null ? sections[sectionPendingRemoval] : null

  return (
    <div>
      <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white mb-6 uppercase">
        {t('tic.construction_table_heading')}
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className={`${CELL} px-4 py-3 text-left font-bold text-gray-900 dark:text-white`} colSpan={2}>
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
              <th className={`${CELL} px-4 py-2`} colSpan={2}></th>
              <th className={`${CELL} px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200`}>EUR</th>
              <th className={`${CELL} px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200`}>(%)</th>
              <th className={`${CELL} px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200`}>EUR</th>
              <th className={`${CELL} px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200`}>(%)</th>
              <th className={`${CELL} px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200`}>EUR</th>
              <th className={`${CELL} px-2 py-2`}></th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section, sectionIndex) => {
              const sectionTotals = calculateSectionTotals(section)
              const sectionTotal = sectionTotals.vlastita + sectionTotals.kreditna

              return (
                <React.Fragment key={sectionIndex}>
                  <tr className="bg-gray-100 dark:bg-gray-700/70">
                    <td className={`${CELL} px-2 py-2 w-20`}>
                      <Input
                        value={section.code}
                        onChange={(e) => onUpdateSection(sectionIndex, { code: e.target.value })}
                        className="px-2 py-1 font-bold border-gray-200 dark:border-gray-600"
                      />
                    </td>
                    <td className={`${CELL} px-2 py-2`}>
                      <Input
                        value={section.name}
                        onChange={(e) => onUpdateSection(sectionIndex, { name: e.target.value })}
                        placeholder={t('tic.section_name_placeholder')}
                        className="px-2 py-1 font-bold uppercase border-gray-200 dark:border-gray-600"
                      />
                    </td>
                    <td className={`${CELL} px-4 py-2`} colSpan={5}></td>
                    <td className={`${CELL} px-2 py-2`}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          icon={ChevronUp}
                          disabled={sectionIndex === 0}
                          onClick={() => onMoveSection(sectionIndex, -1)}
                          title={t('tic.move_section_up')}
                          aria-label={t('tic.move_section_up')}
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          icon={ChevronDown}
                          disabled={sectionIndex === sections.length - 1}
                          onClick={() => onMoveSection(sectionIndex, 1)}
                          title={t('tic.move_section_down')}
                          aria-label={t('tic.move_section_down')}
                        />
                        <Button
                          variant="outline-danger"
                          size="icon-sm"
                          icon={Trash2}
                          onClick={() => setSectionPendingRemoval(sectionIndex)}
                          title={t('tic.remove_section')}
                          aria-label={t('tic.remove_section')}
                        />
                      </div>
                    </td>
                  </tr>

                  {section.items.map((item, itemIndex) => {
                    const rowTotal = item.vlastita + item.kreditna
                    const vlastitaPercent = calculateRowPercentages(item.vlastita, grandTotal)
                    const kreditnaPercent = calculateRowPercentages(item.kreditna, grandTotal)

                    return (
                      <tr key={itemIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className={`${CELL} px-2 py-2 w-20`}>
                          <Input
                            value={item.numeral}
                            onChange={(e) => onUpdateItem(sectionIndex, itemIndex, { numeral: e.target.value })}
                            className="px-2 py-1 border-gray-200 dark:border-gray-600"
                          />
                        </td>
                        <td className={`${CELL} px-2 py-2 min-w-[16rem]`}>
                          <Input
                            value={item.name}
                            onChange={(e) => onUpdateItem(sectionIndex, itemIndex, { name: e.target.value })}
                            placeholder={t('tic.row_name_placeholder')}
                            className="px-2 py-1 border-gray-200 dark:border-gray-600"
                          />
                        </td>
                        <td className={`${CELL} px-2 py-2`}>
                          <Input
                            type="number"
                            value={item.vlastita}
                            onChange={(e) =>
                              onUpdateItem(sectionIndex, itemIndex, { vlastita: parseFloat(e.target.value) || 0 })
                            }
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
                            onChange={(e) =>
                              onUpdateItem(sectionIndex, itemIndex, { kreditna: parseFloat(e.target.value) || 0 })
                            }
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
                              disabled={itemIndex === 0}
                              onClick={() => onMoveItem(sectionIndex, itemIndex, -1)}
                              title={t('tic.move_up')}
                              aria-label={t('tic.move_up')}
                            />
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              icon={ChevronDown}
                              disabled={itemIndex === section.items.length - 1}
                              onClick={() => onMoveItem(sectionIndex, itemIndex, 1)}
                              title={t('tic.move_down')}
                              aria-label={t('tic.move_down')}
                            />
                            <Button
                              variant="outline-danger"
                              size="icon-sm"
                              icon={Trash2}
                              onClick={() => onRemoveItem(sectionIndex, itemIndex)}
                              title={t('tic.remove_row')}
                              aria-label={t('tic.remove_row')}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                  <tr className="bg-gray-50 dark:bg-gray-700/40 font-semibold">
                    <td className={`${CELL} px-4 py-2 text-gray-900 dark:text-white`} colSpan={2}>
                      {t('tic.section_total_row')}
                    </td>
                    <td className={`${CELL} px-4 py-2 text-right text-gray-900 dark:text-white`}>
                      {formatNumber(sectionTotals.vlastita)}
                    </td>
                    <td className={`${CELL} px-4 py-2 text-right text-gray-900 dark:text-white`}>
                      {formatPercentage(calculateRowPercentages(sectionTotals.vlastita, grandTotal))}%
                    </td>
                    <td className={`${CELL} px-4 py-2 text-right text-gray-900 dark:text-white`}>
                      {formatNumber(sectionTotals.kreditna)}
                    </td>
                    <td className={`${CELL} px-4 py-2 text-right text-gray-900 dark:text-white`}>
                      {formatPercentage(calculateRowPercentages(sectionTotals.kreditna, grandTotal))}%
                    </td>
                    <td className={`${CELL} px-4 py-2 text-right text-gray-900 dark:text-white`}>
                      {formatNumber(sectionTotal)}
                    </td>
                    <td className={`${CELL} px-2 py-2`}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        icon={Plus}
                        onClick={() => onAddItem(sectionIndex)}
                        title={t('tic.add_row')}
                        aria-label={t('tic.add_row')}
                      />
                    </td>
                  </tr>
                </React.Fragment>
              )
            })}

            <tr className="bg-blue-50 dark:bg-blue-900/30 font-bold">
              <td className={`${CELL} px-4 py-3 text-gray-900 dark:text-white uppercase`} colSpan={2}>
                {t('tic.construction_total_row')}
              </td>
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
        <Button variant="secondary" size="sm" icon={Plus} onClick={onAddSection}>
          {t('tic.add_section')}
        </Button>
      </div>

      <ConfirmDialog
        show={sectionPendingRemoval !== null}
        title={t('tic.remove_section')}
        message={t('tic.remove_section_confirm', {
          name: pendingSection?.name || pendingSection?.code || '',
          count: pendingSection?.items.length ?? 0,
        })}
        onConfirm={() => {
          if (sectionPendingRemoval !== null) onRemoveSection(sectionPendingRemoval)
          setSectionPendingRemoval(null)
        }}
        onCancel={() => setSectionPendingRemoval(null)}
      />
    </div>
  )
}

export default ConstructionTable
