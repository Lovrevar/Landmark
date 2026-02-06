import React from 'react'
import { Search, X } from 'lucide-react'
import type { Company } from '../types/invoiceTypes'

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
  const hasActiveFilters = searchTerm || filterType !== 'ALL' || filterStatus !== 'ALL' || filterCompany !== 'ALL'

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Pretraži..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => onTypeChange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
        </select>

        <select
          value={filterStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="ALL">Svi statusi</option>
          <option value="PAID">Plaćeno</option>
          <option value="UNPAID">Neplaćeno</option>
          <option value="PARTIALLY_PAID">Djelomično plaćeno</option>
          <option value="UNPAID_AND_PARTIAL">Neplaćeno + Djelomično</option>
        </select>

        <select
          value={filterCompany}
          onChange={(e) => onCompanyChange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="ALL">Sve firme</option>
          {companies.map(company => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center justify-center px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <X className="w-4 h-4 mr-2" />
            Očisti
          </button>
        )}
      </div>
    </div>
  )
}
