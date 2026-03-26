import { useState, useCallback } from 'react'
import { supabase, BankCreditPayment } from '../../../../lib/supabase'
import { useToast } from '../../../../contexts/ToastContext'

interface BankPaymentWithDetails extends BankCreditPayment {
  bank_name?: string
  credit_type?: string
  project_name?: string
  payment_type: 'bank'
}

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
      const { data: bankPaymentsData, error: bankError } = await supabase
        .from('accounting_payments')
        .select(`
          *,
          invoice:accounting_invoices!inner(
            bank_credit_id,
            bank_credits(
              credit_type,
              project_id,
              bank_id,
              banks(name)
            )
          )
        `)
        .not('invoice.bank_credit_id', 'is', null)
        .order('payment_date', { ascending: false })

      if (bankError) throw bankError

      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')

      if (projectsError) throw projectsError

      const enrichedBankPayments: BankPaymentWithDetails[] = (bankPaymentsData || []).map(payment => {
        const bankCredit = payment.invoice?.bank_credits
        const project = bankCredit?.project_id
          ? projectsData?.find((p: { id: string; name: string }) => p.id === bankCredit.project_id)
          : undefined

        return {
          ...payment,
          bank_name: bankCredit?.banks?.name || 'Unknown Bank',
          credit_type: bankCredit?.credit_type || 'N/A',
          project_name: project?.name || 'No Project',
          payment_type: 'bank' as const,
          created_at: payment.created_at,
          notes: payment.description
        }
      })

      setPayments(enrichedBankPayments)
      setStats(calculateStats(enrichedBankPayments))
    } catch (error) {
      console.error('Error fetching payments:', error)
      toast.error('Failed to load payments')
    } finally {
      setLoading(false)
    }
  }, [])

  return { payments, stats, loading, refetch }
}
