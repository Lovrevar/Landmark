import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { retailProjectService } from '../services/retailProjectService'
import type { RetailContract, RetailSupplier, RetailProjectPhase } from '../../../../types/retail'
import { Button, Modal, FormField, Input, Select, Textarea, Form } from '../../../ui'
import { SupplierFormModal } from './SupplierFormModal'
import DateInput from '../../../Common/DateInput'

interface DevelopmentFormModalProps {
  phase: RetailProjectPhase
  onClose: () => void
  onSuccess: () => void
  contract?: RetailContract
}

export const DevelopmentFormModal: React.FC<DevelopmentFormModalProps> = ({
  phase,
  onClose,
  onSuccess,
  contract
}) => {
  const { t } = useTranslation()
  const [suppliers, setSuppliers] = useState<RetailSupplier[]>([])
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [formData, setFormData] = useState({
    supplier_id: contract?.supplier_id || '',
    contract_number: contract?.contract_number || '',
    contract_amount: contract?.contract_amount?.toString() || '',
    contract_date: contract?.contract_date || '',
    notes: contract?.notes || '',
    status: contract?.status || 'Active',
    has_contract: contract?.has_contract ?? true
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    loadSuppliers()
  }, [])

  const loadSuppliers = async () => {
    try {
      const data = await retailProjectService.fetchSuppliers()
      setSuppliers(data)
    } catch (err) {
      console.error('Error loading suppliers:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!formData.supplier_id) errors.supplier_id = t('retail_projects.contract_form.supplier_error')
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setLoading(true)
    setError(null)

    try {
      let contractNumber = formData.contract_number
      if (!contract) {
        contractNumber = await retailProjectService.generateContractNumber(phase.project_id)
      }

      const dataToSubmit = {
        phase_id: phase.id,
        supplier_id: formData.supplier_id,
        contract_number: contractNumber,
        contract_amount: formData.has_contract ? parseFloat(formData.contract_amount) : 0,
        contract_date: formData.contract_date || null,
        status: formData.status as 'Active' | 'Completed' | 'Cancelled',
        start_date: null,
        end_date: null,
        land_area_m2: null,
        notes: formData.notes || null,
        has_contract: formData.has_contract
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

  const handleAddSupplierClick = () => {
    setShowAddSupplier(true)
  }

  const handleSupplierCreated = async () => {
    await loadSuppliers()
    setShowAddSupplier(false)
    const updatedSuppliers = await retailProjectService.fetchSuppliers()
    if (updatedSuppliers.length > 0) {
      const latestSupplier = updatedSuppliers[updatedSuppliers.length - 1]
      setFormData(prev => ({ ...prev, supplier_id: latestSupplier.id }))
    }
  }

  return (
    <>
      {showAddSupplier && (
        <SupplierFormModal
          onClose={() => setShowAddSupplier(false)}
          onSuccess={handleSupplierCreated}
        />
      )}

      <Modal show={true} onClose={onClose} size="lg">
      <Modal.Header
        title={contract ? t('retail_projects.contract_form.edit_supplier_title') : t('retail_projects.contract_form.new_supplier_title')}
        subtitle={`Faza: ${phase.phase_name}`}
        onClose={onClose}
      />
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 px-4 py-3 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>{t('common.note')}:</strong> {t('retail_projects.contract_form.dev_note_body')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FormField label={t('retail_projects.contract_form.supplier_label')} required error={fieldErrors.supplier_id}>
                <div className="flex space-x-2">
                  <Select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    className="flex-1"
                  >
                    <option value="">{t('retail_projects.contract_form.select_supplier')}</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name} - {supplier.supplier_type?.name || 'N/A'}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="success"
                    onClick={handleAddSupplierClick}
                  >
                    {t('retail_projects.contract_form.add_new_btn')}
                  </Button>
                </div>
              </FormField>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.has_contract}
                  onChange={(e) => setFormData({ ...formData, has_contract: e.target.checked })}
                  className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('retail_projects.contract_form.has_contract_label')}</span>
              </label>
              {!formData.has_contract && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                  {t('retail_projects.contract_form.no_contract_hint')}
                </p>
              )}
            </div>

            <FormField label={t('retail_projects.contract_form.contract_date_label')}>
              <DateInput
                value={formData.contract_date}
                onChange={(value) => setFormData({ ...formData, contract_date: value })}
              />
            </FormField>

            <FormField label={t('retail_projects.contract_form.contract_amount_label')}>
              <Input
                type="number"
                step="0.01"
                value={formData.has_contract ? formData.contract_amount : '0'}
                onChange={(e) => setFormData({ ...formData, contract_amount: e.target.value })}
                placeholder="npr. 50000"
                disabled={!formData.has_contract}
                className={!formData.has_contract ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}
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

            <div className="md:col-span-2">
              <FormField label={t('common.description')}>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  placeholder="Opis usluge... (npr. Izrada projektne dokumentacije, Geodetski snimak, itd.)"
                />
              </FormField>
            </div>
          </div>

          {!contract && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 px-4 py-3 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-300">
                <strong>{t('common.note')}:</strong> {t('retail_projects.contract_form.note_payments')}
              </p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={loading}>
            {contract ? t('common.save_changes') : t('retail_projects.contract_form.new_title')}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
    </>
  )
}
