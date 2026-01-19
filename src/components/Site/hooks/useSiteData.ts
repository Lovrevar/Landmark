import { useState, useEffect } from 'react'
import { ProjectPhase, Subcontractor } from '../../../lib/supabase'
import { ProjectWithPhases, PhaseFormInput } from '../types/siteTypes'
import * as siteService from '../services/siteService'

export const useSiteData = () => {
  const [projects, setProjects] = useState<ProjectWithPhases[]>([])
  const [loading, setLoading] = useState(true)
  const [existingSubcontractors, setExistingSubcontractors] = useState<Subcontractor[]>([])

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const projectsData = await siteService.fetchAllProjects()
      const phasesData = await siteService.fetchProjectPhases()
      const subcontractorsWithPhaseData = await siteService.fetchSubcontractorsWithPhases()
      const allSubcontractorsData = await siteService.fetchAllSubcontractors()

      setExistingSubcontractors(allSubcontractorsData)

      const projectsWithPhases = projectsData.map(project => {
        const projectPhases = phasesData.filter(phase => phase.project_id === project.id)
        const projectSubcontractors = subcontractorsWithPhaseData.filter(sub => {
          return projectPhases.some(phase => phase.id === sub.phase_id)
        })

        const total_budget_realized = projectSubcontractors.reduce((sum, sub) => sum + sub.budget_realized, 0)
        const total_subcontractor_cost = projectSubcontractors.reduce((sum, sub) => sum + sub.cost, 0)
        const completion_percentage = total_subcontractor_cost > 0
          ? Math.round((total_budget_realized / total_subcontractor_cost) * 100)
          : 0

        const overdue_subcontractors = projectSubcontractors.filter(sub =>
          new Date(sub.deadline) < new Date() && sub.budget_realized < sub.cost
        ).length

        const has_phases = projectPhases.length > 0
        const total_budget_allocated = projectPhases.reduce((sum, phase) => sum + phase.budget_allocated, 0)
        const total_paid_out = projectSubcontractors.reduce((sum, sub) => sum + (sub.budget_realized || 0), 0)

        return {
          ...project,
          phases: projectPhases,
          subcontractors: projectSubcontractors,
          completion_percentage,
          total_subcontractor_cost,
          overdue_subcontractors,
          has_phases,
          total_budget_allocated,
          total_paid_out
        }
      })

      setProjects(projectsWithPhases)
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

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

      if (!confirm(message)) {
        return false
      }
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
      )) {
        return false
      }
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

      if (!confirm(message)) {
        return false
      }
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

  const deletePhase = async (phase: ProjectPhase, project: ProjectWithPhases) => {
    if (phase.budget_used > 0) {
      alert('Cannot delete phase with active subcontractor assignments. Please remove or reassign all subcontractors first.')
      return false
    }

    if (!confirm(`Are you sure you want to delete phase "${phase.phase_name}"?`)) {
      return false
    }

    try {
      await siteService.deletePhase(phase.id)

      const remainingPhases = project.phases
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

  const addSubcontractorToPhase = async (
    phase: ProjectPhase,
    data: {
      useExisting: boolean
      existing_subcontractor_id?: string
      name?: string
      contact?: string
      job_description: string
      deadline: string
      cost: number
    }
  ) => {
    try {
      if (data.useExisting) {
        if (!data.existing_subcontractor_id) {
          alert('Please select a subcontractor')
          return false
        }

        if (data.cost > phase.budget_allocated - phase.budget_used) {
          alert('Contract cost exceeds available phase budget')
          return false
        }

        const phaseData = await siteService.getPhaseInfo(phase.id)
        const timestamp = Date.now().toString().slice(-6)
        const contractCount = await siteService.getContractCount()
        const contractNumber = `CNT-${new Date().getFullYear()}-${String(contractCount + 1).padStart(4, '0')}-${timestamp}`

        const newContract = await siteService.createContract({
          contract_number: contractNumber,
          project_id: phaseData.project_id,
          phase_id: phase.id,
          subcontractor_id: data.existing_subcontractor_id,
          job_description: data.job_description,
          contract_amount: data.cost,
          budget_realized: 0,
          end_date: data.deadline,
          status: 'active'
        })

        await siteService.updatePhase(phase.id, {
          budget_used: phase.budget_used + data.cost
        })
      } else {
        if (!data.name?.trim() || !data.contact?.trim()) {
          alert('Please fill in required fields')
          return false
        }

        if (data.cost > phase.budget_allocated - phase.budget_used) {
          alert('Contract cost exceeds available phase budget')
          return false
        }

        const phaseData = await siteService.getPhaseInfo(phase.id)
        const timestamp = Date.now().toString().slice(-6)
        const contractCount = await siteService.getContractCount()
        const contractNumber = `CNT-${new Date().getFullYear()}-${String(contractCount + 1).padStart(4, '0')}-${timestamp}`

        const newSubcontractor = await siteService.createSubcontractorWithReturn({
          name: data.name,
          contact: data.contact
        })

        const newContract = await siteService.createContract({
          contract_number: contractNumber,
          project_id: phaseData.project_id,
          phase_id: phase.id,
          subcontractor_id: newSubcontractor.id,
          job_description: data.job_description,
          contract_amount: data.cost,
          budget_realized: 0,
          end_date: data.deadline,
          status: 'active'
        })
      }

      await siteService.recalculatePhaseBudget(phase.id)
      await fetchProjects()
      return true
    } catch (error: any) {
      console.error('Error adding subcontractor:', error)
      if (error.message?.includes('duplicate key value violates unique constraint')) {
        alert('Contract number already exists. Please try again.')
      } else {
        alert('Error adding subcontractor to phase.')
      }
      return false
    }
  }

  const updateSubcontractor = async (subcontractor: Subcontractor) => {
    try {
      await siteService.updateSubcontractor(subcontractor.id, {
        name: subcontractor.name,
        contact: subcontractor.contact,
        job_description: subcontractor.job_description,
        deadline: subcontractor.deadline,
        cost: subcontractor.cost,
        progress: subcontractor.progress || 0
      })

      if (subcontractor.phase_id) {
        await siteService.recalculatePhaseBudget(subcontractor.phase_id)
      }

      await fetchProjects()
      return true
    } catch (error) {
      console.error('Error updating subcontractor:', error)
      alert('Error updating subcontractor.')
      return false
    }
  }

  const deleteSubcontractor = async (subcontractorId: string) => {
    if (!confirm('Are you sure you want to delete this subcontractor?')) {
      return false
    }

    try {
      const subcontractor = await siteService.getSubcontractorDetails(subcontractorId)
      await siteService.deleteSubcontractor(subcontractorId)

      if (subcontractor.phase_id) {
        await siteService.recalculatePhaseBudget(subcontractor.phase_id)
      }

      await fetchProjects()
      return true
    } catch (error) {
      console.error('Error deleting subcontractor:', error)
      alert('Error deleting subcontractor.')
      return false
    }
  }

  const addPaymentToSubcontractor = async (
    subcontractor: Subcontractor,
    amount: number,
    paymentDate: string,
    notes: string,
    userId: string,
    milestoneId?: string,
    paidByType?: 'investor' | 'bank' | null,
    paidByInvestorId?: string | null,
    paidByBankId?: string | null
  ) => {
    console.log('addPaymentToSubcontractor called', {
      subcontractor,
      amount,
      paymentDate,
      notes,
      userId,
      milestoneId,
      paidByType,
      paidByInvestorId,
      paidByBankId
    })

    if (amount <= 0) {
      alert('Please enter a valid payment amount')
      return false
    }

    try {
      const currentBudgetRealized = subcontractor.budget_realized || 0
      let contractId = subcontractor.contract_id

      console.log('Current budget realized:', currentBudgetRealized)
      console.log('Contract ID:', contractId)

      if (!contractId && subcontractor.phase_id) {
        console.log('Creating new contract for subcontractor')
        const phaseData = await siteService.getPhaseInfo(subcontractor.phase_id)
        const timestamp = Date.now().toString().slice(-6)
        const contractCount = await siteService.getContractCount()
        const contractNumber = `CNT-${new Date().getFullYear()}-${String(contractCount + 1).padStart(4, '0')}-${timestamp}`

        const newContract = await siteService.createContract({
          contract_number: contractNumber,
          project_id: phaseData.project_id,
          phase_id: subcontractor.phase_id,
          subcontractor_id: subcontractor.id,
          job_description: subcontractor.job_description || 'Construction work',
          contract_amount: subcontractor.cost,
          budget_realized: currentBudgetRealized,
          end_date: subcontractor.deadline,
          status: 'active'
        })

        contractId = newContract.id
        console.log('Created contract:', contractId)
      }

      // DEPRECATED: Payment creation moved to Accounting module
      // Users should create invoices and payments in Accounting → Invoices
      alert('Payment creation has moved to Accounting module. Please go to Accounting → Invoices to create and pay invoices.')
      return false

      // The following code is deprecated and will not execute:
      // - Milestone status updates
      // - Budget realized updates
      // These updates now happen automatically when payments are created in Accounting module
    } catch (error: any) {
      console.error('Error adding payment:', error)
      alert(error.message || 'Error recording payment. Please check the console for details.')
      return false
    }
  }

  const fetchWirePayments = async (subcontractorId: string) => {
    try {
      const payments = await siteService.fetchWirePayments(subcontractorId)
      return payments
    } catch (error) {
      console.error('Error fetching wire payments:', error)
      return []
    }
  }

  const updateWirePayment = async (
    paymentId: string,
    amount: number,
    paymentDate: string,
    notes: string,
    subcontractor: Subcontractor,
    oldAmount: number
  ) => {
    alert('Payment updates have moved to Accounting module. Please go to Accounting → Payments to edit payments.')
    return false
  }

  const deleteWirePayment = async (paymentId: string, amount: number, subcontractor: Subcontractor) => {
    alert('Payment deletion has moved to Accounting module. Please go to Accounting → Payments to delete payments.')
    return false
  }

  const fetchSubcontractorComments = async (subcontractorId: string) => {
    try {
      const comments = await siteService.fetchSubcontractorComments(subcontractorId)
      return comments
    } catch (error) {
      console.error('Error fetching comments:', error)
      return []
    }
  }

  const addSubcontractorComment = async (
    subcontractorId: string,
    userId: string,
    comment: string,
    commentType: 'completed' | 'issue' | 'general'
  ) => {
    if (!comment.trim()) return false

    try {
      await siteService.createSubcontractorComment({
        subcontractor_id: subcontractorId,
        user_id: userId,
        comment: comment.trim(),
        comment_type: commentType
      })
      return true
    } catch (error) {
      console.error('Error adding comment:', error)
      return false
    }
  }

  useEffect(() => {
    const initializeData = async () => {
      await recalculateAllPhaseBudgets()
      await fetchProjects()
    }
    initializeData()
  }, [])

  return {
    projects,
    loading,
    existingSubcontractors,
    fetchProjects,
    recalculateAllPhaseBudgets,
    createProjectPhases,
    updatePhase,
    deletePhase,
    addSubcontractorToPhase,
    updateSubcontractor,
    deleteSubcontractor,
    addPaymentToSubcontractor,
    fetchWirePayments,
    updateWirePayment,
    deleteWirePayment,
    fetchSubcontractorComments,
    addSubcontractorComment
  }
}
