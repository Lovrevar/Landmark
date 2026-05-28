import { useState, useEffect, useRef } from 'react'
import { Subcontractor } from '../../../../lib/supabase'
import { ProjectWithPhases } from '../types'
import * as siteService from '../services/siteService'

export const useSiteProjectData = () => {
  const [projects, setProjects] = useState<ProjectWithPhases[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [existingSubcontractors, setExistingSubcontractors] = useState<Subcontractor[]>([])
  const hasLoadedRef = useRef(false)

  const fetchProjects = async () => {
    if (hasLoadedRef.current) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    try {
      const [projectsData, phasesData, subcontractorsWithPhaseData, allSubcontractorsData] = await Promise.all([
        siteService.fetchAllProjects(),
        siteService.fetchProjectPhases(),
        siteService.fetchSubcontractorsWithPhases(),
        siteService.fetchAllSubcontractors(),
      ])

      setExistingSubcontractors(allSubcontractorsData)

      const invoiceStatsMap = await siteService.fetchInvoiceStatsForContracts(
        subcontractorsWithPhaseData.map(sub => sub.id)
      )

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
        const total_contracted = projectSubcontractors.reduce((sum, sub) => {
          const subExt = sub as typeof sub & { has_contract?: boolean; invoice_total_paid?: number }
          const hasContract = subExt.has_contract === true
          return sum + (hasContract ? (sub.cost || 0) : (subExt.invoice_total_paid || 0))
        }, 0)

        return {
          ...project,
          phases: projectPhases,
          subcontractors: projectSubcontractors,
          completion_percentage,
          total_subcontractor_cost,
          overdue_subcontractors,
          has_phases,
          total_budget_allocated,
          total_paid_out,
          total_contracted
        }
      })

      setProjects(projectsWithPhases)
      hasLoadedRef.current = true
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  return { projects, loading, refreshing, existingSubcontractors, fetchProjects }
}
