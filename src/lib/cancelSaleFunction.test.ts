import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261012100100_cancel_apartment_sale.sql'),
  'utf8',
)
const statements = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '')
const body = statements.slice(statements.indexOf('CREATE OR REPLACE FUNCTION public.cancel_apartment_sale'), statements.indexOf('$$;'))
const at = (needle: string | RegExp): number => {
  const index = typeof needle === 'string' ? body.indexOf(needle) : body.search(needle)
  expect(index, String(needle)).toBeGreaterThan(-1)
  return index
}

/**
 * SALES-10: a sale could not be undone, so a reverted one counted in every report for ever.
 * `cancel_apartment_sale` is the reverse of `complete_apartment_sale`; the order of its steps is
 * the contract — every refusal has to come before the first write.
 */
describe('cancel_apartment_sale', () => {
  it('runs with a fixed search path and is callable by signed-in users only', () => {
    expect(body).toMatch(/SECURITY DEFINER\s+SET search_path TO 'public', 'pg_temp'/)
    expect(statements).toContain('REVOKE ALL ON FUNCTION public.cancel_apartment_sale(uuid) FROM public, anon')
    expect(statements).toContain('GRANT EXECUTE ON FUNCTION public.cancel_apartment_sale(uuid) TO authenticated')
  })

  it('checks the role, the sale and the invoices before it changes anything', () => {
    const firstWrite = at('DELETE FROM public.sales')
    expect(at("NOT IN ('Director', 'Accounting')")).toBeLessThan(firstWrite)
    expect(at("USING ERRCODE = '42501'")).toBeLessThan(firstWrite)
    expect(at('FOR UPDATE')).toBeLessThan(firstWrite)
    expect(at(/invoice_type = 'OUTGOING_SALES'/)).toBeLessThan(firstWrite)
    expect(at("USING ERRCODE = 'P0001'")).toBeLessThan(firstWrite)
    // Nothing but the delete and the four updates writes.
    expect(body.match(/\b(INSERT INTO|DELETE FROM|UPDATE public\.)/g)).toHaveLength(5)
  })

  it('returns the apartment and both kinds of linked unit to Available and clears the buyer', () => {
    for (const table of ['apartments', 'garages', 'repositories']) {
      expect(body).toMatch(new RegExp(`UPDATE public\\.${table} SET status = 'Available', buyer_name = NULL`))
    }
    expect(body).toContain('SELECT garage_id FROM public.apartment_garages WHERE apartment_id = p_apartment_id')
    expect(body).toContain('SELECT repository_id FROM public.apartment_repositories WHERE apartment_id = p_apartment_id')
    // The links are kept: the units still belong with the apartment.
    expect(body).not.toMatch(/DELETE FROM public\.apartment_(garages|repositories)/)
  })

  it('stops calling the customer a buyer only when no other sale is left', () => {
    const guard = at('IF NOT EXISTS (SELECT 1 FROM public.sales WHERE customer_id = v_sale.customer_id)')
    expect(guard).toBeGreaterThan(at('DELETE FROM public.sales'))
    expect(at("UPDATE public.customers SET status = 'interested'")).toBeGreaterThan(guard)
  })

  it('hands back what the activity log needs, since the row is gone', () => {
    for (const key of ['sale_id', 'customer_id', 'sale_price', 'buyer_name', 'customer_status_reverted']) {
      expect(body).toContain(`'${key}'`)
    }
  })

  it('allows one sale per apartment', () => {
    expect(statements).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS sales_one_per_apartment ON public\.sales \(apartment_id\)/)
  })
})
