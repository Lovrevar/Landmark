import React from 'react'
import { Edit2, Trash2, Calendar, DollarSign, Home, Warehouse, Package } from 'lucide-react'
import { format } from 'date-fns'
import { ApartmentWithDetails, PaymentWithCustomer } from '../types/apartmentTypes'
import { Modal, Button, EmptyState } from '../../ui'

interface PaymentHistoryModalProps {
  visible: boolean
  onClose: () => void
  apartment: ApartmentWithDetails | null
  payments: PaymentWithCustomer[]
  linkedGarage?: { id: string; number: string; price: number } | null
  linkedStorage?: { id: string; number: string; price: number } | null
  onEditPayment: (payment: PaymentWithCustomer) => void
  onDeletePayment: (paymentId: string, saleId: string | null, amount: number) => void
}

export const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({
  visible,
  onClose,
  apartment,
  payments,
  linkedGarage,
  linkedStorage,
  onEditPayment,
  onDeletePayment
}) => {
  if (!visible || !apartment) return null

  const apartmentPayments = payments.filter(p => !p.garage_id && !p.storage_id)
  const garagePayments = payments.filter(p => p.garage_id)
  const storagePayments = payments.filter(p => p.storage_id)

  const aptPaid = apartmentPayments.reduce((sum, p) => sum + p.amount, 0)
  const garagePaid = garagePayments.reduce((sum, p) => sum + p.amount, 0)
  const storagePaid = storagePayments.reduce((sum, p) => sum + p.amount, 0)
  const totalPaid = aptPaid + garagePaid + storagePaid

  const totalPrice = apartment.price + (linkedGarage?.price || 0) + (linkedStorage?.price || 0)
  const remainingBalance = totalPrice - totalPaid

  const getPaymentUnitInfo = (payment: PaymentWithCustomer) => {
    if (payment.garage_id && linkedGarage) {
      return { icon: Warehouse, label: `Garage ${linkedGarage.number}`, color: 'text-orange-600', bgColor: 'bg-orange-100' }
    }
    if (payment.storage_id && linkedStorage) {
      return { icon: Package, label: `Storage ${linkedStorage.number}`, color: 'text-gray-600', bgColor: 'bg-gray-100' }
    }
    return { icon: Home, label: `Apartment ${apartment.number}`, color: 'text-blue-600', bgColor: 'bg-blue-100' }
  }

  return (
    <Modal show={visible} onClose={onClose} size="xl">
      <Modal.Header title="Payment History" onClose={onClose} />

      <Modal.Body>
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-lg font-semibold text-gray-900 mb-2">
              {apartment.project_name} - {apartment.building_name} - Unit {apartment.number}
            </p>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-lg font-bold text-gray-900">€{totalPrice.toLocaleString('hr-HR')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Paid</p>
                <p className="text-lg font-bold text-green-600">€{totalPaid.toLocaleString('hr-HR')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Remaining</p>
                <p className={`text-lg font-bold ${remainingBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  €{remainingBalance.toLocaleString('hr-HR')}
                </p>
              </div>
            </div>

            {totalPrice > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Overall Progress</span>
                  <span className="font-medium">{((totalPaid / totalPrice) * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (totalPaid / totalPrice) * 100)}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-blue-50 p-2 rounded">
                <p className="text-xs text-gray-600 flex items-center">
                  <Home className="w-3 h-3 mr-1 text-blue-600" />
                  Apartment
                </p>
                <p className="text-sm font-bold text-blue-600">€{aptPaid.toLocaleString('hr-HR')}</p>
              </div>
              {linkedGarage && (
                <div className="bg-orange-50 p-2 rounded">
                  <p className="text-xs text-gray-600 flex items-center">
                    <Warehouse className="w-3 h-3 mr-1 text-orange-600" />
                    Garage
                  </p>
                  <p className="text-sm font-bold text-orange-600">€{garagePaid.toLocaleString('hr-HR')}</p>
                </div>
              )}
              {linkedStorage && (
                <div className="bg-gray-50 p-2 rounded">
                  <p className="text-xs text-gray-600 flex items-center">
                    <Package className="w-3 h-3 mr-1 text-gray-600" />
                    Storage
                  </p>
                  <p className="text-sm font-bold text-gray-600">€{storagePaid.toLocaleString('hr-HR')}</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-3">All Payments ({payments.length})</h4>
            {payments.length === 0 ? (
              <EmptyState
                icon={DollarSign}
                title="No payments recorded yet"
              />
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => {
                  const unitInfo = getPaymentUnitInfo(payment)
                  const UnitIcon = unitInfo.icon
                  return (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <DollarSign className="w-4 h-4 text-green-600 mr-1" />
                          <span className="font-bold text-green-600 text-lg">
                            €{payment.amount.toLocaleString('hr-HR')}
                          </span>
                          <span className={`ml-3 px-2 py-0.5 rounded text-xs font-medium ${unitInfo.bgColor} ${unitInfo.color} flex items-center`}>
                            <UnitIcon className="w-3 h-3 mr-1" />
                            {unitInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600 mb-1">
                          <Calendar className="w-3 h-3 mr-1" />
                          {format(new Date(payment.payment_date), 'MMM dd, yyyy')}
                        </div>
                        <p className="text-xs text-gray-500">Customer: {payment.customer_name} {payment.customer_surname}</p>
                        <p className="text-xs text-gray-500">Type: {payment.payment_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                        {payment.notes && (
                          <p className="text-sm text-gray-700 mt-2 italic">"{payment.notes}"</p>
                        )}
                      </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onEditPayment(payment)}
                        title="Edit payment"
                        icon={Edit2}
                      />
                      <Button
                        variant="danger"
                        size="icon-sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this payment?')) {
                            onDeletePayment(payment.id, payment.sale_id, payment.amount)
                          }
                        }}
                        title="Delete payment"
                        icon={Trash2}
                      />
                    </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </Modal.Footer>
    </Modal>
  )
}
