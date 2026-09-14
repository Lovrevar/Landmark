/**
 * Šifrarnici — the code mappings that tell the ERP importer what each 4D Wand
 * code means in Cognilion terms. See docs/erp-integration/SPEC.md §7.
 *
 * Everything here is read and written through the `erp_*` views in `public`;
 * the underlying tables live in the `erp` schema, which PostgREST does not
 * expose.
 */

export type SifrarnikTab = 'accounts' | 'cost_centers' | 'partners'

/**
 * What part an account plays in a posting. This is what lets the importer tell
 * a gross liability line from a net expense line when reconstructing an invoice
 * out of general-ledger rows — without it every reconstructed total is wrong.
 */
export type AccountRole =
  | 'unclassified'
  | 'liability_supplier'
  | 'liability_customer'
  | 'liability_other'
  | 'receivable_advance'
  | 'expense'
  | 'vat_input'
  | 'vat_output'
  | 'bank'
  | 'ignore'

export const ACCOUNT_ROLES: AccountRole[] = [
  'unclassified',
  'liability_supplier',
  'liability_customer',
  'liability_other',
  'receivable_advance',
  'expense',
  'vat_input',
  'vat_output',
  'bank',
  'ignore',
]

/** Roles that require `vat_rate`, mirroring erp_account_map_vat_rate_required. */
export const VAT_ROLES: AccountRole[] = ['vat_input', 'vat_output']

export type PartnerEntityKind =
  | 'subcontractor'
  | 'retail_supplier'
  | 'office_supplier'
  | 'customer'
  | 'retail_customer'
  | 'bank'
  | 'investor'

export const PARTNER_ENTITY_KINDS: PartnerEntityKind[] = [
  'subcontractor',
  'retail_supplier',
  'office_supplier',
  'customer',
  'retail_customer',
  'bank',
  'investor',
]

// ---------------------------------------------------------------------------
// Imported code lists (read-only mirrors of 4D Wand registers)
// ---------------------------------------------------------------------------

export interface ErpAccount {
  account_code: string
  name: string
  active: boolean
}

export interface ErpCostCenter {
  code: string
  name: string
  active: boolean
}

export interface ErpPartner {
  kom_id: number
  name: string
  oib: string | null
  iban: string | null
  active: boolean
}

// ---------------------------------------------------------------------------
// Mappings (ours, hand-maintained)
// ---------------------------------------------------------------------------

export interface AccountMapping {
  account_code: string
  role: AccountRole
  invoice_category_id: string | null
  vat_rate: number | null
  bank_id: string | null
  notes: string | null
}

export interface CostCenterMapping {
  cost_center_code: string
  project_id: string | null
  retail_project_id: string | null
  notes: string | null
}

export interface PartnerMapping {
  kom_id: number
  entity_kind: PartnerEntityKind
  entity_id: string
  notes: string | null
}

// ---------------------------------------------------------------------------
// Joined rows — code list left-joined with its mapping, done client-side
// because the mapping views must stay plain to remain auto-updatable.
// ---------------------------------------------------------------------------

export interface AccountRow extends ErpAccount {
  mapping: AccountMapping | null
}

export interface CostCenterRow extends ErpCostCenter {
  mapping: CostCenterMapping | null
}

export interface PartnerRow extends ErpPartner {
  mapping: PartnerMapping | null
}

/** A selectable target for a mapping — project, category, bank, supplier, … */
export interface TargetOption {
  id: string
  label: string
}
