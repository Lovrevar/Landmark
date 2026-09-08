import { supabase } from '../../../../lib/supabase'
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

// No write helpers here any more. sync_project_from_tic() owns this table: it deletes and
// rebuilds a project's rows whenever the TIC is saved, so anything written from the client would
// survive only until the next save. The three upsert/delete functions that used to live here
// were left without callers when the classification budgets modal became read-only, and keeping
// them would have invited someone to wire the client back into a table the database now owns.

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
