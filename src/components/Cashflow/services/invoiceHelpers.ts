import type { TFunction } from 'i18next'
import type { Invoice, Project, Contract, Milestone } from '../Invoices/types'
import { daysFromToday } from '../../../utils/dateOnly'
import { NO_VALUE } from '../../../utils/formatters'
import { invoiceCashCategory, invoiceCashDirection, type CashDirection } from '../../../utils/invoiceCashDirection'

/**
 * The one invoice-status renderer: Badge variant + i18n label key. Use these rather than a local
 * switch — hand-rolled copies had drifted (UNPAID yellow on one screen, red on the rest; a
 * lowercase 'paid' check that never matched; the raw enum shown as the label). Every screen that
 * shows `accounting_invoices.status` now reads it from here.
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

/**
 * Colour of an invoice type label: red for an invoice the company pays, green for one it is paid
 * on. Read from the shared direction map, so the label cannot disagree with the tab the invoice
 * sits on — ULAZNI (INV) used to be green on the red "Ulazni" tab.
 */
export const getTypeColor = (type: string): string =>
  invoiceCashDirection(type) === 'OUT' ? 'text-red-600' : 'text-green-600'

/**
 * Which way money moves when an invoice of this type is paid, from the company's side: `'OUT'`
 * for every INCOMING_* invoice (a bill received), `'IN'` for every OUTGOING_* one (an invoice
 * issued, including a credit drawdown booked as OUTGOING_BANK). The rule itself lives in
 * `utils/invoiceCashDirection.ts`, which every screen and the bank-balance trigger agree with.
 */
export type PaymentDirection = CashDirection

export const paymentDirection = invoiceCashDirection

export interface PaymentKind {
  /** i18n key of the word a payment register prints for this payment. */
  labelKey: string
  /** Credit principal: neither income nor expense, so it is not coloured as either. */
  financing: boolean
}

/**
 * What a payment *is*, for the "Tip" column of the payment registers.
 *
 * Direction alone is not it: a credit drawdown is money in and a principal repayment money out,
 * but neither is income or expense (CASH-7), and both registers labelled them PRIHOD and RASHOD
 * (FUND-17). Credit fees are an operating cost and stay RASHOD. `null` for a type the cash map
 * does not know — print a dash, never a guess.
 */
export function paymentKind(invoiceType: string | null | undefined): PaymentKind | null {
  const direction = invoiceCashDirection(invoiceType)
  if (!direction) return null
  if (invoiceCashCategory(invoiceType) === 'financing') {
    return { labelKey: direction === 'IN' ? 'payments.table.credit_drawdown' : 'payments.table.principal_repayment', financing: true }
  }
  return { labelKey: direction === 'IN' ? 'payments.table.income' : 'payments.table.expense', financing: false }
}

/** Text colour for a financing label where the register colours the word, not a badge. */
export const FINANCING_TEXT_CLASS = 'text-blue-600 dark:text-blue-400'

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

/**
 * Translated short code for a full invoice type ("ULAZNI (DOB)"), for dense tables. An unknown
 * type is shown as-is rather than hidden.
 */
export const getInvoiceTypeLabel = (type: string | null | undefined, t: TFunction): string => {
  const key = type ? getInvoiceTypeLabelKey(type) : null
  return key ? t(key) : (type || NO_VALUE)
}

/**
 * i18n key for the spelled-out form of an invoice type ("Ulazni – dobavljač"), or null for an
 * unknown type. Detail views use this form; the type legend pairs it with the short code, so the
 * bracketed abbreviations are explained from the same vocabulary that prints them.
 */
export const getInvoiceTypeLongLabelKey = (type: string): string | null => {
  const key = getInvoiceTypeLabelKey(type)
  return key ? key.replace(/^invoice_type\./, 'invoice_type_long.') : null
}

/** Translated spelled-out invoice type. An unknown type is shown as-is rather than hidden. */
export const getInvoiceTypeLongLabel = (type: string | null | undefined, t: TFunction): string => {
  const key = type ? getInvoiceTypeLongLabelKey(type) : null
  return key ? t(key) : (type || NO_VALUE)
}

/** Every invoice type the CHECK allows, in the order the legend lists them. */
export const ALL_INVOICE_TYPES: ReadonlyArray<string> = (
  Object.keys(INVOICE_CATEGORIES_BY_DIRECTION) as InvoiceDirection[]
).flatMap(direction => INVOICE_CATEGORIES_BY_DIRECTION[direction].map(c => `${direction}_${c.value}`))

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
