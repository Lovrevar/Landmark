import type { TFunction } from 'i18next'
import type { Invoice, Project, Contract, Milestone } from '../Invoices/types'
import { daysFromToday } from '../../../utils/dateOnly'
import { NO_VALUE } from '../../../utils/formatters'

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'PAID': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
    case 'PARTIALLY_PAID': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
    case 'UNPAID': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
    default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
  }
}

/**
 * The one invoice-status renderer: Badge variant + i18n label key. Use these rather than a local
 * switch — hand-rolled copies had drifted (UNPAID yellow on one screen, red on the rest; a
 * lowercase 'paid' check that never matched; the raw enum shown as the label).
 */
export type InvoiceStatusVariant = 'green' | 'yellow' | 'red' | 'gray'

export const getInvoiceStatusVariant = (status: string | null | undefined): InvoiceStatusVariant => {
  switch (status) {
    case 'PAID': return 'green'
    case 'PARTIALLY_PAID': return 'yellow'
    case 'UNPAID': return 'red'
    default: return 'gray'
  }
}

/** i18n key for an invoice status, or null for an unknown one (callers fall back to the raw value). */
export const getInvoiceStatusLabelKey = (status: string | null | undefined): string | null => {
  switch (status) {
    case 'PAID': return 'common.paid'
    case 'PARTIALLY_PAID': return 'common.partial'
    case 'UNPAID': return 'common.unpaid'
    default: return null
  }
}

/** Translated status label. An unknown status is shown as-is rather than hidden. */
export const getInvoiceStatusLabel = (status: string | null | undefined, t: TFunction): string => {
  const key = getInvoiceStatusLabelKey(status)
  return key ? t(key) : (status || NO_VALUE)
}

/**
 * `accounting_invoices.invoice_category` — what the invoice is *about*, as opposed to
 * `invoice_type`'s direction. The nine values are fixed by
 * accounting_invoices_invoice_category_check (baseline_schema.sql:2523).
 *
 * Supervision's invoice table printed the raw column ("BANK_CREDIT") and branched on
 * `'SUPERVISION'` — a value no CHECK allows and no migration ever added, so that branch could
 * never run. Stored values stay English; this maps at render time only.
 */
export const INVOICE_CATEGORY_LABEL_KEYS: Readonly<Record<string, string>> = {
  SUBCONTRACTOR: 'invoice_category.subcontractor',
  OFFICE: 'invoice_category.office',
  APARTMENT: 'invoice_category.apartment',
  CUSTOMER: 'invoice_category.customer',
  BANK_CREDIT: 'invoice_category.bank_credit',
  INVESTOR: 'invoice_category.investor',
  MISCELLANEOUS: 'invoice_category.miscellaneous',
  GENERAL: 'invoice_category.general',
  RETAIL: 'invoice_category.retail',
}

/** i18n key for an invoice category, or null for a value the vocabulary does not know. */
export const getInvoiceCategoryLabelKey = (category: string | null | undefined): string | null =>
  (category && INVOICE_CATEGORY_LABEL_KEYS[category]) || null

/** Translated category label. An unknown category is shown as-is rather than hidden. */
export const getInvoiceCategoryLabel = (category: string | null | undefined, t: TFunction): string => {
  const key = getInvoiceCategoryLabelKey(category)
  return key ? t(key) : (category || NO_VALUE)
}

export const getTypeColor = (type: string): string => {
  if (type === 'INCOMING_SUPPLIER' || type === 'INCOMING_OFFICE' || type === 'INCOMING_BANK' || type === 'INCOMING_BANK_EXPENSES') {
    return 'text-red-600'
  }
  return 'text-green-600'
}

/**
 * Which way money moves when an invoice of this type is paid, from the company's side. The prefix
 * names the invoice, not the cash: paying an INCOMING_* invoice (a bill we received — a supplier,
 * a loan repayment, credit fees) is money OUT; an OUTGOING_* invoice (one we issued — a sale, a
 * credit drawdown booked as OUTGOING_BANK) is money IN. Same sign convention as the bank-balance
 * trigger in 20260917100000_payment_update_balance_triggers.sql. Null for a type with neither prefix.
 * Caveat: INCOMING_INVESTMENT is OUT here (and in the trigger) but counted as cash IN by the
 * accounting dashboard and `getTypeColor` — settle that before using this for those screens.
 */
export type PaymentDirection = 'IN' | 'OUT'

export const paymentDirection = (invoiceType: string | null | undefined): PaymentDirection | null => {
  if (invoiceType?.startsWith('OUTGOING_')) return 'IN'
  if (invoiceType?.startsWith('INCOMING_')) return 'OUT'
  return null
}

export type InvoiceDirection = 'INCOMING' | 'OUTGOING'

/**
 * Categories that exist for each invoice direction. `${direction}_${value}` is always one of the
 * nine values allowed by the accounting_invoices_invoice_type_check constraint — there is no
 * INCOMING_SALES, OUTGOING_INVESTMENT or OUTGOING_BANK_EXPENSES. `labelKey` is the i18n key for
 * the full type. Covered by invoiceHelpers.test.ts.
 */
export const INVOICE_CATEGORIES_BY_DIRECTION: Record<
  InvoiceDirection,
  ReadonlyArray<{ value: string; labelKey: string }>
