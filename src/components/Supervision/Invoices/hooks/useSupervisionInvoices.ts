import { useState, useEffect, useCallback, useMemo } from 'react'
import type { InvoiceWithDetails, InvoiceStats } from '../services/supervisionInvoiceService'
import {
  fetchSupervisionInvoices,
  calculateInvoiceStats,
  toggleInvoiceApproval,
  exportInvoicesCSV,
} from '../services/supervisionInvoiceService'
import { useToast } from '../../../../contexts/ToastContext'

export function useSupervisionInvoices() {
  const toast = useToast()
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'recent' | 'large'>('all')
  const [filterApproved, setFilterApproved] = useState<'all' | 'approved' | 'not_approved'>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 100
  const [stats, setStats] = useState<InvoiceStats>({
    totalInvoices: 0, totalAmount: 0, invoicesThisMonth: 0, amountThisMonth: 0,
  })

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSupervisionInvoices()
      setInvoices(data)
      setStats(calculateInvoiceStats(data))
    } catch (err) {
      console.error('Error fetching invoices:', err)
      // Neither the rows nor the stats are replaced with zeros: the screen renders the failure
      // instead, so "€0 invoiced" is never shown for a register that simply did not load.
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  const filteredInvoices = useMemo(() => invoices.filter(invoice => {
    const matchesSearch =
      invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.contract_number?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDateRange =
      (!dateRange.start || new Date(invoice.issue_date) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(invoice.issue_date) <= new Date(dateRange.end))

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'recent' && new Date(invoice.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (filterStatus === 'large' && invoice.total_amount > 10000)

    const matchesApproved =
      filterApproved === 'all' ||
      (filterApproved === 'approved' && invoice.approved) ||
      (filterApproved === 'not_approved' && !invoice.approved)

    return matchesSearch && matchesDateRange && matchesFilter && matchesApproved
  }), [invoices, searchTerm, filterStatus, filterApproved, dateRange])

  const paginatedInvoices = useMemo(
    () => filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredInvoices, currentPage]
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterStatus, filterApproved, dateRange.start, dateRange.end])

  const handleApprove = async (invoiceId: string, currentApproved: boolean) => {
    try {
      await toggleInvoiceApproval(invoiceId, currentApproved)
      setInvoices(prev =>
        prev.map(inv => inv.id === invoiceId ? { ...inv, approved: !currentApproved } : inv)
      )
    } catch (err) {
      console.error('Error updating invoice approval:', err)
      toast.error('Failed to update invoice approval status')
    }
  }

  const handleExportCSV = () => exportInvoicesCSV(filteredInvoices)

  return {
    loading,
    error,
    /** False when nothing has loaded, so the caller can tell a failed load from an empty register. */
    hasData: invoices.length > 0,
    refetch: loadInvoices,
    stats,
    filteredInvoices,
    paginatedInvoices,
    currentPage,
    setCurrentPage,
    pageSize,
    totalCount: filteredInvoices.length,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    filterApproved,
    setFilterApproved,
    dateRange,
    setDateRange,
    handleApprove,
    handleExportCSV,
  }
}
