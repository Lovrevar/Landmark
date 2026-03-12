import { useState, useEffect, useCallback, useMemo } from 'react'
import type { RetailInvoiceWithDetails, RetailInvoiceStats } from '../services/retailInvoiceService'
import {
  fetchRetailInvoices,
  calculateRetailInvoiceStats,
  toggleRetailInvoiceApproval,
  exportRetailInvoicesCSV,
} from '../services/retailInvoiceService'

export function useRetailInvoices() {
  const [invoices, setInvoices] = useState<RetailInvoiceWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterApproved, setFilterApproved] = useState<'all' | 'approved' | 'not_approved'>('all')
  const [filterType, setFilterType] = useState<'all' | 'incoming' | 'outgoing'>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [stats, setStats] = useState<RetailInvoiceStats>({
    totalInvoices: 0, totalAmount: 0, invoicesThisMonth: 0, amountThisMonth: 0,
  })

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchRetailInvoices()
      setInvoices(data)
      setStats(calculateRetailInvoiceStats(data))
    } catch (err) {
      console.error('Error fetching retail invoices:', err)
      alert('Greška pri učitavanju računa')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  const filteredInvoices = useMemo(() => invoices.filter(invoice => {
    const entityName = invoice.supplier_name || invoice.customer_name || ''
    const matchesSearch =
      invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.project_name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDateRange =
      (!dateRange.start || new Date(invoice.issue_date) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(invoice.issue_date) <= new Date(dateRange.end))

    const matchesApproved =
      filterApproved === 'all' ||
      (filterApproved === 'approved' && invoice.approved) ||
      (filterApproved === 'not_approved' && !invoice.approved)

    const matchesType =
      filterType === 'all' ||
      (filterType === 'incoming' && invoice.invoice_type.startsWith('INCOMING')) ||
      (filterType === 'outgoing' && invoice.invoice_type.startsWith('OUTGOING'))

    return matchesSearch && matchesDateRange && matchesApproved && matchesType
  }), [invoices, searchTerm, filterApproved, filterType, dateRange])

  const handleApprove = async (invoiceId: string, currentApproved: boolean) => {
    try {
      await toggleRetailInvoiceApproval(invoiceId, currentApproved)
      setInvoices(prev =>
        prev.map(inv => inv.id === invoiceId ? { ...inv, approved: !currentApproved } : inv)
      )
    } catch (err) {
      console.error('Error updating approval status:', err)
      alert('Greška pri ažuriranju odobrenja')
    }
  }

  const handleExportCSV = () => exportRetailInvoicesCSV(filteredInvoices)

  return {
    loading,
    stats,
    filteredInvoices,
    searchTerm,
    setSearchTerm,
    filterApproved,
    setFilterApproved,
    filterType,
    setFilterType,
    dateRange,
    setDateRange,
    handleApprove,
    handleExportCSV,
  }
}
