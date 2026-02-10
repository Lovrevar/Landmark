import { supabase } from '../../../lib/supabase'
import { CompanyStats, CompanyFormData } from '../types/companyTypes'

export const fetchCompaniesWithStats = async (): Promise<CompanyStats[]> => {
  const { data: statsData, error: statsError } = await supabase
    .from('company_statistics')
    .select('*')
    .order('name')

  if (statsError) throw statsError

  const companiesWithStats = (statsData || []).map((stats: any) => ({
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
    current_balance: stats.total_bank_balance + stats.total_credits_available,
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
    initial_balance: acc.initial_balance
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

  const bankAccountsToInsert = formData.bankAccounts.map(acc => ({
    company_id: companyData.id,
    bank_name: acc.bank_name,
    initial_balance: acc.initial_balance,
    current_balance: acc.initial_balance
  }))

  const { error: bankError } = await supabase
    .from('company_bank_accounts')
    .insert(bankAccountsToInsert)

  if (bankError) throw bankError
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

  for (const account of formData.bankAccounts) {
    if (account.id) {
      const { error: updateError } = await supabase
        .from('company_bank_accounts')
        .update({
          initial_balance: account.initial_balance,
          updated_at: new Date().toISOString()
        })
        .eq('id', account.id)

      if (updateError) throw updateError

      const { data: directPayments } = await supabase
        .from('accounting_payments')
        .select('amount, invoice:accounting_invoices!inner(invoice_type)')
        .eq('company_bank_account_id', account.id)

      const { data: cesijaPayments } = await supabase
        .from('accounting_payments')
        .select('amount')
        .eq('cesija_bank_account_id', account.id)
        .eq('is_cesija', true)

      let totalChange = 0

      if (directPayments && directPayments.length > 0) {
        totalChange += directPayments.reduce((sum, payment: any) => {
          const invoiceType = payment.invoice?.invoice_type
          if (invoiceType && ['INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_BANK'].includes(invoiceType)) {
            return sum + payment.amount
          } else if (invoiceType && ['INCOMING_SUPPLIER', 'INCOMING_OFFICE', 'OUTGOING_SUPPLIER', 'OUTGOING_OFFICE', 'INCOMING_BANK', 'OUTGOING_RETAIL_DEVELOPMENT', 'OUTGOING_RETAIL_CONSTRUCTION'].includes(invoiceType)) {
            return sum - payment.amount
          }
          return sum
        }, 0)
      }

      if (cesijaPayments && cesijaPayments.length > 0) {
        const cesijaTotal = cesijaPayments.reduce((sum, payment: any) => sum + payment.amount, 0)
        totalChange -= cesijaTotal
      }

      const { error: balanceError } = await supabase
        .from('company_bank_accounts')
        .update({
          current_balance: account.initial_balance + totalChange
        })
        .eq('id', account.id)

      if (balanceError) throw balanceError
    }
  }
}

export const deleteCompany = async (companyId: string) => {
  const { error } = await supabase
    .from('accounting_companies')
    .delete()
    .eq('id', companyId)

  if (error) throw error
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

  let cesijaPaidInvoices: any[] = []

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
