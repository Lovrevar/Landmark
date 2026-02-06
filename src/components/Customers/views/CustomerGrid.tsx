import React from 'react'
import { Users } from 'lucide-react'
import { CustomerWithApartments, CustomerCategory } from '../types/customerTypes'
import { CustomerCard } from './CustomerCard'
import { LoadingSpinner, EmptyState } from '../../ui'

interface CustomerGridProps {
  customers: CustomerWithApartments[]
  activeCategory: CustomerCategory
  loading: boolean
  onViewDetails: (customer: CustomerWithApartments) => void
  onEdit: (customer: CustomerWithApartments) => void
  onDelete: (id: string) => void
  onUpdateContact: (id: string) => void
}

export const CustomerGrid: React.FC<CustomerGridProps> = ({
  customers,
  activeCategory,
  loading,
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {customers.map((customer) => (
        <CustomerCard
          key={customer.id}
          customer={customer}
          activeCategory={activeCategory}
          onViewDetails={onViewDetails}
          onEdit={onEdit}
          onDelete={onDelete}
          onUpdateContact={onUpdateContact}
        />
      ))}
    </div>
  )
}
