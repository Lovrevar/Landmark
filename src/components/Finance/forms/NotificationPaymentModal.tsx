import React from 'react'
import { Building2 } from 'lucide-react'
import { format } from 'date-fns'
import { PaymentNotification } from '../services/paymentNotificationService'
import { Modal, FormField, Input, Textarea, Button, Alert } from '../../ui'

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
  if (!notification) return null

  return (
    <Modal show={visible} onClose={onClose} size="md">
      <Modal.Header title="Record Bank Payment" onClose={onClose} />

      <Modal.Body>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
            <Building2 className="w-5 h-5 mr-2" />
            Payment Notification Details
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-blue-700">Bank</p>
              <p className="font-medium text-blue-900">{notification.bank_name}</p>
            </div>
            <div>
              <p className="text-blue-700">Loan Type</p>
              <p className="font-medium text-blue-900">
                {notification.credit_type?.replace('_', ' ').toUpperCase()}
              </p>
            </div>
            <div>
              <p className="text-blue-700">Due Date</p>
              <p className="font-medium text-blue-900">
                {format(new Date(notification.due_date), 'MMM dd, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-blue-700">Scheduled Amount</p>
              <p className="font-medium text-blue-900">{Number(notification.amount).toLocaleString('hr-HR')}</p>
            </div>
            <div>
              <p className="text-blue-700">Payment Number</p>
              <p className="font-medium text-blue-900">#{notification.payment_number}</p>
            </div>
            <div>
              <p className="text-blue-700">Project</p>
              <p className="font-medium text-blue-900">{notification.project_name}</p>
            </div>
          </div>
        </div>

        <Alert variant="warning" title="This payment will be recorded as a bank credit repayment.">
          The outstanding balance of the bank credit will be reduced by the payment amount.
        </Alert>

        <FormField label="Payment Amount" required helperText={`Suggested amount: ${Number(notification.amount).toLocaleString('hr-HR')}`}>
          <Input
            type="number"
            value={amount || ''}
            onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
            placeholder="Enter payment amount"
            min="0"
            step="0.01"
          />
        </FormField>

        <FormField label="Payment Date">
          <Input
            type="date"
            value={paymentDate}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </FormField>

        <FormField label="Notes">
          <Textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            placeholder="Add any notes about this payment..."
          />
        </FormField>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="success" onClick={onSubmit} disabled={!amount || amount <= 0}>
          Record Payment
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
