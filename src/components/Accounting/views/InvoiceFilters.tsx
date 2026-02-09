import React from 'react'
import { X } from 'lucide-react'
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
  const hasActiveFilters = searchTerm || filterType !== 'ALL' || filterStatus !== 'ALL' || filterCompany !== 'ALL'

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
  )
}
