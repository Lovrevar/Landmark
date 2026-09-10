import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { CostClassification } from '../types'

/**
 * Cost classifications are the middle grouping axis on Site Management:
 * phase -> classification -> contract type -> contract.
 *
 * Deliberately modelled on contractTypesService so the two lookups stay interchangeable in the
 * UI. The seven seeded rows carry `is_system` and are protected by a database trigger, so the
 * read-only treatment in the UI is a convenience, not the actual guarantee.
 */

export async function fetchCostClassifications(includeInactive = false): Promise<CostClassification[]> {
  let query = supabase
    .from('cost_classifications')
    .select('id, code, name, description, sort_order, is_system, is_active')
    .order('sort_order')
    .order('name')

  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createCostClassification(input: {
  name: string
  description?: string | null
  sort_order?: number
}): Promise<number> {
  // id is assigned by the DB (identity column) — no client-side max(id)+1 race.
  const { data: inserted, error } = await supabase
    .from('cost_classifications')
    .insert({
      name: input.name,
      description: input.description || null,
      sort_order: input.sort_order ?? 0,
      is_system: false,
      is_active: true
    })
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!inserted) throw new Error('Cost classification was created but could not be read back.')

  // cost_classifications uses integer ids; activity_logs.entity_id is uuid, so the id rides in
  // metadata — same treatment as contract_type.create.
  logActivity({
    action: 'cost_classification.create',
    entity: 'cost_classification',
    metadata: { severity: 'medium', entity_name: input.name, cost_classification_id: inserted.id }
  })

  return inserted.id
}

export async function updateCostClassification(
  id: number,
  updates: Partial<Pick<CostClassification, 'name' | 'description' | 'sort_order' | 'is_active'>>
): Promise<void> {
  const { error } = await supabase
    .from('cost_classifications')
    .update(updates)
    .eq('id', id)

  if (error) throw error

  logActivity({
    action: 'cost_classification.update',
    entity: 'cost_classification',
    metadata: {
      severity: 'medium',
      changed_fields: Object.keys(updates),
      cost_classification_id: id
    }
  })
}

export async function deleteCostClassification(id: number): Promise<void> {
  const { data: row } = await supabase
    .from('cost_classifications')
    .select('name')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase
    .from('cost_classifications')
    .delete()
    .eq('id', id)

  if (error) throw error

  logActivity({
    action: 'cost_classification.delete',
    entity: 'cost_classification',
    metadata: { severity: 'high', entity_name: row?.name ?? null, cost_classification_id: id }
  })
}

/**
 * How many rows depend on a classification. Used to explain a refused delete before the FK or
 * the is_system trigger raises a less helpful error.
 */
export async function countClassificationUsage(id: number): Promise<{ contracts: number; budgets: number }> {
  const [contracts, budgets] = await Promise.all([
    supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('classification_id', id),
    supabase.from('phase_classification_budgets').select('id', { count: 'exact', head: true }).eq('classification_id', id)
  ])

  if (contracts.error) throw contracts.error
  if (budgets.error) throw budgets.error

  return { contracts: contracts.count ?? 0, budgets: budgets.count ?? 0 }
}
