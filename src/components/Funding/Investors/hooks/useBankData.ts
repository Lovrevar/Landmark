import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import type { BankWithCredits, Company } from '../types'

export function useBankData() {
  const [banks, setBanks] = useState<BankWithCredits[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: banksData, error: banksError } = await supabase
        .from('banks')
        .select('*')
        .order('name')

      if (banksError) throw banksError

      const { data: companiesData, error: companiesError } = await supabase
        .from('accounting_companies')
        .select('id, name, oib')
        .order('name')

      if (companiesError) throw companiesError

      const { data: creditsData, error: creditsError } = await supabase
        .from('bank_credits')
        .select(`
          *,
          used_amount,
          repaid_amount,
          projects(name),
          accounting_companies(name)
        `)
        .order('start_date', { ascending: false })

      if (creditsError) throw creditsError

      const banksWithCredits = (banksData || []).map(bank => {
        const bankCredits = (creditsData || []).filter(credit => credit.bank_id === bank.id)
        const total_credits = bankCredits.length
        const active_credits = bankCredits.filter(credit => credit.status === 'active').length
        const credit_utilized = bankCredits.reduce((sum, credit) => sum + Number(credit.amount || 0), 0)
        const outstanding_debt = bankCredits.reduce((sum, credit) => sum + Number(credit.outstanding_balance || 0), 0)
        const available_funds = bank.total_credit_limit - credit_utilized
        const total_used = bankCredits.reduce((sum, credit) => sum + Number(credit.used_amount || 0), 0)
        const credit_utilization = credit_utilized > 0
          ? (total_used / credit_utilized) * 100
          : 0

        return {
          ...bank,
          credit_utilized,
          outstanding_debt,
          available_funds,
          credits: bankCredits,
          total_credits,
          active_credits,
          credit_utilization
        }
      })

      setBanks(banksWithCredits)
      setCompanies(companiesData || [])
    } catch (error) {
      console.error('Error fetching banks data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const addBank = async (newBank: { name: string; contact_person: string; contact_email: string; contact_phone: string }, onDone: () => void) => {
    if (!newBank.name.trim()) {
      alert('Please enter bank name')
      return
    }
    try {
      const { error } = await supabase.from('banks').insert(newBank)
      if (error) throw error
      onDone()
      await fetchData()
    } catch (error) {
      console.error('Error adding bank:', error)
      alert('Error adding bank. Please try again.')
    }
  }

  const updateBank = async (
    editingBank: { id: string },
    newBank: { name: string; contact_person: string; contact_email: string; contact_phone: string },
    onDone: () => void
  ) => {
    if (!newBank.name.trim()) return
    try {
      const { error } = await supabase.from('banks').update(newBank).eq('id', editingBank.id)
      if (error) throw error
      onDone()
      await fetchData()
    } catch (error) {
      console.error('Error updating bank:', error)
      alert('Error updating bank.')
    }
  }

  const deleteBank = async (bankId: string) => {
    if (!confirm('Are you sure you want to delete this bank? This will also delete all associated credits.')) return
    try {
      const { error } = await supabase.from('banks').delete().eq('id', bankId)
      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('Error deleting bank:', error)
      alert('Error deleting bank.')
    }
  }

  return { banks, companies, loading, fetchData, addBank, updateBank, deleteBank }
}
