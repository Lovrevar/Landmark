import { supabase } from '../../../lib/supabase'
import { startOfMonth, differenceInDays } from 'date-fns'
import type { ProjectStats, FinancialMetrics, SalesMetrics, ConstructionMetrics, FundingMetrics, Alert } from '../types/directorTypes'

export async function fetchProjectsData(): Promise<ProjectStats[]> {
  const [
    { data: projectsData, error: projectsError },
    { data: apartments },
    { data: contracts },
    { data: accountingInvoices },
    { data: creditAllocations },
    { data: bankCredits }
  ] = await Promise.all([
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('apartments').select('id, project_id, price, status'),
    supabase.from('contracts').select('id, project_id, total_amount'),
    supabase.from('accounting_invoices').select('id, contract_id, project_id, invoice_type, total_amount'),
    supabase.from('credit_allocations').select('project_id, allocated_amount'),
    supabase.from('bank_credits').select('project_id, outstanding_balance')
  ])

  if (projectsError) throw projectsError

  const apartmentsArray = apartments || []
  const contractsArray = contracts || []
  const invoicesArray = accountingInvoices || []
  const allocationsArray = creditAllocations || []
  const creditsArray = bankCredits || []

  return (projectsData || []).map((project) => {
    const projectApartments = apartmentsArray.filter(a => a.project_id === project.id)
    const projectContracts = contractsArray.filter(c => c.project_id === project.id)

    const contractExpenses = projectContracts.map(c => {
      const contractInvoices = invoicesArray.filter(
        inv => inv.contract_id === c.id &&
        (inv.invoice_type === 'INCOMING_SUPPLIER' || inv.invoice_type === 'INCOMING_OFFICE')
      )
      const invoicedTotal = contractInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
      return Math.max(c.total_amount || 0, invoicedTotal)
    })

    const invoicesWithoutContract = invoicesArray
      .filter(inv =>
        inv.project_id === project.id &&
        !inv.contract_id &&
        (inv.invoice_type === 'INCOMING_SUPPLIER' || inv.invoice_type === 'INCOMING_OFFICE')
      )
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0)

    const totalExpenses = contractExpenses.reduce((sum, exp) => sum + exp, 0) + invoicesWithoutContract
    const soldApts = projectApartments.filter(a => a.status === 'Sold')
    const apartmentSales = soldApts.reduce((sum, a) => sum + a.price, 0)
    const totalInvestment = allocationsArray
      .filter(alloc => alloc.project_id === project.id)
      .reduce((sum, alloc) => sum + (alloc.allocated_amount || 0), 0)
    const totalDebt = creditsArray
      .filter(bc => bc.project_id === project.id)
      .reduce((sum, bc) => sum + bc.outstanding_balance, 0)
    const totalUnits = projectApartments.length
    const soldUnits = soldApts.length
    const completionPercentage = totalUnits > 0 ? (soldUnits / totalUnits) * 100 : 0
    const profit = apartmentSales - totalExpenses
    const profitMargin = apartmentSales > 0 ? (profit / apartmentSales) * 100 : 0

    return {
      id: project.id,
      name: project.name,
      location: project.location,
      status: project.status,
      budget: project.budget,
      total_expenses: totalExpenses,
      apartment_sales: apartmentSales,
      total_investment: totalInvestment,
      total_debt: totalDebt,
      profit_margin: profitMargin,
      completion_percentage: completionPercentage
    }
  })
}

