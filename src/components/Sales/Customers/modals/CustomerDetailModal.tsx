import React from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, Phone, MapPin, Clock, Home, Warehouse, Package } from 'lucide-react'
import { format } from 'date-fns'
import { CustomerWithApartments } from '../types'
import { Modal } from '../../../ui'
import { groupCustomerPurchasesByProject } from '../../utils/customerUtils'

interface CustomerDetailModalProps {
  show: boolean
  customer: CustomerWithApartments | null
  onClose: () => void
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({ show, customer, onClose }) => {
  const { t } = useTranslation()

  if (!show || !customer) return null

  const projectGroups = customer.status === 'buyer' && customer.apartments && customer.apartments.length > 0
    ? groupCustomerPurchasesByProject(customer)
    : null

  return (
    <Modal show={show} onClose={onClose} size="lg">
      <Modal.Header
        title={`${customer.name} ${customer.surname}`}
        onClose={onClose}
      />

      <Modal.Body>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start">
              <Mail className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('customers.detail_modal.email')}</p>
                <p className="font-medium text-gray-900 dark:text-white">{customer.email}</p>
              </div>
            </div>
            <div className="flex items-start">
              <Phone className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('customers.detail_modal.phone')}</p>
                <p className="font-medium text-gray-900 dark:text-white">{customer.phone}</p>
              </div>
            </div>
          </div>

