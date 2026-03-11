import React from 'react'
import { BankCredit } from '../../../../lib/supabase'
import { WirePaymentModal } from './WirePaymentModal'

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
  onSubmit,
}) => {
  if (!credit) return null

  const details = (
    <>
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
    </>
  )

  return (
    <WirePaymentModal
      visible={visible}
      onClose={onClose}
      title="Record Bank Payment"
      details={details}
      amount={amount}
      paymentDate={paymentDate}
      notes={notes}
      onAmountChange={onAmountChange}
      onDateChange={onDateChange}
      onNotesChange={onNotesChange}
      onSubmit={onSubmit}
    />
  )
}
