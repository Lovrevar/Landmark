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
  const { data: contractSums, error: contractError } = await supabase
    .from('contracts')
    .select('phase_id, contract_amount')
    .in('status', ['draft', 'active'])

  if (contractError) throw contractError

  const budgetByPhase = new Map<string, number>()

  for (const contract of contractSums || []) {
    if (!contract.phase_id) continue
    const currentSum = budgetByPhase.get(contract.phase_id) || 0
    budgetByPhase.set(contract.phase_id, currentSum + parseFloat(contract.contract_amount || '0'))
  }

  const { data: allPhases, error: phasesError } = await supabase
    .from('project_phases')
    .select('id')

  if (phasesError) throw phasesError

  const updatePromises = (allPhases || []).map(phase => {
    const budgetUsed = budgetByPhase.get(phase.id) || 0
    return supabase
      .from('project_phases')
      .update({ budget_used: budgetUsed })
      .eq('id', phase.id)
  })

  await Promise.all(updatePromises)
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
  for (let i = 0; i < phases.length; i++) {
    await supabase
      .from('project_phases')
      .update({ phase_number: i + 1 })
      .eq('id', phases[i].id)
  }
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
