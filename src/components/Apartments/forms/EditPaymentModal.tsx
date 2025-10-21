import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { PaymentWithCustomer } from '../types/apartmentTypes'

interface EditPaymentModalProps {
  visible: boolean
  onClose: () => void
  payment: PaymentWithCustomer | null
  onSubmit: (paymentId: string, amount: number, date: string, paymentType: 'down_payment' | 'installment' | 'final_payment' | 'other', notes: string) => void
}

export const EditPaymentModal: React.FC<EditPaymentModalProps> = ({
  visible,
  onClose,
  payment,
  onSubmit
}) => {
  const [amount, setAmount] = useState(0)
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentType, setPaymentType] = useState<'down_payment' | 'installment' | 'final_payment' | 'other'>('installment')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (payment) {
      setAmount(payment.amount)
      setPaymentDate(payment.payment_date.split('T')[0])
      setPaymentType(payment.payment_type)
      setNotes(payment.notes || '')
    }
  }, [payment])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!payment) return
    onSubmit(payment.id, amount, paymentDate, paymentType, notes)
  }

  if (!visible || !payment) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
        <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h3 className="text-xl font-semibold">Edit Payment</h3>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Amount (€)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Type</label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as 'down_payment' | 'installment' | 'final_payment' | 'other')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="down_payment">Down Payment</option>
              <option value="installment">Installment</option>
              <option value="final_payment">Final Payment</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
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
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Update Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
