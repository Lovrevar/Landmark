import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { format } from 'date-fns'
import type { Customer, SaleFormData, CustomerMode, UnitType } from '../types/salesTypes'

interface SaleFormProps {
  visible: boolean
  unit: any | null
  unitType: UnitType
  customers: Customer[]
  onClose: () => void
  onSubmit: (saleData: SaleFormData, customerMode: CustomerMode) => void
}

const SaleForm: React.FC<SaleFormProps> = ({
  visible,
  unit,
  unitType,
  customers,
  onClose,
  onSubmit
}) => {
  const [customerMode, setCustomerMode] = useState<CustomerMode>('new')
  const [formData, setFormData] = useState<SaleFormData>({
    customer_id: '',
    sale_price: 0,
    payment_method: 'bank_loan',
    down_payment: 0,
    monthly_payment: 0,
    sale_date: format(new Date(), 'yyyy-MM-dd'),
    contract_signed: false,
    notes: '',
    buyer_name: '',
    buyer_email: '',
    buyer_phone: '',
    buyer_address: ''
  })

  useEffect(() => {
    if (visible && unit) {
      setFormData(prev => ({
        ...prev,
        sale_price: unit.price
      }))
    }
  }, [visible, unit])

  useEffect(() => {
    if (!visible) {
      setFormData({
        customer_id: '',
        sale_price: 0,
        payment_method: 'bank_loan',
        down_payment: 0,
        monthly_payment: 0,
        sale_date: format(new Date(), 'yyyy-MM-dd'),
        contract_signed: false,
        notes: '',
        buyer_name: '',
        buyer_email: '',
        buyer_phone: '',
        buyer_address: ''
      })
      setCustomerMode('new')
    }
  }, [visible])

  if (!visible || !unit) return null

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId)
    setFormData({
      ...formData,
      customer_id: customerId,
      buyer_name: customer ? `${customer.name} ${customer.surname}` : '',
      buyer_email: customer?.email || '',
      buyer_phone: customer?.phone || ''
    })
  }

  const handleSubmit = () => {
    onSubmit(formData, customerMode)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">
              Complete Sale - Unit {unit.number}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Customer</label>
            <div className="flex space-x-4 mb-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="new"
                  checked={customerMode === 'new'}
                  onChange={(e) => setCustomerMode(e.target.value as CustomerMode)}
                  className="mr-2"
                />
                Create New Customer
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="existing"
                  checked={customerMode === 'existing'}
                  onChange={(e) => setCustomerMode(e.target.value as CustomerMode)}
                  className="mr-2"
                />
                Select Existing Customer
              </label>
            </div>

            {customerMode === 'existing' ? (
              <select
                value={formData.customer_id}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select a customer</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} {customer.surname} - {customer.email}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    value={formData.buyer_name}
                    onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John Smith"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={formData.buyer_email}
                    onChange={(e) => setFormData({ ...formData, buyer_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="john@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={formData.buyer_phone}
                    onChange={(e) => setFormData({ ...formData, buyer_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <input
                    type="text"
                    value={formData.buyer_address}
                    onChange={(e) => setFormData({ ...formData, buyer_address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="123 Main St, City, State"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sale Price (€) *</label>
              <input
                type="number"
                min="0"
                value={formData.sale_price}
                onChange={(e) => setFormData({ ...formData, sale_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="cash">Cash</option>
                <option value="credit">Credit</option>
                <option value="bank_loan">Bank Loan</option>
                <option value="installments">Installments</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Down Payment (€)</label>
              <input
                type="number"
                min="0"
                value={formData.down_payment}
                onChange={(e) => setFormData({ ...formData, down_payment: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Payment (€)</label>
              <input
                type="number"
                min="0"
                value={formData.monthly_payment}
                onChange={(e) => setFormData({ ...formData, monthly_payment: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sale Date</label>
              <input
                type="date"
                value={formData.sale_date}
                onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="contract_signed"
                checked={formData.contract_signed}
                onChange={(e) => setFormData({ ...formData, contract_signed: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="contract_signed" className="text-sm font-medium text-gray-700">
                Contract Signed
              </label>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h4 className="font-semibold text-gray-900 mb-3">Sale Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Sale Price:</span>
                <span className="font-medium text-gray-900 ml-2">€{formData.sale_price.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-600">Down Payment:</span>
                <span className="font-medium text-gray-900 ml-2">€{formData.down_payment.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-600">Remaining:</span>
                <span className="font-medium text-gray-900 ml-2">
                  €{(formData.sale_price - formData.down_payment).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Monthly Payment:</span>
                <span className="font-medium text-gray-900 ml-2">€{formData.monthly_payment.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Additional sale notes..."
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              Complete Sale
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SaleForm
