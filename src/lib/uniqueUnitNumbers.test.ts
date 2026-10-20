import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261012100200_unique_unit_numbers.sql'),
  'utf8',
)
const statements = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '')

/**
 * SALES-9: nothing stopped two units in a building from sharing a number, or two buildings in a
 * project a name. The client compares the same way (`garageNumberKey`, `nextBuildingNames`):
 * trimmed and case-insensitive.
 */
describe('unique unit numbers and building names', () => {
  it('indexes each table on its parent and the normalised label', () => {
    expect(statements).toMatch(/UNIQUE INDEX IF NOT EXISTS garages_unique_number_per_building\s+ON public\.garages \(building_id, lower\(btrim\(number\)\)\)/)
    expect(statements).toMatch(/UNIQUE INDEX IF NOT EXISTS repositories_unique_number_per_building\s+ON public\.repositories \(building_id, lower\(btrim\(number\)\)\)/)
    expect(statements).toMatch(/UNIQUE INDEX IF NOT EXISTS buildings_unique_name_per_project\s+ON public\.buildings \(project_id, lower\(btrim\(name\)\)\)/)
  })

  // NULLs are distinct in a unique index, so an apartment with no building would escape it.
  it('compares an apartment without a building within its project', () => {
    expect(statements).toMatch(/ON public\.apartments \(project_id, COALESCE\(building_id, '00000000-0000-0000-0000-000000000000'::uuid\), lower\(btrim\(number\)\)\)/)
  })

  it('names any existing duplicate before it tries to build an index', () => {
    const check = statements.indexOf('RAISE EXCEPTION')
    expect(check).toBeGreaterThan(-1)
    expect(check).toBeLessThan(statements.indexOf('CREATE UNIQUE INDEX'))
    for (const table of ['apartments', 'garages', 'repositories', 'buildings']) {
      expect(statements.slice(0, check)).toContain(`FROM public.${table}`)
    }
  })
})
