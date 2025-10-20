import React from 'react'
import { CustomerWithApartments, CustomerCategory } from '../types/customerTypes'
import { Mail, Phone, Home, Calendar, Edit2, Trash2, Eye } from 'lucide-react'
import { format } from 'date-fns'

interface CustomerGridProps {
  customers: CustomerWithApartments[]
  activeCategory: CustomerCategory
  loading: boolean
  onViewDetails: (customer: CustomerWithApartments) => void
  onEdit: (customer: CustomerWithApartments) => void
  onDelete: (customerId: string) => void
  onUpdateContact: (customerId: string) => void
}

export const CustomerGrid: React.FC<CustomerGridProps> = ({
  customers,
  loading,
  onViewDetails,
  onEdit,
  onDelete,
  onUpdateContact
}) => {
  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading customers...</p>
      </div>
    )
  }

  if (customers.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No customers in this category</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {customers.map((customer) => (
        <div
          key={customer.id}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {customer.name} {customer.surname}
              </h3>
              <div className="flex items-center text-sm text-gray-600 mt-1">
                <Mail className="w-4 h-4 mr-1" />
                {customer.email}
              </div>
              <div className="flex items-center text-sm text-gray-600 mt-1">
                <Phone className="w-4 h-4 mr-1" />
                {customer.phone}
              </div>
            </div>
            <div className="flex space-x-1">
              <button
                onClick={() => onViewDetails(customer)}
                className="p-1 text-gray-400 hover:text-blue-600"
                title="View details"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => onEdit(customer)}
                className="p-1 text-gray-400 hover:text-green-600"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(customer.id)}
                className="p-1 text-gray-400 hover:text-red-600"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {customer.apartment_count && customer.apartment_count > 0 && (
            <div className="flex items-center text-sm text-gray-600 mb-3">
              <Home className="w-4 h-4 mr-1" />
              {customer.apartment_count} apartment{customer.apartment_count !== 1 ? 's' : ''}
            </div>
          )}

          {customer.last_contact && (
            <div className="flex items-center text-xs text-gray-500 mb-3">
              <Calendar className="w-3 h-3 mr-1" />
              Last contact: {format(new Date(customer.last_contact), 'MMM dd, yyyy')}
            </div>
          )}

          {customer.notes && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{customer.notes}</p>
          )}

          <button
            onClick={() => onUpdateContact(customer.id)}
            className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Update Last Contact
          </button>
        </div>
      ))}
    </div>
  )
}
