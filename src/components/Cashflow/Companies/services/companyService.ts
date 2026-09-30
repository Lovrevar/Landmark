import { supabase } from '../../../../lib/supabase'
import { assertRowsAffected } from '../../../../lib/dbErrors'
import { logActivity } from '../../../../lib/activityLog'
import { CompanyStats, CompanyFormData } from '../types'

export const fetchCompaniesWithStats = async (): Promise<CompanyStats[]> => {
  const { data: statsData, error: statsError } = await supabase
    .from('company_statistics')
    .select('*')
    .order('name')

  if (statsError) throw statsError

  interface CompanyStatRow {
    id: string
    name: string
    oib: string
    initial_balance: number
    total_income_invoices: number
    total_income_amount: number
    total_income_paid: number
    total_income_unpaid: number
    total_expense_invoices: number
    total_expense_amount: number
    total_expense_paid: number
    total_expense_unpaid: number
    total_bank_balance: number
  }

  const companiesWithStats = (statsData || []).map((stats: CompanyStatRow) => ({
    id: stats.id,
    name: stats.name,
    oib: stats.oib,
    initial_balance: stats.initial_balance,
    total_income_invoices: stats.total_income_invoices,
    total_income_amount: stats.total_income_amount,
    total_income_paid: stats.total_income_paid,
    total_income_unpaid: stats.total_income_unpaid,
    total_expense_invoices: stats.total_expense_invoices,
    total_expense_amount: stats.total_expense_amount,
    total_expense_paid: stats.total_expense_paid,
    total_expense_unpaid: stats.total_expense_unpaid,
    current_balance: stats.total_bank_balance,
    profit: stats.total_income_paid - stats.total_expense_paid,
    revenue: stats.total_income_amount,
    bank_accounts: [],
    credits: [],
    invoices: []
  }))

  return companiesWithStats
}

export const fetchBankAccountsForCompany = async (companyId: string) => {
  const { data: bankAccountsData } = await supabase
    .from('company_bank_accounts')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at')

  return (bankAccountsData || []).map(acc => ({
    id: acc.id,
    bank_name: acc.bank_name,
    current_balance: acc.initial_balance,
    balance_reset_at: acc.balance_reset_at
      ? acc.balance_reset_at.split('T')[0]
      : null
  }))
}

export const createCompany = async (formData: CompanyFormData) => {
  const { data: companyData, error: companyError } = await supabase
    .from('accounting_companies')
    .insert([{
      name: formData.name,
      oib: formData.oib,
      initial_balance: 0
    }])
    .select()
    .single()

  if (companyError) throw companyError

  // The entered figure is the opening balance: it goes into initial_balance, which the balance
  // trigger rebuilds from, dated now. With initial_balance 0 the first payment wiped it.
  const openedAt = new Date().toISOString()
  const bankAccountsToInsert = formData.bankAccounts.map(acc => ({
    company_id: companyData.id,
    bank_name: acc.bank_name,
    initial_balance: acc.current_balance,
    current_balance: acc.current_balance,
    balance_reset_at: openedAt
  }))

  if (bankAccountsToInsert.length > 0) {
    const { error: bankError } = await supabase
      .from('company_bank_accounts')
      .insert(bankAccountsToInsert)

    if (bankError) {
      // Roll back the orphaned company so a half-created record isn't left behind
      await supabase.from('accounting_companies').delete().eq('id', companyData.id)
      throw bankError
    }
  }

  // Log only once both inserts have succeeded so the audit trail matches reality
  logActivity({ action: 'company.create', entity: 'company', entityId: companyData.id, metadata: { severity: 'medium', entity_name: formData.name } })

  if (bankAccountsToInsert.length > 0) {
    logActivity({
      action: 'bank_account.create',
      entity: 'bank_account',
      metadata: { severity: 'medium', count: bankAccountsToInsert.length, company_id: companyData.id, entity_name: formData.name }
    })
  }
}

export const updateCompany = async (companyId: string, formData: CompanyFormData) => {
  const { error } = await supabase
    .from('accounting_companies')
    .update({
      name: formData.name,
      oib: formData.oib,
      updated_at: new Date().toISOString()
    })
    .eq('id', companyId)

  if (error) throw error

  logActivity({ action: 'company.update', entity: 'company', entityId: companyId, metadata: { severity: 'medium', entity_name: formData.name, changed_fields: ['name', 'oib'] } })

  for (const account of formData.bankAccounts) {
    if (account.id) {
      const resetAt = account.balance_reset_at
        ? `${account.balance_reset_at}T00:00:00+00:00`
        : new Date().toISOString()

      // The database sets the new balance and date and rebuilds current_balance with the same
      // formula the payment and loan triggers use (reset_company_bank_account_balance).
      const { error: resetError } = await supabase.rpc('reset_company_bank_account_balance', {
        p_account_id: account.id,
        p_balance: account.current_balance,
        p_reset_at: resetAt,
      })
      if (resetError) throw resetError

      logActivity({
        action: 'bank_account.balance_reset',
        entity: 'bank_account',
        entityId: account.id,
        metadata: {
          severity: 'high',
          new_balance: account.current_balance,
          reset_date: account.balance_reset_at || null,
          entity_name: account.bank_name,
        },
      })
    }
  }
}

export const deleteCompany = async (companyId: string) => {
  const { data, error } = await supabase
    .from('accounting_companies')
    .delete()
    .eq('id', companyId)
    .select('id')

  if (error) throw error
  assertRowsAffected(data)

  logActivity({ action: 'company.delete', entity: 'company', entityId: companyId, metadata: { severity: 'high' } })
}

