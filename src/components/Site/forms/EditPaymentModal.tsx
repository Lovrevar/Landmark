import React from 'react'
import { WirePayment } from '../../../lib/supabase'
import { Modal, FormField, Input, Textarea, Button } from '../../ui'

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
  if (!visible || !payment) return null

  return (
    <Modal show={true} onClose={onClose}>
      <Modal.Header title="Edit Payment" onClose={onClose} />

      <Modal.Body>
        <div className="space-y-4">
          <FormField label="Payment Amount (€)" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={payment.amount}
              onChange={(e) => onChange({ ...payment, amount: parseFloat(e.target.value) || 0 })}
              autoFocus
            />
          </FormField>

          <FormField label="Payment Date (Optional)">
            <Input
              type="date"
              value={payment.payment_date || ''}
              onChange={(e) => onChange({ ...payment, payment_date: e.target.value })}
            />
          </FormField>

          <FormField label="Notes (Optional)">
            <Textarea
              value={payment.notes || ''}
              onChange={(e) => onChange({ ...payment, notes: e.target.value })}
              rows={2}
              placeholder="Add any notes about this payment"
            />
          </FormField>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={payment.amount <= 0}>
          Save Changes
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
