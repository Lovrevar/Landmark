import React from 'react'
import { Users } from 'lucide-react'
import { CustomerWithApartments, CustomerCategory } from '../types/customerTypes'
import { CustomerCard } from './CustomerCard'

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
    return <div className="text-center py-12">Loading customers...</div>
  }

  if (customers.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No customers in this category</p>
      </div>
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
