import React from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Square, CheckSquare, MinusSquare } from 'lucide-react'
import { CustomerWithApartments, CustomerCategory, ProjectOption } from './types'
import { CustomerCard } from './CustomerCard'
import { LoadingSpinner, EmptyState, ErrorState } from '../../ui'

interface CustomerGridProps {
  customers: CustomerWithApartments[]
  projects: ProjectOption[]
  activeCategory: CustomerCategory | null
  loading: boolean
  /** The load failed and nothing is on screen — never render this as "no customers". */
  loadFailed?: boolean
  onRetry?: () => void
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
  projects,
  activeCategory,
  loading,
  loadFailed = false,
  onRetry,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onViewDetails,
  onEdit,
  onDelete,
  onUpdateContact
}) => {
  const { t } = useTranslation()
  // Resolved once here rather than per card.
  const projectNameById = React.useMemo(
    () => new Map(projects.map(project => [project.id, project.name])),
    [projects]
  )

  if (loading) {
    return <LoadingSpinner message={t('common.loading')} />
  }

  if (loadFailed) {
    return <ErrorState onRetry={onRetry} />
  }

  if (customers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={t('common.no_data')}
      />
    )
  }

  // Counted against the customers on screen, not `selectedIds.size`: an id can outlive its
  // card (a deleted customer), and a size match then showed "all selected" when it wasn't.
  const selectedCount = customers.filter(customer => selectedIds.has(customer.id)).length
  const allSelected = selectedCount === customers.length
  const someSelected = selectedCount > 0 && !allSelected
  const SelectIcon = allSelected ? CheckSquare : someSelected ? MinusSquare : Square

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={onSelectAll}
          className="flex items-center gap-2 rounded select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <SelectIcon
            className={`w-5 h-5 ${selectedCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}
            aria-hidden="true"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {allSelected
              ? t('common.deselect_all')
              : someSelected
                ? t('customers.selected_count', { count: selectedCount })
                : t('customers.select_all_count', { count: customers.length })}
          </span>
        </button>
        {selectedCount > 0 && (
          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            {t('customers.selected_of_total', { selected: selectedCount, total: customers.length })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            interestedProjectName={
              customer.interested_project_id
                ? projectNameById.get(customer.interested_project_id)
                : undefined
            }
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
