import React from 'react'
import { X, Mail, Phone, MapPin, Clock, Home } from 'lucide-react'
import { format } from 'date-fns'
import { CustomerWithApartments } from '../types/customerTypes'

interface CustomerDetailModalProps {
  show: boolean
  customer: CustomerWithApartments | null
  onClose: () => void
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({ show, customer, onClose }) => {
  if (!show || !customer) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {customer.name} {customer.surname}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start">
              <Mail className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium text-gray-900">{customer.email}</p>
              </div>
            </div>
            <div className="flex items-start">
              <Phone className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-medium text-gray-900">{customer.phone}</p>
              </div>
            </div>
          </div>

          {customer.address && (
            <div className="flex items-start">
              <MapPin className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600">Address</p>
                <p className="font-medium text-gray-900">{customer.address}</p>
              </div>
            </div>
          )}

          {customer.last_contact_date && (
            <div className="flex items-start">
              <Clock className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600">Last Contact</p>
                <p className="font-medium text-gray-900">
                  {format(new Date(customer.last_contact_date), 'MMMM dd, yyyy')}
                </p>
              </div>
            </div>
          )}

          {customer.status === 'buyer' && customer.apartments && customer.apartments.length > 0 && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Home className="w-5 h-5 mr-2" />
                Purchased Apartments
              </h3>
              <div className="space-y-3">
                {customer.apartments.map((apt) => (
                  <div key={apt.id} className="bg-green-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{apt.project_name}</p>
                        <p className="text-sm text-gray-600">Unit {apt.number} - Floor {apt.floor}</p>
                        <p className="text-sm text-gray-600">{apt.size_m2}m²</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-700">€{apt.sale_price.toLocaleString()}</p>
                        <p className="text-xs text-gray-600">{format(new Date(apt.sale_date), 'MMM dd, yyyy')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(customer.status === 'interested' || customer.status === 'hot_lead' || customer.status === 'negotiating') && customer.preferences && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Preferences</h3>
              <div className="grid grid-cols-2 gap-4">
                {customer.preferences.budget_min && customer.preferences.budget_max && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">Budget Range</p>
                    <p className="font-medium text-gray-900">
                      €{(customer.preferences.budget_min / 1000).toFixed(0)}K - €{(customer.preferences.budget_max / 1000).toFixed(0)}K
                    </p>
                  </div>
                )}
                {customer.preferences.preferred_size_min && customer.preferences.preferred_size_max && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">Size Range</p>
                    <p className="font-medium text-gray-900">
                      {customer.preferences.preferred_size_min}m² - {customer.preferences.preferred_size_max}m²
                    </p>
                  </div>
                )}
                {customer.preferences.bedrooms && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">Bedrooms</p>
                    <p className="font-medium text-gray-900">{customer.preferences.bedrooms}</p>
                  </div>
                )}
                {customer.preferences.preferred_floor && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">Preferred Floor</p>
                    <p className="font-medium text-gray-900">{customer.preferences.preferred_floor}</p>
                  </div>
                )}
              </div>
              {customer.preferences.preferred_location && (
                <div className="bg-blue-50 p-3 rounded-lg mt-3">
                  <p className="text-sm text-gray-600">Preferred Location</p>
                  <p className="font-medium text-gray-900">{customer.preferences.preferred_location}</p>
                </div>
              )}
              {customer.preferences.notes && (
                <div className="bg-blue-50 p-3 rounded-lg mt-3">
                  <p className="text-sm text-gray-600">Preference Notes</p>
                  <p className="font-medium text-gray-900">{customer.preferences.notes}</p>
                </div>
              )}
            </div>
          )}

          {customer.status === 'backed_out' && customer.backed_out_reason && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Backed Out Reason</h3>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-gray-900">{customer.backed_out_reason}</p>
              </div>
            </div>
          )}

          {customer.notes && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-900 whitespace-pre-wrap">{customer.notes}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
