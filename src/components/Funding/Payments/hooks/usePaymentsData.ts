import { useState, useCallback } from 'react'
import { fetchBankPayments, type BankPaymentWithDetails } from '../services/bankPaymentsService'

type CombinedPayment = BankPaymentWithDetails

interface PaymentsStats {
  totalPayments: number
  totalAmount: number
  paymentsThisMonth: number
  amountThisMonth: number
  bankPayments: number
}

const calculateStats = (paymentsData: CombinedPayment[]): PaymentsStats => {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const totalAmount = paymentsData.reduce((sum, p) => sum + Number(p.amount), 0)
  const paymentsThisMonth = paymentsData.filter(p => new Date(p.payment_date || p.created_at) >= firstDayOfMonth)
  const amountThisMonth = paymentsThisMonth.reduce((sum, p) => sum + Number(p.amount), 0)
  const bankPayments = paymentsData.length

  return {
    totalPayments: paymentsData.length,
    totalAmount,
    paymentsThisMonth: paymentsThisMonth.length,
    amountThisMonth,
    bankPayments
  }
}

export function usePaymentsData() {
  const [payments, setPayments] = useState<CombinedPayment[]>([])
  const [stats, setStats] = useState<PaymentsStats>({
    totalPayments: 0,
    totalAmount: 0,
    paymentsThisMonth: 0,
    amountThisMonth: 0,
    bankPayments: 0
  })
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
