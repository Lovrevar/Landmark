import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import type {
  AccountMapping,
  AccountRow,
  CostCenterMapping,
  CostCenterRow,
  ErpAccount,
  ErpCostCenter,
  ErpPartner,
  PartnerEntityKind,
  PartnerMapping,
  PartnerRow,
  TargetOption,
} from '../types'

/**
 * All reads and writes go through the `erp_*` views in `public`. The mapping
 * views are deliberately plain (one table, no joins) so Postgres treats them as
 * auto-updatable — a join would make them silently read-only. The join against
 * the code lists therefore happens here, in memory, which is cheap at these
 * row counts.
 */

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function fetchAccountRows(): Promise<AccountRow[]> {
  const [codes, maps] = await Promise.all([
    supabase.from('erp_chart_of_accounts').select('account_code, name, active').order('account_code'),
    supabase.from('erp_account_map').select('account_code, role, invoice_category_id, vat_rate, bank_id, notes'),
  ])
  if (codes.error) throw codes.error
  if (maps.error) throw maps.error

  const byCode = new Map((maps.data ?? []).map(m => [m.account_code, m as AccountMapping]))
  return (codes.data ?? []).map((a: ErpAccount) => ({ ...a, mapping: byCode.get(a.account_code) ?? null }))
}

export async function fetchCostCenterRows(): Promise<CostCenterRow[]> {
  const [codes, maps] = await Promise.all([
    supabase.from('erp_cost_centers').select('code, name, active').order('code'),
    supabase.from('erp_cost_center_map').select('cost_center_code, project_id, retail_project_id, notes'),
  ])
  if (codes.error) throw codes.error
  if (maps.error) throw maps.error

  const byCode = new Map((maps.data ?? []).map(m => [m.cost_center_code, m as CostCenterMapping]))
  return (codes.data ?? []).map((c: ErpCostCenter) => ({ ...c, mapping: byCode.get(c.code) ?? null }))
}

export async function fetchPartnerRows(): Promise<PartnerRow[]> {
  const [codes, maps] = await Promise.all([
    supabase.from('erp_partners').select('kom_id, name, oib, iban, active').order('name'),
    supabase.from('erp_partner_map').select('kom_id, entity_kind, entity_id, notes'),
  ])
  if (codes.error) throw codes.error
  if (maps.error) throw maps.error

  const byId = new Map((maps.data ?? []).map(m => [m.kom_id, m as PartnerMapping]))
  return (codes.data ?? []).map((p: ErpPartner) => ({ ...p, mapping: byId.get(p.kom_id) ?? null }))
}

// ---------------------------------------------------------------------------
// Mapping targets
// ---------------------------------------------------------------------------

export async function fetchInvoiceCategories(): Promise<TargetOption[]> {
  const { data, error } = await supabase
    .from('invoice_categories')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map(r => ({ id: r.id, label: r.name }))
}

export async function fetchBanks(): Promise<TargetOption[]> {
  const { data, error } = await supabase.from('banks').select('id, name').order('name')
  if (error) throw error
  return (data ?? []).map(r => ({ id: r.id, label: r.name }))
}

export async function fetchProjectTargets(): Promise<{ projects: TargetOption[]; retailProjects: TargetOption[] }> {
  const [p, rp] = await Promise.all([
    supabase.from('projects').select('id, name').order('name'),
    supabase.from('retail_projects').select('id, name').order('name'),
  ])
  if (p.error) throw p.error
  if (rp.error) throw rp.error
  return {
    projects: (p.data ?? []).map(r => ({ id: r.id, label: r.name })),
    retailProjects: (rp.data ?? []).map(r => ({ id: r.id, label: r.name })),
  }
}

/** Which table each partner entity kind resolves to. */
const PARTNER_SOURCE = {
  subcontractor: 'subcontractors',
  retail_supplier: 'retail_suppliers',
  office_supplier: 'office_suppliers',
  customer: 'customers',
  retail_customer: 'retail_customers',
  bank: 'banks',
  investor: 'investors',
} as const satisfies Record<PartnerEntityKind, string>

export async function fetchPartnerTargets(kind: PartnerEntityKind): Promise<TargetOption[]> {
  // `customers` stores people as name + surname, so it needs its own query:
  // a computed column string would erase supabase-js's row typing.
  if (kind === 'customer') {
    const { data, error } = await supabase.from('customers').select('id, name, surname').order('name')
    if (error) throw error
    return (data ?? []).map(r => ({
      id: r.id,
      label: r.surname ? `${r.name} ${r.surname}` : r.name,
    }))
  }

  const { data, error } = await supabase.from(PARTNER_SOURCE[kind]).select('id, name').order('name')
  if (error) throw error
  return (data ?? []).map(r => ({ id: r.id, label: r.name }))
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function saveAccountMapping(mapping: AccountMapping): Promise<void> {
  const { error } = await supabase
    .from('erp_account_map')
    .upsert(mapping, { onConflict: 'account_code' })
  if (error) throw error

  logActivity({
    action: 'erp_account_map.upsert',
    entity: 'erp_account_map',
    metadata: {
      severity: 'medium',
      entity_name: mapping.account_code,
      changed_fields: Object.keys(mapping),
    },
  })
}

export async function saveCostCenterMapping(mapping: CostCenterMapping): Promise<void> {
  const { error } = await supabase
    .from('erp_cost_center_map')
    .upsert(mapping, { onConflict: 'cost_center_code' })
  if (error) throw error

  logActivity({
    action: 'erp_cost_center_map.upsert',
    entity: 'erp_cost_center_map',
    metadata: {
      severity: 'medium',
      entity_name: mapping.cost_center_code,
      changed_fields: Object.keys(mapping),
    },
  })
}

export async function savePartnerMapping(mapping: PartnerMapping): Promise<void> {
  const { error } = await supabase
    .from('erp_partner_map')
    .upsert(mapping, { onConflict: 'kom_id' })
  if (error) throw error

  logActivity({
    action: 'erp_partner_map.upsert',
    entity: 'erp_partner_map',
    metadata: {
      severity: 'medium',
      entity_name: String(mapping.kom_id),
      changed_fields: Object.keys(mapping),
    },
  })
}

export async function deleteAccountMapping(accountCode: string): Promise<void> {
  const { error } = await supabase.from('erp_account_map').delete().eq('account_code', accountCode)
  if (error) throw error
  logActivity({
    action: 'erp_account_map.delete',
    entity: 'erp_account_map',
    metadata: { severity: 'high', entity_name: accountCode },
  })
}

export async function deleteCostCenterMapping(code: string): Promise<void> {
  const { error } = await supabase.from('erp_cost_center_map').delete().eq('cost_center_code', code)
  if (error) throw error
  logActivity({
    action: 'erp_cost_center_map.delete',
    entity: 'erp_cost_center_map',
    metadata: { severity: 'high', entity_name: code },
  })
}

export async function deletePartnerMapping(komId: number): Promise<void> {
  const { error } = await supabase.from('erp_partner_map').delete().eq('kom_id', komId)
  if (error) throw error
  logActivity({
    action: 'erp_partner_map.delete',
    entity: 'erp_partner_map',
    metadata: { severity: 'high', entity_name: String(komId) },
  })
}
