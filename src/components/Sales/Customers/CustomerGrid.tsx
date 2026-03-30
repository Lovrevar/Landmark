import React from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import { CustomerWithApartments, CustomerCategory } from './types'
import { CustomerCard } from './CustomerCard'
import { LoadingSpinner, EmptyState } from '../../ui'

interface CustomerGridProps {
  customers: CustomerWithApartments[]
  activeCategory: CustomerCategory | null
  loading: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: () => void
  onViewDetails: (customer: CustomerWithApartments) => void
  onEdit: (customer: CustomerWithApartments) => void
  onDelete: (id: string) => void
  onUpdateContact: (id: string) => void
}

export const CustomerGrid: React.FC<CustomerGridProps> = ({
  customers,
  activeCategory,
  loading,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onViewDetails,
  onEdit,
  onDelete,
  onUpdateContact
}) => {
  const { t } = useTranslation()

  if (loading) {
    return <LoadingSpinner message={t('common.loading')} />
  }

  if (customers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={t('common.no_data')}
      />
    )
  }

  const allSelected = customers.length > 0 && selectedIds.size === customers.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < customers.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={onSelectAll}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
              allSelected
                ? 'bg-blue-600 border-blue-600'
                : someSelected
                  ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-blue-400'
            }`}
          >
            {allSelected && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {someSelected && !allSelected && (
              <div className="w-2 h-0.5 bg-blue-600 rounded" />
            )}
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {allSelected
              ? 'Deselect all'
              : someSelected
                ? `${selectedIds.size} selected`
                : `Select all (${customers.length})`}
          </span>
        </label>
        {selectedIds.size > 0 && (
          <span className="text-xs text-blue-600 font-medium">
            {selectedIds.size} of {customers.length} selected
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            activeCategory={activeCategory}
            isSelected={selectedIds.has(customer.id)}
            onToggleSelect={onToggleSelect}
            onViewDetails={onViewDetails}
            onEdit={onEdit}
            onDelete={onDelete}
            onUpdateContact={onUpdateContact}
          />
        ))}
      </div>
    </div>
  )
}
