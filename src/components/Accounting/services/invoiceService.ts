import { supabase } from '../../../lib/supabase'
import type { Invoice } from '../types/invoiceTypes'

export const fetchData = async (
  filterType: string,
  filterStatus: string,
  filterCompany: string,
  debouncedSearchTerm: string,
  currentPage: number,
  pageSize: number
) => {
  const [
    invoicesResult,
    statisticsResult,
    companiesResult,
    bankAccountsResult,
    creditsResult,
    suppliersResult,
    officeSuppliersResult,
    customersResult,
    investorsResult,
    banksResult,
    projectsResult,
    contractsResult,
    salesResult,
    invoiceCategoriesResult,
    refundsResult
  ] = await Promise.all([
    supabase.rpc('get_filtered_invoices', {
      p_invoice_type: filterType,
      p_status: filterStatus,
      p_company_id: filterCompany !== 'ALL' ? filterCompany : null,
      p_search_term: debouncedSearchTerm || null,
      p_offset: (currentPage - 1) * pageSize,
      p_limit: pageSize
    }),

    supabase.rpc('get_invoice_statistics', {
      p_invoice_type: filterType,
      p_status: filterStatus,
      p_company_id: filterCompany !== 'ALL' ? filterCompany : null,
      p_search_term: debouncedSearchTerm || null
    }),

    supabase
      .from('accounting_companies')
      .select('id, name, oib')
      .order('name'),

    supabase
      .from('company_bank_accounts')
      .select('*')
      .order('bank_name'),

    supabase
      .from('bank_credits')
      .select('*')
      .order('credit_name'),

    supabase
      .from('subcontractors')
      .select('id, name, contact')
      .order('name'),

    supabase
      .from('office_suppliers')
      .select('id, name, contact, email')
      .order('name'),

    supabase
      .from('customers')
      .select('id, name, surname, email')
      .order('name'),

    supabase
      .from('investors')
      .select('id, name, type')
      .order('name'),

    supabase
      .from('banks')
      .select('id, name')
      .order('name'),

    supabase
      .from('projects')
      .select('id, name')
      .order('name'),

    supabase
      .from('contracts')
      .select(`
        id,
        contract_number,
        project_id,
        phase_id,
        subcontractor_id,
        job_description,
        contract_amount,
        projects:project_id (name),
        phases:phase_id (phase_name)
      `)
      .in('status', ['draft', 'active'])
      .order('contract_number'),

    supabase
      .from('sales')
      .select(`
        customer_id,
        apartment_id,
        apartments!inner (
          id,
          number,
          project_id,
          price,
          projects:project_id (name),
          buildings:building_id (name)
        )
      `),

    supabase
      .from('invoice_categories')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order'),

    supabase
      .from('accounting_invoices_refund')
      .select('id, name')
      .order('name')
  ])

  if (invoicesResult.error) throw invoicesResult.error
  const transformedInvoices = (invoicesResult.data || []).map((inv: any) => ({
    ...inv,
    companies: inv.company_name ? { name: inv.company_name } : null,
    subcontractors: inv.supplier_name ? { name: inv.supplier_name } : null,
    customers: inv.customer_name ? { name: inv.customer_name, surname: inv.customer_surname || '' } : null,
    investors: inv.investor_name ? { name: inv.investor_name } : null,
    banks: inv.bank_name ? { name: inv.bank_name } : null,
    projects: inv.project_name ? { name: inv.project_name } : null,
    contracts: inv.contract_number ? { contract_number: inv.contract_number, job_description: inv.contract_job_description || '' } : null,
    office_suppliers: inv.office_supplier_name ? { name: inv.office_supplier_name } : null,
    retail_suppliers: inv.retail_supplier_name ? { name: inv.retail_supplier_name } : null,
    retail_customers: inv.retail_customer_name ? { name: inv.retail_customer_name } : null,
    refunds: inv.refund_name ? { name: inv.refund_name } : null
  }))

  let stats = {
    filtered_count: 0,
    filtered_unpaid_sum: 0,
    total_unpaid_sum: 0
  }

  if (statisticsResult.error) throw statisticsResult.error
  if (statisticsResult.data && statisticsResult.data.length > 0) {
    stats = {
      filtered_count: Number(statisticsResult.data[0].filtered_count) || 0,
      filtered_unpaid_sum: Number(statisticsResult.data[0].filtered_unpaid_sum) || 0,
      total_unpaid_sum: Number(statisticsResult.data[0].total_unpaid_sum) || 0
    }
  }

  if (companiesResult.error) {
    console.error('Error loading companies:', companiesResult.error)
    throw companiesResult.error
  }
  console.log('Loaded companies:', companiesResult.data)

  if (bankAccountsResult.error) {
    console.error('Error loading bank accounts:', bankAccountsResult.error)
  }

  if (creditsResult.error) {
    console.error('Error loading credits:', creditsResult.error)
  }

  if (suppliersResult.error) {
    console.error('Error loading suppliers:', suppliersResult.error)
    throw suppliersResult.error
  }
  console.log('Loaded suppliers:', suppliersResult.data)

  if (officeSuppliersResult.error) {
    console.error('Error loading office suppliers:', officeSuppliersResult.error)
    throw officeSuppliersResult.error
  }
  console.log('Loaded office suppliers:', officeSuppliersResult.data)

  if (customersResult.error) {
    console.error('Error loading customers:', customersResult.error)
    throw customersResult.error
  }
  console.log('Loaded customers:', customersResult.data)

  if (investorsResult.error) throw investorsResult.error

  if (banksResult.error) throw banksResult.error

  if (projectsResult.error) {
    console.error('Error loading projects:', projectsResult.error)
    throw projectsResult.error
  }
  console.log('Loaded projects:', projectsResult.data)

  if (contractsResult.error) throw contractsResult.error

  if (salesResult.error) throw salesResult.error

  const aptList = (salesResult.data || []).map(sale => ({
    ...sale.apartments,
    customer_id: sale.customer_id,
    apartment_id: sale.apartment_id
  }))

  return {
    invoices: transformedInvoices,
    stats,
    companies: companiesResult.data || [],
    bankAccounts: bankAccountsResult.data || [],
    credits: creditsResult.data || [],
    suppliers: suppliersResult.data || [],
    officeSuppliers: officeSuppliersResult.data || [],
    customers: customersResult.data || [],
    investors: investorsResult.data || [],
    banks: banksResult.data || [],
    projects: projectsResult.data || [],
    contracts: contractsResult.data || [],
    sales: salesResult.data || [],
    apartments: aptList,
    invoiceCategories: invoiceCategoriesResult.error ? [] : (invoiceCategoriesResult.data || []),
    refunds: refundsResult.error ? [] : (refundsResult.data || [])
  }
}

