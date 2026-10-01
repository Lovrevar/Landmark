import { useState, useEffect, useCallback } from 'react'
import type { BankCompany, BankCredit, CreditAllocation, MyCompany, InvoiceCategory } from '../bankInvoiceTypes'
import { useToast } from '../../../../contexts/ToastContext'
import { useTranslation } from 'react-i18next'
import { toLoadError } from '../../services/loadError'
import {
  fetchBanksForInvoice,
  fetchCreditsForBank,
  fetchMyCompaniesForInvoice,
  fetchActiveInvoiceCategories,
  fetchCreditAllocations,
} from '../services/bankInvoiceFormDataService'

export const useBankInvoiceData = (bankId: string, creditId?: string) => {
  const toast = useToast()
  const { t } = useTranslation()
  const [banks, setBanks] = useState<BankCompany[]>([])
  const [credits, setCredits] = useState<BankCredit[]>([])
  const [creditAllocations, setCreditAllocations] = useState<CreditAllocation[]>([])
  const [myCompanies, setMyCompanies] = useState<MyCompany[]>([])
  const [invoiceCategories, setInvoiceCategories] = useState<InvoiceCategory[]>([])
  // One slot for the whole form: every list here is a dropdown, and an empty dropdown is
  // indistinguishable from "there are none" — the modal shows this above its fields.
  const [error, setError] = useState<Error | null>(null)

  const fetchBanks = useCallback(async () => {
    try {
      setBanks(await fetchBanksForInvoice())
    } catch (error) {
      console.error('Error fetching banks:', error)
      setError(toLoadError(error))
      toast.error(t('banks.invoice_form.error_load_banks'))
    }
  }, [toast, t])

  const fetchCredits = async (bId: string) => {
    try {
      setCredits(await fetchCreditsForBank(bId))
    } catch (error) {
      console.error('Error fetching credits:', error)
      setError(toLoadError(error))
      setCredits([])
    }
  }

  // Throws rather than returning `[]`: the caller preselects the first company from it, and a
  // silent empty list turns a failed load into "this company has no bank accounts".
  const fetchMyCompanies = useCallback(async () => {
    try {
      const data = await fetchMyCompaniesForInvoice()
      setMyCompanies(data)
      return data
    } catch (error) {
      console.error('Error fetching companies:', error)
      setError(toLoadError(error))
      throw error
    }
  }, [])

  const fetchInvoiceCategories = useCallback(async () => {
    try {
      setInvoiceCategories(await fetchActiveInvoiceCategories())
    } catch (error) {
      console.error('Error fetching invoice categories:', error)
      setError(toLoadError(error))
    }
  }, [])

  useEffect(() => {
    void fetchBanks()
    void fetchInvoiceCategories()
  }, [fetchBanks, fetchInvoiceCategories])

  const fetchAllocations = async (cId: string) => {
    try {
      setCreditAllocations(await fetchCreditAllocations(cId))
    } catch (error) {
      console.error('Error fetching credit allocations:', error)
      setError(toLoadError(error))
      setCreditAllocations([])
    }
  }

  useEffect(() => {
    if (bankId) {
      fetchCredits(bankId)
    } else {
      setCredits([])
      setCreditAllocations([])
    }
  }, [bankId])

  useEffect(() => {
    if (creditId) {
      fetchAllocations(creditId)
    } else {
      setCreditAllocations([])
    }
  }, [creditId])

  return {
    banks,
    credits,
    creditAllocations,
    myCompanies,
    invoiceCategories,
    error,
    dismissError: () => setError(null),
    fetchMyCompanies
  }
}
