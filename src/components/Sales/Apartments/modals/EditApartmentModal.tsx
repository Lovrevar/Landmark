import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ApartmentWithDetails } from '../types'
import { Modal, FormField, Input, Select, Button, Form } from '../../../ui'
import {
  ContractedSection,
  ContractFields,
  emptyContractFields,
  contractFieldsFromData,
  contractFieldsToPayload
} from '../ContractedSection'

interface EditApartmentModalProps {
  visible: boolean
  onClose: () => void
  apartment: ApartmentWithDetails | null
  onSubmit: (id: string, updates: Partial<ApartmentWithDetails>) => void
}

export const EditApartmentModal: React.FC<EditApartmentModalProps> = ({
  visible,
  onClose,
  apartment,
  onSubmit
}) => {
  const [formData, setFormData] = useState({
    number: '',
    floor: 1,
    size_m2: 80,
    price: 150000,
    status: 'Available',
    ulaz: '',
    tip_stana: '',
    sobnost: null as number | null,
    povrsina_otvoreno: null as number | null,
    povrsina_ot_sa_koef: null as number | null
  })
  const { t } = useTranslation()
  const [contractFields, setContractFields] = useState<ContractFields>(emptyContractFields())
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (apartment) {
      setFormData({
        number: apartment.number,
        floor: apartment.floor,
        size_m2: apartment.size_m2,
        price: apartment.price,
        status: apartment.status,
        ulaz: apartment.ulaz || '',
        tip_stana: apartment.tip_stana || '',
        sobnost: apartment.sobnost ?? null,
        povrsina_otvoreno: apartment.povrsina_otvoreno ?? null,
        povrsina_ot_sa_koef: apartment.povrsina_ot_sa_koef ?? null
      })
      setContractFields(contractFieldsFromData(apartment as unknown as Record<string, unknown>))
    }
  }, [apartment])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!apartment) return
    const errors: Record<string, string> = {}
    if (!formData.number) errors.number = 'Apartment number is required'
    if (!formData.floor && formData.floor !== 0) errors.floor = 'Floor is required'
    if (!formData.size_m2) errors.size_m2 = 'Saleable area is required'
    if (!formData.price) errors.price = 'Price is required'
    if (!formData.status) errors.status = 'Status is required'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    onSubmit(apartment.id, { ...formData, ...contractFieldsToPayload(contractFields) })
  }

  if (!visible || !apartment) return null

  return (
    <Modal show={visible} onClose={onClose} size="lg">
      <Modal.Header title={t('apartments.edit')} onClose={onClose} />

      <Form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <Modal.Body>
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>{t('common.project')}:</strong> {apartment.project_name}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>{t('common.building')}:</strong> {apartment.building_name}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('apartments.form.number')} required error={fieldErrors.number}>
                <Input
                  type="text"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                />
              </FormField>

              <FormField label={t('apartments.form.entrance')}>
                <Input
                  type="text"
                  value={formData.ulaz}
                  onChange={(e) => setFormData({ ...formData, ulaz: e.target.value })}
                  placeholder="e.g., A, 1, Ulaz 1"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField label={t('apartments.form.floor')} required error={fieldErrors.floor}>
                <Input
                  type="number"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) })}
                />
              </FormField>

              <FormField label={t('apartments.form.type')}>
                <Input
                  type="text"
                  value={formData.tip_stana}
                  onChange={(e) => setFormData({ ...formData, tip_stana: e.target.value })}
                  placeholder="e.g., 2S, 3S+K"
                />
              </FormField>

              <FormField label={t('apartments.form.rooms')}>
                <Input
                  type="number"
                  value={formData.sobnost ?? ''}
                  onChange={(e) => setFormData({ ...formData, sobnost: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="e.g., 2"
                  min="0"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField label={t('apartments.form.saleable_area')} required error={fieldErrors.size_m2}>
                <Input
                  type="number"
                  value={formData.size_m2}
                  onChange={(e) => setFormData({ ...formData, size_m2: parseFloat(e.target.value) })}
                  step="0.01"
                />
              </FormField>

              <FormField label={t('apartments.form.open_area')}>
                <Input
                  type="number"
                  value={formData.povrsina_otvoreno ?? ''}
                  onChange={(e) => setFormData({ ...formData, povrsina_otvoreno: e.target.value ? parseFloat(e.target.value) : null })}
                  step="0.01"
                  placeholder="0.00"
                />
              </FormField>

              <FormField label={t('apartments.form.open_area_coef')}>
                <Input
                  type="number"
                  value={formData.povrsina_ot_sa_koef ?? ''}
                  onChange={(e) => setFormData({ ...formData, povrsina_ot_sa_koef: e.target.value ? parseFloat(e.target.value) : null })}
                  step="0.01"
                  placeholder="0.00"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('apartments.form.price')} required error={fieldErrors.price}>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                  step="0.01"
                />
              </FormField>

              <FormField label={t('apartments.form.status')} required error={fieldErrors.status}>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Available">{t('apartments.statuses.available')}</option>
                  <option value="Reserved">{t('apartments.statuses.reserved')}</option>
                  <option value="Sold">{t('apartments.statuses.sold')}</option>
                </Select>
              </FormField>
            </div>

            <ContractedSection value={contractFields} onChange={setContractFields} price={formData.price} />
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary">{t('common.save')}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