          {customer.address && (
            <div className="flex items-start">
              <MapPin className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('customers.detail_modal.address')}</p>
                <p className="font-medium text-gray-900 dark:text-white">{customer.address}</p>
              </div>
            </div>
          )}

          {customer.last_contact_date && (
            <div className="flex items-start">
              <Clock className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('customers.detail_modal.last_contact')}</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {format(new Date(customer.last_contact_date), 'MMMM dd, yyyy')}
                </p>
              </div>
            </div>
          )}

          {projectGroups && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Home className="w-5 h-5 mr-2" />
                {t('customers.detail_modal.purchased')}
              </h3>

              <div className="space-y-6">
                    {Object.entries(projectGroups).map(([projectName, { units, projectTotal, projectPaid, projectRemaining }]) => {
                      return (
                        <div key={projectName} className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                            <h4 className="font-semibold text-gray-900 dark:text-white text-base">{projectName}</h4>
                            <span className="text-sm font-bold text-blue-700">€{projectTotal.toLocaleString('hr-HR')}</span>
                          </div>

                          <div className="space-y-3">
                            {units.map((unit) => {
                              const apartmentPrice = unit.type === 'apartment' ? (unit.price || 0) : 0
                              const garagePrice = unit.garage?.price || 0
                              const repositoryPrice = unit.repository?.price || 0
                              const standalonePrice = (unit.type === 'garage' || unit.type === 'repository') ? (unit.price || 0) : 0
                              const totalPackage = apartmentPrice + garagePrice + repositoryPrice + standalonePrice

                              return (
                                <div key={unit.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center space-x-2">
                                      {unit.type === 'apartment' && <Home className="w-4 h-4 text-green-600" />}
                                      {unit.type === 'garage' && <Warehouse className="w-4 h-4 text-orange-600" />}
                                      {unit.type === 'repository' && <Package className="w-4 h-4 text-gray-600 dark:text-gray-400" />}
                                      <div>
                                        <p className="font-medium text-gray-900 dark:text-white">
                                          {unit.type === 'apartment' && `${t('common.apartment')} ${unit.number}`}
                                          {unit.type === 'garage' && `${t('common.garage')} ${unit.number}`}
                                          {unit.type === 'repository' && `${t('common.storage')} ${unit.number}`}
                                        </p>
                                        {unit.type === 'apartment' && (
                                          <p className="text-xs text-gray-600 dark:text-gray-400">Floor {unit.floor} • {unit.size_m2}m²</p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-bold text-green-700">€{totalPackage.toLocaleString('hr-HR')}</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">{unit.sale_date ? format(new Date(unit.sale_date), 'MMM dd, yyyy') : ''}</p>
                                    </div>
                                  </div>

                                  {unit.type === 'apartment' && (unit.garage || unit.repository) && (
                                    <div className="pl-6 space-y-1 text-xs">
                                      {unit.garage && (
                                        <div className="flex items-center justify-between text-orange-700 bg-orange-50 dark:bg-orange-900/20 rounded px-2 py-1">
                                          <span className="flex items-center">
                                            <Warehouse className="w-3 h-3 mr-1" />
                                            Garage {unit.garage.number}
                                          </span>
                                          <span className="font-semibold">€{unit.garage.price.toLocaleString('hr-HR')}</span>
                                        </div>
                                      )}
                                      {unit.repository && (
                                        <div className="flex items-center justify-between text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded px-2 py-1">
                                          <span className="flex items-center">
                                            <Package className="w-3 h-3 mr-1" />
                                            Repository {unit.repository.number}
                                          </span>
                                          <span className="font-semibold">€{unit.repository.price.toLocaleString('hr-HR')}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <p className="text-gray-600 dark:text-gray-400">{t('common.paid')}</p>
                                      <p className="font-semibold text-green-700">€{(unit.total_paid || 0).toLocaleString('hr-HR')}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-600 dark:text-gray-400">{t('customers.detail_modal.total_remaining')}</p>
                                      <p className="font-semibold text-red-600">€{(totalPackage - (unit.total_paid || 0)).toLocaleString('hr-HR')}</p>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium text-gray-700 dark:text-gray-200">{t('customers.detail_modal.total_paid')}:</span>
                              <span className="font-bold text-green-700">€{projectPaid.toLocaleString('hr-HR')}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="font-medium text-gray-700 dark:text-gray-200">{t('customers.detail_modal.total_remaining')}:</span>
                              <span className="font-bold text-red-600">€{projectRemaining.toLocaleString('hr-HR')}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {Object.keys(projectGroups).length > 1 && (() => {
                      const grandTotal = Object.values(projectGroups).reduce((sum, g) => sum + g.projectTotal, 0)
                      const grandPaid = Object.values(projectGroups).reduce((sum, g) => sum + g.projectPaid, 0)
                      const grandRemaining = grandTotal - grandPaid

                      return (
                        <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-4">
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">{t('customers.detail_modal.grand_total')}</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="font-medium text-blue-800 dark:text-blue-200">{t('customers.detail_modal.total_paid')}:</span>
                              <span className="font-bold text-green-700">€{grandPaid.toLocaleString('hr-HR')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium text-blue-800 dark:text-blue-200">{t('customers.detail_modal.total_remaining')}:</span>
                              <span className="font-bold text-red-600">€{grandRemaining.toLocaleString('hr-HR')}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-blue-300 dark:border-blue-700">
                              <span className="font-bold text-blue-900 dark:text-blue-100">{t('customers.detail_modal.grand_total')}:</span>
                              <span className="font-bold text-blue-900 dark:text-blue-100 text-lg">€{grandTotal.toLocaleString('hr-HR')}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
            </div>
          )}

          {(customer.status === 'interested' || customer.status === 'hot_lead' || customer.status === 'negotiating') && customer.preferences && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('customers.detail_modal.preferences')}</h3>
              <div className="grid grid-cols-2 gap-4">
                {customer.preferences.budget_min && customer.preferences.budget_max && (
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('customers.detail_modal.budget_range')}</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      €{(customer.preferences.budget_min / 1000).toFixed(0)}K - €{(customer.preferences.budget_max / 1000).toFixed(0)}K
                    </p>
                  </div>
                )}
                {customer.preferences.preferred_size_min && customer.preferences.preferred_size_max && (
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('customers.detail_modal.size_range')}</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {customer.preferences.preferred_size_min}m² - {customer.preferences.preferred_size_max}m²
                    </p>
                  </div>
                )}
                {customer.preferences.bedrooms && (
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('customers.detail_modal.bedrooms')}</p>
                    <p className="font-medium text-gray-900 dark:text-white">{customer.preferences.bedrooms}</p>
                  </div>
                )}
                {customer.preferences.preferred_floor && (
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('customers.detail_modal.preferred_floor')}</p>
                    <p className="font-medium text-gray-900 dark:text-white">{customer.preferences.preferred_floor}</p>
                  </div>
                )}
              </div>
              {customer.preferences.preferred_location && (
                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg mt-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('customers.detail_modal.preferred_location')}</p>
                  <p className="font-medium text-gray-900 dark:text-white">{customer.preferences.preferred_location}</p>
                </div>
              )}
              {customer.preferences.notes && (
                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg mt-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Preference Notes</p>
                  <p className="font-medium text-gray-900 dark:text-white">{customer.preferences.notes}</p>
                </div>
              )}
            </div>
          )}

          {customer.status === 'backed_out' && customer.backed_out_reason && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('customers.detail_modal.backed_out_reason')}</h3>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <p className="text-gray-900 dark:text-white">{customer.backed_out_reason}</p>
              </div>
            </div>
          )}

          {customer.notes && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notes</h3>
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{customer.notes}</p>
              </div>
            </div>
          )}
        </div>
      </Modal.Body>
    </Modal>
  )
}
