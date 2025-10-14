import { useCallback } from 'react'
import { supabase, Customer } from '../lib/supabase'
import { useSupabaseQuery } from './useSupabaseQuery'

export function useCustomers() {
  const { data: customers, loading, error, refetch } = useSupabaseQuery<Customer[]>(
    async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name')
      return { data, error }
    }
  )

  const createCustomer = useCallback(async (customerData: Partial<Customer>) => {
    const { data, error } = await supabase
      .from('customers')
      .insert(customerData)
      .select()
      .single()

    if (!error) await refetch()
    return { data, error }
  }, [refetch])

  const updateCustomer = useCallback(async (id: string, updates: Partial<Customer>) => {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (!error) await refetch()
    return { data, error }
  }, [refetch])

  const deleteCustomer = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)

    if (!error) await refetch()
    return { error }
  }, [refetch])

  return {
    customers: customers || [],
    loading,
    error,
    refetch,
    createCustomer,
    updateCustomer,
    deleteCustomer
  }
}
