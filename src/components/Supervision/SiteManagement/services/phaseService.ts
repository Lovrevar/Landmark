import { supabase, ProjectPhase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { PhaseFormInput } from '../types'

export const fetchProjectPhases = async () => {
  const { data: phasesData, error: phasesError } = await supabase
    .from('project_phases')
    .select('*')
    .order('project_id', { ascending: true })
    .order('phase_number', { ascending: true })

  if (phasesError) throw phasesError

  return phasesData || []
}

export const recalculatePhaseBudget = async (phaseId: string) => {
  const { data: phaseContracts, error: subError } = await supabase
    .from('contracts')
    .select('contract_amount')
    .eq('phase_id', phaseId)
    .in('status', ['draft', 'active'])

  if (subError) throw subError

  const budgetUsed = (phaseContracts || []).reduce((sum, contract) => sum + parseFloat(contract.contract_amount || 0), 0)

  const { error: updateError } = await supabase
    .from('project_phases')
    .update({ budget_used: budgetUsed })
    .eq('id', phaseId)

  if (updateError) throw updateError

  return budgetUsed
}

export const recalculateAllPhaseBudgets = async () => {
  // Set-based recalc in Postgres (see recalculate_all_phase_budgets RPC migration).
  // The previous client-side read of all active/draft contracts was silently capped at
  // PostgREST's 1000-row default, producing understated phase budgets at scale.
  const { error } = await supabase.rpc('recalculate_all_phase_budgets')

  if (error) throw error
}

/**
 * How many contracts and work logs point at a phase.
 *
 * contracts.phase_id and work_logs.phase_id are both ON DELETE SET NULL, so deleting a phase
 * that still has dependants does not fail — it silently detaches them. Callers must check this
 * first. `budget_used` is NOT a substitute: it is a derived column that only
 * recalculate_all_phase_budgets() refreshes, so it reads 0 for a phase that has contracts
 * whenever the recalc has not run since they were added.
 */
export const countPhaseDependents = async (phaseId: string): Promise<{ contracts: number; workLogs: number }> => {
  const [contracts, workLogs] = await Promise.all([
    supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('phase_id', phaseId),
    supabase.from('work_logs').select('id', { count: 'exact', head: true }).eq('phase_id', phaseId)
  ])

  if (contracts.error) throw contracts.error
  if (workLogs.error) throw workLogs.error

  return { contracts: contracts.count ?? 0, workLogs: workLogs.count ?? 0 }
}

export const createPhases = async (projectId: string, phases: PhaseFormInput[]) => {
  const phasesToInsert = phases.map((phase, index) => ({
    project_id: projectId,
    phase_number: index + 1,
    phase_name: phase.phase_name,
    budget_allocated: phase.budget_allocated,
    budget_used: 0,
    start_date: phase.start_date || null,
    end_date: phase.end_date || null,
    status: 'planning'
  }))

  const { error } = await supabase
    .from('project_phases')
    .insert(phasesToInsert)

  if (error) throw error

  logActivity({ action: 'phase.create', entity: 'phase', projectId, metadata: { severity: 'medium', count: phases.length } })
}

export const updateProjectPhases = async (projectId: string, phases: PhaseFormInput[]) => {
  const existingPhasesData = await supabase
    .from('project_phases')
    .select('*')
    .eq('project_id', projectId)
    .order('phase_number')

  if (existingPhasesData.error) throw existingPhasesData.error

  const existingPhases = existingPhasesData.data || []
  const existingPhaseIds = new Set(existingPhases.map(p => p.id))
  const updatedPhaseIds = new Set(phases.filter(p => p.id).map(p => p.id))

  const phasesToDelete = existingPhases.filter(p => !updatedPhaseIds.has(p.id))
  if (phasesToDelete.length > 0) {
    // Removing a row in the phase-setup modal deletes the phase, and the FKs then NULL out
    // every contract that pointed at it — silently, because ON DELETE SET NULL does not fail.
    // The single-phase delete path has always warned about this; the bulk path never did.
    const dependentCounts = await Promise.all(phasesToDelete.map(p => countPhaseDependents(p.id)))
    const blocked = phasesToDelete
      .map((phase, i) => ({ phase, ...dependentCounts[i] }))
      .filter(entry => entry.contracts > 0 || entry.workLogs > 0)

    if (blocked.length > 0) {
      const detail = blocked
        .map(b => `${b.phase.phase_name} (${b.contracts})`)
        .join(', ')
      throw new Error(
        `Ne možete obrisati faze koje imaju ugovore: ${detail}. Prvo premjestite ili obrišite ugovore.`
      )
    }

    const { error: deleteError } = await supabase
      .from('project_phases')
      .delete()
      .in('id', phasesToDelete.map(p => p.id))

    if (deleteError) throw deleteError
  }

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i]
    const phaseNumber = i + 1

    if (phase.id && existingPhaseIds.has(phase.id)) {
      const { error: updateError } = await supabase
        .from('project_phases')
        .update({
          phase_number: phaseNumber,
          phase_name: phase.phase_name,
          budget_allocated: phase.budget_allocated,
          start_date: phase.start_date || null,
          end_date: phase.end_date || null
        })
        .eq('id', phase.id)

      if (updateError) throw updateError
    } else {
      const { error: insertError } = await supabase
        .from('project_phases')
        .insert({
          project_id: projectId,
          phase_number: phaseNumber,
          phase_name: phase.phase_name,
          budget_allocated: phase.budget_allocated,
          budget_used: 0,
          start_date: phase.start_date || null,
          end_date: phase.end_date || null,
          status: 'planning'
        })

      if (insertError) throw insertError
    }
  }

  logActivity({
    action: 'phase.bulk_update',
    entity: 'phase',
    projectId,
    metadata: {
      severity: 'high',
      count: phases.length,
      created: phases.filter(p => !p.id || !existingPhaseIds.has(p.id)).length,
      deleted: phasesToDelete.length
    }
  })
}

