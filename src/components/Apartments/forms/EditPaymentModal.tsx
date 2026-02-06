import React, { useState, useEffect } from 'react'
import { PaymentWithCustomer } from '../types/apartmentTypes'
import { Modal, FormField, Input, Select, Textarea, Button } from '../../ui'

interface EditPaymentModalProps {
  visible: boolean
  onClose: () => void
  payment: PaymentWithCustomer | null
  onSubmit: (paymentId: string, amount: number, date: string, paymentType: 'down_payment' | 'installment' | 'final_payment' | 'other', notes: string) => void
}

export const EditPaymentModal: React.FC<EditPaymentModalProps> = ({
  visible,
  onClose,
  payment,
  onSubmit
}) => {
  const [amount, setAmount] = useState(0)
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentType, setPaymentType] = useState<'down_payment' | 'installment' | 'final_payment' | 'other'>('installment')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (payment) {
      setAmount(payment.amount)
      setPaymentDate(payment.payment_date.split('T')[0])
      setPaymentType(payment.payment_type)
      setNotes(payment.notes || '')
    }
  }, [payment])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!payment) return
    onSubmit(payment.id, amount, paymentDate, paymentType, notes)
  }

  if (!visible || !payment) return null

  return (
    <Modal show={visible} onClose={onClose} size="lg">
      <Modal.Header title="Edit Payment" onClose={onClose} />

      <form onSubmit={handleSubmit}>
        <Modal.Body>
          <div className="space-y-4">
            <FormField label="Payment Amount (EUR)" required>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value))}
                required
                min="0"
                step="0.01"
              />
            </FormField>

            <FormField label="Payment Date" required>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </FormField>

            <FormField label="Payment Type" required>
              <Select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as 'down_payment' | 'installment' | 'final_payment' | 'other')}
                required
              >
                <option value="down_payment">Down Payment</option>
                <option value="installment">Installment</option>
                <option value="final_payment">Final Payment</option>
                <option value="other">Other</option>
              </Select>
            </FormField>

            <FormField label="Notes">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </FormField>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">Update Payment</Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
