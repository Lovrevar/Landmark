import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { Invoice, Company, CompanyBankAccount, CompanyCredit, PaymentFormData } from '../types'
import { buildPaymentData } from './paymentPayload'

export const fetchPayments = async () => {
  const result = await supabase
    .from('accounting_payments')
    .select(`
      *,
      company_bank_accounts:company_bank_account_id (bank_name, account_number),
      bank_credits:credit_id (credit_name),
      accounting_invoices (
        id,
        invoice_number,
        invoice_type,
        total_amount,
        paid_amount,
        remaining_amount,
        vat_amount,
        companies:company_id (name),
        subcontractors:supplier_id (name),
        customers:customer_id (name, surname),
        office_suppliers:office_supplier_id (name),
        bank_company:bank_id (name),
        retail_suppliers:retail_supplier_id (name)
      )
    `)
    .order('payment_date', { ascending: false })

  if (result.error) throw result.error
  return result.data || []
}

export const fetchInvoices = async () => {
  const result = await supabase
    .from('accounting_invoices')
    .select(`
      id,
      invoice_number,
      invoice_type,
      total_amount,
      paid_amount,
      remaining_amount,
      company_id,
      companies:company_id (name),
      subcontractors:supplier_id (name),
      customers:customer_id (name, surname),
      office_suppliers:office_supplier_id (name),
      bank_company:bank_id (name),
      retail_suppliers:retail_supplier_id (name)
    `)
    .neq('status', 'PAID')
    .order('invoice_number')

  if (result.error) throw result.error
  return result.data as unknown as Invoice[]
}

export const fetchInvoiceById = async (id: string): Promise<Invoice | null> => {
  const result = await supabase
    .from('accounting_invoices')
    .select(`
      id,
      invoice_number,
      invoice_type,
      total_amount,
      paid_amount,
      remaining_amount,
      company_id,
      companies:company_id (name),
      subcontractors:supplier_id (name),
      customers:customer_id (name, surname),
      office_suppliers:office_supplier_id (name),
      bank_company:bank_id (name),
      retail_suppliers:retail_supplier_id (name)
    `)
    .eq('id', id)
    .maybeSingle()

  if (result.error) throw result.error
  return result.data as Invoice | null
}

export const fetchCompanies = async () => {
  const result = await supabase
    .from('accounting_companies')
    .select('id, name')
    .order('name')

  if (result.error) throw result.error
  return result.data as Company[]
}

export const fetchBankAccounts = async () => {
  const result = await supabase
    .from('company_bank_accounts')
    .select('*')
    .order('bank_name')

  if (result.error) throw result.error
  return result.data as CompanyBankAccount[]
}

export const fetchCredits = async () => {
  const result = await supabase
    .from('bank_credits')
    .select('*')
    .eq('disbursed_to_account', false)
    .order('credit_name')

  if (result.error) throw result.error
  return result.data as CompanyCredit[]
}

export const createPayment = async (formData: PaymentFormData) => {
  const { data: { user } } = await supabase.auth.getUser()

  const paymentData = buildPaymentData(formData, user?.id)

  const { data: inserted, error } = await supabase
    .from('accounting_payments')
    .insert([paymentData])
    .select('id')
    .maybeSingle()

  if (error) throw error

  logActivity({
    action: 'payment.create',
    entity: 'payment',
    entityId: inserted?.id ?? null,
    metadata: { severity: 'high', amount: formData.amount, invoice_id: formData.invoice_id },
  })
}

export const updatePayment = async (id: string, formData: PaymentFormData) => {
  const { data: { user } } = await supabase.auth.getUser()

  const paymentData = buildPaymentData(formData, user?.id)

  const { error } = await supabase
    .from('accounting_payments')
    .update(paymentData)
    .eq('id', id)

  if (error) throw error

  logActivity({
    action: 'payment.update',
    entity: 'payment',
    entityId: id,
    metadata: { severity: 'high', amount: formData.amount, invoice_id: formData.invoice_id },
  })
}

export const deletePayment = async (id: string) => {
  const { error } = await supabase
    .from('accounting_payments')
    .delete()
    .eq('id', id)

  if (error) throw error

  logActivity({
    action: 'payment.delete',
    entity: 'payment',
    entityId: id,
    metadata: { severity: 'high' },
  })
}
