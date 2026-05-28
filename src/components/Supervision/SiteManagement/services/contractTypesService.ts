import { supabase } from '../../../../lib/supabase'
import { ContractType } from '../types'

export async function fetchActiveContractTypes(): Promise<ContractType[]> {
  const { data, error } = await supabase
    .from('contract_types')
    .select('*')
    .eq('is_active', true)
    .order('id')

  if (error) throw error
  return data || []
}
