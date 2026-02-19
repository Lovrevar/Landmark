import { supabase } from '../../../lib/supabase'
import { format, startOfMonth, endOfMonth, startOfYear, subMonths } from 'date-fns'
import type { VATStats, CashFlowStats, TopCompany, MonthlyData, MonthlyBudget } from '../types/accountingDashboardTypes'

const isIncomingPaymentType = (invoiceType: string): boolean =>
  invoiceType.startsWith('OUTGOING') ||
  invoiceType === 'INCOMING_BANK_CREDIT' ||
  invoiceType === 'INCOMING_BANK_DRAWN' ||
  invoiceType === 'INCOMING_INVESTOR'

const isOutgoingPaymentType = (invoiceType: string): boolean =>
  invoiceType.startsWith('INCOMING') &&
  invoiceType !== 'INCOMING_BANK_CREDIT' &&
  invoiceType !== 'INCOMING_BANK_DRAWN' &&
  invoiceType !== 'INCOMING_INVESTOR'

const sumVATAmounts = (invoice: any): number =>
  parseFloat(invoice.vat_amount_1 || 0) +
  parseFloat(invoice.vat_amount_2 || 0) +
  parseFloat(invoice.vat_amount_3 || 0) +
  parseFloat(invoice.vat_amount_4 || 0)

export async function fetchVATStats(): Promise<VATStats> {
  const currentMonthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const currentMonthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')
  const yearStart = format(startOfYear(new Date()), 'yyyy-MM-dd')

  const { data: invoices, error } = await supabase
    .from('accounting_invoices')
    .select('invoice_type, vat_amount_1, vat_amount_2, vat_amount_3, vat_amount_4, issue_date, status')
    .eq('status', 'PAID')
    .gte('issue_date', yearStart)

  if (error) throw error

  const outgoingInvoices = (invoices || []).filter(inv => inv.invoice_type.startsWith('OUTGOING'))
  const incomingInvoices = (invoices || []).filter(inv =>
    inv.invoice_type.startsWith('INCOMING') &&
    inv.invoice_type !== 'INCOMING_INVESTOR' &&
    inv.invoice_type !== 'INCOMING_BANK_CREDIT' &&
    inv.invoice_type !== 'INCOMING_BANK_DRAWN'
  )

  const totalVATCollected = outgoingInvoices.reduce((sum, inv) => sum + sumVATAmounts(inv), 0)
  const totalVATPaid = incomingInvoices.reduce((sum, inv) => sum + sumVATAmounts(inv), 0)

  const currentMonthVATCollected = outgoingInvoices
    .filter(inv => inv.issue_date >= currentMonthStart && inv.issue_date <= currentMonthEnd)
    .reduce((sum, inv) => sum + sumVATAmounts(inv), 0)

  const currentMonthVATPaid = incomingInvoices
    .filter(inv => inv.issue_date >= currentMonthStart && inv.issue_date <= currentMonthEnd)
    .reduce((sum, inv) => sum + sumVATAmounts(inv), 0)

  return {
    totalVATCollected,
    totalVATPaid,
    netVAT: totalVATCollected - totalVATPaid,
    currentMonthVATCollected,
    currentMonthVATPaid
  }
}

export async function fetchCashFlowStats(): Promise<CashFlowStats> {
  const currentMonthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const currentMonthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')
  const previousMonthStart = format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
  const previousMonthEnd = format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
  const yearStart = format(startOfYear(new Date()), 'yyyy-MM-dd')

  const { data: payments, error } = await supabase
    .from('accounting_payments')
    .select('amount, payment_date, invoice_id, accounting_invoices!inner(invoice_type)')
    .gte('payment_date', yearStart)

  if (error) throw error

  const incomingPayments = (payments || []).filter(p =>
    isIncomingPaymentType((p.accounting_invoices as any).invoice_type)
  )
  const outgoingPayments = (payments || []).filter(p =>
    isOutgoingPaymentType((p.accounting_invoices as any).invoice_type)
  )

  const sumByDateRange = (arr: any[], start: string, end: string) =>
    arr
      .filter(p => p.payment_date >= start && p.payment_date <= end)
      .reduce((sum, p) => sum + parseFloat(p.amount), 0)

  return {
    totalIncoming: incomingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0),
    totalOutgoing: outgoingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0),
    netCashFlow:
      incomingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0) -
      outgoingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0),
    currentMonthIncoming: sumByDateRange(incomingPayments, currentMonthStart, currentMonthEnd),
    currentMonthOutgoing: sumByDateRange(outgoingPayments, currentMonthStart, currentMonthEnd),
    previousMonthIncoming: sumByDateRange(incomingPayments, previousMonthStart, previousMonthEnd),
    previousMonthOutgoing: sumByDateRange(outgoingPayments, previousMonthStart, previousMonthEnd)
  }
}

