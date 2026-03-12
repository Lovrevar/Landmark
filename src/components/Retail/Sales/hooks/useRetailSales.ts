import { useState, useEffect, useCallback, useMemo } from 'react'
import type { RetailSalesPaymentWithDetails, SalesStats } from '../services/retailSalesService'
import { fetchRetailSalesPayments, calculateSalesStats, exportRetailSalesCSV } from '../services/retailSalesService'

export function useRetailSales() {
  const [payments, setPayments] = useState<RetailSalesPaymentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'recent' | 'large'>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [stats, setStats] = useState<SalesStats>({
    totalPayments: 0, totalAmount: 0, paymentsThisMonth: 0, amountThisMonth: 0,
  })

  const loadPayments = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchRetailSalesPayments()
      setPayments(data)
      setStats(calculateSalesStats(data))
    } catch (err) {
      console.error('Error fetching retail sales payments:', err)
      alert('Failed to load payments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPayments() }, [loadPayments])

  const filteredPayments = useMemo(() => payments.filter(payment => {
    const matchesSearch =
      payment.contract_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
      (filterStatus === 'large' && payment.amount > 10000)

    return matchesSearch && matchesDateRange && matchesFilter
  }), [payments, searchTerm, filterStatus, dateRange])

  const handleExportCSV = () => exportRetailSalesCSV(filteredPayments)

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
