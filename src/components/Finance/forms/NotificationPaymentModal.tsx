import React, { useEffect } from 'react'
import { X, DollarSign, Calendar, FileText, Building2, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { PaymentNotification } from '../services/paymentNotificationService'

interface NotificationPaymentModalProps {
  visible: boolean
  onClose: () => void
  notification: PaymentNotification | null
  amount: number
  paymentDate: string
  notes: string
  onAmountChange: (amount: number) => void
  onDateChange: (date: string) => void
  onNotesChange: (notes: string) => void
  onSubmit: () => void
}

export const NotificationPaymentModal: React.FC<NotificationPaymentModalProps> = ({
  visible,
  onClose,
  notification,
  amount,
  paymentDate,
  notes,
  onAmountChange,
  onDateChange,
  onNotesChange,
  onSubmit
}) => {
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [visible])

  if (!visible || !notification) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
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

        <div className="p-6 overflow-y-auto flex-1">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
              <Building2 className="w-5 h-5 mr-2" />
              Payment Notification Details
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-700">Bank</p>
                <p className="font-medium text-blue-900">{notification.bank_name}</p>
              </div>
              <div>
                <p className="text-blue-700">Credit Type</p>
                <p className="font-medium text-blue-900">
                  {notification.credit_type?.replace('_', ' ').toUpperCase()}
                </p>
              </div>
              <div>
                <p className="text-blue-700">Due Date</p>
                <p className="font-medium text-blue-900">
                  {format(new Date(notification.due_date), 'MMM dd, yyyy')}
                </p>
              </div>
              <div>
                <p className="text-blue-700">Scheduled Amount</p>
                <p className="font-medium text-blue-900">€{Number(notification.amount).toLocaleString('hr-HR')}</p>
              </div>
              <div>
                <p className="text-blue-700">Payment Number</p>
                <p className="font-medium text-blue-900">#{notification.payment_number}</p>
              </div>
              <div>
                <p className="text-blue-700">Project</p>
                <p className="font-medium text-blue-900">{notification.project_name}</p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-6 flex items-start">
            <AlertCircle className="w-5 h-5 text-orange-600 mr-2 mt-0.5" />
            <div className="text-sm text-orange-800">
              <p className="font-medium">This payment will be recorded as a bank credit repayment.</p>
              <p className="mt-1">The outstanding balance of the bank credit will be reduced by the payment amount.</p>
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
              <p className="text-xs text-gray-500 mt-1">
                Suggested amount: €{Number(notification.amount).toLocaleString('hr-HR')}
              </p>
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

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={!amount || amount <= 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Record Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
