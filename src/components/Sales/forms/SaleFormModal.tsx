import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Customer } from '../../../lib/supabase'
import { SaleFormData, UnitForSale, CustomerMode } from '../types/salesTypes'
import { Button, Modal, FormField, Input, Select, Textarea } from '../../ui'

interface SaleFormModalProps {
  visible: boolean
  unitForSale: UnitForSale | null
  customers: Customer[]
  onClose: () => void
  onSubmit: (data: SaleFormData, customerMode: CustomerMode) => void
}

export const SaleFormModal: React.FC<SaleFormModalProps> = ({
  visible,
  unitForSale,
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
    if (visible && unitForSale) {
      setFormData(prev => ({
        ...prev,
        sale_price: unitForSale.unit.price
      }))
    }
  }, [visible, unitForSale])

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

  if (!visible || !unitForSale) return null

  const handleSubmit = () => {
    onSubmit(formData, customerMode)
  }

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

  return (
    <Modal show={true} onClose={onClose} size="lg">
      <Modal.Header title={`Complete Sale for ${unitForSale.unit.number}`} onClose={onClose} />
      <Modal.Body>
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
              <FormField label="Select Customer">
                <Select
                  value={formData.customer_id}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  required
                >
                  <option value="">Select a customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} {customer.surname} - {customer.email}
                    </option>
                  ))}
                </Select>
              </FormField>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Full Name" required>
                  <Input
                    type="text"
                    value={formData.buyer_name}
                    onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
                    placeholder="John Smith"
                    required
                  />
                </FormField>
                <FormField label="Email" required>
                  <Input
                    type="email"
                    value={formData.buyer_email}
                    onChange={(e) => setFormData({ ...formData, buyer_email: e.target.value })}
                    placeholder="john@example.com"
                    required
                  />
                </FormField>
                <FormField label="Phone">
                  <Input
                    type="tel"
                    value={formData.buyer_phone}
                    onChange={(e) => setFormData({ ...formData, buyer_phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                  />
                </FormField>
                <FormField label="Address">
                  <Input
                    type="text"
                    value={formData.buyer_address}
                    onChange={(e) => setFormData({ ...formData, buyer_address: e.target.value })}
                    placeholder="123 Main St, City, State"
                  />
                </FormField>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <FormField label="Sale Price (€)" required>
              <Input
                type="number"
                min="0"
                value={formData.sale_price}
                onChange={(e) => setFormData({ ...formData, sale_price: parseFloat(e.target.value) || 0 })}
                required
              />
            </FormField>
            <FormField label="Payment Method">
              <Select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
              >
                <option value="cash">Cash</option>
                <option value="credit">Credit</option>
                <option value="bank_loan">Bank Loan</option>
                <option value="installments">Installments</option>
              </Select>
            </FormField>
            <FormField label="Down Payment (€)">
              <Input
                type="number"
                min="0"
                value={formData.down_payment}
                onChange={(e) => setFormData({ ...formData, down_payment: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Monthly Payment (€)">
              <Input
                type="number"
                min="0"
                value={formData.monthly_payment}
                onChange={(e) => setFormData({ ...formData, monthly_payment: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Sale Date">
              <Input
                type="date"
                value={formData.sale_date}
                onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
              />
            </FormField>
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
                <span className="font-medium text-gray-900 ml-2">€{formData.sale_price.toLocaleString('hr-HR')}</span>
              </div>
              <div>
                <span className="text-gray-600">Down Payment:</span>
                <span className="font-medium text-gray-900 ml-2">€{formData.down_payment.toLocaleString('hr-HR')}</span>
              </div>
              <div>
                <span className="text-gray-600">Remaining:</span>
                <span className="font-medium text-gray-900 ml-2">
                  €{(formData.sale_price - formData.down_payment).toLocaleString('hr-HR')}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Monthly Payment:</span>
                <span className="font-medium text-gray-900 ml-2">€{formData.monthly_payment.toLocaleString('hr-HR')}</span>
              </div>
            </div>
          </div>

          <FormField label="Notes">
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Additional sale notes..."
            />
          </FormField>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="success" onClick={handleSubmit}>
          Complete Sale
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
