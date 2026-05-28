import { supabase } from '../../../lib/supabase'
import { startOfMonth, differenceInDays } from 'date-fns'
import type {
  ProjectStats,
  FinancialMetrics,
  SalesMetrics,
  ConstructionMetrics,
  FundingMetrics,
  Alert
} from '../types/directorTypes'

interface ProjectRow {
  id: string
  name: string
  location: string | null
  status: string | null
  budget: number | null
}

interface ApartmentRow {
  id: string
  project_id: string | null
  status: string | null
  price: number
}

interface ContractRow {
  id: string
  project_id: string | null
  total_amount: number | null
  contract_amount: number | null
  budget_realized: number | null
  status: string | null
}

interface InvoiceRow {
  id: string
  contract_id: string | null
  project_id: string | null
  invoice_type: string | null
  invoice_category: string | null
  total_amount: number | null
  paid_amount: number | null
}

interface PaymentRow {
  amount: number
  payment_date: string | null
  invoice_id: string | null
}

interface AllocationRow {
  project_id: string | null
  allocated_amount: number | null
}

interface SaleRow {
  sale_price: number
  sale_date: string | null
}

interface CreditRow {
  id: string
  project_id: string | null
  bank_id: string | null
  amount: number | null
  used_amount: number | null
  repaid_amount: number | null
  outstanding_balance: number | null
  interest_rate: number | null
  maturity_date: string | null
  credit_name: string | null
  company: { id: string; name: string } | null
}

interface SubcontractorRow {
  id: string
}

interface MilestoneRow {
  id: string
  milestone_name: string | null
  due_date: string | null
  status: string | null
  contract_id: string | null
}

interface BankRow {
  id: string
  name: string
}

export interface DirectorDashboardData {
  projects: ProjectStats[]
  financial: FinancialMetrics
  sales: SalesMetrics
  construction: ConstructionMetrics
  funding: FundingMetrics
  alerts: Alert[]
}

export async function fetchDirectorDashboard(): Promise<DirectorDashboardData> {
  const [
    { data: projectsData, error: projectsError },
    { data: apartmentsData },
    { data: contractsData },
    { data: invoicesData },
    { data: paymentsData },
    { data: salesRowsData },
    { data: allocationsData },
    { data: creditsData },
    { data: banksData },
    { data: subcontractorsData },
    { data: milestonesData }
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, location, status, budget')
      .order('created_at', { ascending: false }),
    supabase.from('apartments').select('id, project_id, status, price'),
    supabase
      .from('contracts')
      .select('id, project_id, total_amount, contract_amount, budget_realized, status'),
    supabase
      .from('accounting_invoices')
      .select('id, contract_id, project_id, invoice_type, invoice_category, total_amount, paid_amount'),
    supabase.from('accounting_payments').select('amount, payment_date, invoice_id'),
    supabase.from('sales').select('sale_price, sale_date'),
    supabase.from('credit_allocations').select('project_id, allocated_amount'),
    supabase
      .from('bank_credits')
      .select(
        'id, project_id, bank_id, amount, used_amount, repaid_amount, outstanding_balance, interest_rate, maturity_date, credit_name, company:accounting_companies(id, name)'
      ),
    supabase.from('banks').select('id, name'),
    supabase.from('subcontractors').select('id'),
    supabase
      .from('subcontractor_milestones')
      .select('id, milestone_name, due_date, status, contract_id')
  ])

  if (projectsError) throw projectsError

  const projects = (projectsData || []) as ProjectRow[]
  const apartments = (apartmentsData || []) as ApartmentRow[]
  const contracts = (contractsData || []) as ContractRow[]
  const invoices = (invoicesData || []) as InvoiceRow[]
  const payments = (paymentsData || []) as PaymentRow[]
  const salesRows = (salesRowsData || []) as SaleRow[]
  const allocations = (allocationsData || []) as AllocationRow[]
  const credits = (creditsData || []) as unknown as CreditRow[]
  const banks = (banksData || []) as BankRow[]
  const subcontractors = (subcontractorsData || []) as SubcontractorRow[]
  const milestones = (milestonesData || []) as MilestoneRow[]

  const projectStats = deriveProjects(projects, apartments, contracts, invoices, allocations, credits)
  const financial = deriveFinancial(apartments, invoices, payments, salesRows, credits, allocations)
  const sales = deriveSales(apartments, salesRows)
  const construction = deriveConstruction(contracts, subcontractors, milestones, invoices)
  const funding = deriveFunding(banks, credits, allocations)
  const alerts = deriveAlerts(milestones, credits, financial, sales)

  return {
    projects: projectStats,
    financial,
    sales,
    construction,
    funding,
    alerts
  }
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K | null | undefined): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    if (key == null) continue
    const bucket = map.get(key)
    if (bucket) bucket.push(item)
    else map.set(key, [item])
  }
  return map
}

