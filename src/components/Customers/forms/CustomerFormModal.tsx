import React, { useState, useEffect } from 'react'
import { Customer } from '../../../lib/supabase'
import { CustomerWithApartments, CustomerCategory } from '../types/customerTypes'
import { Modal, FormField, Input, Select, Textarea, Button } from '../../ui'

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
    <Modal show={show} onClose={onClose} size="xl">
      <Modal.Header
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        onClose={onClose}
      />

      <Modal.Body>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="First Name" required>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </FormField>
            <FormField label="Last Name" required>
              <Input
                type="text"
                value={formData.surname}
                onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Email" required>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </FormField>
            <FormField label="Phone" required>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Status" required>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              >
                <option value="interested">Interested</option>
                <option value="hot_lead">Hot Lead</option>
                <option value="negotiating">Negotiating</option>
                <option value="buyer">Buyer</option>
                <option value="backed_out">Backed Out</option>
              </Select>
            </FormField>
            <FormField label="Priority">
              <Select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
              >
                <option value="hot">Hot</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
              </Select>
            </FormField>
          </div>

          <FormField label="Address">
            <Input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Bank Account">
              <Input
                type="text"
                value={formData.bank_account}
                onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
              />
            </FormField>
            <FormField label="ID Number">
              <Input
                type="text"
                value={formData.id_number}
                onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
              />
            </FormField>
          </div>

          {formData.status === 'backed_out' && (
            <FormField label="Backed Out Reason">
              <Textarea
                value={formData.backed_out_reason}
                onChange={(e) => setFormData({ ...formData, backed_out_reason: e.target.value })}
                rows={3}
                placeholder="Why did this customer back out?"
              />
            </FormField>
          )}

          {(formData.status === 'interested' || formData.status === 'hot_lead' || formData.status === 'negotiating') && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Preferences</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Min Budget (EUR)">
                  <Input
                    type="number"
                    value={formData.preferences?.budget_min || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, budget_min: Number(e.target.value) }
                    })}
                  />
                </FormField>
                <FormField label="Max Budget (EUR)">
                  <Input
                    type="number"
                    value={formData.preferences?.budget_max || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, budget_max: Number(e.target.value) }
                    })}
                  />
                </FormField>
                <FormField label="Min Size (m2)">
                  <Input
                    type="number"
                    value={formData.preferences?.preferred_size_min || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, preferred_size_min: Number(e.target.value) }
                    })}
                  />
                </FormField>
                <FormField label="Max Size (m2)">
                  <Input
                    type="number"
                    value={formData.preferences?.preferred_size_max || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, preferred_size_max: Number(e.target.value) }
                    })}
                  />
                </FormField>
                <FormField label="Bedrooms">
                  <Input
                    type="number"
                    value={formData.preferences?.bedrooms || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, bedrooms: Number(e.target.value) }
                    })}
                  />
                </FormField>
                <FormField label="Preferred Floor">
                  <Input
                    type="text"
                    value={formData.preferences?.preferred_floor || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, preferred_floor: e.target.value }
                    })}
                    placeholder="e.g., Ground, 1-3"
                  />
                </FormField>
              </div>
              <div className="mt-4">
                <FormField label="Preferred Location">
                  <Input
                    type="text"
                    value={formData.preferences?.preferred_location || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, preferred_location: e.target.value }
                    })}
                  />
                </FormField>
              </div>
              <div className="mt-4">
                <FormField label="Preference Notes">
                  <Textarea
                    value={formData.preferences?.notes || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, notes: e.target.value }
                    })}
                    rows={3}
                    placeholder="Additional notes about customer preferences"
                  />
                </FormField>
              </div>
            </div>
          )}

          <FormField label="General Notes">
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              placeholder="Any additional notes about this customer"
            />
          </FormField>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>
          {editingCustomer ? 'Update Customer' : 'Add Customer'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
