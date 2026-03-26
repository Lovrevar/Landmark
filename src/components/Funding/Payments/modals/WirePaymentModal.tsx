import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, FormField, Input, Textarea, Button } from '../../../ui'

interface WirePaymentModalProps {
  visible: boolean
  onClose: () => void
  title: string
  details: React.ReactNode
  amount: number
  paymentDate: string
  notes: string
  onAmountChange: (v: number) => void
  onDateChange: (v: string) => void
  onNotesChange: (v: string) => void
  onSubmit: () => void
}

export const WirePaymentModal: React.FC<WirePaymentModalProps> = ({
  visible,
  onClose,
  title,
  details,
  amount,
  paymentDate,
  notes,
  onAmountChange,
  onDateChange,
  onNotesChange,
  onSubmit,
}) => {
  const { t } = useTranslation()
  return (
    <Modal show={visible} onClose={onClose} size="md">
      <Modal.Header title={title} onClose={onClose} />

      <Modal.Body>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          {details}
        </div>

        <FormField label={t('funding.payments.wire_payment_modal.amount_label')} required>
          <Input
            type="number"
            value={amount || ''}
            onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
            placeholder={t('funding.payments.wire_payment_modal.amount_placeholder')}
            min="0"
            step="0.01"
          />
        </FormField>

        <FormField label={t('funding.payments.wire_payment_modal.date_label')}>
          <Input
            type="date"
            value={paymentDate}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </FormField>

        <FormField label={t('funding.payments.wire_payment_modal.notes_label')}>
          <Textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            placeholder={t('funding.payments.wire_payment_modal.notes_placeholder')}
          />
        </FormField>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>{t('funding.payments.wire_payment_modal.cancel_button')}</Button>
        <Button variant="success" onClick={onSubmit}>{t('funding.payments.wire_payment_modal.submit_button')}</Button>
      </Modal.Footer>
    </Modal>
  )
}

export default WirePaymentModal
