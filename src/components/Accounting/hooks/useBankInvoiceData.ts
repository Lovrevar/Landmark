import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import type { BankCompany, BankCredit, MyCompany, InvoiceCategory } from '../types/bankInvoiceTypes'

export const useBankInvoiceData = (bankId: string) => {
  const [banks, setBanks] = useState<BankCompany[]>([])
  const [credits, setCredits] = useState<BankCredit[]>([])
  const [myCompanies, setMyCompanies] = useState<MyCompany[]>([])
  const [invoiceCategories, setInvoiceCategories] = useState<InvoiceCategory[]>([])

  const fetchBanks = async () => {
    try {
      const { data, error } = await supabase
        .from('banks')
        .select('id, name, contact_person, contact_email')
        .order('name')

      if (error) throw error
      setBanks(data || [])
    } catch (error) {
      console.error('Error fetching banks:', error)
      alert('Greška pri učitavanju banaka')
    }
  }

  const fetchCredits = async (bankId: string) => {
    try {
      const { data, error } = await supabase
        .from('bank_credits')
        .select('id, company_id, credit_name, amount, outstanding_balance')
        .eq('bank_id', bankId)
        .order('credit_name')

      if (error) throw error
      setCredits(data || [])
    } catch (error) {
      console.error('Error fetching credits:', error)
      setCredits([])
    }
  }

  const fetchMyCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('accounting_companies')
        .select('id, name')
        .order('name')

      if (error) throw error
      setMyCompanies(data || [])
      return data
    } catch (error) {
      console.error('Error fetching companies:', error)
      return []
    }
  }

  const fetchInvoiceCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_categories')
        .select('id, name')
        .eq('is_active', true)
        .order('sort_order')

      if (!error) {
        setInvoiceCategories(data || [])
      }
    } catch (error) {
      console.error('Error fetching invoice categories:', error)
    }
  }

  useEffect(() => {
    fetchBanks()
    fetchMyCompanies()
    fetchInvoiceCategories()
  }, [])

  useEffect(() => {
    if (bankId) {
      fetchCredits(bankId)
    } else {
      setCredits([])
    }
  }, [bankId])

  return {
    banks,
    credits,
    myCompanies,
    invoiceCategories,
    fetchMyCompanies
  }
}
