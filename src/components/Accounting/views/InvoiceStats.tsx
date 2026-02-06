import React from 'react'
import { FileText, DollarSign } from 'lucide-react'

interface InvoiceStatsProps {
  filteredTotalCount: number
  filteredUnpaidAmount: number
  totalUnpaidAmount: number
}

export const InvoiceStats: React.FC<InvoiceStatsProps> = ({
  filteredTotalCount,
  filteredUnpaidAmount,
  totalUnpaidAmount
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Prikazano računa</p>
            <p className="text-2xl font-bold text-gray-900">{filteredTotalCount}</p>
          </div>
          <FileText className="w-8 h-8 text-blue-600" />
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Prikazano Neplaćeno</p>
            <p className="text-2xl font-bold text-red-600">
              €{new Intl.NumberFormat('hr-HR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(filteredUnpaidAmount)}
            </p>
          </div>
          <DollarSign className="w-8 h-8 text-red-600" />
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Ukupno Neplaćeno</p>
            <p className="text-2xl font-bold text-orange-600">
              €{new Intl.NumberFormat('hr-HR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(totalUnpaidAmount)}
            </p>
          </div>
          <DollarSign className="w-8 h-8 text-orange-600" />
        </div>
      </div>
    </div>
  )
}
