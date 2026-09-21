import { useState, useEffect, useRef } from 'react'
import { Subcontractor } from '../../../../lib/supabase'
import { ProjectWithPhases } from '../types'
import * as siteService from '../services/siteService'
import { daysFromToday } from '../../../../utils/dateOnly'
import { ticGrandTotal, phaseTotals } from '../../../Funding/TIC/utils/ticBudget'

export const useSiteProjectData = () => {
  const [projects, setProjects] = useState<ProjectWithPhases[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [existingSubcontractors, setExistingSubcontractors] = useState<Subcontractor[]>([])
  const hasLoadedRef = useRef(false)

  const fetchProjects = async () => {
    if (hasLoadedRef.current) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)
    try {
      const [projectsData, phasesData, subcontractorsWithPhaseData, allSubcontractorsData, classificationBudgets, ticLineItems] = await Promise.all([
        siteService.fetchAllProjects(),
        siteService.fetchProjectPhases(),
        siteService.fetchSubcontractorsWithPhases(),
        siteService.fetchAllSubcontractors(),
        siteService.fetchPhaseClassificationBudgets(),
        siteService.fetchTICTotalsByProject(),
      ])

      setExistingSubcontractors(allSubcontractorsData)

      const invoiceStatsMap = await siteService.fetchInvoiceStatsForContracts(
        subcontractorsWithPhaseData.map(sub => sub.id)
      )

      const projectsWithPhases = projectsData.map(project => {
        const projectPhases = phasesData.filter(phase => phase.project_id === project.id)
        const projectPhaseIds = new Set(projectPhases.map(phase => phase.id))
        const projectClassificationBudgets = classificationBudgets.filter(b => projectPhaseIds.has(b.phase_id))
        const projectTic = ticLineItems.get(project.id) ?? null
        const projectTicPhases = projectTic ? phaseTotals(projectTic) : null
        // Scope by the contract's own project_id, not by whether its phase still resolves.
        // Going through phases meant a contract whose phase was deleted (phase_id set to NULL by
        // the FK) silently vanished from this screen instead of showing up unassigned.
        const projectSubcontractors = subcontractorsWithPhaseData
          .filter(sub => sub.project_id === project.id)
          .map(sub => {
            const stats = invoiceStatsMap.get(sub.id)
            return {
              ...sub,
              // Only `owed` comes from invoices now. Paid is contracts.budget_realized, which
              // migration 20260910120000 made a reliable cache of accounting_payments — the one
              // figure the whole app uses for money paid on a contract.
              invoice_total_owed: stats?.totalOwed || 0
            }
          })

        const total_paid_out = projectSubcontractors.reduce((sum, sub) => sum + (sub.budget_realized || 0), 0)
        const total_subcontractor_cost = projectSubcontractors.reduce((sum, sub) => sum + sub.cost, 0)
        const completion_percentage = total_subcontractor_cost > 0
          ? Math.round((total_paid_out / total_subcontractor_cost) * 100)
          : 0
        // `new Date(null)` is 1 January 1970, so a contract with no deadline used to count as
        // overdue — every unpaid uncontracted row inflated this badge. `daysFromToday` returns
        // NaN for a missing or unparseable date, and NaN < 0 is false. It also compares whole
        // local days, so a contract due today is not yet late.
        const overdue_subcontractors = projectSubcontractors.filter(sub => {
          return daysFromToday(sub.deadline) < 0 && (sub.budget_realized || 0) < sub.cost
        }).length
        const has_phases = projectPhases.length > 0
        const total_budget_allocated = projectPhases.reduce((sum, phase) => sum + phase.budget_allocated, 0)
        const total_contracted = projectSubcontractors.reduce((sum, sub) => {
          const subExt = sub as typeof sub & { has_contract?: boolean; budget_realized?: number }
          const hasContract = subExt.has_contract === true
          return sum + (hasContract ? (sub.cost || 0) : (subExt.budget_realized || 0))
        }, 0)

        return {
          ...project,
          phases: projectPhases,
          subcontractors: projectSubcontractors,
          classification_budgets: projectClassificationBudgets,
          tic_total: projectTic ? ticGrandTotal(projectTic) : null,
          tic_phase_count: projectTicPhases?.byPhase.size ?? 0,
          tic_not_phased: projectTicPhases?.notPhased ?? 0,
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
    } catch (err) {
      console.error('Error fetching projects:', err)
      // Whatever was already on screen is kept: a failed refresh must not turn a project list
      // into "no projects". The caller renders the error instead of, or above, the grid.
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  return { projects, loading, refreshing, error, existingSubcontractors, fetchProjects, refetch: fetchProjects }
}
