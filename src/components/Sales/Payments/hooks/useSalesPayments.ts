import { useState, useEffect, useMemo } from 'react'
import {
  fetchSalesPayments,
  calculateSalesPaymentStats,
  type SalesPaymentWithDetails,
  type SalesPaymentStats
} from '../services/salesPaymentsService'

export function useSalesPayments() {
  const [payments, setPayments] = useState<SalesPaymentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'recent' | 'large'>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchSalesPayments()
        setPayments(data)
      } catch (error) {
        console.error('Error fetching payments:', error)
        alert('Failed to load payments')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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

  return {
    loading,
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
