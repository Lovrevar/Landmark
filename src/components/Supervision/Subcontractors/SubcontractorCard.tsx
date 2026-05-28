import React from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import { Card } from '../../ui'
import { formatEuropean } from '../../../utils/formatters'
import { SubcontractorSummary } from './types'

interface Props {
  sub: SubcontractorSummary
  onSelect: () => void
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
}

export const SubcontractorCard: React.FC<Props> = ({ sub, onSelect, onEdit, onDelete }) => {
  const { t } = useTranslation()
  const paymentPercentage = sub.total_contract_value > 0
    ? (sub.total_paid / sub.total_contract_value) * 100
    : 0

  return (
    <Card variant="default" padding="md" onClick={onSelect}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">{sub.name}</h3>
          {sub.contact && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{sub.contact}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            title={t('supervision.subcontractors.edit')}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title={t('supervision.subcontractors.delete_title')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
        <span>{t('supervision.subcontractors.contracts_short', { count: sub.total_contracts })}</span>
        <span className="text-gray-400 dark:text-gray-600">·</span>
        <span>{t('supervision.subcontractors.active_short', { count: sub.active_contracts })}</span>
        <span className="text-gray-400 dark:text-gray-600">·</span>
        <span>{t('supervision.subcontractors.completed_short', { count: sub.completed_contracts })}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="font-semibold text-gray-900 dark:text-white">€{formatEuropean(sub.total_contract_value)}</span>
        <span className="text-teal-600">€{formatEuropean(sub.total_paid)} {t('common.total_paid').toLowerCase()}</span>
        <span className="text-orange-600">€{formatEuropean(sub.total_remaining)} {t('common.remaining').toLowerCase()}</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
          <div
            className="bg-teal-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, paymentPercentage)}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-9 text-right">{paymentPercentage.toFixed(0)}%</span>
      </div>
    </Card>
  )
}
