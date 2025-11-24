import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X, Building2, MapPin, Calendar, DollarSign, Users, AlertTriangle, FileText } from 'lucide-react'

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Building2 className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              {projectId ? 'Edit Project' : 'New Project'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Name *
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Kozara Residential Complex"
                  required
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location *
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Zagreb, Croatia"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date (Optional)
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Budget (€) *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="number"
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Investor (Optional)
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={form.investor}
                  onChange={(e) => setForm({ ...form, investor: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., ABC Investment Group"
                />
              </div>
            </div>
          </div>
        </form>

        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          {projectId && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300 transition-colors duration-200"
            >
              Delete Project
            </button>
          )}
          <div className={`flex space-x-3 ${!projectId ? 'ml-auto' : ''}`}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors duration-200"
            >
              {loading ? 'Saving...' : projectId ? 'Update Project' : 'Create Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProjectFormModal
