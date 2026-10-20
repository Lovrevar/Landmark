import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Several tests here read a migration's text instead of running it (cancelSaleFunction,
 * contractsScopePolicies, …). That proves something only while that migration is the LAST one to
 * define what it tests: a newer `CREATE OR REPLACE`, `DROP POLICY` or `DROP INDEX` replaces the
 * object in the database while the old file — and so the old test — stays green.
 *
 * When this fails, a newer migration redefines the object. Read the new definition, check it still
 * does what the older test asserts, then point that test, and its row below, at the new file.
 * Real database tests (pgTAP, docs/REGRESSION_PREVENTION.md step 6) replace this once they exist.
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
const policy = (name: string) => new RegExp(`(create|alter|drop)\\s+policy\\s+(if\\s+exists\\s+)?"${name}"`, 'i')
const index = (name: string) =>
  new RegExp(`(create\\s+(unique\\s+)?index\\s+(if\\s+not\\s+exists\\s+)?|drop\\s+index\\s+(if\\s+exists\\s+)?)${schema}"?${name}"?\\b`, 'i')
const trigger = (name: string) =>
  new RegExp(`(create\\s+(or\\s+replace\\s+)?trigger|drop\\s+trigger\\s+(if\\s+exists\\s+)?)\\s*"?${name}"?\\b`, 'i')
const view = (name: string) =>
  new RegExp(`(create\\s+(or\\s+replace\\s+)?view|drop\\s+view\\s+(if\\s+exists\\s+)?|alter\\s+view)\\s*${schema}"?${name}"?\\b`, 'i')

// What a text test covers → the migration it reads. Update both together.
const COVERED: Array<[string, RegExp, string]> = [
  // cancelSaleFunction.test.ts
  ['cancel_apartment_sale()', fn('cancel_apartment_sale'), '20261012100100_cancel_apartment_sale.sql'],
  ['index sales_one_per_apartment', index('sales_one_per_apartment'), '20261012100100_cancel_apartment_sale.sql'],
  // contractsScopePolicies.test.ts
  ['app_can_access_project()', fn('app_can_access_project'), '20261012100000_contracts_project_scope.sql'],
  ['user_has_project_access()', fn('user_has_project_access'), '20261012100000_contracts_project_scope.sql'],
  ['policies on contracts', policiesOn('contracts'), '20261012100000_contracts_project_scope.sql'],
  ['policies on subcontractor_milestones', policiesOn('subcontractor_milestones'), '20261012100000_contracts_project_scope.sql'],
  // storageDocumentPolicies.test.ts
  ['policy on document files', policy('Uploader or finance can delete document files'), '20261009100000_storage_document_delete_policies.sql'],
  ['policy on contract document files', policy('Uploader or finance can delete contract document files'), '20261009100000_storage_document_delete_policies.sql'],
  // uniqueUnitNumbers.test.ts
  ['index apartments_unique_number_per_building', index('apartments_unique_number_per_building'), '20261012100200_unique_unit_numbers.sql'],
  ['index garages_unique_number_per_building', index('garages_unique_number_per_building'), '20261012100200_unique_unit_numbers.sql'],
  ['index repositories_unique_number_per_building', index('repositories_unique_number_per_building'), '20261012100200_unique_unit_numbers.sql'],
  ['index buildings_unique_name_per_project', index('buildings_unique_name_per_project'), '20261012100200_unique_unit_numbers.sql'],
  // unphasedTicPhaseBudgets.test.ts
  ['apply_unphased_tic_budget()', fn('apply_unphased_tic_budget'), '20261015100000_unphased_tic_phase_budgets.sql'],
  ['sync_project_from_tic()', fn('sync_project_from_tic'), '20261015100000_unphased_tic_phase_budgets.sql'],
  ['reapply_unphased_tic_on_phase_change()', fn('reapply_unphased_tic_on_phase_change'), '20261015100000_unphased_tic_phase_budgets.sql'],
  ['trigger trg_project_phases_unphased_tic', trigger('trg_project_phases_unphased_tic'), '20261015100000_unphased_tic_phase_budgets.sql'],
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
