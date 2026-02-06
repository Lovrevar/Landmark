import React from 'react'
import { formatCurrency } from '../../Common/CurrencyInput'

interface InvoiceVATSummaryProps {
  formData: {
    base_amount_1: number
    base_amount_2: number
    base_amount_3: number
    base_amount_4: number
  }
}

export const InvoiceVATSummary: React.FC<InvoiceVATSummaryProps> = ({ formData }) => {
  if (formData.base_amount_1 === 0 && formData.base_amount_2 === 0 && formData.base_amount_3 === 0 && formData.base_amount_4 === 0) {
    return null
  }

  return (
    <div className="px-6 pb-6">
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <div className="text-sm font-medium text-gray-700 mb-2">Pregled računa:</div>

        {formData.base_amount_1 > 0 && (
          <div className="space-y-1 pb-2 border-b border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Osnovica (PDV 25%):</span>
              <span className="font-medium">€{formatCurrency(formData.base_amount_1)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">PDV 25%:</span>
              <span className="font-medium">€{formatCurrency(formData.base_amount_1 * 0.25)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-gray-600">Subtotal:</span>
              <span>€{formatCurrency(formData.base_amount_1 * 1.25)}</span>
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
              <span className="font-medium">€{formatCurrency(formData.base_amount_2 * 0.13)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-gray-600">Subtotal:</span>
              <span>€{formatCurrency(formData.base_amount_2 * 1.13)}</span>
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
              <span className="font-medium">€{formatCurrency(formData.base_amount_4 * 0.05)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-gray-600">Subtotal:</span>
              <span>€{formatCurrency(formData.base_amount_4 * 1.05)}</span>
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
              <span>€{formatCurrency(formData.base_amount_3)}</span>
            </div>
          </div>
        )}

        <div className="flex justify-between text-base font-bold pt-2">
          <span>UKUPNO:</span>
          <span>€{formatCurrency(
            (formData.base_amount_1 * 1.25) +
            (formData.base_amount_2 * 1.13) +
            (formData.base_amount_4 * 1.05) +
            formData.base_amount_3
          )}</span>
        </div>
      </div>
    </div>
  )
}
