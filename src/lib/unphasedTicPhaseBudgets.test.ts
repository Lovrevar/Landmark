import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261015100000_unphased_tic_phase_budgets.sql'),
  'utf8',
)
const statements = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '')

/** The body of one function, from its CREATE to the end of its dollar-quoted body. */
const functionSql = (name: string): string => {
  const start = statements.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)
  expect(start).toBeGreaterThan(-1)
  return statements.slice(start, statements.indexOf('END $$;', start))
}

/**
 * GEN-22: an unphased TIC put the whole budget on phase 1 and 0 on the others. Phases of such a
 * project now carry NULL, and the split is re-applied when phases are added or removed.
 */
describe('unphased TIC phase budgets', () => {
  // CREATE OR REPLACE drops what 20260930100400 set with ALTER FUNCTION.
  it('runs every function as its owner, with a pinned search path', () => {
    const headers = statements.split('CREATE OR REPLACE FUNCTION').slice(1).map(f => f.slice(0, f.indexOf('AS $$')))
    expect(headers).toHaveLength(3)
    for (const header of headers) {
      expect(header).toContain('SECURITY DEFINER')
      expect(header).toContain("SET search_path TO 'public', 'pg_temp'")
    }
    for (const name of ['apply_unphased_tic_budget(uuid)', 'sync_project_from_tic(uuid)', 'reapply_unphased_tic_on_phase_change()']) {
      expect(statements).toContain(`REVOKE ALL ON FUNCTION public.${name} FROM public, anon, authenticated;`)
    }
  })

  it('gives several phases NULL and the only phase the whole plan', () => {
    const fn = functionSql('apply_unphased_tic_budget')
    expect(fn).toMatch(/SET budget_allocated = NULL/)
    expect(fn).toMatch(/SET budget_allocated = v_total WHERE id = v_only_phase/)
    expect(fn).not.toMatch(/phase_number\s*=\s*1/)
  })

  it('leaves a phased TIC, an all-zero TIC and a missing TIC alone', () => {
    const fn = functionSql('apply_unphased_tic_budget')
    const firstWrite = fn.indexOf('DELETE FROM public.phase_classification_budgets')
    for (const guard of ['IF v_line_items IS NULL', 'tic_phase_totals(v_line_items)', 'IF v_total <= 0', 'IF v_phases = 0']) {
      expect(fn.indexOf(guard)).toBeGreaterThan(-1)
      expect(fn.indexOf(guard)).toBeLessThan(firstWrite)
    }
  })

  it('never inserts or deletes a phase from the helper the phase trigger calls', () => {
    const fn = functionSql('apply_unphased_tic_budget')
    expect(fn).not.toMatch(/INSERT INTO public\.project_phases/)
    expect(fn).not.toMatch(/DELETE FROM public\.project_phases/)
  })

  it('hands the unphased case of the sync to the helper', () => {
    const fn = functionSql('sync_project_from_tic')
    expect(fn).toContain('PERFORM public.apply_unphased_tic_budget(p_project_id)')
    expect(fn).not.toMatch(/phase_number\s*=\s*1\b/)
    // A phase left NULL by an earlier unphased TIC gets 0 once the plan is phased.
    expect(fn).toMatch(/SET budget_allocated = 0\s+WHERE project_id = p_project_id AND budget_allocated IS NULL/)
  })

  // Listening to budget_allocated would re-enter the trigger from its own UPDATE.
  it('re-applies the split on phase insert, delete and move only', () => {
    expect(statements).toMatch(
      /CREATE TRIGGER trg_project_phases_unphased_tic\s+AFTER INSERT OR DELETE OR UPDATE OF project_id ON public\.project_phases\s+FOR EACH ROW/,
    )
  })

  // The full sync would also delete empty phases added to a phased TIC's project since its last save.
  it('backfills only unphased TICs, without re-running the full sync', () => {
    const backfill = statements.slice(statements.indexOf('DO $backfill$'))
    expect(backfill).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.tic_phase_totals\(t\.line_items\)\)/)
    expect(backfill).toContain('PERFORM public.apply_unphased_tic_budget(r.project_id)')
    expect(backfill).not.toContain('sync_project_from_tic')
  })
})
