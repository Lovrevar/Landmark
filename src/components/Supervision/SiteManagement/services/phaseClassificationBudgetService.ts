import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { PhaseClassificationBudget } from '../types'
import {
  totalsByClassification,
  type ClassificationTotals
} from '../../../Funding/TIC/utils/ticBudget'
import type { LineItem } from '../../../Funding/TIC/utils/ticFormatters'

/**
 * Per-(phase, classification) budget sub-allocations.
 *
 * There is no `budget_used` here on purpose: spend is derived from contracts at read time, the
 * same way `recalculate_all_phase_budgets()` derives the phase-level figure. One denormalised
 * counter in the system is enough to keep correct.
 */

const SELECT_COLS = 'id, phase_id, classification_id, budget_allocated, notes'

export async function fetchPhaseClassificationBudgets(phaseIds?: string[]): Promise<PhaseClassificationBudget[]> {
  let query = supabase.from('phase_classification_budgets').select(SELECT_COLS)
  if (phaseIds) {
    if (phaseIds.length === 0) return []
    query = query.in('phase_id', phaseIds)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

async function projectIdForPhase(phaseId: string): Promise<string | null> {
  const { data } = await supabase
    .from('project_phases')
    .select('project_id')
    .eq('id', phaseId)
    .maybeSingle()
  return data?.project_id ?? null
}

export async function upsertPhaseClassificationBudget(
  phaseId: string,
  classificationId: number,
  budgetAllocated: number,
  notes: string | null = null
): Promise<void> {
  const { data: upserted, error } = await supabase
    .from('phase_classification_budgets')
    .upsert(
      { phase_id: phaseId, classification_id: classificationId, budget_allocated: budgetAllocated, notes },
      { onConflict: 'phase_id,classification_id' }
    )
    .select('id')
    .maybeSingle()

  if (error) throw error

  logActivity({
    action: 'phase_classification_budget.update',
    entity: 'phase_classification_budget',
    entityId: upserted?.id ?? null,
    projectId: await projectIdForPhase(phaseId),
    metadata: {
      severity: 'medium',
      phase_id: phaseId,
      classification_id: classificationId,
      budget_allocated: budgetAllocated
    }
  })
}

/**
 * Replace a phase's whole set of sub-allocations in one round trip.
 *
 * Rows set to 0 are deleted rather than stored, so an untouched classification does not linger
 * as an empty group in the phase card. Pass a 0 row explicitly only when the intent is to pin an
 * empty group — the modal distinguishes the two.
 */
export async function bulkUpsertPhaseClassificationBudgets(
  phaseId: string,
  rows: Array<{ classification_id: number; budget_allocated: number; keepEmpty?: boolean }>
): Promise<void> {
  const toWrite = rows.filter(r => r.budget_allocated > 0 || r.keepEmpty)
  const toDelete = rows.filter(r => r.budget_allocated <= 0 && !r.keepEmpty).map(r => r.classification_id)

  if (toWrite.length > 0) {
    const { error } = await supabase
      .from('phase_classification_budgets')
      .upsert(
        toWrite.map(r => ({
          phase_id: phaseId,
          classification_id: r.classification_id,
          budget_allocated: r.budget_allocated
        })),
        { onConflict: 'phase_id,classification_id' }
      )
    if (error) throw error
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('phase_classification_budgets')
      .delete()
      .eq('phase_id', phaseId)
      .in('classification_id', toDelete)
    if (error) throw error
  }

  logActivity({
    action: 'phase_classification_budget.bulk_update',
    entity: 'phase_classification_budget',
    projectId: await projectIdForPhase(phaseId),
    metadata: { severity: 'high', phase_id: phaseId, count: toWrite.length, cleared: toDelete.length }
  })
}

export async function deletePhaseClassificationBudget(
  phaseId: string,
  classificationId: number
): Promise<void> {
  const { error } = await supabase
    .from('phase_classification_budgets')
    .delete()
    .eq('phase_id', phaseId)
    .eq('classification_id', classificationId)

  if (error) throw error

  logActivity({
    action: 'phase_classification_budget.delete',
    entity: 'phase_classification_budget',
    projectId: await projectIdForPhase(phaseId),
    metadata: { severity: 'high', phase_id: phaseId, classification_id: classificationId }
  })
}

/**
 * Allocated vs already-committed amount for one (phase, classification) pair.
 *
 * The phase-level budget gate stopped being a meaningful constraint once phase budgets became
 * the sum of their classifications, so this is the figure that actually limits a new contract.
 * `allocated === 0` means no sub-allocation has been set, in which case there is nothing to
 * enforce and the caller should fall back to the phase-level check alone.
 */
export async function fetchClassificationBudgetStatus(
  phaseId: string,
  classificationId: number
): Promise<{ allocated: number; used: number }> {
  const [budgetRow, contracts] = await Promise.all([
    supabase
      .from('phase_classification_budgets')
      .select('budget_allocated')
      .eq('phase_id', phaseId)
      .eq('classification_id', classificationId)
      .maybeSingle(),
    supabase
      .from('contracts')
      .select('contract_amount')
      .eq('phase_id', phaseId)
      .eq('classification_id', classificationId)
      .in('status', ['draft', 'active'])
  ])

  if (budgetRow.error) throw budgetRow.error
  if (contracts.error) throw contracts.error

  const used = (contracts.data || []).reduce(
    (sum, c) => sum + parseFloat(String(c.contract_amount ?? 0)),
    0
  )

  return { allocated: budgetRow.data?.budget_allocated ?? 0, used }
}

/**
 * The project's TIC plan, grouped by cost classification.
 *
 * This is where planned budget actually comes from: the TIC is the investment cost plan, and
 * these are the amounts "Popuni iz TIC-a" writes into a phase. Returns null when the project
 * has no TIC at all, which the caller shows differently from a TIC that exists but is empty.
 *
 * Only the INVESTICIJA rows are read. The GRAĐENJE tab is a breakdown of the single "Građenje"
 * line, so including it would double-count the largest item in the plan.
 */
export async function fetchTICClassificationTotals(
  projectId: string
): Promise<ClassificationTotals | null> {
  const { data, error } = await supabase
    .from('tic_cost_structures')
    .select('line_items')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return totalsByClassification((data.line_items || []) as LineItem[])
}
