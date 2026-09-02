import React, { useState, useEffect, useCallback } from 'react'
import { ProjectCategory } from '../../../../lib/supabase'
import {
  fetchProjectById,
  updateProject,
  createProject,
  deleteProject,
} from '../services/projectFormService'

interface ProjectForm {
  name: string
  location: string
  aliases: string // comma-separated in the form, stored as text[] in the DB
  start_date: string
  end_date: string
  budget: string
  status: string
  category: ProjectCategory
  description: string
}

const defaultForm: ProjectForm = {
  name: '',
  location: '',
  aliases: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  budget: '',
  status: 'Planning',
  category: 'stambeno',
  description: ''
}

// Postgres raises 42501 when an RLS policy rejects the write. Only Directors may
// insert/update/delete projects, so surface that instead of a generic failure.
// Returns a translation key; ProjectFormModal runs it through t(), which passes
// unknown strings straight through.
function toErrorMessage(err: unknown, fallback: string): string {
  const code = (err as { code?: string } | null)?.code
  if (code === '42501') return 'general_projects.error_permission_denied'
  return err instanceof Error ? err.message : fallback
}

function isPermissionError(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === '42501'
}

export function useProjectForm(
  projectId: string | null | undefined,
  onSaved: () => void,
  onDeleted: () => void
) {
  const [form, setForm] = useState<ProjectForm>(defaultForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchProject = useCallback(async () => {
    if (!projectId) return
    try {
      const data = await fetchProjectById(projectId)
      if (data) {
        setForm({
          name: data.name || '',
          location: data.location || '',
          aliases: (data.aliases ?? []).join(', '),
          start_date: data.start_date || '',
          end_date: data.end_date || '',
          budget: data.budget?.toString() || '',
          status: data.status || 'Planning',
          category: data.category || 'stambeno',
          description: ''
        })
      }
    } catch (err) {
      console.error('Error fetching project:', err)
      setError('Failed to load project data')
    }
  }, [projectId])

  useEffect(() => {
    if (projectId) {
      fetchProject()
    }
  }, [projectId, fetchProject])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
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
        aliases: form.aliases.split(',').map(a => a.trim()).filter(Boolean),
        start_date: form.start_date,
        end_date: form.end_date || null,
        budget: parseFloat(form.budget),
        status: form.status,
        category: form.category
      }

      if (projectId) {
        await updateProject(projectId, projectData)
      } else {
        await createProject(projectData)
      }

      onSaved()
    } catch (err: unknown) {
      // A permission denial is an expected outcome, not a defect - don't log it.
      if (!isPermissionError(err)) console.error('Error saving project:', err)
      setError(toErrorMessage(err, 'Failed to save project'))
    } finally {
      setLoading(false)
    }
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = () => setShowDeleteConfirm(true)

  const confirmDelete = async () => {
    if (!projectId) return
    setDeleting(true)
    try {
      await deleteProject(projectId)
      onDeleted()
    } catch (err: unknown) {
      if (!isPermissionError(err)) console.error('Error deleting project:', err)
      setError(toErrorMessage(err, 'Failed to delete project'))
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const cancelDelete = () => setShowDeleteConfirm(false)

  return { form, setForm, loading, error, setError, handleSubmit, handleDelete, confirmDelete, cancelDelete, showDeleteConfirm, deleting }
}
