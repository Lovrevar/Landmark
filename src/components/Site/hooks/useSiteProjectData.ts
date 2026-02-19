import { useState, useEffect } from 'react'
import { Subcontractor } from '../../../lib/supabase'
import { ProjectWithPhases } from '../types/siteTypes'
import * as siteService from '../services/siteService'

export const useSiteProjectData = () => {
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

      const invoiceStatsResults = await Promise.all(
        subcontractorsWithPhaseData.map(async (sub) => {
          const stats = await siteService.fetchSubcontractorInvoiceStats(sub.subcontractor_id, sub.id)
          return { contractId: sub.id, ...stats }
        })
      )
      const invoiceStatsMap = new Map(invoiceStatsResults.map(stat => [stat.contractId, stat]))

      const projectsWithPhases = projectsData.map(project => {
        const projectPhases = phasesData.filter(phase => phase.project_id === project.id)
        const projectSubcontractors = subcontractorsWithPhaseData
          .filter(sub => projectPhases.some(phase => phase.id === sub.phase_id))
          .map(sub => {
            const stats = invoiceStatsMap.get(sub.id)
            return {
              ...sub,
              invoice_total_paid: stats?.totalPaid || 0,
              invoice_total_owed: stats?.totalOwed || 0
            }
          })

        const total_paid_out = projectSubcontractors.reduce((sum, sub) => sum + (sub.invoice_total_paid || 0), 0)
        const total_subcontractor_cost = projectSubcontractors.reduce((sum, sub) => sum + sub.cost, 0)
        const completion_percentage = total_subcontractor_cost > 0
          ? Math.round((total_paid_out / total_subcontractor_cost) * 100)
          : 0
        const overdue_subcontractors = projectSubcontractors.filter(sub => {
          return new Date(sub.deadline) < new Date() && (sub.invoice_total_paid || 0) < sub.cost
        }).length
        const has_phases = projectPhases.length > 0
        const total_budget_allocated = projectPhases.reduce((sum, phase) => sum + phase.budget_allocated, 0)

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

  useEffect(() => {
    fetchProjects()
  }, [])

  return { projects, loading, existingSubcontractors, fetchProjects }
}
