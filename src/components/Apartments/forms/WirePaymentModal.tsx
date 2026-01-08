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
  if (!visible || !apartment) return null

  const totalPackagePrice = apartment.price + (linkedGarage?.price || 0) + (linkedStorage?.price || 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit()
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
            <p className="text-sm font-semibold text-gray-700 mb-2">Payment for:</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Home className="w-4 h-4 mr-2 text-blue-600" />
                  <span className="text-sm text-gray-900">Apartment {apartment.number}</span>
                </div>
                <span className="text-sm font-medium text-gray-700">€{apartment.price.toLocaleString('hr-HR')}</span>
              </div>
              {linkedGarage && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Warehouse className="w-4 h-4 mr-2 text-orange-600" />
                    <span className="text-sm text-gray-900">Garage {linkedGarage.number}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">€{linkedGarage.price.toLocaleString('hr-HR')}</span>
                </div>
              )}
              {linkedStorage && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Package className="w-4 h-4 mr-2 text-gray-600" />
                    <span className="text-sm text-gray-900">Storage {linkedStorage.number}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">€{linkedStorage.price.toLocaleString('hr-HR')}</span>
                </div>
              )}
              <div className="pt-2 mt-2 border-t border-gray-300 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">Total Package:</span>
                <span className="text-base font-bold text-green-600">€{totalPackagePrice.toLocaleString('hr-HR')}</span>
              </div>
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
