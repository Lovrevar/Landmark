import { useState } from 'react'
import type { ProjectMilestone } from '../../../../lib/supabase'
import {
  addMilestone as svcAddMilestone,
  updateMilestone as svcUpdateMilestone,
  deleteMilestone as svcDeleteMilestone,
  toggleMilestoneCompletion as svcToggleMilestone
} from '../Services/milestoneService'
import { useToast } from '../../../../contexts/ToastContext'

interface MilestoneFormData {
  name: string
  due_date: string | null
  completed: boolean
}

export function useMilestoneManagement(projectId: string | undefined, onMutated: () => void) {
  const toast = useToast()
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null)

  const handleAddMilestone = async (data: MilestoneFormData): Promise<void> => {
    if (!data.name.trim() || !projectId) {
      toast.warning('Please enter milestone name')
      return
    }
    try {
      await svcAddMilestone(projectId, { name: data.name, due_date: data.due_date, completed: data.completed })
      onMutated()
    } catch (error) {
      console.error('Error adding milestone:', error)
      toast.error('Error adding milestone. Please try again.')
    }
  }

  const handleUpdateMilestone = async (id: string, data: MilestoneFormData): Promise<void> => {
    if (!data.name.trim()) return
    try {
      await svcUpdateMilestone(id, { name: data.name, due_date: data.due_date, completed: data.completed })
      onMutated()
    } catch (error) {
      console.error('Error updating milestone:', error)
      toast.error('Error updating milestone.')
    }
  }

  const [pendingDeleteMilestoneId, setPendingDeleteMilestoneId] = useState<string | null>(null)
  const [deletingMilestone, setDeletingMilestone] = useState(false)

  const handleDeleteMilestone = (milestoneId: string) => setPendingDeleteMilestoneId(milestoneId)

  const confirmDeleteMilestone = async () => {
    if (!pendingDeleteMilestoneId) return
    setDeletingMilestone(true)
    try {
      await svcDeleteMilestone(pendingDeleteMilestoneId)
      onMutated()
    } catch (error) {
      console.error('Error deleting milestone:', error)
      toast.error('Error deleting milestone.')
    } finally {
      setDeletingMilestone(false)
      setPendingDeleteMilestoneId(null)
    }
  }

  const cancelDeleteMilestone = () => setPendingDeleteMilestoneId(null)

  const handleToggleMilestone = async (milestoneId: string, completed: boolean): Promise<void> => {
    try {
      await svcToggleMilestone(milestoneId, completed)
      onMutated()
    } catch (error) {
      console.error('Error updating milestone:', error)
    }
  }

  return {
    editingMilestone,
    setEditingMilestone,
    handleAddMilestone,
    handleUpdateMilestone,
    handleDeleteMilestone,
    confirmDeleteMilestone,
    cancelDeleteMilestone,
    pendingDeleteMilestoneId,
    deletingMilestone,
    handleToggleMilestone
  }
}