export async function fetchFinancialMetrics(): Promise<FinancialMetrics> {
  const [
    { data: sales },
    { data: invoices },
    { data: accountingPayments },
    { data: accountingInvoices },
    { data: bankCredits },
    { data: creditAllocations },
    { data: apartmentsData }
  ] = await Promise.all([
    supabase.from('sales').select('sale_price'),
    supabase.from('accounting_invoices').select('paid_amount, invoice_category'),
    supabase.from('accounting_payments').select('amount, payment_date, invoice_id'),
    supabase.from('accounting_invoices').select('id, invoice_category'),
    supabase.from('bank_credits').select('outstanding_balance'),
    supabase.from('credit_allocations').select('allocated_amount'),
    supabase.from('apartments').select('price, status').in('status', ['Sold', 'Reserved'])
  ])

  const apartmentPayments = (accountingPayments || []).filter(p => {
    const invoice = (accountingInvoices || []).find(inv => inv.id === p.invoice_id)
    return invoice?.invoice_category === 'CUSTOMER'
  })

  const totalRevenue = (sales || []).reduce((sum, s) => sum + s.sale_price, 0)
  const totalExpenses = (invoices || []).reduce((sum, inv) => sum + Number(inv.paid_amount), 0)
  const totalProfit = totalRevenue - totalExpenses
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
  const totalDebt = (bankCredits || []).reduce((sum, bc) => sum + bc.outstanding_balance, 0)
  const totalEquity = (creditAllocations || []).reduce((sum, alloc) => sum + Number(alloc.allocated_amount), 0)
  const debtToEquityRatio = totalEquity > 0 ? totalDebt / totalEquity : 0
  const currentMonth = startOfMonth(new Date())
  const cashFlowCurrentMonth = apartmentPayments
    .filter(p => p.payment_date && new Date(p.payment_date) >= currentMonth)
    .reduce((sum, p) => sum + p.amount, 0)
  const outstandingReceivables = (apartmentsData || []).reduce((sum, apt) => {
    if (apt.status === 'Reserved') return sum + apt.price
    return sum
  }, 0)

  return {
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    total_profit: totalProfit,
    profit_margin: profitMargin,
    total_debt: totalDebt,
    total_equity: totalEquity,
    debt_to_equity_ratio: debtToEquityRatio,
    cash_flow_current_month: cashFlowCurrentMonth,
    outstanding_receivables: outstandingReceivables,
    outstanding_payables: totalDebt
  }
}

export async function fetchSalesMetrics(): Promise<SalesMetrics> {
  const [{ data: apartments }, { data: sales }] = await Promise.all([
    supabase.from('apartments').select('id, status, price'),
    supabase.from('sales').select('sale_price, sale_date')
  ])

  const totalUnits = apartments?.length || 0
  const soldUnits = apartments?.filter(a => a.status === 'Sold').length || 0
  const reservedUnits = apartments?.filter(a => a.status === 'Reserved').length || 0
  const availableUnits = apartments?.filter(a => a.status === 'Available').length || 0
  const salesRate = totalUnits > 0 ? (soldUnits / totalUnits) * 100 : 0
  const totalSalesRevenue = (sales || []).reduce((sum, s) => sum + s.sale_price, 0)
  const avgPricePerUnit = soldUnits > 0 ? totalSalesRevenue / soldUnits : 0
  const currentMonth = startOfMonth(new Date())
  const monthlySales = (sales || []).filter(s => new Date(s.sale_date) >= currentMonth)

  return {
    total_units: totalUnits,
    sold_units: soldUnits,
    reserved_units: reservedUnits,
    available_units: availableUnits,
    sales_rate: salesRate,
    total_sales_revenue: totalSalesRevenue,
    avg_price_per_unit: avgPricePerUnit,
    monthly_sales_count: monthlySales.length,
    monthly_sales_revenue: monthlySales.reduce((sum, s) => sum + s.sale_price, 0)
  }
}

export async function fetchConstructionMetrics(): Promise<ConstructionMetrics> {
  const [
    { data: contracts },
    { data: subcontractors },
    { data: milestones },
    { data: invoices }
  ] = await Promise.all([
    supabase.from('contracts').select('id, contract_amount, budget_realized, status'),
    supabase.from('subcontractors').select('id, name'),
    supabase.from('subcontractor_milestones').select('id, due_date, status, contract_id'),
    supabase.from('accounting_invoices')
      .select('total_amount, paid_amount, invoice_category, contract_id')
      .eq('invoice_category', 'SUBCONTRACTOR')
  ])

  const today = new Date()
  const completedContracts = (contracts || []).filter(c => c.status === 'completed').length
  const activeContracts = (contracts || []).filter(c => c.status === 'active').length
  const totalContractValue = (contracts || []).reduce((sum, c) => sum + Number(c.contract_amount), 0)
  const totalPaid = (invoices || []).reduce((sum, inv) => sum + Number(inv.paid_amount), 0)
  const pendingPayments = (invoices || []).reduce((sum, inv) => sum + Number(inv.total_amount - inv.paid_amount), 0)
  const overdueTasks = (milestones || []).filter(m =>
    m.due_date && new Date(m.due_date) < today && m.status !== 'completed'
  ).length
  const criticalDeadlines = (milestones || []).filter(m => {
    if (!m.due_date || m.status === 'completed') return false
    const daysUntil = differenceInDays(new Date(m.due_date), today)
    return daysUntil >= 0 && daysUntil <= 7
  }).length

  return {
    total_subcontractors: (subcontractors || []).length,
    active_subcontractors: activeContracts,
    completed_contracts: completedContracts,
    total_contract_value: totalContractValue,
    total_paid: totalPaid,
    pending_payments: pendingPayments,
    overdue_tasks: overdueTasks,
    critical_deadlines: criticalDeadlines
  }
}

