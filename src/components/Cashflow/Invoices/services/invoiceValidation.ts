import type { TFunction } from 'i18next'
import { supabase } from '../../../../lib/supabase'

type InvoiceValidationInput = Record<string, unknown>

export type InvoiceCounterpartyColumn =
  | 'supplier_id'
  | 'customer_id'
  | 'office_supplier_id'
  | 'bank_id'
  | 'retail_supplier_id'
  | 'retail_customer_id'

export const getCounterpartyColumn = (
  invoiceType: string,
  invoiceCategory?: string
): InvoiceCounterpartyColumn | null => {
  if (invoiceCategory === 'RETAIL') {
    if (invoiceType === 'INCOMING_SUPPLIER' || invoiceType === 'OUTGOING_SUPPLIER') return 'retail_supplier_id'
    if (invoiceType === 'OUTGOING_SALES' || invoiceType === 'INCOMING_INVESTMENT') return 'retail_customer_id'
    return null
  }
  if (invoiceType === 'INCOMING_SUPPLIER' || invoiceType === 'OUTGOING_SUPPLIER') return 'supplier_id'
  if (invoiceType === 'INCOMING_OFFICE' || invoiceType === 'OUTGOING_OFFICE') return 'office_supplier_id'
  if (invoiceType === 'OUTGOING_SALES') return 'customer_id'
  if (invoiceType === 'INCOMING_INVESTMENT') return 'bank_id'
  return null
}

export const checkDuplicateInvoiceNumber = async (params: {
  companyId: string
  counterpartyColumn: InvoiceCounterpartyColumn
  counterpartyId: string
  invoiceNumber: string
  issueDate: string
  excludeId?: string
}): Promise<boolean> => {
  const { companyId, counterpartyColumn, counterpartyId, invoiceNumber, issueDate, excludeId } = params
  const trimmedNumber = invoiceNumber.trim()
  if (!companyId || !counterpartyId || !trimmedNumber || !issueDate) return false

  const year = new Date(issueDate).getFullYear()
  if (!Number.isFinite(year)) return false

  const yearStart = `${year}-01-01`
  const yearEnd = `${year + 1}-01-01`

  let query = supabase
    .from('accounting_invoices')
    .select('id')
    .eq('company_id', companyId)
    .eq(counterpartyColumn, counterpartyId)
    .eq('invoice_number', trimmedNumber)
    .gte('issue_date', yearStart)
    .lt('issue_date', yearEnd)
    .limit(1)

  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query
  if (error) throw error
  return (data?.length ?? 0) > 0
}

export const validateInvoice = (
  formData: InvoiceValidationInput,
  t: TFunction
): Record<string, string> => {
  const errors: Record<string, string> = {}

  const invoiceType = String(formData.invoice_type || '').trim()
  const companyId = String(formData.company_id || '').trim()
  const invoiceNumber = String(formData.invoice_number || '').trim()
  const category = String(formData.category || '').trim()
  const issueDate = String(formData.issue_date || '').trim()
  const dueDate = String(formData.due_date || '').trim()
  const projectId = String(formData.project_id || '').trim()
  const contractId = String(formData.contract_id || '').trim()

  if (!invoiceType) errors.invoice_type = t('invoices.form.error_type_required')
  if (!companyId) errors.company_id = t('invoices.form.error_company_required')
  if (!invoiceNumber) errors.invoice_number = t('invoices.form.error_invoice_number_required')
  if (!category) errors.category = t('invoices.form.error_category_required')
  if (!issueDate) errors.issue_date = t('invoices.form.error_issue_date_required')
  if (!dueDate) errors.due_date = t('invoices.form.error_due_date_required')

  if (issueDate && dueDate && dueDate < issueDate) {
    errors.due_date = t('invoices.form.error_due_date_before_issue')
  }

  if (invoiceType === 'INCOMING_SUPPLIER' || invoiceType === 'OUTGOING_SUPPLIER') {
    if (!String(formData.supplier_id || '').trim()) {
      errors.supplier_id = t('invoices.form.error_supplier_required')
    }
  } else if (invoiceType === 'INCOMING_OFFICE' || invoiceType === 'OUTGOING_OFFICE') {
    if (!String(formData.office_supplier_id || '').trim()) {
      errors.office_supplier_id = t('invoices.form.error_office_supplier_required')
    }
  } else if (invoiceType === 'OUTGOING_SALES') {
    if (!String(formData.customer_id || '').trim()) {
      errors.customer_id = t('invoices.form.error_customer_required')
    }
  } else if (invoiceType === 'INCOMING_INVESTMENT') {
    if (!String(formData.bank_id || '').trim()) {
      errors.bank_id = t('invoices.form.error_bank_required')
    }
  }

  if (
    (invoiceType === 'INCOMING_SUPPLIER' || invoiceType === 'OUTGOING_SUPPLIER') &&
    projectId && !contractId
  ) {
    errors.contract_id = t('invoices.form.error_contract_required_for_project')
  }

  const base1 = Number(formData.base_amount_1 || 0)
  const base2 = Number(formData.base_amount_2 || 0)
  const base3 = Number(formData.base_amount_3 || 0)
  const base4 = Number(formData.base_amount_4 || 0)
  if (base1 <= 0 && base2 <= 0 && base3 <= 0 && base4 <= 0) {
    errors.base_amount_1 = t('invoices.form.error_base_amount_required')
  }

  return errors
}

const PG_UNIQUE_VIOLATION = '23505'

export const isInvoiceNumberDuplicateError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: unknown; message?: unknown }
  if (e.code === PG_UNIQUE_VIOLATION) return true
  const msg = String(e.message || '').toLowerCase()
  return msg.includes('invoice_number') && msg.includes('duplicate')
}
