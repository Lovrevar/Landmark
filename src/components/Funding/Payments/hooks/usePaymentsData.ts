import { useState, useCallback } from 'react'
import { useToast } from '../../../../contexts/ToastContext'
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
  const paymentsThisMonth = paymentsData.filter(p => new Date(p.created_at) >= firstDayOfMonth)
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
  const toast = useToast()
  const [payments, setPayments] = useState<CombinedPayment[]>([])
  const [stats, setStats] = useState<PaymentsStats>({
    totalPayments: 0,
    totalAmount: 0,
    paymentsThisMonth: 0,
    amountThisMonth: 0,
    bankPayments: 0
  })
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const enrichedBankPayments = await fetchBankPayments()
      setPayments(enrichedBankPayments)
      setStats(calculateStats(enrichedBankPayments))
    } catch (error) {
      console.error('Error fetching payments:', error)
      toast.error('Failed to load payments')
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { payments, stats, loading, refetch }
}
