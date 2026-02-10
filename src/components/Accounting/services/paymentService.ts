import { supabase } from '../../../lib/supabase'
import { Payment, Invoice, Company, CompanyBankAccount, CompanyCredit, PaymentFormData } from '../types/paymentTypes'

export const fetchPayments = async () => {
  const result = await supabase
    .from('accounting_payments')
    .select(`
      *,
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
  return result.data as Invoice[]
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
    .order('credit_name')

  if (result.error) throw result.error

  const filtered = (result.data || []).filter(credit =>
    credit.disbursed_to_account !== true
  )

  console.log('All credits from DB:', result.data)
  console.log('Filtered credits (disbursed_to_account !== true):', filtered)

  return filtered as CompanyCredit[]
}

export const createPayment = async (formData: PaymentFormData) => {
  const { data: { user } } = await supabase.auth.getUser()

  const paymentData = {
    invoice_id: formData.invoice_id,
    payment_source_type: formData.is_cesija ? 'bank_account' : formData.payment_source_type,
    company_bank_account_id: formData.is_cesija ? null : (formData.payment_source_type === 'bank_account' ? (formData.company_bank_account_id || null) : null),
    credit_id: formData.is_cesija ? null : (formData.payment_source_type === 'credit' ? (formData.credit_id || null) : null),
    is_cesija: formData.is_cesija,
    cesija_company_id: formData.is_cesija ? (formData.cesija_company_id || null) : null,
    cesija_bank_account_id: formData.is_cesija ? (formData.cesija_bank_account_id || null) : null,
    payment_date: formData.payment_date,
    amount: formData.amount,
    payment_method: formData.payment_method,
    reference_number: formData.reference_number || null,
    description: formData.description,
    created_by: user?.id
  }

  const { error } = await supabase
    .from('accounting_payments')
    .insert([paymentData])

  if (error) throw error
}

export const updatePayment = async (id: string, formData: PaymentFormData) => {
  const { data: { user } } = await supabase.auth.getUser()

  const paymentData = {
    invoice_id: formData.invoice_id,
    payment_source_type: formData.is_cesija ? 'bank_account' : formData.payment_source_type,
    company_bank_account_id: formData.is_cesija ? null : (formData.payment_source_type === 'bank_account' ? (formData.company_bank_account_id || null) : null),
    credit_id: formData.is_cesija ? null : (formData.payment_source_type === 'credit' ? (formData.credit_id || null) : null),
    is_cesija: formData.is_cesija,
    cesija_company_id: formData.is_cesija ? (formData.cesija_company_id || null) : null,
    cesija_bank_account_id: formData.is_cesija ? (formData.cesija_bank_account_id || null) : null,
    payment_date: formData.payment_date,
    amount: formData.amount,
    payment_method: formData.payment_method,
    reference_number: formData.reference_number || null,
    description: formData.description,
    created_by: user?.id
  }

  const { error } = await supabase
    .from('accounting_payments')
    .update(paymentData)
    .eq('id', id)

  if (error) throw error
}

export const deletePayment = async (id: string) => {
  const { error } = await supabase
    .from('accounting_payments')
    .delete()
    .eq('id', id)

  if (error) throw error
}
