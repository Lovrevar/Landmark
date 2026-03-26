import React from 'react'
import { useTranslation } from 'react-i18next'
import { WirePayment } from '../../../../lib/supabase'
import { Modal, FormField, Input, Textarea, Button } from '../../../ui'

interface EditPaymentModalProps {
  visible: boolean
  onClose: () => void
  payment: WirePayment | null
  onChange: (updated: WirePayment) => void
  onSubmit: () => void
}

export const EditPaymentModal: React.FC<EditPaymentModalProps> = ({
  visible,
  onClose,
  payment,
  onChange,
  onSubmit
}) => {
  const { t } = useTranslation()

  if (!visible || !payment) return null

  return (
    <Modal show={true} onClose={onClose}>
      <Modal.Header title={t('supervision.edit_payment.title')} onClose={onClose} />

      <Modal.Body>
        <div className="space-y-4">
          <FormField label={t('supervision.edit_payment.amount')} required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={payment.amount}
              onChange={(e) => onChange({ ...payment, amount: parseFloat(e.target.value) || 0 })}
              autoFocus
            />
          </FormField>

          <FormField label={t('supervision.edit_payment.payment_date')}>
            <Input
              type="date"
              value={payment.payment_date || ''}
              onChange={(e) => onChange({ ...payment, payment_date: e.target.value })}
            />
          </FormField>

          <FormField label={t('supervision.edit_payment.notes')}>
            <Textarea
              value={payment.notes || ''}
              onChange={(e) => onChange({ ...payment, notes: e.target.value })}
              rows={2}
              placeholder={t('supervision.edit_payment.notes_placeholder')}
            />
          </FormField>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button onClick={onSubmit} disabled={payment.amount <= 0}>
          {t('common.save_changes')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
