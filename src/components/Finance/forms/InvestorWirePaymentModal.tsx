import React from 'react'
import { ProjectInvestment } from '../../../lib/supabase'
import { format } from 'date-fns'
import { Modal, FormField, Input, Textarea, Button } from '../../ui'

interface InvestorWirePaymentModalProps {
  visible: boolean
  onClose: () => void
  investment: ProjectInvestment | null
  investorName: string
  amount: number
  paymentDate: string
  notes: string
  onAmountChange: (amount: number) => void
  onDateChange: (date: string) => void
  onNotesChange: (notes: string) => void
  onSubmit: () => void
}

export const InvestorWirePaymentModal: React.FC<InvestorWirePaymentModalProps> = ({
  visible,
  onClose,
  investment,
  investorName,
  amount,
  paymentDate,
  notes,
  onAmountChange,
  onDateChange,
  onNotesChange,
  onSubmit
}) => {
  if (!investment) return null

  return (
    <Modal show={visible} onClose={onClose} size="md">
      <Modal.Header title="Record Investor Payment" onClose={onClose} />

      <Modal.Body>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Investment Details</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-blue-700">Investor</p>
              <p className="font-medium text-blue-900">{investorName}</p>
            </div>
            <div>
              <p className="text-blue-700">Investment Type</p>
              <p className="font-medium text-blue-900">
                {investment.investment_type.toUpperCase()}
              </p>
            </div>
            <div>
              <p className="text-blue-700">Investment Amount</p>
              <p className="font-medium text-blue-900">{investment.amount.toLocaleString('hr-HR')}</p>
            </div>
            <div>
              <p className="text-blue-700">Expected Return</p>
              <p className="font-medium text-blue-900">{investment.expected_return}%</p>
            </div>
            {investment.maturity_date && (
              <div>
                <p className="text-blue-700">Maturity Date</p>
                <p className="font-medium text-blue-900">
                  {format(new Date(investment.maturity_date), 'MMM dd, yyyy')}
                </p>
              </div>
            )}
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
            placeholder="Add any notes about this payment (e.g., dividend payment, interest, return of capital)..."
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
