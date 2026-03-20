import React from 'react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import type { PaymentScheduleResult } from '../utils/creditCalculations'

interface PaymentSchedulePreviewProps {
  calculation: PaymentScheduleResult | null
  gracePeriodMonths: number
}

const PaymentSchedulePreview: React.FC<PaymentSchedulePreviewProps> = ({ calculation, gracePeriodMonths }) => {
  const { t } = useTranslation()
  if (!calculation) return null

  return (
    <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
      <h4 className="font-semibold text-blue-900 mb-3">{t('banks.credit_form.schedule_preview')}</h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-blue-700 mb-1">{t('banks.credit_form.principal_payment')}</p>
          <p className="text-xl font-bold text-blue-900">{calculation.principalPerPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-blue-600">{t('banks.credit_form.every_frequency', { frequency: calculation.principalFrequency })}</p>
          <p className="text-xs text-blue-600 mt-1">{t('banks.credit_form.total_payments_label', { count: calculation.totalPrincipalPayments })}</p>
        </div>
        <div>
          <p className="text-sm text-green-700 mb-1">{t('banks.credit_form.interest_payment')}</p>
          <p className="text-xl font-bold text-green-900">{calculation.interestPerPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-green-600">{t('banks.credit_form.every_frequency', { frequency: calculation.interestFrequency })}</p>
          <p className="text-xs text-green-600 mt-1">{t('banks.credit_form.total_payments_label', { count: calculation.totalInterestPayments })}</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-blue-200">
        <p className="text-sm text-blue-700">{t('banks.credit_form.payments_start_label')} <span className="font-semibold">{format(calculation.paymentStartDate, 'MMM dd, yyyy')}</span></p>
        <p className="text-xs text-blue-600 mt-1">{t('banks.credit_form.grace_period_after', { months: gracePeriodMonths })}</p>
      </div>
    </div>
  )
}

export default PaymentSchedulePreview
