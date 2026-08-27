import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { BankWithCredits, Company } from '../types'
import { useToast } from '../../../../contexts/ToastContext'
import { isForeignKeyViolation } from '../../../../lib/dbErrors'
import {
  fetchFundingBanksData,
  createBank,
  updateBank,
  deleteBank,
  fetchBankCreditIds,
  type BankFormPayload,
} from '../services/bankService'
import { countInvoicesForCredits } from '../services/creditService'

export function useBankData() {
  const toast = useToast()
  const { t } = useTranslation()
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
  const [pendingDeleteInvoiceCount, setPendingDeleteInvoiceCount] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  // null = not looked up yet, or the lookup failed; the dialog just omits the warning line.
  const handleDeleteBank = async (bankId: string) => {
    setPendingDeleteId(bankId)
    setPendingDeleteInvoiceCount(null)
    try {
      setPendingDeleteInvoiceCount(await countInvoicesForCredits(await fetchBankCreditIds(bankId)))
    } catch (error) {
      console.error('Error counting invoices linked to investor credits:', error)
    }
  }

  const confirmDeleteBank = async () => {
    if (!pendingDeleteId) return
    setDeleting(true)
    try {
      await deleteBank(pendingDeleteId)
      await fetchData()
    } catch (error) {
      console.error('Error deleting bank:', error)
      toast.error(
        isForeignKeyViolation(error)
          ? t('funding.investors.error_delete_bank_linked')
          : t('funding.investors.error_delete_bank'),
      )
    } finally {
      setDeleting(false)
      setPendingDeleteId(null)
      setPendingDeleteInvoiceCount(null)
    }
  }

  const cancelDeleteBank = () => {
    setPendingDeleteId(null)
    setPendingDeleteInvoiceCount(null)
  }

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
    pendingDeleteInvoiceCount,
    deleting,
  }
}
