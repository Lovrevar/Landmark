import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * A few tests here read a migration's text instead of running it (organizationSettings,
 * invoiceCashDirection). That proves something only while that migration is the LAST one to
 * define what it tests: a newer `CREATE OR REPLACE`, `DROP POLICY` or `DROP INDEX` replaces the
 * object in the database while the old file — and so the old test — stays green.
 *
 * When this fails, a newer migration redefines the object. Read the new definition, check it still
 * does what the older test asserts, then point that test, and its row below, at the new file.
 * Better: replace the text test with a pgTAP test in supabase/tests/database/, which runs against
 * the final state of every migration, and delete its rows here. Cancel-sale, contracts scope,
 * document delete, unique unit numbers and the unphased TIC have been replaced that way.
 */
const dir = resolve(process.cwd(), 'supabase/migrations')
const migrations = readdirSync(dir)
  .filter(f => f.endsWith('.sql'))
  .sort()
  .map(f => ({
    f,
    sql: readFileSync(resolve(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, ''),
  }))

const lastTouching = (pattern: RegExp) => {
  const touching = migrations.filter(m => pattern.test(m.sql))
  return touching[touching.length - 1]?.f
}

const schema = '("?(public|storage)"?\\.)?'
const fn = (name: string) =>
  new RegExp(`(create\\s+(or\\s+replace\\s+)?|alter\\s+|drop\\s+)function\\s+(if\\s+exists\\s+)?${schema}"?${name}"?\\s*\\(`, 'i')
const policiesOn = (table: string) =>
  new RegExp(`(create|alter|drop)\\s+policy\\s+(if\\s+exists\\s+)?"[^"]+"\\s+on\\s+${schema}"?${table}"?\\b`, 'i')
const view = (name: string) =>
  new RegExp(`(create\\s+(or\\s+replace\\s+)?view|drop\\s+view\\s+(if\\s+exists\\s+)?|alter\\s+view)\\s*${schema}"?${name}"?\\b`, 'i')

// What a text test covers → the migration it reads. Update both together.
const COVERED: Array<[string, RegExp, string]> = [
  // organizationSettings.test.ts
  ['policies on organization_settings', policiesOn('organization_settings'), '20261015100100_organization_settings.sql'],
  // invoiceCashDirection.test.ts ("the database agrees")
  ['recalc_company_bank_account_balance()', fn('recalc_company_bank_account_balance'), '20260930100300_cashflow_balances_and_stats.sql'],
  ['view company_statistics', view('company_statistics'), '20261006100000_company_statistics_final.sql'],
]

describe('text-tested migrations are still the latest definition', () => {
  it.each(COVERED)('%s', (_label, pattern, file) => {
    expect(lastTouching(pattern), 'a newer migration redefines this — re-check the test that reads the older file').toBe(file)
  })

  it('every pattern finds the migration it names (a typo would otherwise pass for ever)', () => {
    for (const [label, pattern, file] of COVERED) {
      const own = migrations.find(m => m.f === file)
      expect(own, `${label}: ${file} does not exist`).toBeDefined()
      expect(pattern.test(own!.sql), `${label}: pattern does not match ${file}`).toBe(true)
    }
  })
})
