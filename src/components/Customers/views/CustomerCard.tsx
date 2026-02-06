import React from 'react'
import { Mail, Phone, Clock, Calendar, Eye, Edit2, Trash2, Flame, TrendingUp, AlertCircle, Star } from 'lucide-react'
import { format } from 'date-fns'
import { CustomerWithApartments, CustomerCategory } from '../types/customerTypes'
import { Button } from '../../ui'

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
          <Button variant="ghost" size="icon-sm" icon={Eye} onClick={() => onViewDetails(customer)} title="View details" />
          <Button variant="ghost" size="icon-sm" icon={Edit2} onClick={() => onEdit(customer)} title="Edit" />
          <Button variant="danger" size="icon-sm" icon={Trash2} onClick={() => onDelete(customer.id)} title="Delete" />
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
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs font-semibold text-green-800 mb-2">Purchased Units</p>
          <div className="space-y-2">
            {customer.apartments.map((unit: any) => {
              const apartmentPrice = (unit.type === 'apartment' ? (unit.price || 0) : 0)
              const garagePrice = (unit.garage?.price || 0)
              const repositoryPrice = (unit.repository?.price || 0)
              const standalonePrice = (unit.type === 'garage' || unit.type === 'repository') ? (unit.price || 0) : 0
              const totalPackage = apartmentPrice + garagePrice + repositoryPrice + standalonePrice

              return (
                <div key={unit.id} className="bg-white rounded p-2 space-y-1">
                  <div className="flex justify-between items-start">
                    {unit.type === 'apartment' && (
                      <span className="text-xs font-medium text-green-800">
                        {unit.project_name} - Unit {unit.number}
                      </span>
                    )}
                    {unit.type === 'garage' && (
                      <span className="text-xs font-medium text-orange-700">
                        Garage {unit.number}
                      </span>
                    )}
                    {unit.type === 'repository' && (
                      <span className="text-xs font-medium text-gray-700">
                        Repository {unit.number}
                      </span>
                    )}
                    <span className="text-xs font-bold text-green-700">
                      €{totalPackage > 0 ? (totalPackage / 1000).toFixed(0) : '0'}K
                    </span>
                  </div>

                  {unit.type === 'apartment' && (unit.garage || unit.repository) && (
                    <div className="text-xs text-gray-600 pl-2 space-y-0.5">
                      {unit.garage && (
                        <div className="flex justify-between">
                          <span className="text-orange-600">+ Garage {unit.garage.number}</span>
                          <span>€{(unit.garage.price / 1000).toFixed(0)}K</span>
                        </div>
                      )}
                      {unit.repository && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">+ Repository {unit.repository.number}</span>
                          <span>€{(unit.repository.price / 1000).toFixed(0)}K</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {(() => {
            const totalPaid = customer.apartments.reduce((sum: number, unit: any) => sum + (unit.total_paid || 0), 0)
            const totalPrice = customer.apartments.reduce((sum: number, unit: any) => {
              const aptPrice = unit.type === 'apartment' ? (unit.price || 0) : 0
              const garPrice = unit.garage?.price || 0
              const repPrice = unit.repository?.price || 0
              const standalonePrice = (unit.type === 'garage' || unit.type === 'repository') ? (unit.price || 0) : 0
              return sum + aptPrice + garPrice + repPrice + standalonePrice
            }, 0)
            const remaining = totalPrice - totalPaid

            return (
              <div className="mt-3 pt-3 border-t border-green-300 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-green-800">Total Paid:</span>
                  <span className="font-bold text-green-700">€{totalPaid.toLocaleString('hr-HR')}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-green-800">Remaining:</span>
                  <span className="font-bold text-red-600">€{remaining.toLocaleString('hr-HR')}</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-green-200">
                  <span className="font-semibold text-green-900">Total Value:</span>
                  <span className="font-bold text-green-900">€{totalPrice.toLocaleString('hr-HR')}</span>
                </div>
              </div>
            )
          })()}
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
            {customer.preferences.notes && (
              <div className="pt-1 border-t border-blue-200 mt-2">
                <span className="font-medium">Notes: </span>{customer.preferences.notes}
              </div>
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

      <Button
        variant="secondary"
        size="sm"
        fullWidth
        icon={Calendar}
        onClick={() => onUpdateContact(customer.id)}
        className="mt-4"
      >
        Update Contact Date
      </Button>
    </div>
  )
}
