import type { TFunction } from 'i18next'
import { NO_VALUE } from './formatters'

/**
 * One label and one colour per database status, for every vocabulary shared across modules.
 *
 * The same value was rendered differently on every screen it reached: a project "On Hold" was
 * yellow in General, grey in Supervision and Sales, red on the Director dashboard and orange in
 * Reports — and in all eleven places the *label* was the raw English column value, in a Croatian
 * UI. This is the same shape `Cashflow/services/invoiceHelpers.ts` already uses for invoice status
 * and `Funding/Investors/utils/creditStatus.ts` for credits: a frozen map plus two readers.
 *
 * **These values are stored in English and constrained by a Postgres CHECK.** Map them at render
 * time only — never translate a value that is compared, filtered or written back. `UnitsGrid` and
 * `ApartmentDetailsModal` both branch on `'Sold'` / `'Available'` / `'Reserved'` and write those
 * strings, so the comparison stays English while the label does not.
 *
 * An unrecognised value keeps its raw text in a neutral badge rather than vanishing: a status the
 * UI has not been taught about is still information, and hiding it is how the old code let a
 * `defaulted` credit read as calm.
 */

export type StatusVariant = 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'orange' | 'teal' | 'purple'

export interface StatusDisplay {
  labelKey: string
  variant: StatusVariant
}

export type StatusMap = Readonly<Record<string, StatusDisplay>>

/** `projects.status` and `retail_projects.status` (baseline_schema.sql:3620, :3858). */
export const PROJECT_STATUS: StatusMap = {
  'Planning': { labelKey: 'status.planning', variant: 'gray' },
  'In Progress': { labelKey: 'status.in_progress', variant: 'blue' },
  'Completed': { labelKey: 'status.completed', variant: 'green' },
  // Amber, not red: a project on hold is paused, not failing. Red was the Director dashboard's
  // reading and made every paused project look like an incident.
  'On Hold': { labelKey: 'status.on_hold', variant: 'yellow' },
}

/** `contracts.status` (baseline_schema.sql:3215). */
export const CONTRACT_STATUS: StatusMap = {
  draft: { labelKey: 'status.draft', variant: 'gray' },
  active: { labelKey: 'status.active', variant: 'blue' },
  completed: { labelKey: 'status.completed', variant: 'green' },
  terminated: { labelKey: 'status.terminated', variant: 'red' },
}

/** `retail_contracts.status` (baseline_schema.sql:3714) — capitalised, a different vocabulary. */
export const RETAIL_CONTRACT_STATUS: StatusMap = {
  'Active': { labelKey: 'status.active', variant: 'blue' },
  'Completed': { labelKey: 'status.completed', variant: 'green' },
  'Cancelled': { labelKey: 'status.cancelled', variant: 'gray' },
}

/** `retail_project_phases.status` (baseline_schema.sql:3830). */
export const RETAIL_PHASE_STATUS: StatusMap = {
  'Pending': { labelKey: 'status.pending', variant: 'gray' },
  'In Progress': { labelKey: 'status.in_progress', variant: 'blue' },
  'Completed': { labelKey: 'status.completed', variant: 'green' },
}

/** `apartments.status`, `garages.status`, `repositories.status` (baseline_schema.sql:2775, :3374, :3639). */
export const UNIT_STATUS: StatusMap = {
  'Available': { labelKey: 'status.available', variant: 'blue' },
  'Reserved': { labelKey: 'status.reserved', variant: 'yellow' },
  'Sold': { labelKey: 'status.sold', variant: 'green' },
}

/** `subcontractor_milestones.status` (baseline_schema.sql:4007) — `completed` means partly paid. */
export const MILESTONE_STATUS: StatusMap = {
  pending: { labelKey: 'status.pending', variant: 'gray' },
  completed: { labelKey: 'status.partial_payment', variant: 'yellow' },
  paid: { labelKey: 'status.paid', variant: 'green' },
}

/** `retail_contract_milestones.status` (baseline_schema.sql:3661). */
export const RETAIL_MILESTONE_STATUS: StatusMap = {
  pending: { labelKey: 'status.pending', variant: 'gray' },
  paid: { labelKey: 'status.paid', variant: 'green' },
  cancelled: { labelKey: 'status.cancelled', variant: 'gray' },
}

/**
 * Risk level — computed, not stored (`investmentService.ts`, `generalReportService.ts`).
 *
 * It rendered as "High Rizik" on one screen and "Rizik: High" on another. The thresholds that
 * produce it are deliberately not all the same (see `getCreditRiskLevel` vs `utilisationTone` in
 * `creditCalculations.ts`); only the label is unified here.
 */
export const RISK_LEVEL: StatusMap = {
  Low: { labelKey: 'risk.low', variant: 'green' },
  Medium: { labelKey: 'risk.medium', variant: 'orange' },
  High: { labelKey: 'risk.high', variant: 'red' },
}

/** The badge colour for a value, or neutral grey when the vocabulary does not know it. */
export function statusVariant(map: StatusMap, value: string | null | undefined): StatusVariant {
  return (value && map[value]?.variant) || 'gray'
}

/** The i18n key for a value, or `null` when the vocabulary does not know it. */
export function statusLabelKey(map: StatusMap, value: string | null | undefined): string | null {
  return (value && map[value]?.labelKey) || null
}

/** The translated label. An unknown value shows as-is; a missing one as a dash. */
export function statusLabel(map: StatusMap, value: string | null | undefined, t: TFunction): string {
  const key = statusLabelKey(map, value)
  if (key) return t(key)
  return value || NO_VALUE
}
