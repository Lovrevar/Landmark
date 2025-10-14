import { useCallback } from 'react'
import { supabase, Subcontractor } from '../lib/supabase'
import { useSupabaseQuery } from './useSupabaseQuery'

export function useSubcontractors(phaseId?: string) {
  const { data: subcontractors, loading, error, refetch } = useSupabaseQuery<Subcontractor[]>(
    async () => {
      let query = supabase
        .from('subcontractors')
        .select('*')
        .order('name')

      if (phaseId) {
        query = query.eq('phase_id', phaseId)
      }

      const { data, error } = await query
      return { data, error }
    },
    [phaseId]
  )

  const createSubcontractor = useCallback(async (subcontractorData: Partial<Subcontractor>) => {
    const { data, error } = await supabase
      .from('subcontractors')
      .insert(subcontractorData)
      .select()
      .single()

    if (!error) await refetch()
    return { data, error }
  }, [refetch])

  const updateSubcontractor = useCallback(async (id: string, updates: Partial<Subcontractor>) => {
    const { data, error } = await supabase
      .from('subcontractors')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (!error) await refetch()
    return { data, error }
  }, [refetch])

  const deleteSubcontractor = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('subcontractors')
      .delete()
      .eq('id', id)

    if (!error) await refetch()
    return { error }
  }, [refetch])

  return {
    subcontractors: subcontractors || [],
    loading,
    error,
    refetch,
    createSubcontractor,
    updateSubcontractor,
    deleteSubcontractor
  }
}
