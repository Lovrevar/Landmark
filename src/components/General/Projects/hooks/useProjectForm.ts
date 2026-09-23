import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ProjectCategory } from '../../../../lib/supabase'
import {
  fetchProjectById,
  updateProject,
  createProject,
  deleteProject,
} from '../services/projectFormService'
import { toErrorMessage, isPermissionError } from '../../../../lib/errorMessage'

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

/**
 * Postgres raises 42501 when an RLS policy rejects the write. Only Directors may
 * insert/update/delete projects, so surface that instead of a generic failure.
 *
 * Returns a translation key for that one case; ProjectFormModal runs the result through t(),
 * which passes unknown strings straight through. Everything else goes to the shared
 * `toErrorMessage`, which also refuses raw Postgres text in favour of the fallback.
 */
function toFormError(err: unknown, fallback: string): string {
  if (isPermissionError(err)) return 'general_projects.error_permission_denied'
  return toErrorMessage(err, fallback)
}

export function useProjectForm(
  projectId: string | null | undefined,
  onSaved: () => void,
  onDeleted: () => void
) {
  const { t } = useTranslation()
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
      setError(toErrorMessage(err, t('general_projects.errors.load_failed')))
    }
  }, [projectId, t])

  useEffect(() => {
    if (projectId) {
      fetchProject()
    }
  }, [projectId, fetchProject])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError(t('general_projects.form_error_name'))
      return
    }
    if (!form.location.trim()) {
      setError(t('general_projects.form_error_location'))
      return
    }
    // No budget validation: the TIC writes it, not this form. Requiring one here would block
    // creating a project before its cost plan exists — which is the normal order of work.

    setLoading(true)
    try {
      const projectData = {
        name: form.name.trim(),
        location: form.location.trim(),
        aliases: form.aliases.split(',').map(a => a.trim()).filter(Boolean),
        start_date: form.start_date,
        end_date: form.end_date || null,
        // Sent unchanged so an existing value survives a name or date edit; the TIC trigger
        // overwrites it whenever a plan is saved.
        budget: parseFloat(form.budget) || 0,
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
      setError(toFormError(err, t('general_projects.errors.save_failed')))
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
      setError(toFormError(err, t('general_projects.errors.delete_failed')))
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const cancelDelete = () => setShowDeleteConfirm(false)

  return { form, setForm, loading, error, setError, handleSubmit, handleDelete, confirmDelete, cancelDelete, showDeleteConfirm, deleting }
}
