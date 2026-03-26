import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { retailProjectService } from '../services/retailProjectService'
import type { RetailContract, RetailProjectPhase } from '../../../../types/retail'
import { Button, Modal, FormField, Input, Select, Textarea, Form } from '../../../ui'

interface RetailCustomer {
  id: string
  name: string
  contact_phone?: string
  contact_email?: string
  oib?: string
  address?: string
}

interface SalesFormModalProps {
  phase: RetailProjectPhase
  onClose: () => void
  onSuccess: () => void
  contract?: RetailContract
}

export const SalesFormModal: React.FC<SalesFormModalProps> = ({
  phase,
  onClose,
  onSuccess,
  contract
}) => {
  const { t } = useTranslation()
  const [customers, setCustomers] = useState<RetailCustomer[]>([])
  const [formData, setFormData] = useState({
    customer_id: contract?.customer_id || '',
    contract_number: contract?.contract_number || '',
    contract_amount: contract?.contract_amount?.toString() || '',
    building_surface_m2: contract?.building_surface_m2?.toString() || '',
    total_surface_m2: contract?.total_surface_m2?.toString() || '',
    price_per_m2: contract?.price_per_m2?.toString() || '',
    contract_date: contract?.contract_date || '',
    start_date: contract?.start_date || '',
    end_date: contract?.end_date || '',
    status: contract?.status || 'Active',
    notes: contract?.notes || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    loadCustomers()
    if (!contract) {
      generateContractNumber()
    }
  }, [])

  useEffect(() => {
    const amount = parseFloat(formData.contract_amount)
    const surface = parseFloat(formData.total_surface_m2)

    if (amount > 0 && surface > 0) {
      const pricePerM2 = (amount / surface).toFixed(2)
      setFormData(prev => ({ ...prev, price_per_m2: pricePerM2 }))
    } else {
      setFormData(prev => ({ ...prev, price_per_m2: '' }))
    }
  }, [formData.contract_amount, formData.total_surface_m2])

  const loadCustomers = async () => {
    try {
      const data = await retailProjectService.fetchCustomers()
      setCustomers(data)
    } catch (err) {
      console.error('Error loading customers:', err)
    }
  }

  const generateContractNumber = async () => {
    try {
      const number = await retailProjectService.generateContractNumber(phase.project_id)
      setFormData(prev => ({ ...prev, contract_number: number }))
    } catch (err) {
      console.error('Error generating contract number:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!formData.customer_id) errors.customer_id = t('retail_projects.contract_form.customer_error')
    if (!formData.contract_amount) errors.contract_amount = t('retail_projects.contract_form.contract_amount_required')
    if (!formData.contract_date) errors.contract_date = t('retail_projects.contract_form.contract_date_required')
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setLoading(true)
    setError(null)

    try {
      const dataToSubmit = {
        phase_id: phase.id,
        customer_id: formData.customer_id,
        contract_number: formData.contract_number,
        contract_amount: parseFloat(formData.contract_amount),
        building_surface_m2: formData.building_surface_m2 ? parseFloat(formData.building_surface_m2) : null,
        total_surface_m2: formData.total_surface_m2 ? parseFloat(formData.total_surface_m2) : null,
        price_per_m2: formData.price_per_m2 ? parseFloat(formData.price_per_m2) : null,
        contract_date: formData.contract_date,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        status: formData.status as 'Active' | 'Completed' | 'Cancelled',
        notes: formData.notes || null,
        land_area_m2: null,
        supplier_id: null
      }

      if (contract) {
        await retailProjectService.updateContract(contract.id, dataToSubmit)
      } else {
        await retailProjectService.createContract(dataToSubmit)
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('retail_projects.contract_form.save_error'))
      console.error('Error saving contract:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal show={true} onClose={onClose}>
      <Modal.Header
        title={contract ? t('retail_projects.contract_form.edit_customer_title') : t('retail_projects.contract_form.new_customer_title')}
        subtitle={`Faza: ${phase.phase_name}`}
        onClose={onClose}
      />
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>{t('common.note')}:</strong> {t('retail_projects.contract_form.sales_note_body')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label={t('retail_projects.contract_form.customer_label')}
              required
              helperText={t('retail_projects.contract_form.customer_helper')}
              className="md:col-span-2"
              error={fieldErrors.customer_id}
            >
              <Select
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
              >
                <option value="">{t('retail_projects.contract_form.select_customer')}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label={t('retail_projects.contract_form.contract_number_label')} required>
              <Input
                type="text"
                value={formData.contract_number}
                onChange={(e) => setFormData({ ...formData, contract_number: e.target.value })}
                className="bg-gray-50"
                readOnly={!!contract}
              />
            </FormField>

            <FormField label={t('retail_projects.contract_form.contract_date_label')} required error={fieldErrors.contract_date}>
              <Input
                type="date"
                value={formData.contract_date}
                onChange={(e) => setFormData({ ...formData, contract_date: e.target.value })}
              />
            </FormField>

            <FormField label={t('retail_projects.contract_form.contract_amount_label')} required error={fieldErrors.contract_amount}>
              <Input
                type="number"
                step="0.01"
                value={formData.contract_amount}
                onChange={(e) => setFormData({ ...formData, contract_amount: e.target.value })}
                placeholder="npr. 500000"
              />
            </FormField>

            <FormField label={t('retail_projects.contract_form.building_surface_label')} helperText={t('retail_projects.contract_form.building_surface_hint')}>
              <Input
                type="number"
                step="0.01"
                value={formData.building_surface_m2}
                onChange={(e) => setFormData({ ...formData, building_surface_m2: e.target.value })}
                placeholder="npr. 350"
              />
            </FormField>

            <FormField label={t('retail_projects.contract_form.total_surface_label')} helperText={t('retail_projects.contract_form.total_surface_hint')}>
              <Input
                type="number"
                step="0.01"
                value={formData.total_surface_m2}
                onChange={(e) => setFormData({ ...formData, total_surface_m2: e.target.value })}
                placeholder="npr. 500"
              />
            </FormField>

            <FormField
              label={t('retail_projects.contract_form.price_per_m2_label')}
              helperText={formData.price_per_m2
                ? t('retail_projects.contract_form.price_auto_hint')
                : t('retail_projects.contract_form.price_enter_hint')
              }
            >
              <Input
                type="number"
                step="0.01"
                value={formData.price_per_m2}
                className="bg-gray-50 font-semibold"
                placeholder={t('retail_projects.contract_form.price_auto_placeholder')}
                readOnly
              />
            </FormField>

            <FormField label={t('common.status')}>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Completed' | 'Cancelled' })}
              >
                <option value="Active">{t('retail_projects.contract_form.status_active')}</option>
                <option value="Completed">{t('retail_projects.contract_form.status_completed')}</option>
                <option value="Cancelled">{t('retail_projects.contract_form.status_cancelled')}</option>
              </Select>
            </FormField>

            <FormField label={t('retail_projects.contract_form.start_date')}>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </FormField>

            <FormField label={t('retail_projects.contract_form.end_date_label')}>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </FormField>

            <FormField label={t('retail_projects.contract_form.notes_label')} className="md:col-span-2">
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder={t('retail_projects.contract_form.additional_notes')}
              />
            </FormField>
          </div>

          {!contract && (
            <div className="bg-green-50 border border-green-200 px-4 py-3 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>{t('common.note')}:</strong> {t('retail_projects.contract_form.note_milestones_sales')}
              </p>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={loading}
          >
            {contract ? t('common.save_changes') : t('retail_projects.contract_form.new_title')}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
