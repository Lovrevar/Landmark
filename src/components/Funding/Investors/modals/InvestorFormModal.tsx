import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, FormField, Input, Button } from '../../../ui'
import type { Bank } from '../../../../lib/supabase'
import type { BankFormData } from '../types'

interface InvestorFormModalProps {
  show: boolean
  onClose: () => void
  editingBank: Bank | null
  formData: BankFormData
  onChange: (data: BankFormData) => void
  onSubmit: () => void
}

const InvestorFormModal: React.FC<InvestorFormModalProps> = ({
  show,
  onClose,
  editingBank,
  formData,
  onChange,
  onSubmit,
}) => {
  const { t } = useTranslation()
  return (
    <Modal show={show} onClose={onClose} size="md">
      <Modal.Header title={editingBank ? t('funding.investors.investor_form.title_edit') : t('funding.investors.investor_form.title_add')} onClose={onClose} />
      <Modal.Body>
        <div className="space-y-4">
          <FormField label={t('funding.investors.investor_form.bank_name_label')} required>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => onChange({ ...formData, name: e.target.value })}
              placeholder={t('funding.investors.investor_form.bank_name_placeholder')}
            />
          </FormField>
          <FormField label={t('funding.investors.investor_form.contact_person_label')}>
            <Input
              type="text"
              value={formData.contact_person}
              onChange={(e) => onChange({ ...formData, contact_person: e.target.value })}
              placeholder={t('funding.investors.investor_form.contact_person_placeholder')}
            />
          </FormField>
          <FormField label={t('funding.investors.investor_form.contact_email_label')}>
            <Input
              type="email"
              value={formData.contact_email}
              onChange={(e) => onChange({ ...formData, contact_email: e.target.value })}
              placeholder={t('funding.investors.investor_form.contact_email_placeholder')}
            />
          </FormField>
          <FormField label={t('funding.investors.investor_form.contact_phone_label')}>
            <Input
              type="tel"
              value={formData.contact_phone}
              onChange={(e) => onChange({ ...formData, contact_phone: e.target.value })}
              placeholder={t('funding.investors.investor_form.contact_phone_placeholder')}
            />
          </FormField>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={onSubmit}>
          {editingBank ? t('funding.investors.investor_form.update_button') : t('funding.investors.investor_form.add_button')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default InvestorFormModal
