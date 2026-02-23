import React from 'react'
import { Users } from 'lucide-react'
import { CustomerWithApartments, CustomerCategory } from '../types/customerTypes'
import { CustomerCard } from './CustomerCard'
import { LoadingSpinner, EmptyState } from '../../ui'

interface CustomerGridProps {
  customers: CustomerWithApartments[]
  activeCategory: CustomerCategory
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
  if (loading) {
    return <LoadingSpinner message="Loading customers..." />
  }

  if (customers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No customers in this category"
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
                  ? 'bg-blue-100 border-blue-400'
                  : 'bg-white border-gray-300 hover:border-blue-400'
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
          <span className="text-sm text-gray-600">
            {allSelected
              ? 'Deselect all'
              : someSelected
                ? `${selectedIds.size} selected`
                : `Select all (${customers.length})`}
          </span>
        </label>
        {selectedIds.size > 0 && (
          <span className="text-xs text-blue-600 font-medium">
            {selectedIds.size} of {customers.length} selected for email
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
