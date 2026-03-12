import { useState, useEffect, useCallback, useMemo } from 'react'
import type { InvoiceWithDetails, InvoiceStats } from '../services/supervisionInvoiceService'
import {
  fetchSupervisionInvoices,
  calculateInvoiceStats,
  toggleInvoiceApproval,
  exportInvoicesCSV,
} from '../services/supervisionInvoiceService'

export function useSupervisionInvoices() {
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'recent' | 'large'>('all')
  const [filterApproved, setFilterApproved] = useState<'all' | 'approved' | 'not_approved'>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [stats, setStats] = useState<InvoiceStats>({
    totalInvoices: 0, totalAmount: 0, invoicesThisMonth: 0, amountThisMonth: 0,
  })

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchSupervisionInvoices()
      setInvoices(data)
      setStats(calculateInvoiceStats(data))
    } catch (err) {
      console.error('Error fetching invoices:', err)
      alert('Failed to load invoices')
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

  const handleApprove = async (invoiceId: string, currentApproved: boolean) => {
    try {
      await toggleInvoiceApproval(invoiceId, currentApproved)
      setInvoices(prev =>
        prev.map(inv => inv.id === invoiceId ? { ...inv, approved: !currentApproved } : inv)
      )
    } catch (err) {
      console.error('Error updating invoice approval:', err)
      alert('Failed to update invoice approval status')
    }
  }

  const handleExportCSV = () => exportInvoicesCSV(filteredInvoices)

  return {
    loading,
    stats,
    filteredInvoices,
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
