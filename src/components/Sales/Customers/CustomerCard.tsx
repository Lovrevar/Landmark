import React from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, Phone, Clock, Calendar, Eye, Edit2, Trash2, Building2, Square, CheckSquare } from 'lucide-react'
import { CustomerWithApartments, CustomerCategory } from './types'
import { Button } from '../../ui'
import { formatEuroCompact, formatDate } from '../../../utils/formatters'

interface CustomerCardProps {
  customer: CustomerWithApartments
  /** Name of the project the customer is interested in, resolved by CustomerGrid. */
  interestedProjectName?: string
  activeCategory: CustomerCategory | null
  isSelected: boolean
  onToggleSelect: (id: string) => void
  onViewDetails: (customer: CustomerWithApartments) => void
  onEdit: (customer: CustomerWithApartments) => void
  onDelete: (id: string) => void
  onUpdateContact: (id: string) => void
}

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  interestedProjectName,
  activeCategory,
  isSelected,
  onToggleSelect,
  onViewDetails,
  onEdit,
  onDelete,
  onUpdateContact
}) => {
  const { t, i18n } = useTranslation()
  const fullName = `${customer.name} ${customer.surname}`
  return (
    // Clicking the card opens the customer. It used to toggle selection, which silently added
    // customers to the email export; selection now has its own checkbox in the header.
    <div
      role="button"
      tabIndex={0}
      aria-label={t('customers.card.open_details', { name: fullName })}
      onClick={() => onViewDetails(customer)}
      onKeyDown={e => {
        // Ignore keys bubbling up from the buttons inside the card, or Enter on "Edit" would
        // be swallowed here and open the details instead.
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onViewDetails(customer)
        }
      }}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 p-6 hover:shadow-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        isSelected ? 'border-blue-400 shadow-blue-100' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onToggleSelect(customer.id)
          }}
          aria-pressed={isSelected}
          aria-label={t('customers.card.select_customer', { name: fullName })}
          className="p-1 -ml-1 mr-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {isSelected ? (
            <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          ) : (
            <Square className="w-5 h-5 text-gray-400" aria-hidden="true" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {fullName}
          </h3>
          {interestedProjectName && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300">
              <Building2 className="w-4 h-4" />
              <span className="ml-1">{interestedProjectName}</span>
            </span>
          )}
        </div>
        <div className="flex space-x-1" onClick={e => e.stopPropagation()}>
          <Button variant="ghost" size="icon-sm" icon={Eye} onClick={() => onViewDetails(customer)} title={t('customers.card.view_details')} aria-label={t('customers.card.view_details')} />
          <Button variant="ghost" size="icon-sm" icon={Edit2} onClick={() => onEdit(customer)} title={t('common.edit')} aria-label={t('common.edit')} />
          <Button variant="danger" size="icon-sm" icon={Trash2} onClick={() => onDelete(customer.id)} title={t('common.delete')} aria-label={t('common.delete')} />
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {customer.email && (
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Mail className="w-4 h-4 mr-2" />
            {customer.email}
          </div>
        )}
        {customer.phone && (
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Phone className="w-4 h-4 mr-2" />
            {customer.phone}
          </div>
        )}
        {customer.last_contact_date && (
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Clock className="w-4 h-4 mr-2" />
            {t('customers.detail_modal.last_contact')}: {formatDate(customer.last_contact_date, i18n.language)}
          </div>
        )}
      </div>

      {activeCategory === 'buyer' && customer.apartments && customer.apartments.length > 0 && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-xs font-semibold text-green-800 dark:text-green-200 mb-2">{t('customers.card.purchased_units')}</p>
          <div className="space-y-2">
            {customer.apartments.map((unit) => {
              const apartmentPrice = (unit.type === 'apartment' ? (unit.price || 0) : 0)
              const garagePrice = (unit.garage?.price || 0)
              const repositoryPrice = (unit.repository?.price || 0)
              const standalonePrice = (unit.type === 'garage' || unit.type === 'repository') ? (unit.price || 0) : 0
              const totalPackage = apartmentPrice + garagePrice + repositoryPrice + standalonePrice

              return (
                <div key={unit.id} className="bg-white dark:bg-gray-700 rounded p-2 space-y-1">
                  <div className="flex justify-between items-start">
                    {unit.type === 'apartment' && (
                      <span className="text-xs font-medium text-green-800 dark:text-green-200">
                        {unit.project_name} - {t('common.unit')} {unit.number}
                      </span>
                    )}
                    {unit.type === 'garage' && (
                      <span className="text-xs font-medium text-orange-700 dark:text-orange-400">
                        {t('common.garage')} {unit.number}
                      </span>
                    )}
                    {unit.type === 'repository' && (
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                        {t('common.storage')} {unit.number}
                      </span>
                    )}
                    <span className="text-xs font-bold text-green-700">
                      {formatEuroCompact(totalPackage)}
                    </span>
                  </div>

                  {unit.type === 'apartment' && (unit.garage || unit.repository) && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 pl-2 space-y-0.5">
                      {unit.garage && (
                        <div className="flex justify-between">
                          <span className="text-orange-600">+ {t('common.garage')} {unit.garage.number}</span>
                          <span>{formatEuroCompact(unit.garage.price)}</span>
                        </div>
                      )}
                      {unit.repository && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">+ {t('common.storage')} {unit.repository.number}</span>
                          <span>{formatEuroCompact(unit.repository.price)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {(() => {
            const totalPaid = customer.apartments.reduce((sum, unit) => sum + (unit.total_paid || 0), 0)
            const totalPrice = customer.apartments.reduce((sum, unit) => {
              const aptPrice = unit.type === 'apartment' ? (unit.price || 0) : 0
              const garPrice = unit.garage?.price || 0
              const repPrice = unit.repository?.price || 0
              const standalonePrice = (unit.type === 'garage' || unit.type === 'repository') ? (unit.price || 0) : 0
              return sum + aptPrice + garPrice + repPrice + standalonePrice
            }, 0)
            const remaining = totalPrice - totalPaid

            return (
              <div className="mt-3 pt-3 border-t border-green-300 dark:border-green-700 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-green-800 dark:text-green-200">{t('customers.card.total_paid')}:</span>
                  <span className="font-bold text-green-700">€{totalPaid.toLocaleString('hr-HR')}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-green-800 dark:text-green-200">{t('customers.card.remaining')}:</span>
                  <span className="font-bold text-red-600">€{remaining.toLocaleString('hr-HR')}</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-green-200 dark:border-green-700">
                  <span className="font-semibold text-green-900 dark:text-green-100">{t('customers.card.total_value')}:</span>
                  <span className="font-bold text-green-900 dark:text-green-100">€{totalPrice.toLocaleString('hr-HR')}</span>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {(activeCategory === 'interested' || activeCategory === 'lead') && customer.preferences && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-2">{t('customers.card.preferences')}</p>
          <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            {customer.preferences.budget_min && customer.preferences.budget_max && (
              <div>{t('customers.card.budget')} {formatEuroCompact(customer.preferences.budget_min)} - {formatEuroCompact(customer.preferences.budget_max)}</div>
            )}
            {customer.preferences.preferred_size_min && customer.preferences.preferred_size_max && (
              <div>{t('customers.card.size')} {customer.preferences.preferred_size_min}m² - {customer.preferences.preferred_size_max}m²</div>
            )}
            {customer.preferences.bedrooms && (
              <div>{t('customers.card.bedrooms')} {customer.preferences.bedrooms}</div>
            )}
            {customer.preferences.preferred_location && (
              <div>{t('customers.card.location')} {customer.preferences.preferred_location}</div>
            )}
            {customer.preferences.notes && (
              <div className="pt-1 border-t border-blue-200 dark:border-blue-700 mt-2">
                <span className="font-medium">{t('customers.card.notes')} </span>{customer.preferences.notes}
              </div>
            )}
          </div>
        </div>
      )}

      <div onClick={e => e.stopPropagation()}>
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          icon={Calendar}
          onClick={() => onUpdateContact(customer.id)}
          className="mt-4"
        >
          {t('customers.card.update_contact')}
        </Button>
      </div>
    </div>
  )
}
