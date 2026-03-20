import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Button, Input, FormField, Alert, Form } from '../../../ui'
import { OfficeSupplier, OfficeSupplierFormData } from '../types'

interface OfficeSupplierFormModalProps {
  showModal: boolean
  editingSupplier: OfficeSupplier | null
  formData: OfficeSupplierFormData
  setFormData: (data: OfficeSupplierFormData) => void
  handleCloseModal: () => void
  handleSubmit: (e: React.FormEvent) => void
}

const OfficeSupplierFormModal: React.FC<OfficeSupplierFormModalProps> = ({
  showModal,
  editingSupplier,
  formData,
  setFormData,
  handleCloseModal,
  handleSubmit
}) => {
  const { t } = useTranslation()

  return (
    <Modal show={showModal} onClose={handleCloseModal} size="md">
      <Modal.Header
        title={editingSupplier ? t('office_suppliers.form.title_edit') : t('office_suppliers.form.title_add')}
        onClose={handleCloseModal}
      />

      <Form onSubmit={handleSubmit} className="overflow-y-auto flex-1 flex flex-col">
        <Modal.Body>
          <FormField label={t('office_suppliers.form.name_label')} required>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('office_suppliers.form.name_placeholder')}
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('office_suppliers.form.contact_label')}>
              <Input
                type="text"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                placeholder="+385 99 123 4567"
              />
            </FormField>

            <FormField label={t('office_suppliers.form.email_label')}>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="info@example.com"
              />
            </FormField>
          </div>

          <FormField label={t('office_suppliers.form.address_label')}>
            <Input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder={t('office_suppliers.form.address_placeholder')}
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('office_suppliers.form.oib_label')}>
              <Input
                type="text"
                value={formData.tax_id}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                placeholder="12345678901"
              />
            </FormField>

            <FormField label={t('office_suppliers.form.vat_label')}>
              <Input
                type="text"
                value={formData.vat_id}
                onChange={(e) => setFormData({ ...formData, vat_id: e.target.value })}
                placeholder="HR12345678901"
              />
            </FormField>
          </div>

          <Alert variant="info" title={t('office_suppliers.form.note_title')}>
            {t('office_suppliers.form.note_text')}
          </Alert>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" type="button" onClick={handleCloseModal}>
            {t('office_suppliers.form.cancel')}
          </Button>
          <Button type="submit">
            {editingSupplier ? t('office_suppliers.form.save_changes') : t('office_suppliers.form.add')}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}

export default OfficeSupplierFormModal
