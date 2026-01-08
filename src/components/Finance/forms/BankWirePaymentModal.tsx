import React from 'react'
import { X, DollarSign, Calendar, FileText } from 'lucide-react'
import { BankCredit } from '../../../lib/supabase'

interface BankWirePaymentModalProps {
  visible: boolean
  onClose: () => void
  credit: BankCredit | null
  bankName: string
  amount: number
  paymentDate: string
  notes: string
  onAmountChange: (amount: number) => void
  onDateChange: (date: string) => void
  onNotesChange: (notes: string) => void
  onSubmit: () => void
}

export const BankWirePaymentModal: React.FC<BankWirePaymentModalProps> = ({
  visible,
  onClose,
  credit,
  bankName,
  amount,
  paymentDate,
  notes,
  onAmountChange,
  onDateChange,
  onNotesChange,
  onSubmit
}) => {
  if (!visible || !credit) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">Record Bank Payment</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-blue-900 mb-2">Payment Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-700">Bank</p>
                <p className="font-medium text-blue-900">{bankName}</p>
              </div>
              <div>
                <p className="text-blue-700">Credit Type</p>
                <p className="font-medium text-blue-900">
                  {credit.credit_type.replace('_', ' ')}
                </p>
              </div>
              <div>
                <p className="text-blue-700">Outstanding Balance</p>
                <p className="font-medium text-blue-900">€{credit.outstanding_balance.toLocaleString('hr-HR')}</p>
              </div>
              <div>
                <p className="text-blue-700">Scheduled Payment</p>
                <p className="font-medium text-blue-900">€{credit.monthly_payment.toLocaleString('hr-HR')}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Payment Amount (€) *
              </label>
              <input
                type="number"
                value={amount || ''}
                onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter payment amount"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Payment Date
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4 inline mr-1" />
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Add any notes about this payment..."
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              Record Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
