import React from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  if (!investment) return null

  const details = (
    <>
      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">{t('funding.payments.investor_wire_modal.details_heading')}</h4>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-blue-700 dark:text-blue-300">{t('funding.payments.investor_wire_modal.investor_label')}</p>
          <p className="font-medium text-blue-900 dark:text-blue-100">{investorName}</p>
        </div>
        <div>
          <p className="text-blue-700 dark:text-blue-300">{t('funding.payments.investor_wire_modal.investment_type_label')}</p>
          <p className="font-medium text-blue-900 dark:text-blue-100">
            {investment.investment_type.toUpperCase()}
          </p>
        </div>
        <div>
          <p className="text-blue-700 dark:text-blue-300">{t('funding.payments.investor_wire_modal.investment_amount_label')}</p>
          <p className="font-medium text-blue-900 dark:text-blue-100">{investment.amount.toLocaleString('hr-HR')}</p>
        </div>
        <div>
          <p className="text-blue-700 dark:text-blue-300">{t('funding.payments.investor_wire_modal.expected_return_label')}</p>
          <p className="font-medium text-blue-900 dark:text-blue-100">{investment.expected_return}%</p>
        </div>
        {investment.maturity_date && (
          <div>
            <p className="text-blue-700 dark:text-blue-300">{t('funding.payments.investor_wire_modal.maturity_date_label')}</p>
            <p className="font-medium text-blue-900 dark:text-blue-100">
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
      title={t('funding.payments.investor_wire_modal.title')}
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
