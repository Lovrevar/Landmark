import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261009100000_storage_document_delete_policies.sql'),
  'utf8',
)
// Statements only: the header comment quotes the old policy names.
const statements = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '')

/**
 * SEC-A12: any signed-in user could delete any stored document file, because the DELETE policies
 * on the two document buckets checked the bucket and nothing else. The rule now has to match the
 * one on `public.documents` — and has to work from the file's owner, because the app deletes the
 * row before the file (documentService.deleteDocument).
 */
describe('document file delete policies', () => {
  it('drops both bucket-wide DELETE policies by the names production has', () => {
    expect(statements).toContain('DROP POLICY IF EXISTS "Authenticated users can delete from documents bucket" ON storage.objects')
    expect(statements).toContain('DROP POLICY IF EXISTS "Authenticated users can delete from contract-documents" ON storage.objects')
  })

  it('lets only the owner or a finance role delete, in each bucket', () => {
    const policies = statements.split('CREATE POLICY').slice(1)
    expect(policies).toHaveLength(2)
    for (const policy of policies) {
      expect(policy).toContain('FOR DELETE TO authenticated')
      expect(policy).toMatch(/owner_id = \(SELECT auth\.uid\(\)\)::text/)
      expect(policy).toMatch(/public\.app_user_role\(\) IN \('Director', 'Accounting'\)/)
    }
    expect(policies.map(policy => /bucket_id = '([a-z-]+)'/.exec(policy)?.[1]).sort()).toEqual(['contract-documents', 'documents'])
  })

  it('does not join to public.documents: the row is gone by the time the file is deleted', () => {
    expect(statements).not.toMatch(/public\.documents|FROM documents/)
  })

  it('adds no way to overwrite a file in place', () => {
    expect(statements).not.toMatch(/FOR (UPDATE|ALL)/)
  })
})
