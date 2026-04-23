import type { SupabaseClient } from '@supabase/supabase-js'

export interface SeededInvoice {
  id: string
  invoice_number: string
  company_id: string
}

/**
 * Picks the first existing accounting_companies row as the counterparty. The
 * E2E tests create a new invoice against this company — we don't create or
 * mutate the company itself. Throws if the dev DB has no companies.
 */
async function firstCompanyId(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin
    .from('accounting_companies')
    .select('id')
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`[factory] accounting_companies lookup failed: ${error.message}`)
  if (!data) {
    throw new Error(
      '[factory] dev DB has no accounting_companies rows; Cashflow tests require at least one. ' +
        'Run e2e/support/anchor-setup.sql or create one manually.'
    )
  }
  return data.id as string
}

/**
 * Picks the first existing subcontractors row as the supplier. Required to
 * satisfy the check_invoice_entity_type CHECK constraint for invoice_type =
 * 'INCOMING_SUPPLIER', which demands supplier_id IS NOT NULL (or retail_supplier_id).
 * We use subcontractors because the schema is minimal (name + contact only)
 * and the dev DB already has rows. Invoice FK uses ON DELETE RESTRICT, so the
 * row is safe from per-test cleanup cascades.
 */
async function firstSubcontractorId(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin
    .from('subcontractors')
    .select('id')
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`[factory] subcontractors lookup failed: ${error.message}`)
  if (!data) {
    throw new Error(
      '[factory] dev DB has no subcontractors rows; Cashflow tests require at least one. ' +
        'Create one manually via the Supervision module.'
    )
  }
  return data.id as string
}

/**
 * Inserts a minimal `accounting_invoices` row with `invoice_category='RETAIL'`
 * and `approved=true`. RETAIL invoices surface on the Approvals page without a
 * project_id, which keeps the test free of project/contract seeding.
 *
 * Uses invoice_type='INCOMING_SUPPLIER' with an existing subcontractor as
 * supplier_id to satisfy the check_invoice_entity_type CHECK constraint.
 * The invoice_number carries the test namespace so cleanupByPrefix can reclaim it.
 */
export async function createApprovedRetailInvoice(
  admin: SupabaseClient,
  opts: { ns: string; amount?: number; suffix?: string }
): Promise<SeededInvoice> {
  const amount = opts.amount ?? 100
  const invoice_number = `${opts.ns}-${opts.suffix ?? 'inv'}`
  const company_id = await firstCompanyId(admin)
  const supplier_id = await firstSubcontractorId(admin)

  const today = new Date()
  const due = new Date(today)
  due.setDate(due.getDate() + 30)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const { data, error } = await admin
    .from('accounting_invoices')
    .insert({
      invoice_type: 'INCOMING_SUPPLIER',
      invoice_category: 'RETAIL',
      company_id,
      supplier_id,
      invoice_number,
      issue_date: fmt(today),
      due_date: fmt(due),
      category: 'E2E',
      approved: true,
      base_amount: amount,
      base_amount_1: amount,
      vat_rate: 0,
      vat_rate_1: 0,
      vat_amount: 0,
      vat_amount_1: 0,
      total_amount: amount,
      paid_amount: 0,
      remaining_amount: amount,
      status: 'UNPAID',
      description: `E2E seed ${opts.ns}`,
    })
    .select('id, invoice_number, company_id')
    .maybeSingle()

  if (error) throw new Error(`[factory] accounting_invoices insert failed: ${error.message}`)
  if (!data) throw new Error('[factory] accounting_invoices insert returned no row')

  return data as SeededInvoice
}