export const updatePhase = async (
  phaseId: string,
  updates: {
    phase_name?: string
    budget_allocated?: number
    budget_used?: number
    start_date?: string | null
    end_date?: string | null
    status?: 'planning' | 'active' | 'completed' | 'on_hold'
  }
) => {
  const { data: phaseRow } = await supabase
    .from('project_phases')
    .select('project_id')
    .eq('id', phaseId)
    .maybeSingle()

  const { error } = await supabase
    .from('project_phases')
    .update({
      phase_name: updates.phase_name,
      budget_allocated: updates.budget_allocated,
      start_date: updates.start_date,
      end_date: updates.end_date,
      status: updates.status
    })
    .eq('id', phaseId)

  if (error) throw error

  logActivity({ action: 'phase.update', entity: 'phase', entityId: phaseId, projectId: phaseRow?.project_id ?? null, metadata: { severity: 'medium', changed_fields: Object.keys(updates) } })
}

export const deletePhase = async (phaseId: string) => {
  const { data: phaseRow } = await supabase
    .from('project_phases')
    .select('project_id')
    .eq('id', phaseId)
    .maybeSingle()

  const { error } = await supabase
    .from('project_phases')
    .delete()
    .eq('id', phaseId)

  if (error) throw error

  logActivity({ action: 'phase.delete', entity: 'phase', entityId: phaseId, projectId: phaseRow?.project_id ?? null, metadata: { severity: 'high' } })
}

export const resequencePhases = async (phases: ProjectPhase[]) => {
  const projectId = phases[0]?.project_id
  if (!projectId) return

  // One statement, via RPC. The previous row-by-row loop could transiently violate
  // UNIQUE (project_id, phase_number) mid-way when phases were reordered rather than appended.
  const { error } = await supabase.rpc('renumber_project_phases', {
    p_project_id: projectId,
    p_ordered_ids: phases.map(p => p.id)
  })
  if (error) throw error

  logActivity({
    action: 'phase.bulk_update',
    entity: 'phase',
    projectId: phases[0]?.project_id ?? null,
    metadata: { severity: 'medium', operation: 'resequence', count: phases.length }
  })
}

export const getPhaseInfo = async (phaseId: string) => {
  const { data, error } = await supabase
    .from('project_phases')
    .select('project_id, phase_name')
    .eq('id', phaseId)
    .single()

  if (error) throw error

  return data
}
