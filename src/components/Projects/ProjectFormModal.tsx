import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Building2, MapPin, Calendar, DollarSign, Users } from 'lucide-react'
import { Modal, FormField, Input, Select, Button, Alert } from '../ui'

interface ProjectFormModalProps {
  projectId?: string | null
  onClose: () => void
  onSuccess: () => void
}

interface ProjectForm {
  name: string
  location: string
  start_date: string
  end_date: string
  budget: string
  investor: string
  status: string
  description: string
}

const ProjectFormModal: React.FC<ProjectFormModalProps> = ({ projectId, onClose, onSuccess }) => {
  const [form, setForm] = useState<ProjectForm>({
    name: '',
    location: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    budget: '',
    investor: '',
    status: 'Planning',
    description: ''
  })
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
          investor: data.investor || '',
          status: data.status || 'Planning',
          description: ''
        })
      }
    } catch (error) {
      console.error('Error fetching project:', error)
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
        investor: form.investor.trim() || null,
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

      onSuccess()
    } catch (error: any) {
      console.error('Error saving project:', error)
      setError(error.message || 'Failed to save project')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!projectId) return

    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (error) throw error

      onSuccess()
    } catch (error: any) {
      console.error('Error deleting project:', error)
      setError(error.message || 'Failed to delete project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal show={true} onClose={onClose} size="lg">
      <Modal.Header
        title={projectId ? 'Edit Project' : 'New Project'}
        onClose={onClose}
      />
      <Modal.Body>
        <form onSubmit={handleSubmit}>
          {error && (
            <Alert variant="error" className="mb-4" onDismiss={() => setError('')}>
              {error}
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Project Name" required className="md:col-span-2">
              <Input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Kozara Residential Complex"
                required
              />
            </FormField>

            <FormField label="Location" required className="md:col-span-2">
              <Input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g., Zagreb, Croatia"
                required
              />
            </FormField>

            <FormField label="Start Date" required>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                required
              />
            </FormField>

            <FormField label="End Date (Optional)">
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </FormField>

            <FormField label="Budget (EUR)" required>
              <Input
                type="number"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </FormField>

            <FormField label="Status">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </Select>
            </FormField>

            <FormField label="Investor (Optional)" className="md:col-span-2">
              <Input
                type="text"
                value={form.investor}
                onChange={(e) => setForm({ ...form, investor: e.target.value })}
                placeholder="e.g., ABC Investment Group"
              />
            </FormField>
          </div>
        </form>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-between items-center w-full">
          {projectId && (
            <Button variant="danger" onClick={handleDelete} disabled={loading}>
              Delete Project
            </Button>
          )}
          <div className={`flex space-x-3 ${!projectId ? 'ml-auto' : ''}`}>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading} loading={loading}>
              {projectId ? 'Update Project' : 'Create Project'}
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  )
}

export default ProjectFormModal
