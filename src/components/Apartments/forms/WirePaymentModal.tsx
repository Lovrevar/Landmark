import React, { useState, useEffect } from 'react'
import { DollarSign, Home, Warehouse, Package } from 'lucide-react'
import { ApartmentWithDetails } from '../types/apartmentTypes'
import { Modal, FormField, Input, Select, Textarea, Button } from '../../ui'

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
    <Modal show={visible} onClose={onClose} size="lg">
      <Modal.Header title="Wire Payment" onClose={onClose} />

      <form onSubmit={handleSubmit}>
        <Modal.Body>
          <div className="space-y-4">
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

          <FormField label="Payment Amount (EUR)" required>
            <Input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(parseFloat(e.target.value))}
              required
              min="0"
              step="0.01"
            />
          </FormField>

          <FormField label="Payment Date" required>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => onDateChange(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Payment Type" required>
            <Select
              value={paymentType}
              onChange={(e) => onPaymentTypeChange(e.target.value as 'down_payment' | 'installment' | 'final_payment' | 'other')}
              required
            >
              <option value="down_payment">Down Payment</option>
              <option value="installment">Installment</option>
              <option value="final_payment">Final Payment</option>
              <option value="other">Other</option>
            </Select>
          </FormField>

          <FormField label="Notes (Optional)">
            <Textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={3}
              placeholder="Add any additional notes..."
            />
          </FormField>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="success">Record Payment</Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
