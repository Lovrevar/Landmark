import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  ClipboardCheck,
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Loader,
  AlertCircle,
  CloudRain,
  Package,
  Edit2,
  Trash2,
  Palette,
  Wrench
} from 'lucide-react'
import { LoadingSpinner, PageHeader, Modal, Button, Badge, Input, Select, Textarea, Card, EmptyState } from '../ui'
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
  notes: string
  color: string
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
  const [editingLog, setEditingLog] = useState<WorkLog | null>(null)
  const [formData, setFormData] = useState({
    project_id: '',
    phase_id: '',
    contract_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    status: 'in_progress' as WorkLog['status'],
    work_description: '',
    blocker_details: '',
    notes: '',
    color: 'blue'
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
          contracts!work_logs_contract_id_fkey (contract_number, job_description),
          subcontractors!work_logs_subcontractor_id_fkey (name),
          projects!work_logs_project_id_fkey (name),
          project_phases!work_logs_phase_id_fkey (phase_name)
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
        .select('id, contract_number, job_description, subcontractor_id, status, subcontractors!contracts_subcontractor_id_fkey(name)')
        .eq('phase_id', phaseId)
        .in('status', ['active', 'draft'])
        .order('contract_number')

      if (error) {
        console.error('Error fetching contracts:', error)
        throw error
      }

      console.log('Fetched contracts for phase:', phaseId, 'Count:', data?.length)
      setContracts(data || [])
    } catch (error) {
      console.error('Error fetching contracts:', error)
      setContracts([])
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
      if (editingLog) {
        const { error } = await supabase
          .from('work_logs')
          .update({
            contract_id: formData.contract_id,
            project_id: formData.project_id,
            phase_id: formData.phase_id || null,
            subcontractor_id: selectedContract.subcontractor_id,
            date: formData.date,
            status: formData.status,
            work_description: formData.work_description,
            blocker_details: formData.status === 'blocker' || formData.status === 'quality_issue' ? formData.blocker_details : null,
            notes: formData.notes,
            color: formData.color
          })
          .eq('id', editingLog.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('work_logs').insert([
          {
            contract_id: formData.contract_id,
            project_id: formData.project_id,
            phase_id: formData.phase_id || null,
            subcontractor_id: selectedContract.subcontractor_id,
            date: formData.date,
            status: formData.status,
            work_description: formData.work_description,
            blocker_details: formData.status === 'blocker' || formData.status === 'quality_issue' ? formData.blocker_details : null,
            notes: formData.notes,
            color: formData.color,
            created_by: user?.id
          }
        ])

        if (error) throw error
      }

      setShowForm(false)
      setEditingLog(null)
      setFormData({
        project_id: '',
        phase_id: '',
        contract_id: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        status: 'in_progress',
        work_description: '',
        blocker_details: '',
        notes: '',
        color: 'blue'
      })
      fetchData()
    } catch (error) {
      console.error('Error saving work log:', error)
      alert('Failed to save work log')
    }
  }

  const handleEdit = (log: WorkLog) => {
    setEditingLog(log)
    setFormData({
      project_id: log.project_id,
      phase_id: log.phase_id || '',
      contract_id: log.contract_id,
      date: log.date,
      status: log.status,
      work_description: log.work_description,
      blocker_details: log.blocker_details || '',
      notes: log.notes || '',
      color: log.color
    })
    if (log.project_id) fetchPhases(log.project_id)
    if (log.phase_id) fetchContracts(log.phase_id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this work log?')) return

    try {
      const { error } = await supabase
        .from('work_logs')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error deleting work log:', error)
      alert('Failed to delete work log')
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading work logs..." />
  }

  const getStatusBadge = (status: WorkLog['status']) => {
    const config = statusConfig[status]
    const Icon = config.icon

    const variantMap: Record<string, 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'orange'> = {
      green: 'green',
      red: 'red',
      yellow: 'yellow',
      blue: 'blue',
      gray: 'gray',
      orange: 'orange'
    }

    return (
      <Badge variant={variantMap[config.color] || 'gray'}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Logs"
        description="Track subcontractor activities and site observations"
        actions={
          <Button
            icon={Plus}
            onClick={() => {
              setEditingLog(null)
              setFormData({
                project_id: '',
                phase_id: '',
                contract_id: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                status: 'in_progress',
                work_description: '',
                blocker_details: '',
                notes: '',
                color: 'blue'
              })
              setShowForm(true)
            }}
          >
            New Work Log
          </Button>
        }
      />

      <Modal
        show={showForm}
        onClose={() => {
          setShowForm(false)
          setEditingLog(null)
        }}
        size="md"
      >
        <Modal.Header
          title={editingLog ? 'Edit Work Log' : 'New Work Log'}
          onClose={() => {
            setShowForm(false)
            setEditingLog(null)
          }}
        />

        <form onSubmit={handleSubmit}>
          <Modal.Body>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project *
                  </label>
                  <Select
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
                    required
                  >
                    <option value="">Select Project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phase *
                  </label>
                  <Select
                    value={formData.phase_id}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        phase_id: e.target.value,
                        contract_id: ''
                      })
                    }}
                    disabled={!formData.project_id}
                    required
                  >
                    <option value="">Select Phase</option>
                    {phases.map((phase) => (
                      <option key={phase.id} value={phase.id}>
                        {phase.phase_name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contract *
                </label>
                <Select
                  value={formData.contract_id}
                  onChange={(e) => setFormData({ ...formData, contract_id: e.target.value })}
                  disabled={!formData.phase_id}
                  required
                >
                  <option value="">
                    {!formData.phase_id
                      ? 'Select Phase First'
                      : contracts.length === 0
                        ? 'No active contracts in this phase'
                        : 'Select Contract'}
                  </option>
                  {contracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.contract_number} - {contract.subcontractors?.name} - {contract.job_description}
                    </option>
                  ))}
                </Select>
                {formData.phase_id && contracts.length === 0 && (
                  <p className="text-sm text-amber-600 mt-1">
                    No active contracts found for this phase. Make sure contracts exist in Site Management.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date *
                  </label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status *
                  </label>
                  <Select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as WorkLog['status'] })}
                    required
                  >
                    {Object.entries(statusConfig).map(([value, config]) => (
                      <option key={value} value={value}>
                        {config.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Description *
                </label>
                <Textarea
                  value={formData.work_description}
                  onChange={(e) => setFormData({ ...formData, work_description: e.target.value })}
                  rows={3}
                  placeholder="Describe the work performed or observed..."
                  required
                />
              </div>

              {(formData.status === 'blocker' || formData.status === 'quality_issue') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {formData.status === 'blocker' ? 'Blocker Details' : 'Issue Details'}
                  </label>
                  <Textarea
                    value={formData.blocker_details}
                    onChange={(e) => setFormData({ ...formData, blocker_details: e.target.value })}
                    rows={2}
                    placeholder={formData.status === 'blocker' ? 'Describe what is blocking the work...' : 'Describe the quality issue...'}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes
                </label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Any additional observations or notes..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Palette className="w-4 h-4 inline mr-1" />
                  Color (for dashboard)
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {['blue', 'green', 'red', 'yellow', 'orange', 'purple', 'pink', 'gray'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`h-10 rounded-lg border-2 transition-all ${
                        formData.color === color ? 'border-gray-900 scale-110' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color === 'yellow' ? '#fbbf24' : color === 'orange' ? '#f97316' : color === 'purple' ? '#a855f7' : color === 'pink' ? '#ec4899' : color === 'gray' ? '#6b7280' : color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
          </Modal.Body>

          <Modal.Footer>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {editingLog ? 'Update Work Log' : 'Create Work Log'}
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      <Card variant="default" padding="none">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <ClipboardCheck className="w-5 h-5 mr-2 text-blue-600" />
            Work Log History
          </h2>
        </div>
        <div className="p-6">
          {workLogs.length === 0 ? (
            <Card variant="bordered" padding="lg" className="bg-gray-50">
              <EmptyState
                icon={Wrench}
                title="No work logs yet"
                description="Start tracking subcontractor activities by creating your first work log"
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {workLogs.map((log) => (
                <div
                  key={log.id}
                  className="border-l-4 rounded-lg hover:shadow-md transition-shadow bg-white border border-gray-200"
                  style={{ borderLeftColor: log.color || 'blue' }}
                >
                  <Card variant="bordered" padding="md">
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
                      <div className="flex items-start space-x-2">
                        <div className="text-right mr-2">
                          <div className="flex items-center text-gray-600 text-sm mb-1">
                            <Calendar className="w-4 h-4 mr-1" />
                            {format(new Date(log.date), 'MMM dd, yyyy')}
                          </div>
                          <p className="text-xs text-gray-500">
                            Logged {format(new Date(log.created_at), 'MMM dd, HH:mm')}
                          </p>
                        </div>
                        <Button
                          size="icon-md"
                          variant="ghost"
                          icon={Edit2}
                          onClick={() => handleEdit(log)}
                          title="Edit"
                          className="text-blue-600 hover:bg-blue-50"
                        />
                        <Button
                          size="icon-md"
                          variant="ghost"
                          icon={Trash2}
                          onClick={() => handleDelete(log.id)}
                          title="Delete"
                          className="text-red-600 hover:bg-red-50"
                        />
                      </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg mb-3">
                      <p className="text-sm text-gray-700">{log.work_description}</p>
                    </div>

                    {log.blocker_details && (
                      <div className="bg-red-50 border border-red-200 p-3 rounded-lg mb-3">
                        <p className="text-xs font-medium text-red-800 mb-1">
                          {log.status === 'blocker' ? 'Blocker Details:' : 'Issue Details:'}
                        </p>
                        <p className="text-sm text-red-700">{log.blocker_details}</p>
                      </div>
                    )}

                    {log.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-700 mb-1">Notes:</p>
                        <p className="text-sm text-gray-600">{log.notes}</p>
                      </div>
                    )}
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

export default WorkLogs
