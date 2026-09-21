import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../../contexts/AuthContext'
import { useToast } from '../../../../contexts/ToastContext'
import { toErrorMessage } from '../../../../lib/errorMessage'
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
})

export function useWorkLogs() {
  const toast = useToast()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [projects, setProjects] = useState<WorkLogProject[]>([])
  const [phases, setPhases] = useState<WorkLogPhase[]>([])
  const [contracts, setContracts] = useState<WorkLogContract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingLog, setEditingLog] = useState<WorkLog | null>(null)
  const [formData, setFormData] = useState<WorkLogFormData>(emptyForm())

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [projectData, logData] = await Promise.all([fetchProjects(), fetchWorkLogs()])
      setProjects(projectData)
      setWorkLogs(logData)
    } catch (err) {
      console.error('Error fetching work logs data:', err)
      // An empty diary and an unreachable one mean opposite things to a supervisor checking
      // whether anything was recorded on site.
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // The two cascading lookups below feed dropdowns in the form. A failure empties one, which the
  // form already reads as "no phases/contracts here", so it is named rather than only logged.
  const loadPhases = useCallback(async (projectId: string) => {
    try {
      setPhases(await fetchPhasesByProject(projectId))
    } catch (err) {
      console.error('Error fetching phases:', err)
      toast.error(toErrorMessage(err, t('supervision.work_logs.errors.load_phases_failed')))
    }
  }, [toast, t])

  const loadContracts = useCallback(async (phaseId: string) => {
    try {
      setContracts(await fetchContractsByPhase(phaseId))
    } catch (err) {
      console.error('Error fetching contracts:', err)
      toast.error(toErrorMessage(err, t('supervision.work_logs.errors.load_contracts_failed')))
    }
  }, [toast, t])

  useEffect(() => {
    if (formData.project_id) loadPhases(formData.project_id)
  }, [formData.project_id, loadPhases])

  useEffect(() => {
    if (formData.phase_id) loadContracts(formData.phase_id)
  }, [formData.phase_id, loadContracts])

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
      status: log.status ?? 'in_progress',
      work_description: log.work_description,
      blocker_details: log.blocker_details || '',
      notes: log.notes || '',
    })
    if (log.project_id) loadPhases(log.project_id)
    if (log.phase_id) loadContracts(log.phase_id)
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
      toast.warning(t('supervision.work_logs.errors.contract_and_description'))
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
      toast.error(t('supervision.work_logs.errors.save_failed'))
    }
  }

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = (id: string) => setPendingDeleteId(id)

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    setDeleting(true)
    try {
      await deleteWorkLog(pendingDeleteId)
      await loadData()
    } catch (err) {
      console.error('Error deleting work log:', err)
      toast.error(t('supervision.work_logs.errors.delete_failed'))
    } finally {
      setDeleting(false)
      setPendingDeleteId(null)
    }
  }

  const cancelDelete = () => setPendingDeleteId(null)

  return {
    workLogs,
    projects,
    phases,
    contracts,
    loading,
    error,
    refetch: loadData,
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
    confirmDelete,
    cancelDelete,
    pendingDeleteId,
    deleting,
  }
}
