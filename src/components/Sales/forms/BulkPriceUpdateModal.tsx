import React, { useState, useEffect } from 'react'
import { X, Plus, Minus } from 'lucide-react'
import { UnitType } from '../types/salesTypes'

interface BulkPriceUpdateModalProps {
  visible: boolean
  selectedUnits: any[]
  unitType: UnitType
  onClose: () => void
  onSubmit: (adjustmentType: 'increase' | 'decrease', adjustmentValue: number) => void
}

export const BulkPriceUpdateModal: React.FC<BulkPriceUpdateModalProps> = ({
  visible,
  selectedUnits,
  unitType,
  onClose,
  onSubmit
}) => {
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase')
  const [adjustmentValue, setAdjustmentValue] = useState<string>('')

  useEffect(() => {
    if (visible) {
      setAdjustmentType('increase')
      setAdjustmentValue('')
    }
  }, [visible])

  if (!visible) return null

  const priceRange = selectedUnits.length > 0
    ? {
        min: Math.min(...selectedUnits.map(u => u.price_per_m2 || 0)),
        max: Math.max(...selectedUnits.map(u => u.price_per_m2 || 0))
      }
    : { min: 0, max: 0 }

  const adjustment = parseFloat(adjustmentValue) || 0

  const newPriceRange = {
    min: adjustmentType === 'increase' ? priceRange.min + adjustment : Math.max(0, priceRange.min - adjustment),
    max: adjustmentType === 'increase' ? priceRange.max + adjustment : Math.max(0, priceRange.max - adjustment)
  }

  const totalCurrentValue = selectedUnits.reduce((sum, unit) => sum + (unit.price || 0), 0)
  const totalNewValue = selectedUnits.reduce((sum, unit) => {
    const newPricePerM2 = adjustmentType === 'increase'
      ? (unit.price_per_m2 || 0) + adjustment
      : (unit.price_per_m2 || 0) - adjustment
    return sum + (unit.size_m2 * Math.max(0, newPricePerM2))
  }, 0)

  const totalValueChange = totalNewValue - totalCurrentValue

  const wouldCreateNegativePrice = adjustmentType === 'decrease' &&
    selectedUnits.some(unit => (unit.price_per_m2 || 0) - adjustment < 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!adjustmentValue || parseFloat(adjustmentValue) <= 0) {
      alert('Please enter a valid adjustment value greater than 0')
      return
    }

    if (wouldCreateNegativePrice) {
      alert('This decrease would result in negative prices for some units. Please enter a smaller value.')
      return
    }

    onSubmit(adjustmentType, adjustment)
  }

  const getUnitLabel = () => {
    if (unitType === 'apartment') return 'Apartments'
    if (unitType === 'garage') return 'Garages'
    return 'Repositories'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Configure Price for {getUnitLabel()}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Selection Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-700">Selected Units:</p>
                <p className="font-bold text-blue-900">{selectedUnits.length}</p>
              </div>
              <div>
                <p className="text-blue-700">Current Price Range/m²:</p>
                <p className="font-bold text-blue-900">
                  €{priceRange.min.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {priceRange.min !== priceRange.max && (
                    <> - €{priceRange.max.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adjustment Type
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setAdjustmentType('increase')}
                className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 transition-all duration-200 ${
                  adjustmentType === 'increase'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                <Plus className="w-5 h-5 mr-2" />
                <span className="font-semibold">Increase Price</span>
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType('decrease')}
                className={`flex items-center justify-center px-4 py-3 rounded-lg border-2 transition-all duration-200 ${
                  adjustmentType === 'decrease'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                <Minus className="w-5 h-5 mr-2" />
                <span className="font-semibold">Decrease Price</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adjustment Amount (€ per m²)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={adjustmentValue}
              onChange={(e) => setAdjustmentValue(e.target.value)}
              placeholder="Enter amount (e.g., 500)"
              className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {adjustmentValue && parseFloat(adjustmentValue) > 0 && (
            <div className={`border-2 rounded-lg p-4 ${
              adjustmentType === 'increase' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
            }`}>
              <h3 className={`font-semibold mb-3 ${
                adjustmentType === 'increase' ? 'text-green-900' : 'text-red-900'
              }`}>
                Price Preview
              </h3>
              <div className="space-y-3 text-sm">
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-600 mb-2">
                    {adjustmentType === 'increase' ? '+' : '-'}€{adjustment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/m² will be {adjustmentType === 'increase' ? 'added to' : 'subtracted from'} <strong>each unit's</strong> current price/m²
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">New Price Range/m²:</span>
                    <span className={`font-bold text-lg ${
                      adjustmentType === 'increase' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      €{newPriceRange.min.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {newPriceRange.min !== newPriceRange.max && (
                        <> - €{newPriceRange.max.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-300">
                  <span className="text-gray-700">Current Total Value:</span>
                  <span className="font-semibold">€{totalCurrentValue.toLocaleString('hr-HR')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">New Total Value:</span>
                  <span className="font-semibold">€{totalNewValue.toLocaleString('hr-HR')}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t-2 border-gray-400">
                  <span className="font-bold text-gray-900">Total Value Change:</span>
                  <span className={`font-bold text-lg ${
                    totalValueChange >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {totalValueChange >= 0 ? '+' : ''}€{totalValueChange.toLocaleString('hr-HR')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {wouldCreateNegativePrice && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-4">
              <p className="text-red-800 font-semibold">
                Warning: This decrease would result in negative prices for some units. Please reduce the adjustment amount.
              </p>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors duration-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={wouldCreateNegativePrice}
              className={`flex-1 px-6 py-3 rounded-lg transition-colors duration-200 font-medium ${
                wouldCreateNegativePrice
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : adjustmentType === 'increase'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {adjustmentType === 'increase' ? 'Increase' : 'Decrease'} Prices
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
