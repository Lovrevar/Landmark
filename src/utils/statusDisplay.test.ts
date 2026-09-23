import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import hr from '../locales/hr/translation.json'
import en from '../locales/en/translation.json'
import {
  PROJECT_STATUS, CONTRACT_STATUS, RETAIL_CONTRACT_STATUS, RETAIL_PHASE_STATUS,
  UNIT_STATUS, CUSTOMER_STATUS, MILESTONE_STATUS, RETAIL_MILESTONE_STATUS, RISK_LEVEL,
  statusVariant, statusLabelKey, statusLabel, type StatusMap,
} from './statusDisplay'

/** Enough of i18next to assert which key a caller would look up. */
const t = ((key: string) => `t:${key}`) as unknown as TFunction

const lookup = (bundle: Record<string, unknown>, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], bundle)

/**
 * The database CHECK constraints these maps must cover, quoted from
 * supabase/migrations/00000000000000_baseline_schema.sql. If a migration ever widens one of these
 * enums, this table is the thing that should fail first.
 */
const VOCABULARIES: [string, StatusMap, string[]][] = [
  ['projects.status', PROJECT_STATUS, ['Planning', 'In Progress', 'Completed', 'On Hold']],
  ['contracts.status', CONTRACT_STATUS, ['draft', 'active', 'completed', 'terminated']],
  ['retail_contracts.status', RETAIL_CONTRACT_STATUS, ['Active', 'Completed', 'Cancelled']],
  ['retail_project_phases.status', RETAIL_PHASE_STATUS, ['Pending', 'In Progress', 'Completed']],
  ['apartments.status', UNIT_STATUS, ['Available', 'Reserved', 'Sold']],
  ['customers.status', CUSTOMER_STATUS, ['buyer', 'interested', 'lead']],
  ['subcontractor_milestones.status', MILESTONE_STATUS, ['pending', 'completed', 'paid']],
  ['retail_contract_milestones.status', RETAIL_MILESTONE_STATUS, ['pending', 'paid', 'cancelled']],
  ['risk level (computed)', RISK_LEVEL, ['Low', 'Medium', 'High']],
]

describe.each(VOCABULARIES)('%s', (_name, map, values) => {
  it('covers every value the column allows, and nothing else', () => {
    expect(Object.keys(map).sort()).toEqual([...values].sort())
  })

  it('gives every value a label key that exists in both locales', () => {
    for (const value of values) {
      const key = statusLabelKey(map, value)
      expect(key, `${value} has no label key`).toBeTruthy()
      expect(lookup(hr, key as string), `${key} missing from hr`).toBeTruthy()
      expect(lookup(en, key as string), `${key} missing from en`).toBeTruthy()
    }
  })
})

describe('unknown and missing values', () => {
  it('keeps an unrecognised status visible rather than hiding it', () => {
    // A value the UI has not been taught about is still information. The old per-screen maps
    // silently fell through, which is how a defaulted credit rendered as a calm blue badge.
    expect(statusLabel(PROJECT_STATUS, 'Archived', t)).toBe('Archived')
    expect(statusVariant(PROJECT_STATUS, 'Archived')).toBe('gray')
    expect(statusLabelKey(PROJECT_STATUS, 'Archived')).toBeNull()
  })

  it('renders a dash when there is no status at all', () => {
    expect(statusLabel(PROJECT_STATUS, null, t)).toBe('—')
    expect(statusLabel(PROJECT_STATUS, undefined, t)).toBe('—')
    expect(statusLabel(PROJECT_STATUS, '', t)).toBe('—')
    expect(statusVariant(PROJECT_STATUS, null)).toBe('gray')
  })
})

describe('statusLabel', () => {
  it('translates through the key rather than the raw value', () => {
    expect(statusLabel(PROJECT_STATUS, 'In Progress', t)).toBe('t:status.in_progress')
    expect(statusLabel(RISK_LEVEL, 'High', t)).toBe('t:risk.high')
  })

  it('names a customer status instead of shouting the database value', () => {
    // The sales report PDF printed `customer.status.toUpperCase()`, so a Croatian document
    // carried "LEAD" — and upper-casing is locale-sensitive besides.
    expect(statusLabel(CUSTOMER_STATUS, 'lead', t)).toBe('t:customer_status.lead')
  })

  it('reads a partly paid milestone as partial, not as completed work', () => {
    // The trigger sets `completed` when *some* money has landed, so the honest label is the
    // payment one; "Završeno" would claim the work is done.
    expect(statusLabel(MILESTONE_STATUS, 'completed', t)).toBe('t:status.partial_payment')
  })
})
