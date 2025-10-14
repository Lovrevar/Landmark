import { useState, useCallback } from 'react'
import { supabase, Apartment } from '../lib/supabase'
import { useSupabaseQuery } from './useSupabaseQuery'

export function useApartments(projectId?: string) {
  const { data: apartments, loading, error, refetch } = useSupabaseQuery<Apartment[]>(
    async () => {
      let query = supabase
        .from('apartments')
        .select('*')
        .order('floor')
        .order('number')

      if (projectId) {
        query = query.eq('project_id', projectId)
      }

      const { data, error } = await query
      return { data, error }
    },
    [projectId]
  )

  const createApartment = useCallback(async (apartmentData: Partial<Apartment>) => {
    const { data, error } = await supabase
      .from('apartments')
      .insert(apartmentData)
      .select()
      .single()

    if (!error) await refetch()
    return { data, error }
  }, [refetch])

  const updateApartment = useCallback(async (id: string, updates: Partial<Apartment>) => {
    const { data, error } = await supabase
      .from('apartments')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (!error) await refetch()
    return { data, error }
  }, [refetch])

  const deleteApartment = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('apartments')
      .delete()
      .eq('id', id)

    if (!error) await refetch()
    return { error }
  }, [refetch])

  const bulkCreateApartments = useCallback(async (apartmentsData: Partial<Apartment>[]) => {
    const { data, error } = await supabase
      .from('apartments')
      .insert(apartmentsData)
      .select()

    if (!error) await refetch()
    return { data, error }
  }, [refetch])

  return {
    apartments: apartments || [],
    loading,
    error,
    refetch,
    createApartment,
    updateApartment,
    deleteApartment,
    bulkCreateApartments
  }
}
