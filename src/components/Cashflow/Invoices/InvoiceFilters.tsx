import React from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { Company } from './types'
import { SearchInput, Select, Button } from '../../ui'

interface InvoiceFiltersProps {
  searchTerm: string
  filterDirection: 'INCOMING' | 'OUTGOING'
  filterCategory: string
  filterStatus: string
  filterCompany: string
  companies: Company[]
  onSearchChange: (value: string) => void
  onDirectionChange: (value: 'INCOMING' | 'OUTGOING') => void
  onCategoryChange: (value: string) => void
  onStatusChange: (value: string) => void
  onCompanyChange: (value: string) => void
  onClearFilters: () => void
}

export const InvoiceFilters: React.FC<InvoiceFiltersProps> = ({
  searchTerm,
  filterDirection,
  filterCategory,
  filterStatus,
  filterCompany,
  companies,
  onSearchChange,
  onDirectionChange,
  onCategoryChange,
  onStatusChange,
  onCompanyChange,
  onClearFilters
}) => {
  const { t } = useTranslation()
  const hasActiveFilters =
    searchTerm ||
    filterCategory !== 'ALL' ||
    filterStatus !== 'ALL' ||
    filterCompany !== 'ALL'

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <SearchInput
          value={searchTerm}
          placeholder={t('invoices.search')}
          onChange={(e) => onSearchChange(e.target.value)}
          onClear={() => onSearchChange('')}
        />

        <Select
          value={filterCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="ALL">{t('invoices.filters.all_types')}</option>
          <option value="SUPPLIER">{t('invoice_type.ulazni_dob')}</option>
          <option value="OFFICE">{t('invoice_type.ulazni_ured')}</option>
          <option value="INVESTMENT">{t('invoice_type.ulazni_inv')}</option>
          <option value="BANK">{t('invoice_type.ulazni_banka')}</option>
          <option value="SALES">{t('invoice_type.izlazni_prod')}</option>
        </Select>

        <Select
          value={filterStatus}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          <option value="ALL">{t('invoices.filters.all_statuses')}</option>
          <option value="PAID">{t('common.paid')}</option>
          <option value="UNPAID">{t('common.unpaid')}</option>
          <option value="PARTIALLY_PAID">{t('common.partial')}</option>
          <option value="UNPAID_AND_PARTIAL">{t('common.unpaid')} + {t('common.partial')}</option>
        </Select>

        <Select
          value={filterCompany}
          onChange={(e) => onCompanyChange(e.target.value)}
        >
          <option value="ALL">{t('invoices.filters.all_suppliers')}</option>
          {companies.map(company => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </Select>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              type="button"
              onClick={() => onDirectionChange('INCOMING')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                filterDirection === 'INCOMING'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Ulazni
            </button>
            <button
              type="button"
              onClick={() => onDirectionChange('OUTGOING')}
              className={`px-4 py-2 text-sm font-medium border-l border-gray-300 transition-colors ${
                filterDirection === 'OUTGOING'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Izlazni
            </button>
          </div>

          {hasActiveFilters && (
            <Button
              variant="secondary"
              icon={X}
              onClick={onClearFilters}
            >
              {t('common.clear')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
