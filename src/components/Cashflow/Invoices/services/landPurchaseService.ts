import { supabase } from '../../../../lib/supabase'
import type { Contract } from '../hooks/useLandPurchaseFormData'

export interface LandPurchaseFormData {
  company_id: string
  supplier_id: string
  project_id: string
  phase_id: string
  contract_id: string
  invoice_name: string
  iban: string
  deposit_amount: number
  deposit_due_date: string
  remaining_amount: number
  remaining_due_date: string
}

type InvoiceInsertPayload = Record<string, unknown>

function buildInvoicePayload(
  formData: LandPurchaseFormData,
  type: 'deposit' | 'remaining',
  invoiceType: 'projects' | 'retail',
  selectedContract: Contract
): InvoiceInsertPayload {
  const isDeposit = type === 'deposit'
  const amount = isDeposit ? formData.deposit_amount : formData.remaining_amount
  const dueDate = isDeposit ? formData.deposit_due_date : formData.remaining_due_date
  const suffix = isDeposit ? 'Kapara' : 'Preostalo'
  const description = isDeposit
    ? 'Kapara za kupoprodaju zemljišta'
    : 'Preostali iznos za kupoprodaju zemljišta'

  const base = {
    invoice_number: `${formData.invoice_name}-${suffix}`,
    invoice_type: 'INCOMING_SUPPLIER',
    company_id: formData.company_id,
    issue_date: selectedContract.contract_date,
    due_date: dueDate,
    base_amount: amount,
    vat_rate: 0,
    vat_amount: 0,
    total_amount: amount,
    category: 'land_purchase',
    description,
    status: 'UNPAID',
    paid_amount: 0,
    remaining_amount: amount,
    base_amount_1: 0,
    vat_rate_1: 25,
    vat_amount_1: 0,
    base_amount_2: 0,
    vat_rate_2: 13,
    vat_amount_2: 0,
    base_amount_3: amount,
    vat_rate_3: 0,
    vat_amount_3: 0,
    approved: false,
    iban: formData.iban || null
  }

  if (invoiceType === 'projects') {
    return {
      ...base,
      invoice_category: 'SUBCONTRACTOR',
      supplier_id: formData.supplier_id,
      contract_id: selectedContract.id,
      project_id: formData.project_id
    }
  } else {
    return {
      ...base,
      invoice_category: 'RETAIL',
      retail_supplier_id: formData.supplier_id,
      retail_contract_id: selectedContract.id,
      retail_project_id: formData.project_id
    }
  }
}

export async function createLandPurchaseInvoices(
  formData: LandPurchaseFormData,
  invoiceType: 'projects' | 'retail',
  selectedContract: Contract
): Promise<void> {
  const invoicesToCreate: InvoiceInsertPayload[] = []

  if (formData.deposit_amount > 0) {
    invoicesToCreate.push(buildInvoicePayload(formData, 'deposit', invoiceType, selectedContract))
  }

  if (formData.remaining_amount > 0) {
    invoicesToCreate.push(buildInvoicePayload(formData, 'remaining', invoiceType, selectedContract))
  }

  if (invoicesToCreate.length > 0) {
    const { error } = await supabase
      .from('accounting_invoices')
      .insert(invoicesToCreate)
    if (error) throw error
  }
}
