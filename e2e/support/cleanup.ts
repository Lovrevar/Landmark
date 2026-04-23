import type { SupabaseClient } from '@supabase/supabase-js'

type NamespacedColumn = { table: string; column: string }

// Tables that test factories populate with namespace-prefixed text.
// Module test suites extend this as new factories land.
// Order matters only if FK constraints would fail — deepest children first.
const NAMESPACED_COLUMNS: NamespacedColumn[] = [
  // Cashflow — accounting_invoices.invoice_number carries the namespace.
  // hidden_approved_invoices and accounting_payments cascade via FK ON DELETE.
  { table: 'accounting_invoices', column: 'invoice_number' },
  // Sales — customers.name is seeded with the namespace by the customer factory
  // and the /customers form test. sales/apartments referencing these cascade
  // via FK (customers id → sales customer_id).
  { table: 'customers', column: 'name' },
  // Retail — retail_customers.name is seeded with the namespace by the retail
  // customers form test. retail_sales referencing these cascade via FK.
  { table: 'retail_customers', column: 'name' },
]

export async function cleanupByPrefix(
  admin: SupabaseClient,
  prefix: string
): Promise<void> {
  for (const { table, column } of NAMESPACED_COLUMNS) {
    const { error } = await admin.from(table).delete().like(column, `${prefix}%`)
    if (error && !isIgnorable(error.message)) {
      console.warn(`[e2e cleanup] ${table}.${column} like '${prefix}%':`, error.message)
    }
  }
}

function isIgnorable(message: string): boolean {
  return /does not exist|permission denied|schema cache/i.test(message)
}
