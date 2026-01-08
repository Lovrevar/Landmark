import React, { useEffect } from 'react'
import { X, Building2, User, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { Subcontractor, WirePayment } from '../../../lib/supabase'

interface AccountingPayment {
  id: string
  amount: number
  payment_date: string | null
  payment_method: string | null
  reference_number: string | null
  description: string | null
  created_at: string
  invoice?: {
    id: string
    invoice_number: string
    invoice_type: string
    total_amount: number
    status: string
  }
}

interface PaymentHistoryModalProps {
  visible: boolean
  onClose: () => void
  subcontractor: Subcontractor | null
  payments: (WirePayment | AccountingPayment)[]
  onEditPayment: (payment: WirePayment) => void
  onDeletePayment: (paymentId: string, amount: number) => void
}

export const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({
  visible,
  onClose,
  subcontractor,
  payments,
  onEditPayment,
  onDeletePayment
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

  if (!visible || !subcontractor) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex-shrink-0 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Payment History</h3>
              <p className="text-sm text-gray-600 mt-1">{subcontractor.name}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600">Contract Amount</p>
                <p className="text-lg font-bold text-gray-900">€{subcontractor.cost.toLocaleString('hr-HR')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Paid</p>
                <p className="text-lg font-bold text-teal-600">€{subcontractor.budget_realized.toLocaleString('hr-HR')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Remaining</p>
                <p className="text-lg font-bold text-orange-600">
                  €{Math.max(0, subcontractor.cost - subcontractor.budget_realized).toLocaleString('hr-HR')}
                </p>
              </div>
            </div>
          </div>

          <h4 className="font-semibold text-gray-900 mb-3">All Payments ({payments.length})</h4>

          {payments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No payments recorded yet
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => {
                const isAccountingPayment = 'invoice' in payment
                const accountingPayment = payment as AccountingPayment

                return (
                  <div key={payment.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-lg font-bold text-gray-900">€{payment.amount.toLocaleString('hr-HR')}</span>
                          {payment.payment_date && (
                            <span className="text-sm text-gray-600">
                              {format(new Date(payment.payment_date), 'MMM dd, yyyy')}
                            </span>
                          )}
                          {!payment.payment_date && (
                            <span className="text-sm text-gray-400 italic">Date not set</span>
                          )}
                        </div>

                        {isAccountingPayment && accountingPayment.invoice && (
                          <div className="flex items-center space-x-2 mb-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-gray-700">
                              Invoice: <span className="font-medium text-blue-600">
                                {accountingPayment.invoice.invoice_number}
                              </span>
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              accountingPayment.invoice.status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {accountingPayment.invoice.status}
                            </span>
                          </div>
                        )}

                        {isAccountingPayment && accountingPayment.payment_method && (
                          <div className="text-sm text-gray-600 mb-2">
                            Method: <span className="font-medium">{accountingPayment.payment_method}</span>
                          </div>
                        )}

                        {isAccountingPayment && accountingPayment.reference_number && (
                          <div className="text-sm text-gray-600 mb-2">
                            Ref: {accountingPayment.reference_number}
                          </div>
                        )}

                        {!isAccountingPayment && (payment as WirePayment).paid_by_type && ((payment as WirePayment).paid_by_investor_id || (payment as WirePayment).paid_by_bank_id) && (
                          <div className="flex items-center space-x-2 mb-2">
                            {(payment as WirePayment).paid_by_type === 'investor' ? (
                              <>
                                <User className="w-4 h-4 text-blue-600" />
                                <span className="text-sm text-gray-700">
                                  Paid by: <span className="font-medium text-blue-600">
                                    {(payment as any).investor?.name || 'Investor'}
                                    {(payment as any).investor?.type && ` (${(payment as any).investor.type})`}
                                  </span>
                                </span>
                              </>
                            ) : (
                              <>
                                <Building2 className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-gray-700">
                                  Paid by: <span className="font-medium text-green-600">
                                    {(payment as any).bank?.name || 'Bank'}
                                  </span>
                                </span>
                              </>
                            )}
                          </div>
                        )}

                        {((isAccountingPayment && accountingPayment.description) || (!isAccountingPayment && (payment as WirePayment).notes)) && (
                          <p className="text-sm text-gray-600 mb-2">
                            {isAccountingPayment ? accountingPayment.description : (payment as WirePayment).notes}
                          </p>
                        )}

                        <p className="text-xs text-gray-400">
                          Created {format(new Date(payment.created_at), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                      {!isAccountingPayment && (
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => onEditPayment(payment as WirePayment)}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onDeletePayment(payment.id, payment.amount)}
                            className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                      {isAccountingPayment && (
                        <div className="ml-4">
                          <span className="text-xs text-gray-500 italic">Managed in Accounting</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
