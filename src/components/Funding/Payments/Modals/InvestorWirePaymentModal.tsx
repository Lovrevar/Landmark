import React from 'react'
import { ProjectInvestment } from '../../../../lib/supabase'
import { format } from 'date-fns'
import { WirePaymentModal } from './WirePaymentModal'

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
  onSubmit,
}) => {
  if (!investment) return null

  const details = (
    <>
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
    </>
  )

  return (
    <WirePaymentModal
      visible={visible}
      onClose={onClose}
      title="Record Investor Payment"
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