function deriveProjects(
  projects: ProjectRow[],
  apartments: ApartmentRow[],
  contracts: ContractRow[],
  invoices: InvoiceRow[],
  allocations: AllocationRow[],
  credits: CreditRow[]
): ProjectStats[] {
  const apartmentsByProject = groupBy(apartments, a => a.project_id)
  const contractsByProject = groupBy(contracts, c => c.project_id)
  const invoicesByContract = groupBy(invoices, i => i.contract_id)
  const invoicesByProject = groupBy(invoices, i => i.project_id)
  const allocationsByProject = groupBy(allocations, a => a.project_id)
  const creditsByProject = groupBy(credits, c => c.project_id)

  return projects.map(project => {
    const projectApartments = apartmentsByProject.get(project.id) || []
    const projectContracts = contractsByProject.get(project.id) || []

    const contractExpenses = projectContracts.map(c => {
      const contractInvoices = (invoicesByContract.get(c.id) || []).filter(
        inv => inv.invoice_type === 'INCOMING_SUPPLIER' || inv.invoice_type === 'INCOMING_OFFICE'
      )
      const invoicedTotal = contractInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
      return Math.max(c.total_amount || 0, invoicedTotal)
    })

    const invoicesWithoutContract = (invoicesByProject.get(project.id) || [])
      .filter(
        inv =>
          !inv.contract_id &&
          (inv.invoice_type === 'INCOMING_SUPPLIER' || inv.invoice_type === 'INCOMING_OFFICE')
      )
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0)

    const totalExpenses = contractExpenses.reduce((sum, exp) => sum + exp, 0) + invoicesWithoutContract
    const soldApts = projectApartments.filter(a => a.status === 'Sold')
    const apartmentSales = soldApts.reduce((sum, a) => sum + a.price, 0)
    const totalInvestment = (allocationsByProject.get(project.id) || []).reduce(
      (sum, alloc) => sum + (alloc.allocated_amount || 0),
      0
    )
    const totalDebt = (creditsByProject.get(project.id) || []).reduce(
      (sum, bc) => sum + (bc.outstanding_balance || 0),
      0
    )
    const totalUnits = projectApartments.length
    const soldUnits = soldApts.length
    const completionPercentage = totalUnits > 0 ? (soldUnits / totalUnits) * 100 : 0
    const profit = apartmentSales - totalExpenses
    const profitMargin = apartmentSales > 0 ? (profit / apartmentSales) * 100 : 0

    return {
      id: project.id,
      name: project.name,
      location: project.location ?? '',
      status: project.status ?? '',
      budget: project.budget ?? 0,
      total_expenses: totalExpenses,
      apartment_sales: apartmentSales,
      total_investment: totalInvestment,
      total_debt: totalDebt,
      profit_margin: profitMargin,
      completion_percentage: completionPercentage
    }
  })
}

