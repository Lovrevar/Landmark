import React from 'react'
import { format } from 'date-fns'
import type { PaymentScheduleResult } from '../utils/creditCalculations'

interface PaymentSchedulePreviewProps {
  calculation: PaymentScheduleResult | null
  gracePeriodMonths: number
}

const PaymentSchedulePreview: React.FC<PaymentSchedulePreviewProps> = ({ calculation, gracePeriodMonths }) => {
  if (!calculation) return null

  return (
    <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
      <h4 className="font-semibold text-blue-900 mb-3">Payment Schedule Preview</h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-blue-700 mb-1">Principal Payment</p>
          <p className="text-xl font-bold text-blue-900">{calculation.principalPerPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-blue-600">Every {calculation.principalFrequency}</p>
          <p className="text-xs text-blue-600 mt-1">{calculation.totalPrincipalPayments} total payments</p>
        </div>
        <div>
          <p className="text-sm text-green-700 mb-1">Interest Payment</p>
          <p className="text-xl font-bold text-green-900">{calculation.interestPerPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-green-600">Every {calculation.interestFrequency}</p>
          <p className="text-xs text-green-600 mt-1">{calculation.totalInterestPayments} total payments</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-blue-200">
        <p className="text-sm text-blue-700">Payments start: <span className="font-semibold">{format(calculation.paymentStartDate, 'MMM dd, yyyy')}</span></p>
        <p className="text-xs text-blue-600 mt-1">After {gracePeriodMonths} month grace period</p>
      </div>
    </div>
  )
}

export default PaymentSchedulePreview
