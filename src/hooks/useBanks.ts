import { useCallback } from 'react'
import { supabase, Bank, BankCredit } from '../lib/supabase'
import { useSupabaseQuery } from './useSupabaseQuery'

export interface BankWithCredits extends Bank {
  credits: BankCredit[]
  active_credits_count: number
  total_outstanding: number
}

export function useBanks() {
  const { data: banks, loading, error, refetch } = useSupabaseQuery<BankWithCredits[]>(
    async () => {
      const { data: banksData, error: banksError } = await supabase
        .from('banks')
        .select('*')
        .order('name')

      if (banksError) throw banksError

      const { data: creditsData, error: creditsError } = await supabase
        .from('bank_credits')
        .select('*')
        .order('start_date', { ascending: false })

      if (creditsError) throw creditsError

      const banksWithCredits = (banksData || []).map(bank => {
        const bankCredits = (creditsData || []).filter(c => c.bank_id === bank.id)
        const active_credits_count = bankCredits.filter(c => c.status === 'active').length
        const total_outstanding = bankCredits
          .filter(c => c.status === 'active')
          .reduce((sum, c) => sum + c.outstanding_balance, 0)

        return {
          ...bank,
          credits: bankCredits,
          active_credits_count,
          total_outstanding
        }
      })

      return { data: banksWithCredits, error: null }
    }
  )

  const createBank = useCallback(async (bankData: Partial<Bank>) => {
    const { data, error } = await supabase
      .from('banks')
      .insert(bankData)
      .select()
      .single()

    if (!error) await refetch()
    return { data, error }
  }, [refetch])

  const updateBank = useCallback(async (id: string, updates: Partial<Bank>) => {
    const { data, error } = await supabase
      .from('banks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (!error) await refetch()
    return { data, error }
  }, [refetch])

  const deleteBank = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('banks')
      .delete()
      .eq('id', id)

    if (!error) await refetch()
    return { error }
  }, [refetch])

  const createCredit = useCallback(async (creditData: Partial<BankCredit>) => {
    const { data, error } = await supabase
      .from('bank_credits')
      .insert(creditData)
      .select()
      .single()

    if (!error) await refetch()
    return { data, error }
  }, [refetch])

  return {
    banks: banks || [],
    loading,
    error,
    refetch,
    createBank,
    updateBank,
    deleteBank,
    createCredit
  }
}
