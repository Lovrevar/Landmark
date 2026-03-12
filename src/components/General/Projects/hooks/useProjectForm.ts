import React, { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'

interface ProjectForm {
  name: string
  location: string
  start_date: string
  end_date: string
  budget: string
  status: string
  description: string
}

const defaultForm: ProjectForm = {
  name: '',
  location: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  budget: '',
  status: 'Planning',
  description: ''
}

export function useProjectForm(
  projectId: string | null | undefined,
  onSaved: () => void,
  onDeleted: () => void
) {
  const [form, setForm] = useState<ProjectForm>(defaultForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (projectId) {
      fetchProject()
    }
  }, [projectId])

  const fetchProject = async () => {
    if (!projectId) return
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (error) throw error

      if (data) {
        setForm({
          name: data.name || '',
          location: data.location || '',
          start_date: data.start_date || '',
          end_date: data.end_date || '',
          budget: data.budget?.toString() || '',
          status: data.status || 'Planning',
          description: ''
        })
      }
    } catch (err) {
      console.error('Error fetching project:', err)
      setError('Failed to load project data')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError('Project name is required')
      return
    }
    if (!form.location.trim()) {
      setError('Location is required')
      return
    }
    if (!form.budget || parseFloat(form.budget) <= 0) {
      setError('Valid budget is required')
      return
    }

    setLoading(true)
    try {
      const projectData = {
        name: form.name.trim(),
        location: form.location.trim(),
        start_date: form.start_date,
        end_date: form.end_date || null,
        budget: parseFloat(form.budget),
        status: form.status
      }

      if (projectId) {
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', projectId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('projects')
          .insert([projectData])
        if (error) throw error
      }

      onSaved()
    } catch (err: unknown) {
      console.error('Error saving project:', err)
      setError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!projectId) return
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
      if (error) throw error
      onDeleted()
    } catch (err: unknown) {
      console.error('Error deleting project:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete project')
    } finally {
      setLoading(false)
    }
  }

  return { form, setForm, loading, error, setError, handleSubmit, handleDelete }
}
