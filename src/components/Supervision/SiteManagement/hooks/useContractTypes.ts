import { useState, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'
import { ContractType } from '../types'

export const useContractTypes = () => {
  const [contractTypes, setContractTypes] = useState<ContractType[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('contract_types')
        .select('*')
        .eq('is_active', true)
        .order('id')

      if (error) throw error
      setContractTypes(data || [])
    } catch (error) {
      console.error('Error loading contract types:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  return { contractTypes, loading, load }
}
