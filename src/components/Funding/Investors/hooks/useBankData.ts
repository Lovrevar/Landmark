import { useState, useEffect } from 'react'
import type { BankWithCredits, Company } from '../types'
import { useToast } from '../../../../contexts/ToastContext'
import {
  fetchFundingBanksData,
  createBank,
  updateBank,
  deleteBank,
  type BankFormPayload,
} from '../services/bankService'

export function useBankData() {
  const toast = useToast()
  const [banks, setBanks] = useState<BankWithCredits[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const data = await fetchFundingBanksData()
      setBanks(data.banks)
      setCompanies(data.companies)
    } catch (error) {
      console.error('Error fetching banks data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const addBank = async (newBank: BankFormPayload, onDone: () => void) => {
    if (!newBank.name.trim()) {
      toast.warning('Please enter bank name')
      return
    }
    try {
      await createBank(newBank)
      onDone()
      await fetchData()
    } catch (error) {
      console.error('Error adding bank:', error)
      toast.error('Error adding bank. Please try again.')
    }
  }

  const handleUpdateBank = async (
    editingBank: { id: string },
    newBank: BankFormPayload,
    onDone: () => void
  ) => {
    if (!newBank.name.trim()) return
    try {
      await updateBank(editingBank.id, newBank)
      onDone()
      await fetchData()
    } catch (error) {
      console.error('Error updating bank:', error)
      toast.error('Error updating bank.')
    }
  }

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteBank = (bankId: string) => setPendingDeleteId(bankId)

  const confirmDeleteBank = async () => {
    if (!pendingDeleteId) return
    setDeleting(true)
    try {
      await deleteBank(pendingDeleteId)
      await fetchData()
    } catch (error) {
      console.error('Error deleting bank:', error)
      toast.error('Error deleting bank.')
    } finally {
      setDeleting(false)
      setPendingDeleteId(null)
    }
  }

  const cancelDeleteBank = () => setPendingDeleteId(null)

  return {
    banks,
    companies,
    loading,
    fetchData,
    addBank,
    updateBank: handleUpdateBank,
    deleteBank: handleDeleteBank,
    confirmDeleteBank,
    cancelDeleteBank,
    pendingDeleteId,
    deleting,
  }
}
