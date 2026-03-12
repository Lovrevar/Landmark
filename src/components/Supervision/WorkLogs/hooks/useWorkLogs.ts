import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { useAuth } from '../../../../contexts/AuthContext'
import type { WorkLog, WorkLogProject, WorkLogPhase, WorkLogContract, WorkLogFormData } from '../services/workLogService'
import {
  fetchProjects,
  fetchWorkLogs,
  fetchPhasesByProject,
  fetchContractsByPhase,
  createWorkLog,
  updateWorkLog,
  deleteWorkLog,
} from '../services/workLogService'

const emptyForm = (): WorkLogFormData => ({
  project_id: '',
  phase_id: '',
  contract_id: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  status: 'in_progress',
  work_description: '',
  blocker_details: '',
  notes: '',
  color: 'blue',
})

export function useWorkLogs() {
  const { user } = useAuth()
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [projects, setProjects] = useState<WorkLogProject[]>([])
  const [phases, setPhases] = useState<WorkLogPhase[]>([])
  const [contracts, setContracts] = useState<WorkLogContract[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingLog, setEditingLog] = useState<WorkLog | null>(null)
  const [formData, setFormData] = useState<WorkLogFormData>(emptyForm())

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [projectData, logData] = await Promise.all([fetchProjects(), fetchWorkLogs()])
      setProjects(projectData)
      setWorkLogs(logData)
    } catch (err) {
      console.error('Error fetching work logs data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (formData.project_id) {
      fetchPhasesByProject(formData.project_id).then(setPhases).catch(console.error)
    }
  }, [formData.project_id])

  useEffect(() => {
    if (formData.phase_id) {
      fetchContractsByPhase(formData.phase_id).then(setContracts).catch(console.error)
    }
  }, [formData.phase_id])

  const openNewForm = () => {
    setEditingLog(null)
    setFormData(emptyForm())
    setShowForm(true)
  }

  const openEditForm = (log: WorkLog) => {
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
      color: log.color,
    })
    if (log.project_id) fetchPhasesByProject(log.project_id).then(setPhases).catch(console.error)
    if (log.phase_id) fetchContractsByPhase(log.phase_id).then(setContracts).catch(console.error)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingLog(null)
  }

  const handleProjectChange = (projectId: string) => {
    setFormData(prev => ({ ...prev, project_id: projectId, phase_id: '', contract_id: '' }))
    setPhases([])
    setContracts([])
  }

  const handlePhaseChange = (phaseId: string) => {
    setFormData(prev => ({ ...prev, phase_id: phaseId, contract_id: '' }))
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
        await updateWorkLog(editingLog.id, formData, selectedContract.subcontractor_id)
      } else {
        await createWorkLog(formData, selectedContract.subcontractor_id, user?.id)
      }
      closeForm()
      await loadData()
    } catch (err) {
      console.error('Error saving work log:', err)
      alert('Failed to save work log')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this work log?')) return
    try {
      await deleteWorkLog(id)
      await loadData()
    } catch (err) {
      console.error('Error deleting work log:', err)
      alert('Failed to delete work log')
    }
  }

  return {
    workLogs,
    projects,
    phases,
    contracts,
    loading,
    showForm,
    editingLog,
    formData,
    setFormData,
    openNewForm,
    openEditForm,
    closeForm,
    handleProjectChange,
    handlePhaseChange,
    handleSubmit,
    handleDelete,
  }
}
