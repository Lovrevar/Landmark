import React from 'react'
import { useTranslation } from 'react-i18next'
import { Briefcase, Pencil, Trash2 } from 'lucide-react'
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
    <Card variant="default" padding="lg" onClick={onSelect}>
      <Card.Header>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{sub.name}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{sub.contact}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            title={t('supervision.subcontractors.edit')}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title={t('supervision.subcontractors.delete_title')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <div className={`p-2 rounded-lg ${sub.active_contracts > 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
            <Briefcase className={`w-5 h-5 ${sub.active_contracts > 0 ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'}`} />
          </div>
        </div>
      </Card.Header>

      <Card.Body>
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">{t('supervision.subcontractors.total_contracts')}:</span>
            <span className="font-medium text-gray-900 dark:text-white">{sub.total_contracts}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">{t('supervision.subcontractors.active_completed')}:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {sub.active_contracts} / {sub.completed_contracts}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">{t('supervision.subcontractors.contract_value')}:</span>
            <span className="font-bold text-gray-900 dark:text-white">€{formatEuropean(sub.total_contract_value)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">{t('common.total_paid')}:</span>
            <span className="font-medium text-teal-600">€{formatEuropean(sub.total_paid)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">{t('common.remaining')}:</span>
            <span className="font-medium text-orange-600">€{formatEuropean(sub.total_remaining)}</span>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">{t('supervision.subcontractors.payment_progress')}</span>
            <span className="text-xs font-medium text-gray-900 dark:text-white">{paymentPercentage.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
            <div
              className="bg-teal-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, paymentPercentage)}%` }}
            />
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}
