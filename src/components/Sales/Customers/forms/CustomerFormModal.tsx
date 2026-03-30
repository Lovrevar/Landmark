import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Customer } from '../../../../lib/supabase'
import { CustomerWithApartments, CustomerCategory } from '../types'
import { Modal, FormField, Input, Select, Textarea, Button } from '../../../ui'
import { Alert } from '../../../ui'

interface CustomerFormModalProps {
  show: boolean
  editingCustomer: CustomerWithApartments | null
  activeCategory: CustomerCategory | null
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
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    surname: '',
    email: '',
    phone: '',
    address: '',
    bank_account: '',
    id_number: '',
    status: activeCategory ?? 'interested',
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
    setError(null)
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
        status: activeCategory ?? 'interested',
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
    setError(null)
    const errors: Record<string, string> = {}
    if (!formData.name?.trim()) errors.name = 'First name is required.'
    if (!formData.surname?.trim()) errors.surname = 'Last name is required.'
    if (!formData.email?.trim()) errors.email = 'Email is required.'
    if (!formData.phone?.trim()) errors.phone = 'Phone is required.'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    try {
      await onSave(formData, editingCustomer?.id)
      onClose()
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string }
      if (error?.code === '23505') {
        setError('A customer with this email already exists.')
      } else {
        setError(error?.message || 'An error occurred while saving the customer.')
      }
    }
  }

  if (!show) return null

  return (
    <Modal show={show} onClose={onClose} size="xl">
      <Modal.Header
        title={editingCustomer ? t('customers.edit') : t('customers.add')}
        onClose={onClose}
      />

      <Modal.Body>
        <div className="space-y-6">
          {error && (
            <Alert variant="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('customers.form.first_name')} required error={fieldErrors.name}>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </FormField>
            <FormField label={t('customers.form.last_name')} required error={fieldErrors.surname}>
              <Input
                type="text"
                value={formData.surname}
                onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('customers.form.email')} required error={fieldErrors.email}>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </FormField>
            <FormField label={t('customers.form.phone')} required error={fieldErrors.phone}>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('customers.form.status')} required>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'interested' | 'hot_lead' | 'negotiating' | 'buyer' | 'backed_out' })}
              >
                <option value="interested">{t('customer_status.interested')}</option>
                <option value="hot_lead">{t('customer_status.hot_lead')}</option>
                <option value="negotiating">{t('customer_status.negotiating')}</option>
                <option value="buyer">{t('customer_status.buyer')}</option>
                <option value="backed_out">{t('customer_status.backed_out')}</option>
              </Select>
            </FormField>
            <FormField label={t('customers.form.priority')}>
              <Select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'hot' | 'warm' | 'cold' })}
              >
                <option value="hot">{t('customer_priority.hot')}</option>
                <option value="warm">{t('customer_priority.warm')}</option>
                <option value="cold">{t('customer_priority.cold')}</option>
              </Select>
            </FormField>
          </div>

          <FormField label={t('customers.form.address')}>
            <Input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('customers.form.bank_account')}>
              <Input
                type="text"
                value={formData.bank_account}
                onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
              />
            </FormField>
            <FormField label={t('customers.form.id_number')}>
              <Input
                type="text"
                value={formData.id_number}
                onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
              />
            </FormField>
          </div>

          {formData.status === 'backed_out' && (
            <FormField label={t('customers.form.backed_out_reason')}>
              <Textarea
                value={formData.backed_out_reason}
                onChange={(e) => setFormData({ ...formData, backed_out_reason: e.target.value })}
                rows={3}
                placeholder="Why did this customer back out?"
              />
            </FormField>
          )}

          {(formData.status === 'interested' || formData.status === 'hot_lead' || formData.status === 'negotiating') && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('customers.form.preferences')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t('customers.form.min_budget')}>
                  <Input
                    type="number"
                    value={formData.preferences?.budget_min || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, budget_min: Number(e.target.value) }
                    })}
                  />
                </FormField>
                <FormField label={t('customers.form.max_budget')}>
                  <Input
                    type="number"
                    value={formData.preferences?.budget_max || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, budget_max: Number(e.target.value) }
                    })}
                  />
                </FormField>
                <FormField label={t('customers.form.min_size')}>
                  <Input
                    type="number"
                    value={formData.preferences?.preferred_size_min || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, preferred_size_min: Number(e.target.value) }
                    })}
                  />
                </FormField>
                <FormField label={t('customers.form.max_size')}>
                  <Input
                    type="number"
                    value={formData.preferences?.preferred_size_max || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, preferred_size_max: Number(e.target.value) }
                    })}
                  />
                </FormField>
                <FormField label={t('customers.form.bedrooms')}>
                  <Input
                    type="number"
                    value={formData.preferences?.bedrooms || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, bedrooms: Number(e.target.value) }
                    })}
                  />
                </FormField>
                <FormField label={t('customers.form.preferred_floor')}>
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
                <FormField label={t('customers.form.preferred_location')}>
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
                <FormField label={t('customers.form.preference_notes')}>
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

          <FormField label={t('customers.form.general_notes')}>
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
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={handleSubmit}>
          {editingCustomer ? t('customers.update') : t('customers.add')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
