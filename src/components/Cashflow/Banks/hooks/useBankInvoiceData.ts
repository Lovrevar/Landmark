import { useState, useEffect } from 'react'
import type { BankCompany, BankCredit, CreditAllocation, MyCompany, InvoiceCategory } from '../bankInvoiceTypes'
import { useToast } from '../../../../contexts/ToastContext'
import {
  fetchBanksForInvoice,
  fetchCreditsForBank,
  fetchMyCompaniesForInvoice,
  fetchActiveInvoiceCategories,
  fetchCreditAllocations,
} from '../services/bankInvoiceFormDataService'

export const useBankInvoiceData = (bankId: string, creditId?: string) => {
  const toast = useToast()
  const [banks, setBanks] = useState<BankCompany[]>([])
  const [credits, setCredits] = useState<BankCredit[]>([])
  const [creditAllocations, setCreditAllocations] = useState<CreditAllocation[]>([])
  const [myCompanies, setMyCompanies] = useState<MyCompany[]>([])
  const [invoiceCategories, setInvoiceCategories] = useState<InvoiceCategory[]>([])

  const fetchBanks = async () => {
    try {
      setBanks(await fetchBanksForInvoice())
    } catch (error) {
      console.error('Error fetching banks:', error)
      toast.error('Greška pri učitavanju banaka')
    }
  }

  const fetchCredits = async (bId: string) => {
    try {
      setCredits(await fetchCreditsForBank(bId))
    } catch (error) {
      console.error('Error fetching credits:', error)
      setCredits([])
    }
  }

  const fetchMyCompanies = async () => {
    try {
      const data = await fetchMyCompaniesForInvoice()
      setMyCompanies(data)
      return data
    } catch (error) {
      console.error('Error fetching companies:', error)
      return []
    }
  }

  const fetchInvoiceCategories = async () => {
    try {
      setInvoiceCategories(await fetchActiveInvoiceCategories())
    } catch (error) {
      console.error('Error fetching invoice categories:', error)
    }
  }

  useEffect(() => {
    fetchBanks()
    fetchMyCompanies()
    fetchInvoiceCategories()
  }, [])

  const fetchAllocations = async (cId: string) => {
    try {
      setCreditAllocations(await fetchCreditAllocations(cId))
    } catch (error) {
      console.error('Error fetching credit allocations:', error)
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
    fetchMyCompanies
  }
}
