import React from 'react'
import { X } from 'lucide-react'
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

  const handleSubmit = () => {
    onSubmit()
  }

  const newOutstandingBalance = credit.outstanding_balance - amount
  const wouldOverpay = newOutstandingBalance < 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Wire Payment</h3>
              <p className="text-sm text-gray-600 mt-1">{bankName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Credit Amount:</span>
              <span className="text-sm font-medium text-gray-900">€{credit.amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Outstanding Balance:</span>
              <span className="text-sm font-medium text-orange-600">€{credit.outstanding_balance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-700">Already Paid:</span>
              <span className="text-sm font-bold text-green-600">
                €{(credit.amount - credit.outstanding_balance).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Amount (€) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter payment amount"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the amount you are paying to the bank
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Date (Optional)
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty if date is not yet known
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Add any notes about this payment"
            />
          </div>

          {amount > 0 && (
            <div className={`p-3 rounded-lg mb-4 ${
              wouldOverpay
                ? 'bg-orange-50 border border-orange-200'
                : 'bg-blue-50 border border-blue-200'
            }`}>
              <p className={`text-sm ${
                wouldOverpay
                  ? 'text-orange-700'
                  : 'text-blue-700'
              }`}>
                <span className="font-medium">New Outstanding Balance:</span> €{Math.max(0, newOutstandingBalance).toLocaleString()}
              </p>
              {wouldOverpay && (
                <p className="text-sm text-orange-700 mt-1">
                  <span className="font-medium">Overpayment:</span> €{Math.abs(newOutstandingBalance).toLocaleString()}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={amount <= 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Record Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