> = {
  INCOMING: [
    { value: 'SUPPLIER', labelKey: 'invoice_type.ulazni_dob' },
    { value: 'OFFICE', labelKey: 'invoice_type.ulazni_ured' },
    { value: 'INVESTMENT', labelKey: 'invoice_type.ulazni_inv' },
    { value: 'BANK', labelKey: 'invoice_type.ulazni_banka' },
    { value: 'BANK_EXPENSES', labelKey: 'invoice_type.ulazni_troskred' },
  ],
  OUTGOING: [
    { value: 'SUPPLIER', labelKey: 'invoice_type.izlazni_dob' },
    { value: 'OFFICE', labelKey: 'invoice_type.izlazni_ured' },
    { value: 'SALES', labelKey: 'invoice_type.izlazni_prod' },
    { value: 'BANK', labelKey: 'invoice_type.izlazni_banka' },
  ],
}

export const isInvoiceCategoryValidForDirection = (direction: InvoiceDirection, category: string): boolean =>
  INVOICE_CATEGORIES_BY_DIRECTION[direction].some(c => c.value === category)

/** i18n key for a full invoice type (e.g. 'INCOMING_BANK_EXPENSES'), or null for an unknown type. */
export const getInvoiceTypeLabelKey = (type: string): string | null => {
  for (const direction of Object.keys(INVOICE_CATEGORIES_BY_DIRECTION) as InvoiceDirection[]) {
    const match = INVOICE_CATEGORIES_BY_DIRECTION[direction].find(c => `${direction}_${c.value}` === type)
    if (match) return match.labelKey
  }
  return null
}

export const getTypeLabel = (type: string): string => {
  switch (type) {
    case 'INCOMING_SUPPLIER': return 'ULAZNI (DOB)'
    case 'INCOMING_INVESTMENT': return 'ULAZNI (INV)'
    case 'INCOMING_OFFICE': return 'ULAZNI (URED)'
    case 'INCOMING_BANK': return 'ULAZNI (BANKA)'
    case 'INCOMING_BANK_EXPENSES': return 'ULAZNI (TROŠ.KRED)'
    case 'OUTGOING_OFFICE': return 'IZLAZNI (URED)'
    case 'OUTGOING_SUPPLIER': return 'IZLAZNI (DOB)'
    case 'OUTGOING_SALES': return 'IZLAZNI (PROD)'
    case 'OUTGOING_BANK': return 'IZLAZNI (BANKA)'
    default: return type
  }
}

export const getSupplierCustomerName = (invoice: Invoice): string => {
  if (invoice.subcontractors?.name) return invoice.subcontractors.name
  if (invoice.retail_suppliers?.name) return invoice.retail_suppliers.name
  if (invoice.office_suppliers?.name) return invoice.office_suppliers.name
  if (invoice.customers) return `${invoice.customers.name} ${invoice.customers.surname}`
  if (invoice.retail_customers?.name) return invoice.retail_customers.name
  if (invoice.investors?.name) return invoice.investors.name
  if (invoice.banks?.name) return invoice.banks.name
  return '-'
}

export const getCustomerProjects = (
  customerId: string,
  projects: Project[],
  customerSales: Array<{ customer_id?: string; apartments?: { project_id?: string } }>
): Project[] => {
  if (!customerId) return projects

  const customerProjectIds = new Set(
    customerSales
      .filter(sale => sale.customer_id === customerId)
      .map(sale => sale.apartments?.project_id)
      .filter(Boolean)
  )

  return projects.filter(project => customerProjectIds.has(project.id))
}

export const getCustomerApartmentsByProject = (
  customerId: string,
  projectId: string,
  customerApartments: Array<{ customer_id?: string; project_id?: string }>
): Array<{ customer_id?: string; project_id?: string }> => {
  if (!customerId) return []

  return customerApartments.filter(apt =>
    apt.customer_id === customerId &&
    (!projectId || apt.project_id === projectId)
  )
}

export const getSupplierProjects = (
  supplierId: string,
  projects: Project[],
  contracts: Contract[]
): Project[] => {
  if (!supplierId) return []

  const supplierProjectIds = new Set(
    contracts
      .filter(contract => contract.subcontractor_id === supplierId)
      .map(contract => contract.project_id)
  )

  return projects.filter(project => supplierProjectIds.has(project.id))
}

export const getSupplierContractsByProject = (
  supplierId: string,
  projectId: string,
  contracts: Contract[]
): Contract[] => {
  if (!supplierId) return []

  return contracts.filter(contract =>
    contract.subcontractor_id === supplierId &&
    (!projectId || contract.project_id === projectId)
  )
}

export const getMilestonesByContract = (
  contractId: string,
  milestones: Milestone[]
): Milestone[] => {
  if (!contractId) return []
  return milestones.filter(m => m.contract_id === contractId && m.status !== 'paid')
}

export const isOverdue = (dueDate: string, status: string): boolean => {
  return status !== 'PAID' && daysFromToday(dueDate) < 0
}

export const columnLabels = {
  approved: 'Odobreno',
  type: 'Tip',
  invoice_number: 'Broj računa',
  company: 'Firma',
  supplier_customer: 'Dobavljač/Kupac',
  category: 'Kategorija',
  issue_date: 'Datum izdavanja',
  due_date: 'Dospijeće',
  base_amount: 'Osnovica',
  vat: 'PDV',
  total_amount: 'Ukupno',
  paid_amount: 'Plaćeno',
  remaining_amount: 'Preostalo',
  status: 'Status'
}
