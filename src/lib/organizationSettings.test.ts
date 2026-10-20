import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261015100100_organization_settings.sql'),
  'utf8',
)
const statements = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '')

/**
 * GEN-19: the organisation's name lives in each database. Every signed-in user reads it (a Sales
 * user's Sales report prints it); nobody writes it from the app.
 */
describe('organization settings', () => {
  it('holds exactly one row', () => {
    expect(statements).toMatch(/id\s+boolean PRIMARY KEY DEFAULT true CHECK \(id\)/)
    expect(statements).toMatch(/INSERT INTO public\.organization_settings \(id\) VALUES \(true\) ON CONFLICT \(id\) DO NOTHING/)
  })

  it('lets every signed-in user read it and nobody write it', () => {
    expect(statements).toContain('ENABLE ROW LEVEL SECURITY')
    const policies = statements.match(/CREATE POLICY[\s\S]*?;/g) ?? []
    expect(policies).toHaveLength(1)
    expect(policies[0]).toMatch(/FOR SELECT TO authenticated\s+USING \(true\)/)
    expect(statements).toContain('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.organization_settings FROM authenticated;')
    expect(statements).toContain('REVOKE ALL ON public.organization_settings FROM anon;')
  })
})
