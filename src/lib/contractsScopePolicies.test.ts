import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261012100000_contracts_project_scope.sql'),
  'utf8',
)
// Statements only: the header comment describes the old policies in prose.
const statements = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '')
const policy = (name: string): string => {
  const start = statements.indexOf(`CREATE POLICY "${name}"`)
  expect(start, name).toBeGreaterThan(-1)
  return statements.slice(start, statements.indexOf(';', start))
}

/**
 * SEC-004: contracts and their milestones were readable, and contracts writable, by a Supervision
 * user on every project. They now follow `project_managers`, as projects and phases already did.
 */
describe('contracts follow project assignment', () => {
  it('drops every old contracts policy by the name production has', () => {
    for (const name of [
      'Authenticated users can read contracts',
      'Directors, Supervision and Accounting can create contracts',
      'Site roles can insert contracts',
      'Directors, Supervision and Accounting can update contracts',
      'Site roles can update contracts',
      'Director can delete contracts',
    ]) {
      expect(statements).toContain(`DROP POLICY IF EXISTS "${name}"`)
    }
    expect(statements).not.toMatch(/ON public\.contracts[\s\S]{0,80}USING \(true\)/)
  })

  it('lets a role read a contract only through project access', () => {
    expect(policy('Project roles can read contracts')).toMatch(/FOR SELECT TO authenticated\s+USING \(public\.app_can_access_project\(project_id\)\)/)
  })

  it('lets Supervision write only on its own projects, Director and Accounting anywhere', () => {
    for (const name of ['Site roles can insert contracts on their projects', 'Site roles can update contracts on their projects']) {
      const text = policy(name)
      expect(text).toContain("public.app_user_role() IN ('Director', 'Accounting')")
      expect(text).toContain("public.app_user_role() = 'Supervision' AND public.app_can_access_project(project_id)")
    }
    // An update must not be able to move a contract onto a project the user cannot reach.
    expect(policy('Site roles can update contracts on their projects')).toMatch(/USING[\s\S]+WITH CHECK/)
    expect(policy('Director can delete contracts')).toContain("public.app_user_role() = 'Director'")
  })

  it('defines project access as the phase policies do: four roles always, Supervision by assignment', () => {
    const start = statements.indexOf('CREATE OR REPLACE FUNCTION public.app_can_access_project')
    const fn = statements.slice(start, statements.indexOf('$$;', start))
    expect(fn).toMatch(/STABLE SECURITY DEFINER\s+SET search_path TO 'public', 'pg_temp'/)
    expect(fn).toContain("u.role IN ('Director', 'Accounting', 'Investment', 'Sales')")
    expect(fn).toMatch(/u\.role = 'Supervision'[\s\S]+project_managers pm[\s\S]+pm\.user_id = u\.id AND pm\.project_id = p_project_id/)
    expect(statements).toContain('REVOKE ALL ON FUNCTION public.app_can_access_project(uuid) FROM public, anon')
    expect(statements).toContain('GRANT EXECUTE ON FUNCTION public.app_can_access_project(uuid) TO authenticated')
  })

  it('makes milestones readable and writable only with their contract', () => {
    expect(statements).toContain('DROP POLICY IF EXISTS "Authenticated users can view milestones"')
    const visible = 'EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = subcontractor_milestones.contract_id)'
    expect(policy('Milestones are readable with their contract')).toContain(visible)
    const manage = policy('Site roles can manage milestones on their contracts')
    expect(manage.split(visible)).toHaveLength(3)
    expect(manage).toContain("public.app_user_role() IN ('Director', 'Supervision', 'Accounting')")
  })

  // AUTH-4. The one-argument function is the one the project_milestones policy calls.
  it('drops only the unused two-argument overload, and only after checking nothing uses it', () => {
    expect(statements).toContain('DROP FUNCTION IF EXISTS public.user_has_project_access(uuid, uuid)')
    expect(statements).not.toMatch(/DROP FUNCTION[^;]*user_has_project_access\(uuid\)/)
    expect(statements.indexOf('RAISE EXCEPTION')).toBeLessThan(statements.indexOf('DROP FUNCTION IF EXISTS public.user_has_project_access'))
  })
})
