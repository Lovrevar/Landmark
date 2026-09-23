import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { monthKey } from '../../../../utils/dateOnly'
import { fetchBankPayments, type BankPaymentWithDetails } from '../services/bankPaymentsService'
import { paymentTotalsByDirection, EMPTY_PAYMENT_TOTALS, type PaymentTotals } from '../../../Cashflow/services/paymentTotals'

type CombinedPayment = BankPaymentWithDetails

interface PaymentsStats {
  /** Split by direction: drawdowns in, repayments and fees out. Never one summed amount. */
  all: PaymentTotals
  thisMonth: PaymentTotals
}

const calculateStats = (paymentsData: CombinedPayment[]): PaymentsStats => {
  // Same calendar month, compared as 'YYYY-MM' strings: a `>= first of the month` test also
  // counted future-dated payments, and `new Date('YYYY-MM-DD')` parses as UTC midnight.
  const currentMonth = format(new Date(), 'yyyy-MM')
  const paymentsThisMonth = paymentsData.filter(p => monthKey(p.payment_date || p.created_at) === currentMonth)

  return {
    all: paymentTotalsByDirection(paymentsData),
    thisMonth: paymentTotalsByDirection(paymentsThisMonth),
  }
}

export function usePaymentsData() {
  const [payments, setPayments] = useState<CombinedPayment[]>([])
  const [stats, setStats] = useState<PaymentsStats>({ all: EMPTY_PAYMENT_TOTALS, thisMonth: EMPTY_PAYMENT_TOTALS })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const enrichedBankPayments = await fetchBankPayments()
      setPayments(enrichedBankPayments)
      setStats(calculateStats(enrichedBankPayments))
    } catch (err) {
      console.error('Error fetching payments:', err)
      // The stats are left alone rather than recomputed from nothing: "€0 paid this month" is a
      // figure the screen would stand behind, and a failed read cannot.
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [])

  return { payments, stats, loading, error, refetch }
}