function deriveFinancial(
  apartments: ApartmentRow[],
  invoices: InvoiceRow[],
  payments: PaymentRow[],
  salesRows: SaleRow[],
  credits: CreditRow[],
  allocations: AllocationRow[]
): FinancialMetrics {
  const customerInvoiceIds = new Set(
    invoices.filter(inv => inv.invoice_category === 'CUSTOMER').map(inv => inv.id)
  )
  const apartmentPayments = payments.filter(p => p.invoice_id && customerInvoiceIds.has(p.invoice_id))

  const totalRevenue = salesRows.reduce((sum, s) => sum + s.sale_price, 0)
  const totalExpenses = invoices.reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0)
  const totalProfit = totalRevenue - totalExpenses
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
  const totalDebt = credits.reduce((sum, bc) => sum + Number(bc.outstanding_balance || 0), 0)
  const totalEquity = allocations.reduce((sum, alloc) => sum + Number(alloc.allocated_amount || 0), 0)
  const debtToEquityRatio = totalEquity > 0 ? totalDebt / totalEquity : 0
  const currentMonth = startOfMonth(new Date())
  const cashFlowCurrentMonth = apartmentPayments
    .filter(p => p.payment_date && new Date(p.payment_date) >= currentMonth)
    .reduce((sum, p) => sum + p.amount, 0)
  const outstandingReceivables = apartments.reduce((sum, apt) => {
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

function deriveSales(apartments: ApartmentRow[], salesRows: SaleRow[]): SalesMetrics {
  const totalUnits = apartments.length
  const soldUnits = apartments.filter(a => a.status === 'Sold').length
  const reservedUnits = apartments.filter(a => a.status === 'Reserved').length
  const availableUnits = apartments.filter(a => a.status === 'Available').length
  const salesRate = totalUnits > 0 ? (soldUnits / totalUnits) * 100 : 0
  const totalSalesRevenue = salesRows.reduce((sum, s) => sum + s.sale_price, 0)
  const avgPricePerUnit = soldUnits > 0 ? totalSalesRevenue / soldUnits : 0
  const currentMonth = startOfMonth(new Date())
  const monthlySales = salesRows.filter(s => s.sale_date && new Date(s.sale_date) >= currentMonth)

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

function deriveConstruction(
  contracts: ContractRow[],
  subcontractors: SubcontractorRow[],
  milestones: MilestoneRow[],
  invoices: InvoiceRow[]
): ConstructionMetrics {
  const today = new Date()
  const subcontractorInvoices = invoices.filter(inv => inv.invoice_category === 'SUBCONTRACTOR')

  const completedContracts = contracts.filter(c => {
    const amount = Number(c.contract_amount || 0)
    const realized = Number(c.budget_realized || 0)
    if (amount > 0) return realized >= amount
    return realized > 0
  }).length
  const activeContracts = contracts.filter(c => c.status === 'active').length
  const totalContractValue = contracts.reduce((sum, c) => sum + Number(c.contract_amount || 0), 0)
  const totalPaid = subcontractorInvoices.reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0)
  const pendingPayments = subcontractorInvoices.reduce(
    (sum, inv) => sum + Number((inv.total_amount || 0) - (inv.paid_amount || 0)),
    0
  )
  const overdueTasks = milestones.filter(
    m => m.due_date && new Date(m.due_date) < today && m.status !== 'completed'
  ).length
  const criticalDeadlines = milestones.filter(m => {
    if (!m.due_date || m.status === 'completed') return false
    const daysUntil = differenceInDays(new Date(m.due_date), today)
    return daysUntil >= 0 && daysUntil <= 7
  }).length

  return {
    total_subcontractors: subcontractors.length,
    active_subcontractors: activeContracts,
    completed_contracts: completedContracts,
    total_contract_value: totalContractValue,
    total_paid: totalPaid,
    pending_payments: pendingPayments,
    overdue_tasks: overdueTasks,
    critical_deadlines: criticalDeadlines
  }
}

function deriveFunding(
  banks: BankRow[],
  credits: CreditRow[],
  allocations: AllocationRow[]
): FundingMetrics {
  const totalBanks = banks.length
  const activeFunderIds = new Set(
    allocations.map(a => a.project_id).filter((id): id is string => Boolean(id))
  )
  const totalBankCredit = credits.reduce((sum, bc) => sum + Number(bc.amount || 0), 0)
  const outstandingDebt = credits.reduce((sum, bc) => sum + Number(bc.outstanding_balance || 0), 0)
  const totalUsedCredit = credits.reduce((sum, bc) => sum + Number(bc.used_amount || 0), 0)
  const creditPaidOut = totalBankCredit > 0 ? (totalUsedCredit / totalBankCredit) * 100 : 0
  const avgInterestRate = credits.length
    ? credits.reduce((sum, bc) => sum + Number(bc.interest_rate || 0), 0) / credits.length
    : 0
  const upcomingMaturities = credits.filter(bc => {
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

function deriveAlerts(
  milestones: MilestoneRow[],
  credits: CreditRow[],
  financial: FinancialMetrics,
  sales: SalesMetrics
): Alert[] {
  const alerts: Alert[] = []
  const today = new Date()

  for (const milestone of milestones) {
    if (!milestone.due_date || milestone.status === 'completed') continue
    const daysUntil = differenceInDays(new Date(milestone.due_date), today)
    if (daysUntil < 0) {
      alerts.push({
        type: 'critical',
        title: 'Overdue Milestone',
        message: `${milestone.milestone_name || 'Milestone'} is ${Math.abs(daysUntil)} days overdue`,
        date: milestone.due_date
      })
    } else if (daysUntil <= 3) {
      alerts.push({
        type: 'warning',
        title: 'Urgent Deadline',
        message: `${milestone.milestone_name || 'Milestone'} due in ${daysUntil} days`,
        date: milestone.due_date
      })
    }
  }

  for (const credit of credits) {
    if (!credit.maturity_date) continue
    const daysUntil = differenceInDays(new Date(credit.maturity_date), today)
    if (daysUntil >= 0 && daysUntil <= 30) {
      const label = credit.credit_name || credit.company?.name || 'Credit'
      alerts.push({
        type: 'warning',
        title: 'Credit Maturity',
        message: `${label} of €${Number(credit.amount || 0).toLocaleString()} matures in ${daysUntil} days`,
        date: credit.maturity_date
      })
    }
  }

  if (financial.debt_to_equity_ratio > 2) {
    alerts.push({
      type: 'warning',
      title: 'High Leverage',
      message: `Debt-to-Equity ratio is ${financial.debt_to_equity_ratio.toFixed(2)}x (recommended < 2x)`
    })
  }

  if (sales.sales_rate < 30 && sales.total_units > 0) {
    alerts.push({
      type: 'info',
      title: 'Low Sales Rate',
      message: `Only ${sales.sales_rate.toFixed(1)}% of units sold. Consider sales strategy review.`
    })
  }

  return alerts.slice(0, 10)
}
