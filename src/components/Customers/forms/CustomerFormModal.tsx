import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Customer } from '../../../lib/supabase'
import { CustomerWithApartments, CustomerCategory } from '../types/customerTypes'

interface CustomerFormModalProps {
  show: boolean
  editingCustomer: CustomerWithApartments | null
  activeCategory: CustomerCategory
  onClose: () => void
  onSave: (formData: Partial<Customer>, editingId?: string) => Promise<void>
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  show,
  editingCustomer,
  activeCategory,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    surname: '',
    email: '',
    phone: '',
    address: '',
    bank_account: '',
    id_number: '',
    status: activeCategory,
    priority: 'warm',
    notes: '',
    preferences: {
      budget_min: 0,
      budget_max: 0,
      preferred_size_min: 0,
      preferred_size_max: 0,
      preferred_floor: '',
      preferred_location: '',
      bedrooms: 0,
      notes: ''
    }
  })

  useEffect(() => {
    if (editingCustomer) {
      setFormData(editingCustomer)
    } else {
      setFormData({
        name: '',
        surname: '',
        email: '',
        phone: '',
        address: '',
        bank_account: '',
        id_number: '',
        status: activeCategory,
        priority: 'warm',
        notes: '',
        preferences: {
          budget_min: 0,
          budget_max: 0,
          preferred_size_min: 0,
          preferred_size_max: 0,
          preferred_floor: '',
          preferred_location: '',
          bedrooms: 0,
          notes: ''
        }
      })
    }
  }, [editingCustomer, activeCategory])

  const handleSubmit = async () => {
    try {
      await onSave(formData, editingCustomer?.id)
      onClose()
    } catch (error) {
      alert('Error saving customer')
    }
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
              <input
                type="text"
                value={formData.surname}
                onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="interested">Interested</option>
                <option value="hot_lead">Hot Lead</option>
                <option value="negotiating">Negotiating</option>
                <option value="buyer">Buyer</option>
                <option value="backed_out">Backed Out</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="hot">Hot</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bank Account</label>
              <input
                type="text"
                value={formData.bank_account}
                onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ID Number</label>
              <input
                type="text"
                value={formData.id_number}
                onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {formData.status === 'backed_out' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Backed Out Reason</label>
              <textarea
                value={formData.backed_out_reason}
                onChange={(e) => setFormData({ ...formData, backed_out_reason: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Why did this customer back out?"
              />
            </div>
          )}

          {(formData.status === 'interested' || formData.status === 'hot_lead' || formData.status === 'negotiating') && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Preferences</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Budget (€)</label>
                  <input
                    type="number"
                    value={formData.preferences?.budget_min || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, budget_min: Number(e.target.value) }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Budget (€)</label>
                  <input
                    type="number"
                    value={formData.preferences?.budget_max || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, budget_max: Number(e.target.value) }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Size (m²)</label>
                  <input
                    type="number"
                    value={formData.preferences?.preferred_size_min || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, preferred_size_min: Number(e.target.value) }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Size (m²)</label>
                  <input
                    type="number"
                    value={formData.preferences?.preferred_size_max || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, preferred_size_max: Number(e.target.value) }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bedrooms</label>
                  <input
                    type="number"
                    value={formData.preferences?.bedrooms || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, bedrooms: Number(e.target.value) }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Floor</label>
                  <input
                    type="text"
                    value={formData.preferences?.preferred_floor || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, preferred_floor: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Ground, 1-3"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Location</label>
                <input
                  type="text"
                  value={formData.preferences?.preferred_location || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    preferences: { ...formData.preferences, preferred_location: e.target.value }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Preference Notes</label>
                <textarea
                  value={formData.preferences?.notes || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    preferences: { ...formData.preferences, notes: e.target.value }
                  })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Additional notes about customer preferences"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">General Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Any additional notes about this customer"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {editingCustomer ? 'Update Customer' : 'Add Customer'}
          </button>
        </div>
      </div>
    </div>
  )
}
