import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../../../contexts/AuthContext'
import {
  ApprovedInvoice,
  fetchApprovedInvoices,
  hideInvoice as svcHideInvoice,
  bulkHideInvoices as svcBulkHideInvoices
} from '../services/approvalsService'

interface ApprovalsStats {
  totalInvoices: number
  totalAmount: number
  oldestInvoice: string | null
}

interface UseApprovalsResult {
  invoices: ApprovedInvoice[]
  filteredInvoices: ApprovedInvoice[]
  stats: ApprovalsStats
  loading: boolean
  searchTerm: string
  setSearchTerm: (term: string) => void
  selectedIds: Set<string>
  toggleSelect: (id: string) => void
  toggleSelectAll: () => void
  allFilteredSelected: boolean
  selectedCount: number
  selectedTotal: number
  hideInvoice: (invoiceId: string) => Promise<void>
  bulkHide: () => Promise<void>
}

export function useApprovals(): UseApprovalsResult {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState<ApprovedInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState<ApprovalsStats>({
    totalInvoices: 0,
    totalAmount: 0,
    oldestInvoice: null
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchApprovedInvoices()
      setInvoices(data)
      setSelectedIds(new Set())
      const totalAmount = data.reduce((sum, inv) => sum + inv.total_amount, 0)
      const oldestInvoice = data.length > 0 ? data[0].issue_date : null
      setStats({ totalInvoices: data.length, totalAmount, oldestInvoice })
    } catch (error) {
      console.error('Error fetching approved invoices:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const allFilteredSelected =
    filteredInvoices.length > 0 &&
    filteredInvoices.every((inv) => selectedIds.has(inv.id))

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filteredInvoices.forEach((inv) => next.delete(inv.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filteredInvoices.forEach((inv) => next.add(inv.id))
        return next
      })
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedCount = selectedIds.size
  const selectedTotal = invoices
    .filter((inv) => selectedIds.has(inv.id))
    .reduce((sum, inv) => sum + inv.total_amount, 0)

  const hideInvoice = useCallback(async (invoiceId: string) => {
    if (!user?.id) throw new Error('Korisnik nije pronađen.')
    await svcHideInvoice(invoiceId, user.id)
    await load()
  }, [user?.id, load])

  const bulkHide = useCallback(async () => {
    if (!user?.id) throw new Error('Korisnik nije pronađen.')
    await svcBulkHideInvoices(Array.from(selectedIds), user.id)
    await load()
  }, [user?.id, selectedIds, load])

  return {
    invoices,
    filteredInvoices,
    stats,
    loading,
    searchTerm,
    setSearchTerm,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    allFilteredSelected,
    selectedCount,
    selectedTotal,
    hideInvoice,
    bulkHide
  }
}
