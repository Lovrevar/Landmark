import { useState, useCallback } from 'react'
import { supabase, Project } from '../lib/supabase'
import { useSupabaseQuery } from './useSupabaseQuery'

export function useProjects() {
  const { data: projects, loading, error, refetch } = useSupabaseQuery<Project[]>(
    async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('name')
      return { data, error }
    }
  )

  const createProject = useCallback(async (projectData: Partial<Project>) => {
    const { data, error } = await supabase
      .from('projects')
      .insert(projectData)
      .select()
      .single()

    if (!error) await refetch()
    return { data, error }
  }, [refetch])

  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (!error) await refetch()
    return { data, error }
  }, [refetch])

  const deleteProject = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)

    if (!error) await refetch()
    return { error }
  }, [refetch])

  return {
    projects: projects || [],
    loading,
    error,
    refetch,
    createProject,
    updateProject,
    deleteProject
  }
}
