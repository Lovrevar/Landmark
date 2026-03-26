import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Home, Warehouse, Package } from 'lucide-react'
import { ApartmentWithDetails } from '../types'
import { Modal, FormField, Input, Select, Textarea, Button, Form } from '../../../ui'

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
  paymentUnitType: _paymentUnitType,  // eslint-disable-line @typescript-eslint/no-unused-vars
  onAmountChange,
  onDateChange,
  onPaymentTypeChange,
  onNotesChange,
  onPaymentUnitTypeChange: _onPaymentUnitTypeChange,  // eslint-disable-line @typescript-eslint/no-unused-vars
  onSubmit,
  onMultiUnitSubmit: _onMultiUnitSubmit  // eslint-disable-line @typescript-eslint/no-unused-vars
}) => {
  const { t } = useTranslation()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  if (!visible || !apartment) return null

  const totalPackagePrice = apartment.price + (linkedGarage?.price || 0) + (linkedStorage?.price || 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!amount) errors.amount = 'Payment amount is required'
    if (!paymentDate) errors.paymentDate = 'Payment date is required'
    if (!paymentType) errors.paymentType = 'Payment type is required'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    onSubmit()
  }

  return (
    <Modal show={visible} onClose={onClose} size="lg">
      <Modal.Header title="Wire Payment" onClose={onClose} />

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm font-semibold text-gray-700 mb-2">Payment for:</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Home className="w-4 h-4 mr-2 text-blue-600" />
                  <span className="text-sm text-gray-900">{t('common.apartment')} {apartment.number}</span>
                </div>
                <span className="text-sm font-medium text-gray-700">€{apartment.price.toLocaleString('hr-HR')}</span>
              </div>
              {linkedGarage && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Warehouse className="w-4 h-4 mr-2 text-orange-600" />
                    <span className="text-sm text-gray-900">{t('common.garage')} {linkedGarage.number}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">€{linkedGarage.price.toLocaleString('hr-HR')}</span>
                </div>
              )}
              {linkedStorage && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Package className="w-4 h-4 mr-2 text-gray-600" />
                    <span className="text-sm text-gray-900">{t('common.storage')} {linkedStorage.number}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">€{linkedStorage.price.toLocaleString('hr-HR')}</span>
                </div>
              )}
              <div className="pt-2 mt-2 border-t border-gray-300 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">{t('common.total')}:</span>
                <span className="text-base font-bold text-green-600">€{totalPackagePrice.toLocaleString('hr-HR')}</span>
              </div>
            </div>
          </div>

          <FormField label="Payment Amount (EUR)" required error={fieldErrors.amount}>
            <Input
              type="number"
              value={amount}
              onChange={(e) => onAmountChange(parseFloat(e.target.value))}
              min="0"
              step="0.01"
            />
          </FormField>

          <FormField label="Payment Date" required error={fieldErrors.paymentDate}>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </FormField>

          <FormField label="Payment Type" required error={fieldErrors.paymentType}>
            <Select
              value={paymentType}
              onChange={(e) => onPaymentTypeChange(e.target.value as 'down_payment' | 'installment' | 'final_payment' | 'other')}
            >
              <option value="down_payment">{t('payment_type.down_payment')}</option>
              <option value="installment">{t('payment_type.installment')}</option>
              <option value="final_payment">{t('payment_type.final_payment')}</option>
              <option value="other">{t('payment_type.other')}</option>
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
          <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="success">{t('common.save')}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
