import React from 'react'
import { X, Mail, Phone, Home, Calendar } from 'lucide-react'
import { CustomerWithApartments } from '../types/customerTypes'
import { format } from 'date-fns'

interface CustomerDetailModalProps {
  show: boolean
  customer: CustomerWithApartments | null
  onClose: () => void
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  show,
  customer,
  onClose
}) => {
  if (!show || !customer) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900">
                {customer.name} {customer.surname}
              </h3>
              <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full mt-2 ${
                customer.category === 'interested' ? 'bg-blue-100 text-blue-800' :
                customer.category === 'reserved' ? 'bg-yellow-100 text-yellow-800' :
                customer.category === 'contract' ? 'bg-orange-100 text-orange-800' :
                'bg-green-100 text-green-800'
              }`}>
                {customer.category.toUpperCase()}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-3">Contact Information</h4>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Mail className="w-4 h-4 text-blue-600 mr-2" />
                  <span className="text-sm text-blue-900">{customer.email}</span>
                </div>
                <div className="flex items-center">
                  <Phone className="w-4 h-4 text-blue-600 mr-2" />
                  <span className="text-sm text-blue-900">{customer.phone || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-3">Activity</h4>
              <div className="space-y-2">
                {customer.last_contact && (
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-green-600 mr-2" />
                    <span className="text-sm text-green-900">
                      Last contact: {format(new Date(customer.last_contact), 'MMM dd, yyyy')}
                    </span>
                  </div>
                )}
                <div className="flex items-center">
                  <Home className="w-4 h-4 text-green-600 mr-2" />
                  <span className="text-sm text-green-900">
                    {customer.apartment_count || 0} apartment{customer.apartment_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {customer.apartments && customer.apartments.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3">Associated Apartments</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {customer.apartments.map((apt: any) => (
                  <div key={apt.id} className="border border-gray-200 rounded-lg p-3">
                    <p className="font-medium text-gray-900">Apartment {apt.number}</p>
                    <p className="text-sm text-gray-600">{apt.size}m²</p>
                    <p className="text-sm text-gray-600">€{apt.price?.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {customer.notes && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Notes</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{customer.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
