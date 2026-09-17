import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  fetchSalesPayments,
  calculateSalesPaymentStats,
  type SalesPaymentWithDetails,
  type SalesPaymentStats
} from '../services/salesPaymentsService'
import { useToast } from '../../../../contexts/ToastContext'

export function useSalesPayments() {
  const toast = useToast()
  const { t } = useTranslation()
  const [payments, setPayments] = useState<SalesPaymentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'recent' | 'large'>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSalesPayments()
      setPayments(data)
    } catch (err) {
      console.error('Error fetching payments:', err)
      setError(err instanceof Error ? err : new Error(String(err)))
      toast.error(t('customers.sales_payments.load_failed'))
    } finally {
      setLoading(false)
    }
  }, [toast, t])

  useEffect(() => {
    load()
  }, [load])

  const stats: SalesPaymentStats = useMemo(() => calculateSalesPaymentStats(payments), [payments])

  const filteredPayments = useMemo(() =>
    payments.filter(payment => {
      const matchesSearch =
        payment.apartment_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.description?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesDateRange =
        (!dateRange.start || new Date(payment.payment_date) >= new Date(dateRange.start)) &&
        (!dateRange.end || new Date(payment.payment_date) <= new Date(dateRange.end))

      const matchesFilter =
        filterStatus === 'all' ||
        (filterStatus === 'recent' && new Date(payment.payment_date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
        (filterStatus === 'large' && Number(payment.amount) > 10000)

      return matchesSearch && matchesDateRange && matchesFilter
    }),
    [payments, searchTerm, filterStatus, dateRange]
  )

  const dismissError = useCallback(() => setError(null), [])

  return {
    loading,
    error,
    dismissError,
    // Distinguishes "the load failed and there is nothing on screen" from "the load failed
    // but the previous rows are still shown" — the two get different treatments.
    hasData: payments.length > 0,
    refetch: load,
    stats,
    filteredPayments,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    dateRange,
    setDateRange
  }
}
