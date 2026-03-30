import React from 'react'
import { Building2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { PaymentNotification } from '../services/paymentNotificationService'
import { Modal, FormField, Input, Textarea, Button, Alert } from '../../../ui'

interface NotificationPaymentModalProps {
  visible: boolean
  onClose: () => void
  notification: PaymentNotification | null
  amount: number
  paymentDate: string
  notes: string
  onAmountChange: (amount: number) => void
  onDateChange: (date: string) => void
  onNotesChange: (notes: string) => void
  onSubmit: () => void
}

export const NotificationPaymentModal: React.FC<NotificationPaymentModalProps> = ({
  visible,
  onClose,
  notification,
  amount,
  paymentDate,
  notes,
  onAmountChange,
  onDateChange,
  onNotesChange,
  onSubmit
}) => {
  const { t } = useTranslation()
  if (!notification) return null

  return (
    <Modal show={visible} onClose={onClose} size="md">
      <Modal.Header title={t('funding.payments.notification_payment_modal.title')} onClose={onClose} />

      <Modal.Body>
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
            <Building2 className="w-5 h-5 mr-2" />
            {t('funding.payments.notification_payment_modal.details_heading')}
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-blue-700 dark:text-blue-300">{t('funding.payments.notification_payment_modal.bank_label')}</p>
              <p className="font-medium text-blue-900 dark:text-blue-100">{notification.bank_name}</p>
            </div>
            <div>
              <p className="text-blue-700 dark:text-blue-300">{t('funding.payments.notification_payment_modal.loan_type_label')}</p>
              <p className="font-medium text-blue-900 dark:text-blue-100">
                {notification.credit_type?.replace('_', ' ').toUpperCase()}
              </p>
            </div>
            <div>
              <p className="text-blue-700 dark:text-blue-300">{t('funding.payments.notification_payment_modal.due_date_label')}</p>
              <p className="font-medium text-blue-900 dark:text-blue-100">
                {format(new Date(notification.due_date), 'MMM dd, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-blue-700 dark:text-blue-300">{t('funding.payments.notification_payment_modal.scheduled_amount_label')}</p>
              <p className="font-medium text-blue-900 dark:text-blue-100">{Number(notification.amount).toLocaleString('hr-HR')}</p>
            </div>
            <div>
              <p className="text-blue-700 dark:text-blue-300">{t('funding.payments.notification_payment_modal.payment_number_label')}</p>
              <p className="font-medium text-blue-900 dark:text-blue-100">#{notification.payment_number}</p>
            </div>
            <div>
              <p className="text-blue-700 dark:text-blue-300">{t('funding.payments.notification_payment_modal.project_label')}</p>
              <p className="font-medium text-blue-900 dark:text-blue-100">{notification.project_name}</p>
            </div>
          </div>
        </div>

        <Alert variant="warning" title={t('funding.payments.notification_payment_modal.warning_title')}>
          {t('funding.payments.notification_payment_modal.warning_body')}
        </Alert>

        <FormField label={t('funding.payments.notification_payment_modal.amount_label')} required helperText={t('funding.payments.notification_payment_modal.suggested_amount', { amount: Number(notification.amount).toLocaleString('hr-HR') })}>
          <Input
            type="number"
            value={amount || ''}
            onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
            placeholder={t('funding.payments.wire_payment_modal.amount_placeholder')}
            min="0"
            step="0.01"
          />
        </FormField>

        <FormField label={t('funding.payments.notification_payment_modal.date_label')}>
          <Input
            type="date"
            value={paymentDate}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </FormField>

        <FormField label={t('funding.payments.notification_payment_modal.notes_label')}>
          <Textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            placeholder={t('funding.payments.notification_payment_modal.notes_placeholder')}
          />
        </FormField>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>{t('funding.payments.notification_payment_modal.cancel_button')}</Button>
        <Button variant="success" onClick={onSubmit} disabled={!amount || amount <= 0}>
          {t('funding.payments.notification_payment_modal.submit_button')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