export const handleSubmit = async (
  formData: any,
  editingInvoice: Invoice | null,
  isOfficeInvoice: boolean
) => {
  const { data: { user } } = await supabase.auth.getUser()

  let supplier_id = null
  let office_supplier_id = null
  let customer_id = null
  let investor_id = null
  let bank_id = null
  let invoice_category = 'GENERAL'

  if (formData.invoice_type === 'INCOMING_SUPPLIER' || formData.invoice_type === 'OUTGOING_SUPPLIER') {
    supplier_id = formData.supplier_id || null
    invoice_category = 'SUBCONTRACTOR'
  } else if (formData.invoice_type === 'INCOMING_OFFICE' || formData.invoice_type === 'OUTGOING_OFFICE') {
    office_supplier_id = formData.office_supplier_id || null
    invoice_category = 'OFFICE'
  } else if (formData.invoice_type === 'INCOMING_INVESTMENT') {
    investor_id = formData.investor_id || null
    bank_id = formData.bank_id || null
    invoice_category = investor_id ? 'INVESTOR' : 'BANK_CREDIT'
  } else if (formData.invoice_type === 'OUTGOING_SALES') {
    customer_id = formData.customer_id || null
    invoice_category = 'CUSTOMER'
  }

  let approved = false
  if (formData.invoice_type === 'INCOMING_OFFICE' || formData.invoice_type === 'OUTGOING_OFFICE') {
    approved = true
  } else if (formData.invoice_type === 'INCOMING_INVESTMENT' && bank_id) {
    approved = true
  }

  const invoiceData = {
    invoice_type: formData.invoice_type,
    invoice_category,
    company_id: formData.company_id,
    company_bank_account_id: null,
    supplier_id,
    office_supplier_id,
    customer_id,
    investor_id,
    bank_id,
    apartment_id: formData.apartment_id || null,
    contract_id: formData.contract_id || null,
    milestone_id: formData.milestone_id || null,
    invoice_number: formData.invoice_number,
    reference_number: formData.reference_number || null,
    iban: formData.iban || null,
    issue_date: formData.issue_date,
    due_date: formData.due_date,
    base_amount_1: formData.base_amount_1 || 0,
    base_amount_2: formData.base_amount_2 || 0,
    base_amount_3: formData.base_amount_3 || 0,
    base_amount_4: formData.base_amount_4 || 0,
    category: formData.category,
    project_id: formData.project_id || null,
    refund_id: formData.refund_id ? parseInt(formData.refund_id) : null,
    description: formData.description,
    approved,
    created_by: user?.id
  }

  if (editingInvoice) {
    const { error } = await supabase
      .from('accounting_invoices')
      .update(invoiceData)
      .eq('id', editingInvoice.id)

    if (error) throw error
  } else {
    const { error } = await supabase
      .from('accounting_invoices')
      .insert([invoiceData])

    if (error) throw error
  }
}

