import { ProjectPhase } from '../../../lib/supabase'
import { ProjectWithPhases, PhaseFormInput } from '../types/siteTypes'
import * as siteService from '../services/siteService'

export const useProjectPhases = (fetchProjects: () => Promise<void>) => {
  const recalculateAllPhaseBudgets = async () => {
    try {
      await siteService.recalculateAllPhaseBudgets()
    } catch (error) {
      console.error('Error recalculating phase budgets:', error)
    }
  }

  const createProjectPhases = async (projectId: string, phases: PhaseFormInput[], projectBudget: number) => {
    const totalAllocated = phases.reduce((sum, phase) => sum + phase.budget_allocated, 0)
    const budgetDifference = totalAllocated - projectBudget

    if (budgetDifference !== 0) {
      const message = budgetDifference > 0
        ? `Total allocated budget (€${totalAllocated.toLocaleString('hr-HR')}) exceeds project budget by €${Math.abs(budgetDifference).toLocaleString()}. Do you want to proceed?`
        : `Total allocated budget (€${totalAllocated.toLocaleString('hr-HR')}) is less than project budget by €${Math.abs(budgetDifference).toLocaleString()}. Do you want to proceed?`
      if (!confirm(message)) return false
    }

    try {
      await siteService.createPhases(projectId, phases)
      await fetchProjects()
      return true
    } catch (error) {
      console.error('Error creating phases:', error)
      alert('Error creating project phases.')
      return false
    }
  }

  const updatePhase = async (
    phase: ProjectPhase,
    updates: {
      phase_name: string
      budget_allocated: number
      start_date: string
      end_date: string
      status: 'planning' | 'active' | 'completed' | 'on_hold'
    },
    project: ProjectWithPhases
  ) => {
    if (!updates.phase_name.trim()) {
      alert('Phase name is required')
      return false
    }

    if (updates.budget_allocated < phase.budget_used) {
      if (!confirm(
        `Warning: New budget ($${updates.budget_allocated.toLocaleString('hr-HR')}) is less than already allocated amount (€${phase.budget_used.toLocaleString('hr-HR')}).\n\n` +
        `This means you're reducing the budget below what's already committed to subcontractors.\n\n` +
        `Do you want to proceed anyway?`
      )) return false
    }

    const otherPhasesTotalBudget = project.phases
      .filter(p => p.id !== phase.id)
      .reduce((sum, p) => sum + p.budget_allocated, 0)
    const newTotalAllocated = otherPhasesTotalBudget + updates.budget_allocated
    const projectBudgetDiff = newTotalAllocated - project.budget

    if (projectBudgetDiff !== 0) {
      const message = projectBudgetDiff > 0
        ? `Total allocated budget across all phases (€${newTotalAllocated.toLocaleString('hr-HR')}) will exceed project budget by €${Math.abs(projectBudgetDiff).toLocaleString()}. Do you want to proceed?`
        : `Total allocated budget across all phases (€${newTotalAllocated.toLocaleString('hr-HR')}) will be less than project budget by €${Math.abs(projectBudgetDiff).toLocaleString()}. Do you want to proceed?`
      if (!confirm(message)) return false
    }

    try {
      await siteService.updatePhase(phase.id, {
        phase_name: updates.phase_name,
        budget_allocated: updates.budget_allocated,
        start_date: updates.start_date || null,
        end_date: updates.end_date || null,
        status: updates.status
      })
      await fetchProjects()
      return true
    } catch (error) {
      console.error('Error updating phase:', error)
      alert('Error updating phase. Please try again.')
      return false
    }
  }

  const deletePhase = async (phase: ProjectPhase, _project: ProjectWithPhases) => {
    if (phase.budget_used > 0) {
      alert('Cannot delete phase with active subcontractor assignments. Please remove or reassign all subcontractors first.')
      return false
    }

    if (!confirm(`Are you sure you want to delete phase "${phase.phase_name}"?`)) return false

    try {
      await siteService.deletePhase(phase.id)
      const remainingPhases = _project.phases
        .filter(p => p.id !== phase.id)
        .sort((a, b) => a.phase_number - b.phase_number)
      await siteService.resequencePhases(remainingPhases)
      await fetchProjects()
      return true
    } catch (error) {
      console.error('Error deleting phase:', error)
      alert('Error deleting phase. Please try again.')
      return false
    }
  }

  const updateProjectPhases = async (projectId: string, phases: PhaseFormInput[], projectBudget: number) => {
    const totalAllocated = phases.reduce((sum, phase) => sum + phase.budget_allocated, 0)
    const budgetDifference = totalAllocated - projectBudget

    if (budgetDifference !== 0) {
      const message = budgetDifference > 0
        ? `Total allocated budget (€${totalAllocated.toLocaleString('hr-HR')}) exceeds project budget by €${Math.abs(budgetDifference).toLocaleString()}. Do you want to proceed?`
        : `Total allocated budget (€${totalAllocated.toLocaleString('hr-HR')}) is less than project budget by €${Math.abs(budgetDifference).toLocaleString()}. Do you want to proceed?`
      if (!confirm(message)) return false
    }

    try {
      await siteService.updateProjectPhases(projectId, phases)
      await fetchProjects()
      return true
    } catch (error) {
      console.error('Error updating phases:', error)
      alert('Error updating project phases.')
      return false
    }
  }

  return { recalculateAllPhaseBudgets, createProjectPhases, updatePhase, deletePhase, updateProjectPhases }
}
