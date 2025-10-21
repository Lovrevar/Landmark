import React from 'react'
import { X, Mail, Phone, MapPin, Clock, Home, Warehouse, Package } from 'lucide-react'
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
                Purchased Properties
              </h3>

              {(() => {
                const projectGroups = customer.apartments.reduce((groups: any, unit: any) => {
                  const projectName = unit.project_name || 'Standalone Units'
                  if (!groups[projectName]) {
                    groups[projectName] = []
                  }
                  groups[projectName].push(unit)
                  return groups
                }, {})

                return (
                  <div className="space-y-6">
                    {Object.entries(projectGroups).map(([projectName, units]: [string, any]) => {
                      const projectTotal = units.reduce((sum: number, u: any) => {
                        const aptPrice = u.type === 'apartment' ? u.price : 0
                        const garPrice = u.garage?.price || 0
                        const repPrice = u.repository?.price || 0
                        return sum + aptPrice + garPrice + repPrice
                      }, 0)

                      const projectPaid = units.reduce((sum: number, u: any) => sum + (u.total_paid || 0), 0)
                      const projectRemaining = projectTotal - projectPaid

                      return (
                        <div key={projectName} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-300">
                            <h4 className="font-semibold text-gray-900 text-base">{projectName}</h4>
                            <span className="text-sm font-bold text-blue-700">€{projectTotal.toLocaleString()}</span>
                          </div>

                          <div className="space-y-3">
                            {units.map((unit: any) => {
                              const apartmentPrice = unit.type === 'apartment' ? unit.price : 0
                              const garagePrice = unit.garage?.price || 0
                              const repositoryPrice = unit.repository?.price || 0
                              const totalPackage = apartmentPrice + garagePrice + repositoryPrice

                              return (
                                <div key={unit.id} className="bg-white border border-gray-200 rounded-lg p-3">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center space-x-2">
                                      {unit.type === 'apartment' && <Home className="w-4 h-4 text-green-600" />}
                                      {unit.type === 'garage' && <Warehouse className="w-4 h-4 text-orange-600" />}
                                      {unit.type === 'repository' && <Package className="w-4 h-4 text-gray-600" />}
                                      <div>
                                        <p className="font-medium text-gray-900">
                                          {unit.type === 'apartment' && `Apartment ${unit.number}`}
                                          {unit.type === 'garage' && `Garage ${unit.number}`}
                                          {unit.type === 'repository' && `Repository ${unit.number}`}
                                        </p>
                                        {unit.type === 'apartment' && (
                                          <p className="text-xs text-gray-600">Floor {unit.floor} • {unit.size_m2}m²</p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-bold text-green-700">€{totalPackage.toLocaleString()}</p>
                                      <p className="text-xs text-gray-500">{format(new Date(unit.sale_date), 'MMM dd, yyyy')}</p>
                                    </div>
                                  </div>

                                  {unit.type === 'apartment' && (unit.garage || unit.repository) && (
                                    <div className="pl-6 space-y-1 text-xs">
                                      {unit.garage && (
                                        <div className="flex items-center justify-between text-orange-700 bg-orange-50 rounded px-2 py-1">
                                          <span className="flex items-center">
                                            <Warehouse className="w-3 h-3 mr-1" />
                                            Garage {unit.garage.number}
                                          </span>
                                          <span className="font-semibold">€{unit.garage.price.toLocaleString()}</span>
                                        </div>
                                      )}
                                      {unit.repository && (
                                        <div className="flex items-center justify-between text-gray-700 bg-gray-100 rounded px-2 py-1">
                                          <span className="flex items-center">
                                            <Package className="w-3 h-3 mr-1" />
                                            Repository {unit.repository.number}
                                          </span>
                                          <span className="font-semibold">€{unit.repository.price.toLocaleString()}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className="mt-2 pt-2 border-t border-gray-200 grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <p className="text-gray-600">Paid</p>
                                      <p className="font-semibold text-green-700">€{(unit.total_paid || 0).toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-600">Remaining</p>
                                      <p className="font-semibold text-red-600">€{(totalPackage - (unit.total_paid || 0)).toLocaleString()}</p>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          <div className="mt-3 pt-3 border-t border-gray-300 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium text-gray-700">Project Total Paid:</span>
                              <span className="font-bold text-green-700">€{projectPaid.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="font-medium text-gray-700">Project Remaining:</span>
                              <span className="font-bold text-red-600">€{projectRemaining.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {Object.keys(projectGroups).length > 1 && (() => {
                      const grandTotal = customer.apartments.reduce((sum: number, unit: any) => {
                        const aptPrice = unit.type === 'apartment' ? unit.price : 0
                        const garPrice = unit.garage?.price || 0
                        const repPrice = unit.repository?.price || 0
                        return sum + aptPrice + garPrice + repPrice
                      }, 0)
                      const grandPaid = customer.apartments.reduce((sum: number, unit: any) => sum + (unit.total_paid || 0), 0)
                      const grandRemaining = grandTotal - grandPaid

                      return (
                        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                          <h4 className="font-semibold text-blue-900 mb-3">All Projects Summary</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="font-medium text-blue-800">Total Paid:</span>
                              <span className="font-bold text-green-700">€{grandPaid.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium text-blue-800">Total Remaining:</span>
                              <span className="font-bold text-red-600">€{grandRemaining.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-blue-300">
                              <span className="font-bold text-blue-900">Grand Total:</span>
                              <span className="font-bold text-blue-900 text-lg">€{grandTotal.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )
              })()}
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