export async function fetchTopCompanies(): Promise<TopCompany[]> {
  const yearStart = format(startOfYear(new Date()), 'yyyy-MM-dd')

  const { data: companies, error } = await supabase
    .from('accounting_companies')
    .select('id, name')

  if (error) throw error
  if (!companies || companies.length === 0) return []

  const companyIds = companies.map(c => c.id)

  const [bankAccountsResult, paymentsResult, invoiceCountsResult] = await Promise.all([
    supabase
      .from('company_bank_accounts')
      .select('company_id, current_balance')
      .in('company_id', companyIds),
    supabase
      .from('accounting_payments')
      .select('amount, payment_date, accounting_invoices!inner(invoice_type, company_id)')
      .in('accounting_invoices.company_id', companyIds)
      .gte('payment_date', yearStart),
    Promise.all(
      companyIds.map(id =>
        supabase
          .from('accounting_invoices')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', id)
          .then(result => ({ company_id: id, count: result.count || 0 }))
      )
    )
  ])

  const bankAccountsByCompany = new Map<string, number>()
  for (const acc of bankAccountsResult.data || []) {
    const current = bankAccountsByCompany.get(acc.company_id) || 0
    bankAccountsByCompany.set(acc.company_id, current + parseFloat(acc.current_balance || '0'))
  }

  const paymentsByCompany = new Map<string, { incoming: number; outgoing: number }>()
  for (const payment of paymentsResult.data || []) {
    const companyId = (payment.accounting_invoices as any).company_id
    const invoiceType = (payment.accounting_invoices as any).invoice_type
    if (!paymentsByCompany.has(companyId)) {
      paymentsByCompany.set(companyId, { incoming: 0, outgoing: 0 })
    }
    const stats = paymentsByCompany.get(companyId)!
    const amount = parseFloat(payment.amount)
    if (isIncomingPaymentType(invoiceType)) stats.incoming += amount
    else if (isOutgoingPaymentType(invoiceType)) stats.outgoing += amount
  }

  const invoiceCountsByCompany = new Map<string, number>()
  for (const row of invoiceCountsResult) {
    invoiceCountsByCompany.set(row.company_id, row.count)
  }

  const companyStats: TopCompany[] = companies.map(company => {
    const payments = paymentsByCompany.get(company.id) || { incoming: 0, outgoing: 0 }
    return {
      id: company.id,
      name: company.name,
      totalIncoming: payments.incoming,
      totalOutgoing: payments.outgoing,
      netBalance: bankAccountsByCompany.get(company.id) || 0,
      invoiceCount: invoiceCountsByCompany.get(company.id) || 0
    }
  })

  return companyStats.sort((a, b) => b.netBalance - a.netBalance).slice(0, 5)
}

export async function fetchMonthlyTrends(): Promise<MonthlyData[]> {
  const yearStart = format(startOfYear(new Date()), 'yyyy-MM-dd')

  const { data: payments, error } = await supabase
    .from('accounting_payments')
    .select('amount, payment_date, accounting_invoices!inner(invoice_type)')
    .gte('payment_date', yearStart)

  if (error) throw error

  const monthlyMap = new Map<string, { incoming: number; outgoing: number }>()

  for (const payment of payments || []) {
    const month = format(new Date(payment.payment_date), 'MMM yyyy')
    const invoiceType = (payment.accounting_invoices as any).invoice_type

    if (!monthlyMap.has(month)) monthlyMap.set(month, { incoming: 0, outgoing: 0 })

    const data = monthlyMap.get(month)!
    const amount = parseFloat(payment.amount)

    if (isIncomingPaymentType(invoiceType)) data.incoming += amount
    else if (isOutgoingPaymentType(invoiceType)) data.outgoing += amount
  }

  return Array.from(monthlyMap.entries()).map(([month, data]) => ({
    month,
    incoming: data.incoming,
    outgoing: data.outgoing
  }))
}

export async function fetchMonthlyBudget(): Promise<MonthlyBudget | null> {
  const currentDate = new Date()
  const { data, error } = await supabase
    .from('monthly_budgets')
    .select('*')
    .eq('month', currentDate.getMonth() + 1)
    .eq('year', currentDate.getFullYear())
    .maybeSingle()

  if (error) throw error
  return data
}
