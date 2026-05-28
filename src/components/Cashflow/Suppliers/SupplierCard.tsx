import React from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import { Card, Badge } from '../../ui'
import { formatEuropean } from '../../../utils/formatters'
import { SupplierSummary } from './types'

interface Props {
  supplier: SupplierSummary
  onSelect: () => void
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
}

const SupplierCard: React.FC<Props> = ({ supplier, onSelect, onEdit, onDelete }) => {
  const { t } = useTranslation()
  const paymentPercentage = supplier.total_contract_value > 0
    ? (supplier.total_paid / supplier.total_contract_value) * 100
    : 0

  return (
    <Card variant="default" padding="md" onClick={onSelect}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">{supplier.name}</h3>
            <Badge variant={supplier.source === 'retail' ? 'teal' : 'blue'} size="sm">
              {supplier.source === 'retail' ? t('suppliers.source_retail') : t('suppliers.source_site')}
            </Badge>
          </div>
          {supplier.contact && supplier.contact !== '-' && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{supplier.contact}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {supplier.source === 'site' && (
            <button
              onClick={onEdit}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
              title={t('common.edit')}
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title={t('common.delete')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
        <span>{t('suppliers.contracts_count', { count: supplier.total_contracts })}</span>
        <span className="text-gray-400 dark:text-gray-600">·</span>
        <span>{t('suppliers.invoices_count', { count: supplier.total_invoices })}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="font-semibold text-gray-900 dark:text-white">€{formatEuropean(supplier.total_contract_value)}</span>
        <span className="text-green-600">€{formatEuropean(supplier.total_paid)} {t('suppliers.paid_label').replace(':', '').trim().toLowerCase()}</span>
        <span className="text-orange-600">€{formatEuropean(supplier.total_remaining)} {t('suppliers.remaining_label').replace(':', '').trim().toLowerCase()}</span>
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

export default SupplierCard
