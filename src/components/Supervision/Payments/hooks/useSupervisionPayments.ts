import { useState, useEffect, useCallback, useMemo } from 'react'
import type { PaymentWithDetails, PaymentStats } from '../services/supervisionPaymentService'
import {
  fetchSupervisionPayments,
  calculatePaymentStats,
  exportPaymentsCSV,
} from '../services/supervisionPaymentService'
import { useToast } from '../../../../contexts/ToastContext'

export function useSupervisionPayments() {
  const toast = useToast()
  const [payments, setPayments] = useState<PaymentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'recent' | 'large'>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [stats, setStats] = useState<PaymentStats>({
    totalPayments: 0, totalAmount: 0, paymentsThisMonth: 0, amountThisMonth: 0,
  })

  const loadPayments = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchSupervisionPayments()
      setPayments(data)
      setStats(calculatePaymentStats(data))
    } catch (err) {
      console.error('Error fetching payments:', err)
      toast.error('Failed to load payments')
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

  const handleExportCSV = () => exportPaymentsCSV(filteredPayments)

  return {
    loading,
    stats,
    filteredPayments,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    dateRange,
    setDateRange,
    handleExportCSV,
  }
}