export const handlePaymentSubmit = async (
  paymentFormData: any,
  payingInvoice: Invoice
) => {
  const { data: { user } } = await supabase.auth.getUser()

  const paymentData = {
    invoice_id: payingInvoice.id,
    payment_source_type: paymentFormData.payment_source_type,
    company_bank_account_id: paymentFormData.is_cesija ? null : (paymentFormData.payment_source_type === 'bank_account' ? (paymentFormData.company_bank_account_id || null) : null),
    credit_id: paymentFormData.is_cesija ? null : (paymentFormData.payment_source_type === 'credit' ? (paymentFormData.credit_id || null) : null),
    credit_allocation_id: paymentFormData.is_cesija ? null : (paymentFormData.payment_source_type === 'credit' ? (paymentFormData.credit_allocation_id || null) : null),
    is_cesija: paymentFormData.is_cesija,
    cesija_company_id: paymentFormData.is_cesija ? (paymentFormData.cesija_company_id || null) : null,
    cesija_bank_account_id: paymentFormData.is_cesija && paymentFormData.payment_source_type === 'bank_account' ? (paymentFormData.cesija_bank_account_id || null) : null,
    cesija_credit_id: paymentFormData.is_cesija && paymentFormData.payment_source_type === 'credit' ? (paymentFormData.cesija_credit_id || null) : null,
    cesija_credit_allocation_id: paymentFormData.is_cesija && paymentFormData.payment_source_type === 'credit' ? (paymentFormData.cesija_credit_allocation_id || null) : null,
    payment_date: paymentFormData.payment_date,
    amount: paymentFormData.amount,
    payment_method: paymentFormData.payment_method,
    reference_number: paymentFormData.reference_number || null,
    description: paymentFormData.description,
    created_by: user?.id
  }

  const { error } = await supabase
    .from('accounting_payments')
    .insert([paymentData])

  if (error) throw error
}

export const handleDelete = async (id: string) => {
  const { error } = await supabase
    .from('accounting_invoices')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export const fetchCreditAllocations = async (creditId: string) => {
  const { data, error } = await supabase
    .from('credit_allocations')
    .select(`
      id,
      credit_id,
      project_id,
      allocated_amount,
      used_amount,
      description,
      project:projects(id, name)
    `)
    .eq('credit_id', creditId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export const fetchMilestones = async (contractId: string) => {
  const { data, error } = await supabase
    .from('subcontractor_milestones')
    .select('*')
    .eq('contract_id', contractId)
    .order('milestone_number', { ascending: true })

  if (error) throw error
  return data || []
}
