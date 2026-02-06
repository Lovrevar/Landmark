import React from 'react'
import { formatCurrency } from '../../Common/CurrencyInput'
import { Card } from '../../ui'
import type { BankInvoiceFormData, CalculatedTotals } from '../types/bankInvoiceTypes'

interface InvoicePreviewProps {
  formData: BankInvoiceFormData
  calc: CalculatedTotals
}

const InvoicePreview: React.FC<InvoicePreviewProps> = ({ formData, calc }) => {
  if (formData.base_amount_1 === 0 && formData.base_amount_2 === 0 && formData.base_amount_3 === 0 && formData.base_amount_4 === 0) {
    return null
  }

  return (
    <Card variant="bordered" padding="none" className="col-span-2 bg-gray-50 p-4 space-y-2">
      <Card.Header className="!mb-2">
        <div className="text-sm font-medium text-gray-700">Pregled računa:</div>
      </Card.Header>

      <Card.Body className="space-y-2">
        {formData.base_amount_1 > 0 && (
          <div className="space-y-1 pb-2 border-b border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Osnovica (PDV 25%):</span>
              <span className="font-medium">€{formatCurrency(formData.base_amount_1)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">PDV 25%:</span>
              <span className="font-medium">€{formatCurrency(calc.vat1)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-gray-600">Subtotal:</span>
              <span>€{formatCurrency(calc.subtotal1)}</span>
            </div>
          </div>
        )}

        {formData.base_amount_2 > 0 && (
          <div className="space-y-1 pb-2 border-b border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Osnovica (PDV 13%):</span>
              <span className="font-medium">€{formatCurrency(formData.base_amount_2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">PDV 13%:</span>
              <span className="font-medium">€{formatCurrency(calc.vat2)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-gray-600">Subtotal:</span>
              <span>€{formatCurrency(calc.subtotal2)}</span>
            </div>
          </div>
        )}

        {formData.base_amount_4 > 0 && (
          <div className="space-y-1 pb-2 border-b border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Osnovica (PDV 5%):</span>
              <span className="font-medium">€{formatCurrency(formData.base_amount_4)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">PDV 5%:</span>
              <span className="font-medium">€{formatCurrency(calc.vat4)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-gray-600">Subtotal:</span>
              <span>€{formatCurrency(calc.subtotal4)}</span>
            </div>
          </div>
        )}

        {formData.base_amount_3 > 0 && (
          <div className="space-y-1 pb-2 border-b border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Osnovica (PDV 0%):</span>
              <span className="font-medium">€{formatCurrency(formData.base_amount_3)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">PDV 0%:</span>
              <span className="font-medium">€0.00</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-gray-600">Subtotal:</span>
              <span>€{formatCurrency(calc.subtotal3)}</span>
            </div>
          </div>
        )}

        <div className="flex justify-between text-base font-bold pt-2">
          <span>UKUPNO:</span>
          <span>€{formatCurrency(calc.total)}</span>
        </div>
      </Card.Body>
    </Card>
  )
}

export default InvoicePreview
