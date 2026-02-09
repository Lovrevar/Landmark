import React, { useState } from 'react'
import { X, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import type { Company } from '../types/invoiceTypes'
import { SearchInput, Select, Button } from '../../ui'

interface InvoiceFiltersProps {
  searchTerm: string
  filterType: string
  filterStatus: string
  filterCompany: string
  companies: Company[]
  onSearchChange: (value: string) => void
  onTypeChange: (value: string) => void
  onStatusChange: (value: string) => void
  onCompanyChange: (value: string) => void
  onClearFilters: () => void
}

export const InvoiceFilters: React.FC<InvoiceFiltersProps> = ({
  searchTerm,
  filterType,
  filterStatus,
  filterCompany,
  companies,
  onSearchChange,
  onTypeChange,
  onStatusChange,
  onCompanyChange,
  onClearFilters
}) => {
  const [isOpen, setIsOpen] = useState(true)
  const hasActiveFilters = searchTerm || filterType !== 'ALL' || filterStatus !== 'ALL' || filterCompany !== 'ALL'

  return (
    <div className="relative flex gap-2">
      <div
        className={`bg-white rounded-lg shadow-sm border border-gray-200 transition-all duration-300 ease-in-out ${
          isOpen ? 'w-80' : 'w-0 overflow-hidden border-0'
        }`}
      >
        <div className="p-4 space-y-4 min-w-80">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Filteri</h3>
            </div>
            {hasActiveFilters && (
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                Aktivni
              </span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pretraga</label>
            <SearchInput
              value={searchTerm}
              placeholder="Pretraži račune..."
              onChange={(e) => onSearchChange(e.target.value)}
              onClear={() => onSearchChange('')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tip računa</label>
            <Select
              value={filterType}
              onChange={(e) => onTypeChange(e.target.value)}
            >
              <option value="ALL">Svi tipovi</option>
              <option value="INCOMING_SUPPLIER">Ulazni (Dobavljač)</option>
              <option value="INCOMING_OFFICE">Ulazni (Ured)</option>
              <option value="INCOMING_INVESTMENT">Ulazni (Investicije)</option>
              <option value="INCOMING_BANK">Ulazni (Banka)</option>
              <option value="OUTGOING_SUPPLIER">Izlazni (Dobavljač)</option>
              <option value="OUTGOING_OFFICE">Izlazni (Ured)</option>
              <option value="OUTGOING_SALES">Izlazni (Prodaja)</option>
              <option value="OUTGOING_BANK">Izlazni (Banka)</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kompanija</label>
            <Select
              value={filterCompany}
              onChange={(e) => onCompanyChange(e.target.value)}
            >
              <option value="ALL">Sve firme</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </Select>
          </div>

          {hasActiveFilters && (
            <Button
              variant="secondary"
              icon={X}
              onClick={onClearFilters}
              className="w-full"
            >
              Očisti filtere
            </Button>
          )}
        </div>
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex-shrink-0 h-10 w-10 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm flex items-center justify-center transition-colors"
        title={isOpen ? 'Sakrij filtere' : 'Prikaži filtere'}
      >
        {isOpen ? (
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-600" />
        )}
      </button>
    </div>
  )
}