export const fetchCompanyDetails = async (companyId: string) => {
  const [
    bankAccountsResult,
    creditsResult,
    invoicesResult
  ] = await Promise.all([
    supabase
      .from('company_bank_accounts')
      .select('*')
      .eq('company_id', companyId)
      .order('bank_name'),

    supabase
      .from('bank_credits')
      .select(`
        *,
        used_amount,
        repaid_amount,
        disbursed_to_account,
        allocations:credit_allocations(
          id,
          allocated_amount,
          description,
          project:projects(id, name)
        )
      `)
      .eq('company_id', companyId)
      .order('credit_name'),

    supabase
      .from('accounting_invoices')
      .select(`
        id,
        invoice_number,
        invoice_type,
        invoice_category,
        total_amount,
        paid_amount,
        remaining_amount,
        status,
        issue_date,
        supplier:supplier_id (name),
        customer:customer_id (name, surname),
        office_supplier:office_supplier_id (name),
        retail_supplier:retail_suppliers!accounting_invoices_retail_supplier_id_fkey (name),
        retail_customer:retail_customers!accounting_invoices_retail_customer_id_fkey (name),
        company:company_id (name),
        bank:bank_id (name)
      `)
      .eq('company_id', companyId)
      .order('issue_date', { ascending: false })
      .limit(100)
  ])

  const bankAccounts = bankAccountsResult.data || []
  const bankAccountIds = bankAccounts.map(ba => ba.id)
  const credits = creditsResult.data || []
  const creditIds = credits.map(c => c.id)

  let cesijaPaidInvoices: Array<{ id: string; [key: string]: unknown }> = []

  const orConditions = [`cesija_company_id.eq.${companyId}`]
  if (creditIds.length > 0) {
    orConditions.push(`cesija_credit_id.in.(${creditIds.join(',')})`)
  }
  if (bankAccountIds.length > 0) {
    orConditions.push(`cesija_bank_account_id.in.(${bankAccountIds.join(',')})`)
  }

  const { data: paymentsWhereWePayOthers } = await supabase
    .from('accounting_payments')
    .select(`
      invoice_id,
      cesija_company_id,
      accounting_invoices!inner(company_id)
    `)
    .eq('is_cesija', true)
    .or(orConditions.join(','))

  const ownInvoiceIds = (invoicesResult.data || []).map(inv => inv.id)
  const { data: paymentsWhereOthersPayUs } = await supabase
    .from('accounting_payments')
    .select(`
      invoice_id,
      cesija_company_id
    `)
    .eq('is_cesija', true)
    .in('invoice_id', ownInvoiceIds.length > 0 ? ownInvoiceIds : ['null'])

  const allCesijaPayments = [
    ...(paymentsWhereWePayOthers || []),
    ...(paymentsWhereOthersPayUs || [])
  ]

  const cesijaPaidInvoiceIds = [...new Set(allCesijaPayments.map(p => p.invoice_id))]

  if (cesijaPaidInvoiceIds.length > 0) {
    const { data: cesiaInvoicesData } = await supabase
      .from('accounting_invoices')
      .select(`
        id,
        invoice_number,
        invoice_type,
        invoice_category,
        total_amount,
        paid_amount,
        remaining_amount,
        status,
        issue_date,
        supplier:supplier_id (name),
        customer:customer_id (name, surname),
        office_supplier:office_supplier_id (name),
        retail_supplier:retail_suppliers!accounting_invoices_retail_supplier_id_fkey (name),
        retail_customer:retail_customers!accounting_invoices_retail_customer_id_fkey (name),
        company:company_id (name),
        bank:bank_id (name)
      `)
      .in('id', cesijaPaidInvoiceIds)
      .order('issue_date', { ascending: false })

    cesijaPaidInvoices = (cesiaInvoicesData || []).map(inv => {
      const payment = allCesijaPayments.find(p => p.invoice_id === inv.id)
      return {
        ...inv,
        is_cesija_payment: true,
        cesija_company_id: payment?.cesija_company_id
      }
    })
  }

  const ownInvoices = (invoicesResult.data || []).map(inv => {
    const payment = allCesijaPayments.find(p => p.invoice_id === inv.id)
    return {
      ...inv,
      is_cesija_payment: !!payment,
      cesija_company_id: payment?.cesija_company_id
    }
  })

  const allInvoicesMap = new Map()
  ownInvoices.forEach(inv => allInvoicesMap.set(inv.id, inv))
  cesijaPaidInvoices.forEach(inv => {
    if (!allInvoicesMap.has(inv.id)) {
      allInvoicesMap.set(inv.id, inv)
    }
  })

  const allInvoices = Array.from(allInvoicesMap.values()).sort((a, b) =>
    new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime()
  )

  const companiesData = await supabase
    .from('accounting_companies')
    .select('id, name')

  const companiesMap = new Map((companiesData.data || []).map(c => [c.id, c.name]))

  const allInvoicesWithCesija = allInvoices.map(inv => {
    let cesija_name = null

    if (inv.is_cesija_payment) {
      if (inv.cesija_company_id === companyId) {
        cesija_name = inv.company?.name || companiesMap.get(inv.company_id)
      } else {
        cesija_name = companiesMap.get(inv.cesija_company_id)
      }
    }

    return {
      ...inv,
      cesija_company_name: cesija_name
    }
  })

  return {
    bankAccounts,
    credits,
    invoices: allInvoicesWithCesija
  }
}
