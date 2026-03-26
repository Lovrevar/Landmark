import { useState, useEffect, useCallback } from 'react'
import type { BankCredit, CreditAllocation, AllocationFormData } from '../types'
import type { ReferenceItem } from '../services/creditService'
import {
  fetchCredits,
  fetchAllocationsForCredit,
  fetchDisbursedAmounts,
  fetchProjects,
  fetchCompanies,
  fetchBanks,
  createAllocation,
  deleteAllocation,
} from '../services/creditService'
import { useToast } from '../../../../contexts/ToastContext'

const EMPTY_FORM: AllocationFormData = {
  allocation_type: 'project',
  project_id: '',
  refinancing_entity_type: 'company',
  refinancing_entity_id: '',
  allocated_amount: 0,
  description: '',
}

export function useCreditManagement() {
  const toast = useToast()
  const [credits, setCredits] = useState<BankCredit[]>([])
  const [allocations, setAllocations] = useState<Map<string, CreditAllocation[]>>(new Map())
  const [disbursedAmounts, setDisbursedAmounts] = useState<Map<string, number>>(new Map())
  const [expandedCredits, setExpandedCredits] = useState<Set<string>>(new Set())
  const [expandedAllocations, setExpandedAllocations] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showAllocationModal, setShowAllocationModal] = useState(false)
  const [selectedCredit, setSelectedCredit] = useState<BankCredit | null>(null)
  const [allocationForm, setAllocationForm] = useState<AllocationFormData>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [projects, setProjects] = useState<ReferenceItem[]>([])
  const [companies, setCompanies] = useState<ReferenceItem[]>([])
  const [banks, setBanks] = useState<ReferenceItem[]>([])

  const loadAllocationsForCredit = useCallback(async (creditId: string) => {
    const data = await fetchAllocationsForCredit(creditId)
    setAllocations(prev => {
      const next = new Map(prev)
      next.set(creditId, data)
      return next
    })
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [creditData, projectData, companyData, bankData] = await Promise.all([
        fetchCredits(),
        fetchProjects(),
        fetchCompanies(),
        fetchBanks(),
      ])

      setCredits(creditData)
      setProjects(projectData)
      setCompanies(companyData)
      setBanks(bankData)

      if (creditData.length > 0) {
        const disbursed = await fetchDisbursedAmounts(creditData.map(c => c.id))
        setDisbursedAmounts(disbursed)
        await Promise.all(creditData.map(c => loadAllocationsForCredit(c.id)))
      }
    } catch (err) {
      setError('Greška pri učitavanju podataka')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [loadAllocationsForCredit])

  useEffect(() => { loadData() }, [loadData])

  const toggleCredit = (creditId: string) => {
    setExpandedCredits(prev => {
      const next = new Set(prev)
      if (next.has(creditId)) { next.delete(creditId) } else { next.add(creditId) }
      return next
    })
  }

  const toggleAllocation = (allocationKey: string) => {
    setExpandedAllocations(prev => {
      const next = new Set(prev)
      if (next.has(allocationKey)) { next.delete(allocationKey) } else { next.add(allocationKey) }
      return next
    })
  }

  const openAllocationModal = (credit: BankCredit) => {
    setSelectedCredit(credit)
    setAllocationForm(EMPTY_FORM)
    setShowAllocationModal(true)
  }

  const closeAllocationModal = () => setShowAllocationModal(false)

  const handleCreateAllocation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCredit) return

    const errors: Record<string, string> = {}
    if (allocationForm.allocation_type === 'project' && !allocationForm.project_id) {
      errors.project_id = 'Odaberi projekt'
    }
    if (allocationForm.allocation_type === 'refinancing' && !allocationForm.refinancing_entity_id) {
      errors.refinancing_entity_id = 'Odaberi entitet'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    try {
      await createAllocation(selectedCredit.id, allocationForm)
      await loadAllocationsForCredit(selectedCredit.id)
      setShowAllocationModal(false)
      setFieldErrors({})
    } catch (err) {
      console.error('Error creating allocation:', err)
      toast.error('Greška pri kreiranju namjene')
    }
  }

  const [pendingDeleteAllocation, setPendingDeleteAllocation] = useState<{ allocationId: string; creditId: string } | null>(null)
  const [deletingAllocation, setDeletingAllocation] = useState(false)

  const handleDeleteAllocation = (allocationId: string, creditId: string) =>
    setPendingDeleteAllocation({ allocationId, creditId })

  const confirmDeleteAllocation = async () => {
    if (!pendingDeleteAllocation) return
    setDeletingAllocation(true)
    try {
      await deleteAllocation(pendingDeleteAllocation.allocationId)
      await loadAllocationsForCredit(pendingDeleteAllocation.creditId)
    } catch (err) {
      console.error('Error deleting allocation:', err)
    } finally {
      setDeletingAllocation(false)
      setPendingDeleteAllocation(null)
    }
  }

  const cancelDeleteAllocation = () => setPendingDeleteAllocation(null)

  return {
    credits,
    allocations,
    disbursedAmounts,
    expandedCredits,
    expandedAllocations,
    loading,
    error,
    projects,
    companies,
    banks,
    showAllocationModal,
    selectedCredit,
    allocationForm,
    setAllocationForm,
    toggleCredit,
    toggleAllocation,
    openAllocationModal,
    closeAllocationModal,
    handleCreateAllocation,
    handleDeleteAllocation,
    confirmDeleteAllocation,
    cancelDeleteAllocation,
    pendingDeleteAllocation,
    deletingAllocation,
    fieldErrors,
  }
}
