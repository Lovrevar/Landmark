import React, { useState } from 'react'
import { X } from 'lucide-react'
import { UnitForSale, SaleFormData, CustomerMode } from '../types/salesTypes'

interface SaleFormModalProps {
  visible: boolean
  unitForSale: UnitForSale | null
  customers: any[]
  onClose: () => void
  onSubmit: (saleData: SaleFormData, customerMode: CustomerMode) => void
}

export const SaleFormModal: React.FC<SaleFormModalProps> = ({
  visible,
  unitForSale,
  customers,
  onClose,
  onSubmit
}) => {
  const [customerMode, setCustomerMode] = useState<CustomerMode>('existing')
  const [formData, setFormData] = useState<SaleFormData>({
    customer_id: '',
    buyer_name: '',
    buyer_email: '',
    buyer_phone: '',
    buyer_address: '',
    sale_price: 0,
    payment_method: 'cash',
    down_payment: 0,
    monthly_payment: 0,
    sale_date: new Date().toISOString().split('T')[0],
    contract_signed: false,
    notes: ''
  })

  if (!visible || !unitForSale) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">
              Sell {unitForSale.type} #{unitForSale.unit.number}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Customer Mode</label>
              <div className="flex space-x-4">
                <button
                  onClick={() => setCustomerMode('existing')}
                  className={`px-4 py-2 rounded-lg ${
                    customerMode === 'existing'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Existing Customer
                </button>
                <button
                  onClick={() => setCustomerMode('new')}
                  className={`px-4 py-2 rounded-lg ${
                    customerMode === 'new'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  New Customer
                </button>
              </div>
            </div>

            {customerMode === 'existing' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Customer</label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.surname} - {c.email}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Buyer Name</label>
                  <input
                    type="text"
                    value={formData.buyer_name}
                    onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Buyer Email</label>
                  <input
                    type="email"
                    value={formData.buyer_email}
                    onChange={(e) => setFormData({ ...formData, buyer_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Buyer Phone</label>
                  <input
                    type="tel"
                    value={formData.buyer_phone}
                    onChange={(e) => setFormData({ ...formData, buyer_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Buyer Address</label>
                  <input
                    type="text"
                    value={formData.buyer_address}
                    onChange={(e) => setFormData({ ...formData, buyer_address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sale Price</label>
                <input
                  type="number"
                  value={formData.sale_price}
                  onChange={(e) => setFormData({ ...formData, sale_price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="cash">Cash</option>
                  <option value="installment">Installment</option>
                  <option value="mortgage">Mortgage</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Down Payment</label>
                <input
                  type="number"
                  value={formData.down_payment}
                  onChange={(e) => setFormData({ ...formData, down_payment: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Payment</label>
                <input
                  type="number"
                  value={formData.monthly_payment}
                  onChange={(e) => setFormData({ ...formData, monthly_payment: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sale Date</label>
              <input
                type="date"
                value={formData.sale_date}
                onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.contract_signed}
                  onChange={(e) => setFormData({ ...formData, contract_signed: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Contract Signed</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={() => onSubmit(formData, customerMode)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Complete Sale
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
