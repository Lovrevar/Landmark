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

  const handleDeleteMilestone = async (milestoneId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this milestone?')) return
    try {
      await svcDeleteMilestone(milestoneId)
      onMutated()
    } catch (error) {
      console.error('Error deleting milestone:', error)
      toast.error('Error deleting milestone.')
    }
  }

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
    handleToggleMilestone
  }
}
