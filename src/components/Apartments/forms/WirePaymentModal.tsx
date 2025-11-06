import React, { useState, useEffect } from 'react'
import { X, DollarSign, Home, Warehouse, Package } from 'lucide-react'
import { ApartmentWithDetails } from '../types/apartmentTypes'

interface WirePaymentModalProps {
  visible: boolean
  onClose: () => void
  apartment: ApartmentWithDetails | null
  amount: number
  paymentDate: string
  paymentType: 'down_payment' | 'installment' | 'final_payment' | 'other'
  notes: string
  linkedGarage?: { id: string; number: string; price: number; size_m2: number } | null
  linkedStorage?: { id: string; number: string; price: number; size_m2: number } | null
  paymentUnitType: 'apartment' | 'garage' | 'storage'
  onAmountChange: (amount: number) => void
  onDateChange: (date: string) => void
  onPaymentTypeChange: (type: 'down_payment' | 'installment' | 'final_payment' | 'other') => void
  onNotesChange: (notes: string) => void
  onPaymentUnitTypeChange: (type: 'apartment' | 'garage' | 'storage') => void
  onSubmit: () => void
  onMultiUnitSubmit?: (selectedUnits: Array<{ unitId: string; unitType: 'apartment' | 'garage' | 'storage'; amount: number }>) => void
}

export const WirePaymentModal: React.FC<WirePaymentModalProps> = ({
  visible,
  onClose,
  apartment,
  amount,
  paymentDate,
  paymentType,
  notes,
  linkedGarage,
  linkedStorage,
  paymentUnitType,
  onAmountChange,
  onDateChange,
  onPaymentTypeChange,
  onNotesChange,
  onPaymentUnitTypeChange,
  onSubmit,
  onMultiUnitSubmit
}) => {
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set(['apartment']))
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (visible && apartment) {
      setSelectedUnits(new Set(['apartment']))
      setSplitAmounts({})
    }
  }, [visible, apartment])

  useEffect(() => {
    if (amount > 0 && selectedUnits.size > 0) {
      const splitAmount = amount / selectedUnits.size
      const newSplitAmounts: Record<string, number> = {}
      selectedUnits.forEach(unit => {
        newSplitAmounts[unit] = splitAmount
      })
      setSplitAmounts(newSplitAmounts)
    }
  }, [amount, selectedUnits])

  if (!visible || !apartment) return null

  const toggleUnitSelection = (unitType: string) => {
    const newSelected = new Set(selectedUnits)
    if (newSelected.has(unitType)) {
      if (newSelected.size > 1) {
        newSelected.delete(unitType)
      }
    } else {
      newSelected.add(unitType)
    }
    setSelectedUnits(newSelected)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (onMultiUnitSubmit && selectedUnits.size > 0) {
      const payments: Array<{ unitId: string; unitType: 'apartment' | 'garage' | 'storage'; amount: number }> = []

      selectedUnits.forEach(unitType => {
        if (unitType === 'apartment') {
          payments.push({
            unitId: apartment.id,
            unitType: 'apartment',
            amount: splitAmounts[unitType] || 0
          })
        } else if (unitType === 'garage' && linkedGarage) {
          payments.push({
            unitId: linkedGarage.id,
            unitType: 'garage',
            amount: splitAmounts[unitType] || 0
          })
        } else if (unitType === 'storage' && linkedStorage) {
          payments.push({
            unitId: linkedStorage.id,
            unitType: 'storage',
            amount: splitAmounts[unitType] || 0
          })
        }
      })

      onMultiUnitSubmit(payments)
    } else {
      onSubmit()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
        <div className="bg-green-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center">
            <DollarSign className="w-6 h-6 mr-2" />
            <h3 className="text-xl font-semibold">Wire Payment</h3>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Payment for: {selectedUnits.size > 1 && <span className="text-blue-600 font-medium">(Split payment across {selectedUnits.size} units)</span>}</p>
            <div className="grid grid-cols-1 gap-2">
              <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors bg-white hover:border-blue-400 ${
                selectedUnits.has('apartment') ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
              }`} onClick={() => toggleUnitSelection('apartment')}>
                <input
                  type="checkbox"
                  checked={selectedUnits.has('apartment')}
                  onChange={() => {}}
                  className="mr-3"
                />
                <Home className="w-4 h-4 mr-2 text-blue-600" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Apartment {apartment.number}</div>
                  <div className="text-sm text-gray-600">Price: €{apartment.price.toLocaleString()}</div>
                  {selectedUnits.has('apartment') && splitAmounts['apartment'] > 0 && (
                    <div className="text-sm font-semibold text-blue-600 mt-1">
                      Payment: €{splitAmounts['apartment'].toLocaleString()}
                    </div>
                  )}
                </div>
              </label>

              {linkedGarage && (
                <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors bg-white hover:border-orange-400 ${
                  selectedUnits.has('garage') ? 'border-orange-600 bg-orange-50' : 'border-gray-200'
                }`} onClick={() => toggleUnitSelection('garage')}>
                  <input
                    type="checkbox"
                    checked={selectedUnits.has('garage')}
                    onChange={() => {}}
                    className="mr-3"
                  />
                  <Warehouse className="w-4 h-4 mr-2 text-orange-600" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Garage {linkedGarage.number}</div>
                    <div className="text-sm text-gray-600">Price: €{linkedGarage.price.toLocaleString()}</div>
                    {selectedUnits.has('garage') && splitAmounts['garage'] > 0 && (
                      <div className="text-sm font-semibold text-orange-600 mt-1">
                        Payment: €{splitAmounts['garage'].toLocaleString()}
                      </div>
                    )}
                  </div>
                </label>
              )}

              {linkedStorage && (
                <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors bg-white hover:border-gray-400 ${
                  selectedUnits.has('storage') ? 'border-gray-600 bg-gray-50' : 'border-gray-200'
                }`} onClick={() => toggleUnitSelection('storage')}>
                  <input
                    type="checkbox"
                    checked={selectedUnits.has('storage')}
                    onChange={() => {}}
                    className="mr-3"
                  />
                  <Package className="w-4 h-4 mr-2 text-gray-600" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Storage {linkedStorage.number}</div>
                    <div className="text-sm text-gray-600">Price: €{linkedStorage.price.toLocaleString()}</div>
                    {selectedUnits.has('storage') && splitAmounts['storage'] > 0 && (
                      <div className="text-sm font-semibold text-gray-600 mt-1">
                        Payment: €{splitAmounts['storage'].toLocaleString()}
                      </div>
                    )}
                  </div>
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Amount (€)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              required
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Type</label>
            <select
              value={paymentType}
              onChange={(e) => onPaymentTypeChange(e.target.value as 'down_payment' | 'installment' | 'final_payment' | 'other')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              required
            >
              <option value="down_payment">Down Payment</option>
              <option value="installment">Installment</option>
              <option value="final_payment">Final Payment</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              rows={3}
              placeholder="Add any additional notes..."
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
