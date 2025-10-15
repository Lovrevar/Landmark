import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  ClipboardCheck,
  Plus,
  X,
  Calendar,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader,
  AlertCircle,
  Wrench,
  CloudRain,
  Package
} from 'lucide-react'
import { format } from 'date-fns'

interface WorkLog {
  id: string
  contract_id: string
  project_id: string
  phase_id: string | null
  subcontractor_id: string
  date: string
  status: 'work_finished' | 'in_progress' | 'blocker' | 'quality_issue' | 'waiting_materials' | 'weather_delay'
  work_description: string
  blocker_details: string | null
  workers_count: number
  hours_worked: number
  notes: string
  photos: string[]
  created_at: string
  contracts?: {
    contract_number: string
    job_description: string
  }
  subcontractors?: {
    name: string
  }
  projects?: {
    name: string
  }
  project_phases?: {
    phase_name: string
  }
}

interface Project {
  id: string
  name: string
}

interface Phase {
  id: string
  phase_name: string
}

interface Contract {
  id: string
  contract_number: string
  job_description: string
  subcontractor_id: string
  subcontractors?: {
    name: string
  }
}

const statusConfig = {
  work_finished: { label: 'Work Finished', icon: CheckCircle2, color: 'green' },
  in_progress: { label: 'In Progress', icon: Loader, color: 'blue' },
  blocker: { label: 'Blocker', icon: AlertTriangle, color: 'red' },
  quality_issue: { label: 'Quality Issue', icon: AlertCircle, color: 'orange' },
  waiting_materials: { label: 'Waiting Materials', icon: Package, color: 'yellow' },
  weather_delay: { label: 'Weather Delay', icon: CloudRain, color: 'gray' }
}

