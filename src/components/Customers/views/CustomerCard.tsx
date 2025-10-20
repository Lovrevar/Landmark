import React from 'react'
import { Mail, Phone, Clock, Calendar, Eye, Edit2, Trash2, Flame, TrendingUp, AlertCircle, Star } from 'lucide-react'
import { format } from 'date-fns'
import { CustomerWithApartments, CustomerCategory } from '../types/customerTypes'

interface CustomerCardProps {
  customer: CustomerWithApartments
  activeCategory: CustomerCategory
  onViewDetails: (customer: CustomerWithApartments) => void
  onEdit: (customer: CustomerWithApartments) => void
  onDelete: (id: string) => void
  onUpdateContact: (id: string) => void
}

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  activeCategory,
  onViewDetails,
  onEdit,
  onDelete,
  onUpdateContact
}) => {
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'hot': return 'text-red-600 bg-red-100'
      case 'warm': return 'text-yellow-600 bg-yellow-100'
      case 'cold': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getPriorityIcon = (priority?: string) => {
    switch (priority) {
      case 'hot': return <Flame className="w-4 h-4" />
      case 'warm': return <TrendingUp className="w-4 h-4" />
      case 'cold': return <AlertCircle className="w-4 h-4" />
      default: return <Star className="w-4 h-4" />
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {customer.name} {customer.surname}
          </h3>
          {customer.priority && (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 ${getPriorityColor(customer.priority)}`}>
              {getPriorityIcon(customer.priority)}
              <span className="ml-1 capitalize">{customer.priority}</span>
            </span>
          )}
        </div>
        <div className="flex space-x-1">
          <button
            onClick={() => onViewDetails(customer)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(customer)}
            className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(customer.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm text-gray-600">
          <Mail className="w-4 h-4 mr-2" />
          {customer.email}
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <Phone className="w-4 h-4 mr-2" />
          {customer.phone}
        </div>
        {customer.last_contact_date && (
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="w-4 h-4 mr-2" />
            Last contact: {format(new Date(customer.last_contact_date), 'MMM dd, yyyy')}
          </div>
        )}
      </div>

      {activeCategory === 'buyer' && customer.apartments && customer.apartments.length > 0 && (
        <div className="mb-4 p-3 bg-green-50 rounded-lg">
          <p className="text-xs font-semibold text-green-800 mb-2">Purchased Units</p>
          {customer.apartments.map((apt) => (
            <div key={apt.id} className="text-xs text-green-700 flex justify-between">
              <span>{apt.project_name} - Unit {apt.number}</span>
              <span>€{(apt.sale_price / 1000).toFixed(0)}K</span>
            </div>
          ))}
        </div>
      )}

      {(activeCategory === 'interested' || activeCategory === 'hot_lead') && customer.preferences && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs font-semibold text-blue-800 mb-2">Preferences</p>
          <div className="text-xs text-blue-700 space-y-1">
            {customer.preferences.budget_min && customer.preferences.budget_max && (
              <div>Budget: €{(customer.preferences.budget_min / 1000).toFixed(0)}K - €{(customer.preferences.budget_max / 1000).toFixed(0)}K</div>
            )}
            {customer.preferences.preferred_size_min && customer.preferences.preferred_size_max && (
              <div>Size: {customer.preferences.preferred_size_min}m² - {customer.preferences.preferred_size_max}m²</div>
            )}
            {customer.preferences.bedrooms && (
              <div>Bedrooms: {customer.preferences.bedrooms}</div>
            )}
            {customer.preferences.preferred_location && (
              <div>Location: {customer.preferences.preferred_location}</div>
            )}
          </div>
        </div>
      )}

      {activeCategory === 'backed_out' && customer.backed_out_reason && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg">
          <p className="text-xs font-semibold text-red-800 mb-1">Backed Out Reason</p>
          <p className="text-xs text-red-700">{customer.backed_out_reason}</p>
        </div>
      )}

      <button
        onClick={() => onUpdateContact(customer.id)}
        className="w-full mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
      >
        <Calendar className="w-4 h-4 inline mr-2" />
        Update Contact Date
      </button>
    </div>
  )
}
