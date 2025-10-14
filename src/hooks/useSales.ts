import { useCallback } from 'react'
import { supabase, Sale, Customer } from '../lib/supabase'
import { useSupabaseQuery } from './useSupabaseQuery'

export function useSales() {
  const { data: sales, loading, error, refetch } = useSupabaseQuery<Sale[]>(
    async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customers(name, surname, email, phone)
        `)
        .order('sale_date', { ascending: false })
      return { data, error }
    }
  )

  const createSale = useCallback(async (saleData: Partial<Sale>) => {
    const { data, error } = await supabase
      .from('sales')
      .insert(saleData)
      .select()
      .single()

    if (!error) await refetch()
    return { data, error }
  }, [refetch])

  const updateSale = useCallback(async (id: string, updates: Partial<Sale>) => {
    const { data, error } = await supabase
      .from('sales')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (!error) await refetch()
    return { data, error }
  }, [refetch])

  return {
    sales: sales || [],
    loading,
    error,
    refetch,
    createSale,
    updateSale
  }
}
