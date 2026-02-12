import React from 'react'
import { DollarSign, Calendar, FileText } from 'lucide-react'
import { BankCredit } from '../../../lib/supabase'
import { Modal, FormField, Input, Textarea, Button } from '../../ui'

interface BankWirePaymentModalProps {
  visible: boolean
  onClose: () => void
  credit: BankCredit | null
  bankName: string
  amount: number
  paymentDate: string
  notes: string
  onAmountChange: (amount: number) => void
  onDateChange: (date: string) => void
  onNotesChange: (notes: string) => void
  onSubmit: () => void
}

export const BankWirePaymentModal: React.FC<BankWirePaymentModalProps> = ({
  visible,
  onClose,
  credit,
  bankName,
  amount,
  paymentDate,
  notes,
  onAmountChange,
  onDateChange,
  onNotesChange,
  onSubmit
}) => {
  if (!credit) return null

  return (
    <Modal show={visible} onClose={onClose} size="md">
      <Modal.Header title="Record Bank Payment" onClose={onClose} />

      <Modal.Body>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Payment Details</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-blue-700">Bank</p>
              <p className="font-medium text-blue-900">{bankName}</p>
            </div>
            <div>
              <p className="text-blue-700">Loan Type</p>
              <p className="font-medium text-blue-900">
                {credit.credit_type.replace('_', ' ')}
              </p>
            </div>
            <div>
              <p className="text-blue-700">Outstanding Balance</p>
              <p className="font-medium text-blue-900">{credit.outstanding_balance.toLocaleString('hr-HR')}</p>
            </div>
            <div>
              <p className="text-blue-700">Scheduled Payment</p>
              <p className="font-medium text-blue-900">{credit.monthly_payment.toLocaleString('hr-HR')}</p>
            </div>
          </div>
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
