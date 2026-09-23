import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../../Common/CurrencyInput'
import { Alert } from '../../../ui'

interface InvoiceAmounts {
  total_amount: number
  paid_amount: number
  remaining_amount: number
}

/** Total / paid / remaining box shown above both payment forms once an invoice is known. */
export const PaymentInvoiceSummary: React.FC<{ invoice: InvoiceAmounts }> = ({ invoice }) => {
  const { t } = useTranslation()
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">{t('payments.form.total_amount_label')}</span>
        <span className="font-medium text-gray-900 dark:text-white">€{formatCurrency(invoice.total_amount)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">{t('payments.form.paid_amount_label')}</span>
        <span className="font-medium text-green-600">€{formatCurrency(invoice.paid_amount)}</span>
      </div>
      <div className="flex justify-between text-base border-t border-gray-300 dark:border-gray-600 pt-2">
        <span className="font-semibold text-gray-900 dark:text-white">{t('payments.form.remaining_amount_label')}</span>
        <span className="font-bold text-red-600">€{formatCurrency(invoice.remaining_amount)}</span>
      </div>
    </div>
  )
}

interface PartialPaymentAlertProps {
  amount: number
  /** What this payment may cover: remaining_amount, plus the payment's old amount when editing. */
  payableAmount: number
}

/** Tells the user whether the payment settles the invoice or leaves it partially paid. */
export const PartialPaymentAlert: React.FC<PartialPaymentAlertProps> = ({ amount, payableAmount }) => {
  const { t } = useTranslation()
  if (!(amount > 0 && amount <= payableAmount)) return null

  return (
    <Alert variant="info">
      <p className="font-medium">
        {amount === payableAmount
          ? t('payments.form.will_be_paid_full')
          : t('payments.form.will_be_partial_remaining', { amount: formatCurrency(payableAmount - amount) })}
      </p>
      {amount < payableAmount && (
        <p className="text-xs mt-1 opacity-90">
          {t('payments.form.will_be_partial_status')}
        </p>
      )}
    </Alert>
  )
}