const WorkLogs: React.FC = () => {
  const { user } = useAuth()
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    project_id: '',
    phase_id: '',
    contract_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    status: 'in_progress' as WorkLog['status'],
    work_description: '',
    blocker_details: '',
    workers_count: 0,
    hours_worked: 0,
    notes: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (formData.project_id) {
      fetchPhases(formData.project_id)
    }
  }, [formData.project_id])

  useEffect(() => {
    if (formData.phase_id) {
      fetchContracts(formData.phase_id)
    }
  }, [formData.phase_id])

  const fetchData = async () => {
    try {
      setLoading(true)

      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .order('name')

      if (projectsError) throw projectsError

      const { data: logsData, error: logsError } = await supabase
        .from('work_logs')
        .select(`
          *,
          contracts (contract_number, job_description),
          subcontractors (name),
          projects (name),
          project_phases (phase_name)
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (logsError) throw logsError

      setProjects(projectsData || [])
      setWorkLogs(logsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPhases = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('project_phases')
        .select('id, phase_name')
        .eq('project_id', projectId)
        .order('phase_number')

      if (error) throw error
      setPhases(data || [])
    } catch (error) {
      console.error('Error fetching phases:', error)
    }
  }

  const fetchContracts = async (phaseId: string) => {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          id,
          contract_number,
          job_description,
          subcontractor_id,
          subcontractors (name)
        `)
        .eq('phase_id', phaseId)
        .in('status', ['active', 'draft'])
        .order('contract_number')

      if (error) throw error
      setContracts(data || [])
    } catch (error) {
      console.error('Error fetching contracts:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.contract_id || !formData.work_description) {
      alert('Please select a contract and provide work description')
      return
    }

    const selectedContract = contracts.find(c => c.id === formData.contract_id)
    if (!selectedContract) return

    try {
      const { error } = await supabase.from('work_logs').insert([
        {
          contract_id: formData.contract_id,
          project_id: formData.project_id,
          phase_id: formData.phase_id || null,
          subcontractor_id: selectedContract.subcontractor_id,
          date: formData.date,
          status: formData.status,
          work_description: formData.work_description,
          blocker_details: formData.status === 'blocker' ? formData.blocker_details : null,
          workers_count: formData.workers_count,
          hours_worked: formData.hours_worked,
          notes: formData.notes,
          photos: [],
          created_by: user?.id
        }
      ])

      if (error) throw error

      setShowForm(false)
      setFormData({
        project_id: '',
        phase_id: '',
        contract_id: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        status: 'in_progress',
        work_description: '',
        blocker_details: '',
        workers_count: 0,
        hours_worked: 0,
        notes: ''
      })
      fetchData()
    } catch (error) {
      console.error('Error creating work log:', error)
      alert('Failed to create work log')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading work logs...</div>
  }

  const getStatusBadge = (status: WorkLog['status']) => {
    const config = statusConfig[status]
    const Icon = config.icon
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-${config.color}-100 text-${config.color}-800`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Work Logs</h1>
          <p className="text-gray-600 mt-1">Track subcontractor activities and site observations</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Work Log
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">New Work Log</h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project *
                  </label>
                  <select
                    value={formData.project_id}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        project_id: e.target.value,
                        phase_id: '',
                        contract_id: ''
                      })
                      setPhases([])
                      setContracts([])
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select Project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phase
                  </label>
                  <select
                    value={formData.phase_id}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        phase_id: e.target.value,
                        contract_id: ''
                      })
                      setContracts([])
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={!formData.project_id}
                  >
                    <option value="">Select Phase</option>
                    {phases.map((phase) => (
                      <option key={phase.id} value={phase.id}>
                        {phase.phase_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contract *
                </label>
                <select
                  value={formData.contract_id}
                  onChange={(e) => setFormData({ ...formData, contract_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={!formData.phase_id}
                  required
                >
                  <option value="">Select Contract</option>
                  {contracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.contract_number} - {contract.subcontractors?.name} - {contract.job_description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as WorkLog['status'] })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    {Object.entries(statusConfig).map(([value, config]) => (
                      <option key={value} value={value}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Description *
                </label>
                <textarea
                  value={formData.work_description}
                  onChange={(e) => setFormData({ ...formData, work_description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Describe the work performed or observed..."
                  required
                />
              </div>

              {formData.status === 'blocker' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Blocker Details
                  </label>
                  <textarea
                    value={formData.blocker_details}
                    onChange={(e) => setFormData({ ...formData, blocker_details: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={2}
                    placeholder="Describe what is blocking the work..."
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Workers Count
                  </label>
                  <input
                    type="number"
                    value={formData.workers_count}
                    onChange={(e) => setFormData({ ...formData, workers_count: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hours Worked
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.hours_worked}
                    onChange={(e) => setFormData({ ...formData, hours_worked: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Any additional observations or notes..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Work Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <ClipboardCheck className="w-5 h-5 mr-2 text-blue-600" />
            Work Log History
          </h2>
        </div>
        <div className="p-6">
          {workLogs.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No work logs yet</p>
              <p className="text-sm text-gray-500">Start tracking subcontractor activities by creating your first work log</p>
            </div>
          ) : (
            <div className="space-y-4">
              {workLogs.map((log) => (
                <div key={log.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{log.subcontractors?.name}</h3>
                        {getStatusBadge(log.status)}
                      </div>
                      <p className="text-sm text-gray-600">
                        {log.projects?.name} {log.project_phases?.phase_name && `• ${log.project_phases.phase_name}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Contract: {log.contracts?.contract_number} - {log.contracts?.job_description}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center text-gray-600 text-sm mb-1">
                        <Calendar className="w-4 h-4 mr-1" />
                        {format(new Date(log.date), 'MMM dd, yyyy')}
                      </div>
                      <p className="text-xs text-gray-500">
                        Logged {format(new Date(log.created_at), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg mb-3">
                    <p className="text-sm text-gray-700">{log.work_description}</p>
                  </div>

                  {log.blocker_details && (
                    <div className="bg-red-50 border border-red-200 p-3 rounded-lg mb-3">
                      <p className="text-xs font-medium text-red-800 mb-1">Blocker Details:</p>
                      <p className="text-sm text-red-700">{log.blocker_details}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    {log.workers_count > 0 && (
                      <div className="bg-blue-50 p-2 rounded-lg">
                        <div className="flex items-center text-blue-600 mb-1">
                          <Users className="w-3 h-3 mr-1" />
                          <span className="text-xs font-medium">Workers</span>
                        </div>
                        <p className="text-sm font-bold text-blue-900">{log.workers_count}</p>
                      </div>
                    )}
                    {log.hours_worked > 0 && (
                      <div className="bg-purple-50 p-2 rounded-lg">
                        <div className="flex items-center text-purple-600 mb-1">
                          <Clock className="w-3 h-3 mr-1" />
                          <span className="text-xs font-medium">Hours</span>
                        </div>
                        <p className="text-sm font-bold text-purple-900">{log.hours_worked}</p>
                      </div>
                    )}
                  </div>

                  {log.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-700 mb-1">Notes:</p>
                      <p className="text-sm text-gray-600">{log.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default WorkLogs
