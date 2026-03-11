import React from 'react'
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
  return (
    <Modal show={visible} onClose={onClose} size="md">
      <Modal.Header title={title} onClose={onClose} />

      <Modal.Body>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          {details}
        </div>

        <FormField label="Payment Amount" required>
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
        <Button variant="success" onClick={onSubmit}>Record Payment</Button>
      </Modal.Footer>
    </Modal>
  )
}

export default WirePaymentModal
