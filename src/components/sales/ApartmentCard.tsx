import React from 'react'
import { Edit2, Trash2 } from 'lucide-react'
import { ApartmentWithSale } from '../../services/apartmentService'
import { StatusBadge } from '../common/StatusBadge'
import { Button } from '../common/Button'

interface ApartmentCardProps {
  apartment: ApartmentWithSale
  isSelected: boolean
  onSelect: (id: string, selected: boolean) => void
  onEdit: (apartment: ApartmentWithSale) => void
  onDelete: (id: string) => void
  onSell: (apartment: ApartmentWithSale) => void
  onStatusChange: (id: string, status: string) => void
}

export const ApartmentCard: React.FC<ApartmentCardProps> = ({
  apartment,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onSell,
  onStatusChange
}) => {
  const getBgColor = () => {
    if (isSelected) return 'ring-2 ring-blue-500 bg-blue-50'
    if (apartment.status === 'Sold') return 'border-green-200 bg-green-50'
    if (apartment.status === 'Reserved') return 'border-yellow-200 bg-yellow-50'
    return 'border-gray-200 bg-white'
  }

  return (
    <div
      className={`rounded-xl shadow-sm border p-4 transition-all duration-200 hover:shadow-md ${getBgColor()}`}
    >
      <div className="flex items-center justify-between mb-3">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(apartment.id, e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Select</span>
        </label>
        <StatusBadge status={apartment.status} />
      </div>

      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">Unit {apartment.number}</h4>
          <p className="text-sm text-gray-600">Floor {apartment.floor}</p>
        </div>
        <div className="flex space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(apartment)
            }}
            className="p-1 text-gray-400 hover:text-blue-600"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(apartment.id)
            }}
            className="p-1 text-gray-400 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Size:</span>
          <span className="text-sm font-medium">{apartment.size_m2} m²</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Price per m²:</span>
          <span className="text-sm font-medium">€{(apartment.price / apartment.size_m2).toFixed(0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Total Price:</span>
          <span className="text-sm font-bold text-green-600">€{apartment.price.toLocaleString()}</span>
        </div>

        {apartment.status === 'Sold' && apartment.sale_info && (
          <>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Buyer:</span>
              <span className="text-sm font-medium">{apartment.sale_info.buyer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Sale Price:</span>
              <span className="text-sm font-bold text-green-600">€{apartment.sale_info.sale_price.toLocaleString()}</span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-gray-500">Payment Progress</span>
                <span className="text-xs font-medium">
                  €{apartment.sale_info.total_paid.toLocaleString()} / €{apartment.sale_info.sale_price.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-green-600 h-1.5 rounded-full"
                  style={{
                    width: `${apartment.sale_info.sale_price > 0 ? (apartment.sale_info.total_paid / apartment.sale_info.sale_price) * 100 : 0}%`
                  }}
                ></div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="border-t pt-3 flex items-center justify-between">
        <StatusBadge status={apartment.status} />
        {apartment.status !== 'Sold' && (
          <div className="flex space-x-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSell(apartment)
              }}
              className="px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded text-xs font-medium transition-colors duration-200"
            >
              Mark Sold
            </button>
            {apartment.status === 'Available' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onStatusChange(apartment.id, 'Reserved')
                }}
                className="px-2 py-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded text-xs font-medium transition-colors duration-200"
              >
                Reserve
              </button>
            )}
            {apartment.status === 'Reserved' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onStatusChange(apartment.id, 'Available')
                }}
                className="px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-xs font-medium transition-colors duration-200"
              >
                Available
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
