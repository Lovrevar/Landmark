import { useCallback } from 'react'
import { supabase, Investor, ProjectInvestment } from '../lib/supabase'
import { useSupabaseQuery } from './useSupabaseQuery'

export interface InvestorWithInvestments extends Investor {
  investments: ProjectInvestment[]
  active_investments_count: number
  total_active_amount: number
}

export function useInvestors() {
  const { data: investors, loading, error, refetch } = useSupabaseQuery<InvestorWithInvestments[]>(
    async () => {
      const { data: investorsData, error: investorsError } = await supabase
        .from('investors')
        .select('*')
        .order('name')

      if (investorsError) throw investorsError

      const { data: investmentsData, error: investmentsError } = await supabase
        .from('project_investments')
        .select('*')
        .order('investment_date', { ascending: false })

      if (investmentsError) throw investmentsError

      const investorsWithInvestments = (investorsData || []).map(investor => {
        const investorInvestments = (investmentsData || []).filter(i => i.investor_id === investor.id)
        const active_investments_count = investorInvestments.filter(i => i.status === 'active').length
        const total_active_amount = investorInvestments
          .filter(i => i.status === 'active')
          .reduce((sum, i) => sum + i.amount, 0)

        return {
          ...investor,
          investments: investorInvestments,
          active_investments_count,
          total_active_amount
        }
      })

      return { data: investorsWithInvestments, error: null }
    }
  )

  const createInvestor = useCallback(async (investorData: Partial<Investor>) => {
    const { data, error } = await supabase
      .from('investors')
      .insert(investorData)
      .select()
      .single()

    if (!error) await refetch()
    return { data, error }
  }, [refetch])

  const updateInvestor = useCallback(async (id: string, updates: Partial<Investor>) => {
    const { data, error } = await supabase
      .from('investors')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (!error) await refetch()
    return { data, error }
  }, [refetch])

  const deleteInvestor = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('investors')
      .delete()
      .eq('id', id)

    if (!error) await refetch()
    return { error }
  }, [refetch])

  return {
    investors: investors || [],
    loading,
    error,
    refetch,
    createInvestor,
    updateInvestor,
    deleteInvestor
  }
}
