import React from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  if (!credit) return null

  const details = (
    <>
      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">{t('funding.payments.bank_wire_modal.details_heading')}</h4>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-blue-700 dark:text-blue-300">{t('funding.payments.bank_wire_modal.bank_label')}</p>
          <p className="font-medium text-blue-900 dark:text-blue-100">{bankName}</p>
        </div>
        <div>
          <p className="text-blue-700 dark:text-blue-300">{t('funding.payments.bank_wire_modal.loan_type_label')}</p>
          <p className="font-medium text-blue-900 dark:text-blue-100">
            {credit.credit_type.replace('_', ' ')}
          </p>
        </div>
        <div>
          <p className="text-blue-700 dark:text-blue-300">{t('funding.payments.bank_wire_modal.outstanding_balance_label')}</p>
          <p className="font-medium text-blue-900 dark:text-blue-100">{credit.outstanding_balance.toLocaleString('hr-HR')}</p>
        </div>
        <div>
          <p className="text-blue-700 dark:text-blue-300">{t('funding.payments.bank_wire_modal.scheduled_payment_label')}</p>
          <p className="font-medium text-blue-900 dark:text-blue-100">{credit.monthly_payment.toLocaleString('hr-HR')}</p>
        </div>
      </div>
    </>
  )

  return (
    <WirePaymentModal
      visible={visible}
      onClose={onClose}
      title={t('funding.payments.bank_wire_modal.title')}
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
