import { useState, useEffect, useCallback, useMemo } from 'react'
import type { PaymentWithDetails, PaymentStats } from '../services/supervisionPaymentService'
import {
  fetchSupervisionPayments,
  calculatePaymentStats,
  exportSupervisionPaymentsExcel,
} from '../services/supervisionPaymentService'
import { useAsyncExport } from '../../../../hooks/useAsyncExport'

export function useSupervisionPayments() {
  const [payments, setPayments] = useState<PaymentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'recent' | 'large'>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [stats, setStats] = useState<PaymentStats>({
    totalPayments: 0, totalAmount: 0, paymentsThisMonth: 0, amountThisMonth: 0,
  })

  const loadPayments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSupervisionPayments()
      setPayments(data)
      setStats(calculatePaymentStats(data))
    } catch (err) {
      console.error('Error fetching payments:', err)
      // Kept out of the stats deliberately: "€0 paid this month" is a claim, and a failed read
      // is not entitled to make it.
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPayments() }, [loadPayments])

  const filteredPayments = useMemo(() => payments.filter(payment => {
    const matchesSearch =
      payment.subcontractor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.contract?.contract_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.notes?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDateRange =
      (!dateRange.start || new Date(payment.payment_date || payment.created_at) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(payment.payment_date || payment.created_at) <= new Date(dateRange.end))

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'recent' && new Date(payment.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (filterStatus === 'large' && payment.amount > 10000)

    return matchesSearch && matchesDateRange && matchesFilter
  }), [payments, searchTerm, filterStatus, dateRange])

  // Through `useAsyncExport` so a failed export toasts instead of dying inside the click handler.
  const { exporting, run: runExportExcel } = useAsyncExport(exportSupervisionPaymentsExcel, 'common.export_error')
  const handleExportExcel = () => void runExportExcel(filteredPayments)

  return {
    loading,
    error,
    /** False when nothing has loaded, so the caller can tell a failed load from "no payments". */
    hasData: payments.length > 0,
    refetch: loadPayments,
    stats,
    filteredPayments,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    dateRange,
    setDateRange,
    exporting,
    handleExportExcel,
  }
}
