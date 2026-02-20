import React from 'react'
import { X } from 'lucide-react'
import type { Company } from '../types/invoiceTypes'
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
          placeholder="Pretraži..."
          onChange={(e) => onSearchChange(e.target.value)}
          onClear={() => onSearchChange('')}
        />

        <Select
          value={filterCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="ALL">Sve kategorije</option>
          <option value="SUPPLIER">Dobavljač</option>
          <option value="OFFICE">Ured</option>
          <option value="INVESTMENT">Investicije</option>
          <option value="BANK">Banka</option>
          <option value="SALES">Prodaja</option>
        </Select>

        <Select
          value={filterStatus}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          <option value="ALL">Svi statusi</option>
          <option value="PAID">Plaćeno</option>
          <option value="UNPAID">Neplaćeno</option>
          <option value="PARTIALLY_PAID">Djelomično plaćeno</option>
          <option value="UNPAID_AND_PARTIAL">Neplaćeno + Djelomično</option>
        </Select>

        <Select
          value={filterCompany}
          onChange={(e) => onCompanyChange(e.target.value)}
        >
          <option value="ALL">Sve firme</option>
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
              Očisti
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
