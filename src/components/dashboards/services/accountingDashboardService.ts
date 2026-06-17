import { supabase } from '../../../lib/supabase'
import { format, startOfMonth, endOfMonth, startOfYear, subMonths } from 'date-fns'
import { monthKey } from '../../../utils/dateOnly'
import type { VATStats, CashFlowStats, TopCompany, MonthlyData, MonthlyBudget } from '../types/accountingDashboardTypes'

// Cash-flow direction by invoice_type, keyed against the real DB enum
// (accounting_invoices_invoice_type_check). "Incoming cash" = money the company
// receives: every OUTGOING_* invoice (issued to customers) plus INCOMING_INVESTMENT
// (investor capital / bank drawdowns — confirmed as cash IN, matching the Cashflow
// Calendar convention). "Outgoing cash" = bills the company pays.
const INCOMING_CASH_TYPES = new Set([
  'OUTGOING_SUPPLIER',
  'OUTGOING_SALES',
  'OUTGOING_OFFICE',
  'OUTGOING_BANK',
  'INCOMING_INVESTMENT'
])

const OUTGOING_CASH_TYPES = new Set([
  'INCOMING_SUPPLIER',
  'INCOMING_OFFICE',
  'INCOMING_BANK',
  'INCOMING_BANK_EXPENSES'
])

const isIncomingPaymentType = (invoiceType: string): boolean => INCOMING_CASH_TYPES.has(invoiceType)
const isOutgoingPaymentType = (invoiceType: string): boolean => OUTGOING_CASH_TYPES.has(invoiceType)

const sumVATAmounts = (invoice: { vat_amount_1?: string | number | null; vat_amount_2?: string | number | null; vat_amount_3?: string | number | null; vat_amount_4?: string | number | null }): number =>
  Number(invoice.vat_amount_1 || 0) +
  Number(invoice.vat_amount_2 || 0) +
  Number(invoice.vat_amount_3 || 0) +
  Number(invoice.vat_amount_4 || 0)

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

  // Output VAT comes from sales (OUTGOING). Input VAT (pretporez) is only
  // deductible on taxable purchases — exclude INCOMING_INVESTMENT (financing
  // carries no input VAT) so Net PDV isn't distorted.
  const inputVATTypes = new Set([
    'INCOMING_SUPPLIER',
    'INCOMING_OFFICE',
    'INCOMING_BANK',
    'INCOMING_BANK_EXPENSES'
  ])
  const outgoingInvoices = (invoices || []).filter(inv => inv.invoice_type.startsWith('OUTGOING'))
  const incomingInvoices = (invoices || []).filter(inv => inputVATTypes.has(inv.invoice_type))

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
    isIncomingPaymentType((p.accounting_invoices as unknown as { invoice_type: string }).invoice_type)
  )
  const outgoingPayments = (payments || []).filter(p =>
    isOutgoingPaymentType((p.accounting_invoices as unknown as { invoice_type: string }).invoice_type)
  )

  const sumByDateRange = (arr: Array<{ amount: string; payment_date: string }>, start: string, end: string) =>
    arr
      .filter(p => p.payment_date >= start && p.payment_date <= end)
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)

  const totalIncoming = incomingPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  const totalOutgoing = outgoingPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)

  return {
    totalIncoming,
    totalOutgoing,
    netCashFlow: totalIncoming - totalOutgoing,
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

  // Single grouped query for invoice counts (year-scoped to match the card's
  // "{year}" heading) instead of one count round-trip per company.
  const [paymentsResult, invoiceCountsResult] = await Promise.all([
    supabase
      .from('accounting_payments')
      .select('amount, payment_date, accounting_invoices!inner(invoice_type, company_id)')
      .in('accounting_invoices.company_id', companyIds)
      .gte('payment_date', yearStart),
    supabase
      .from('accounting_invoices')
      .select('company_id')
      .in('company_id', companyIds)
      .gte('issue_date', yearStart)
  ])

  const paymentsByCompany = new Map<string, { incoming: number; outgoing: number }>()
  for (const payment of paymentsResult.data || []) {
    const companyId = (payment.accounting_invoices as unknown as { company_id: string; invoice_type: string }).company_id
    const invoiceType = (payment.accounting_invoices as unknown as { company_id: string; invoice_type: string }).invoice_type
    if (!paymentsByCompany.has(companyId)) {
      paymentsByCompany.set(companyId, { incoming: 0, outgoing: 0 })
    }
    const stats = paymentsByCompany.get(companyId)!
    const amount = parseFloat(payment.amount) || 0
    if (isIncomingPaymentType(invoiceType)) stats.incoming += amount
    else if (isOutgoingPaymentType(invoiceType)) stats.outgoing += amount
  }

  const invoiceCountsByCompany = new Map<string, number>()
  for (const row of invoiceCountsResult.data || []) {
    invoiceCountsByCompany.set(row.company_id, (invoiceCountsByCompany.get(row.company_id) || 0) + 1)
  }

  const companyStats: TopCompany[] = companies.map(company => {
    const payments = paymentsByCompany.get(company.id) || { incoming: 0, outgoing: 0 }
    return {
      id: company.id,
      name: company.name,
      totalIncoming: payments.incoming,
      totalOutgoing: payments.outgoing,
      // Net payment flow (in − out), consistent with the In/Out figures shown
      // on each row — not an unrelated point-in-time bank balance.
      netBalance: payments.incoming - payments.outgoing,
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

  // Pre-seed every month from Jan to the current month with zeros, keyed by a
  // sortable 'YYYY-MM' so the chart shows gaps as zeros and stays chronological.
  const now = new Date()
  const monthlyMap = new Map<string, { incoming: number; outgoing: number; label: string }>()
  for (let m = 0; m <= now.getMonth(); m++) {
    const d = new Date(now.getFullYear(), m, 1)
    monthlyMap.set(format(d, 'yyyy-MM'), { incoming: 0, outgoing: 0, label: format(d, 'MMM yyyy') })
  }

  for (const payment of payments || []) {
    const key = monthKey(payment.payment_date)
    const data = monthlyMap.get(key)
    if (!data) continue
    const invoiceType = (payment.accounting_invoices as unknown as { invoice_type: string }).invoice_type
    const amount = parseFloat(payment.amount) || 0
    if (isIncomingPaymentType(invoiceType)) data.incoming += amount
    else if (isOutgoingPaymentType(invoiceType)) data.outgoing += amount
  }

  return Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, data]) => ({ month: data.label, incoming: data.incoming, outgoing: data.outgoing }))
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
