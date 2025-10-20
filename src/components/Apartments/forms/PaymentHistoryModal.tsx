import React from 'react'
import { X, Edit2, Trash2, Calendar, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { ApartmentWithDetails, PaymentWithUser } from '../types/apartmentTypes'

interface PaymentHistoryModalProps {
  visible: boolean
  onClose: () => void
  apartment: ApartmentWithDetails | null
  payments: PaymentWithUser[]
  onEditPayment: (payment: PaymentWithUser) => void
  onDeletePayment: (paymentId: string, amount: number) => void
}

export const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({
  visible,
  onClose,
  apartment,
  payments,
  onEditPayment,
  onDeletePayment
}) => {
  if (!visible || !apartment) return null

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const remainingBalance = apartment.price - totalPaid

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-teal-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h3 className="text-xl font-semibold">Payment History</h3>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-lg font-semibold text-gray-900 mb-2">
              {apartment.project_name} - {apartment.building_name} - Unit {apartment.number}
            </p>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <p className="text-sm text-gray-600">Total Price</p>
                <p className="text-lg font-bold text-gray-900">€{apartment.price.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Paid</p>
                <p className="text-lg font-bold text-green-600">€{totalPaid.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Remaining</p>
                <p className={`text-lg font-bold ${remainingBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  €{remainingBalance.toLocaleString()}
                </p>
              </div>
            </div>

            {apartment.price > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Payment Progress</span>
                  <span className="font-medium">{((totalPaid / apartment.price) * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (totalPaid / apartment.price) * 100)}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-3">All Payments ({payments.length})</h4>
            {payments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <DollarSign className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No payments recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <DollarSign className="w-4 h-4 text-green-600 mr-1" />
                        <span className="font-bold text-green-600 text-lg">
                          €{payment.amount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600 mb-1">
                        <Calendar className="w-3 h-3 mr-1" />
                        {format(new Date(payment.payment_date), 'MMM dd, yyyy')}
                      </div>
                      <p className="text-xs text-gray-500">Recorded by: {payment.user_email}</p>
                      {payment.notes && (
                        <p className="text-sm text-gray-700 mt-2 italic">"{payment.notes}"</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onEditPayment(payment)}
                        className="p-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg transition-colors duration-200"
                        title="Edit payment"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this payment?')) {
                            onDeletePayment(payment.id, payment.amount)
                          }
                        }}
                        className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors duration-200"
                        title="Delete payment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