export async function fetchFundingMetrics(): Promise<FundingMetrics> {
  const [
    { data: companies },
    { data: bankCredits },
    { data: creditAllocations }
  ] = await Promise.all([
    supabase.from('banks').select('*'),
    supabase.from('bank_credits').select('amount, used_amount, repaid_amount, outstanding_balance, interest_rate, maturity_date, bank_id'),
    supabase.from('credit_allocations').select('bank_credits(bank_id)')
  ])

  const totalBanks = (companies || []).length
  const activeFunderIds = new Set(
    (creditAllocations || [])
      .map(alloc => (alloc.bank_credits as any)?.project_id)
      .filter(Boolean)
  )
  const totalBankCredit = (bankCredits || []).reduce((sum, bc) => sum + Number(bc.amount), 0)
  const outstandingDebt = (bankCredits || []).reduce((sum, bc) => sum + Number(bc.outstanding_balance || 0), 0)
  const totalUsedCredit = (bankCredits || []).reduce((sum, bc) => sum + Number(bc.used_amount || 0), 0)
  const creditPaidOut = totalBankCredit > 0 ? (totalUsedCredit / totalBankCredit) * 100 : 0
  const avgInterestRate = (bankCredits || []).length
    ? (bankCredits || []).reduce((sum, bc) => sum + Number(bc.interest_rate || 0), 0) / (bankCredits || []).length
    : 0
  const upcomingMaturities = (bankCredits || []).filter(bc => {
    if (!bc.maturity_date) return false
    const daysUntil = differenceInDays(new Date(bc.maturity_date), new Date())
    return daysUntil >= 0 && daysUntil <= 90
  }).length

  return {
    total_investors: activeFunderIds.size,
    total_banks: totalBanks,
    total_bank_credit: totalBankCredit,
    outstanding_debt: outstandingDebt,
    credit_paid_out: creditPaidOut,
    avg_interest_rate: avgInterestRate,
    monthly_debt_service: 0,
    upcoming_maturities: upcomingMaturities
  }
}

export async function fetchAlerts(financialMetrics: FinancialMetrics, salesMetrics: SalesMetrics): Promise<Alert[]> {
  const newAlerts: Alert[] = []
  const today = new Date()

  const [{ data: milestones }, { data: bankCredits }] = await Promise.all([
    supabase.from('subcontractor_milestones').select('milestone_name, due_date, status, contracts(job_description)'),
    supabase.from('bank_credits').select('maturity_date, amount, credit_name, company:accounting_companies(name)')
  ])

  ;(milestones || []).forEach(milestone => {
    if (milestone.due_date && milestone.status !== 'completed') {
      const daysUntil = differenceInDays(new Date(milestone.due_date), today)
      if (daysUntil < 0) {
        newAlerts.push({
          type: 'critical',
          title: 'Overdue Milestone',
          message: `${milestone.milestone_name || 'Milestone'} is ${Math.abs(daysUntil)} days overdue`,
          date: milestone.due_date
        })
      } else if (daysUntil <= 3) {
        newAlerts.push({
          type: 'warning',
          title: 'Urgent Deadline',
          message: `${milestone.milestone_name || 'Milestone'} due in ${daysUntil} days`,
          date: milestone.due_date
        })
      }
    }
  })

  ;(bankCredits || []).forEach(credit => {
    if (credit.maturity_date) {
      const daysUntil = differenceInDays(new Date(credit.maturity_date), today)
      if (daysUntil >= 0 && daysUntil <= 30) {
        newAlerts.push({
          type: 'warning',
          title: 'Credit Maturity',
          message: `${credit.credit_name || (credit.company as any)?.name || 'Credit'} of €${Number(credit.amount).toLocaleString()} matures in ${daysUntil} days`,
          date: credit.maturity_date
        })
      }
    }
  })

  if (financialMetrics.debt_to_equity_ratio > 2) {
    newAlerts.push({
      type: 'warning',
      title: 'High Leverage',
      message: `Debt-to-Equity ratio is ${financialMetrics.debt_to_equity_ratio.toFixed(2)}x (recommended < 2x)`
    })
  }

  if (salesMetrics.sales_rate < 30 && salesMetrics.total_units > 0) {
    newAlerts.push({
      type: 'info',
      title: 'Low Sales Rate',
      message: `Only ${salesMetrics.sales_rate.toFixed(1)}% of units sold. Consider sales strategy review.`
    })
  }

  return newAlerts.slice(0, 10)
}
