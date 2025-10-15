import React from 'react'
import { Trash2, LinkIcon, Unlink } from 'lucide-react'
import { EnhancedApartment, EnhancedGarage, EnhancedRepository, UnitType } from '../../types'
import { StatusPill } from './StatusPill'

interface UnitCardProps {
  unit: EnhancedApartment | EnhancedGarage | EnhancedRepository
  unitType: UnitType
  linkedGarage?: EnhancedGarage | null
  linkedRepository?: EnhancedRepository | null
  onDelete: () => void
  onReserve?: () => void
  onMakeAvailable?: () => void
  onSell: () => void
  onOpenLinking?: () => void
  onUnlinkGarage?: () => void
  onUnlinkRepository?: () => void
}

export function UnitCard({
  unit,
  unitType,
  linkedGarage,
  linkedRepository,
  onDelete,
  onReserve,
  onMakeAvailable,
  onSell,
  onOpenLinking,
  onUnlinkGarage,
  onUnlinkRepository
}: UnitCardProps) {
  const isSold = unit.status === 'Sold'
  const isReserved = unit.status === 'Reserved'
  const isAvailable = unit.status === 'Available'

  return (
    <div
      className={`rounded-xl shadow-sm border p-4 transition-all duration-200 ${
        isSold
          ? 'border-green-200 bg-green-50'
          : isReserved
            ? 'border-yellow-200 bg-yellow-50'
            : 'border-gray-200 bg-white hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">Unit {unit.number}</h4>
          <p className="text-sm text-gray-600">Floor {unit.floor}</p>
        </div>
        <div className="flex space-x-1">
          {unitType === 'apartment' && onOpenLinking && (
            <button
              onClick={onOpenLinking}
              className="p-1 text-gray-400 hover:text-blue-600"
              title="Link garage/repository"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Size:</span>
          <span className="text-sm font-medium">{unit.size_m2} m²</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Price:</span>
          <span className="text-sm font-bold text-green-600">€{unit.price.toLocaleString()}</span>
        </div>

        {isSold && unit.sale_info && (
          <>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Buyer:</span>
              <span className="text-sm font-medium">{unit.sale_info.buyer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Sale Price:</span>
              <span className="text-sm font-bold text-green-600">
                €{unit.sale_info.sale_price.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Down Payment:</span>
              <span className="text-sm font-medium">€{unit.sale_info.down_payment.toLocaleString()}</span>
            </div>
            {unit.sale_info.monthly_payment > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Monthly:</span>
                <span className="text-sm font-medium">
                  €{unit.sale_info.monthly_payment.toLocaleString()}
                </span>
              </div>
            )}
            <div className="mt-2">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-gray-500">Payment Progress</span>
                <span className="text-xs font-medium">
                  €{unit.sale_info.total_paid.toLocaleString()} / €{unit.sale_info.sale_price.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-green-600 h-1.5 rounded-full"
                  style={{
                    width: `${unit.sale_info.sale_price > 0 ? (unit.sale_info.total_paid / unit.sale_info.sale_price) * 100 : 0}%`
                  }}
                ></div>
              </div>
            </div>
          </>
        )}

        {linkedGarage && onUnlinkGarage && (
          <div className="flex justify-between items-center text-sm bg-orange-100 px-2 py-1 rounded">
            <span className="text-orange-700">Garage: {linkedGarage.number}</span>
            <button
              onClick={onUnlinkGarage}
              className="text-orange-600 hover:text-orange-800"
            >
              <Unlink className="w-3 h-3" />
            </button>
          </div>
        )}

        {linkedRepository && onUnlinkRepository && (
          <div className="flex justify-between items-center text-sm bg-purple-100 px-2 py-1 rounded">
            <span className="text-purple-700">Repository: {linkedRepository.number}</span>
            <button
              onClick={onUnlinkRepository}
              className="text-purple-600 hover:text-purple-800"
            >
              <Unlink className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      <div className="border-t pt-3">
        <div className="flex items-center justify-between">
          <StatusPill status={unit.status} />

          {!isSold && (
            <div className="flex space-x-1">
              {isAvailable && onReserve && (
                <button
                  onClick={onReserve}
                  className="px-2 py-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded text-xs font-medium"
                >
                  Reserve
                </button>
              )}
              {isReserved && onMakeAvailable && (
                <button
                  onClick={onMakeAvailable}
                  className="px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-xs font-medium"
                >
                  Available
                </button>
              )}
              <button
                onClick={onSell}
                className="px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded text-xs font-medium"
              >
                Sell
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
