import { supabase } from '../../../lib/supabase'
import { ticGrandTotal } from '../../Funding/TIC/utils/ticBudget'
import type { LineItem } from '../../Funding/TIC/utils/ticFormatters'
import { daysFromToday } from '../../../utils/dateOnly'
import type { ComprehensiveReport, ProjectData, ReportRisk } from '../types'
import { normalizeOrgName } from '../../../lib/orgName'
import { averagePer, customerFunnel, salesRate, soldRevenue, unitStatusCounts } from '../../../utils/salesFigures'
import {
  activeFunderCount,
  allocationTotals,
  creditLineTotals,
  debtToEquity,
  liveDebtFigures,
  loanTotals,
  projectFunding,
  totalEquity as equityOf,
} from '../../../utils/fundingFigures'
import { bankAccountTotals, cesijaFromCredit, costPaid } from '../../../utils/paymentFigures'
import { monthlyCashFlow } from '../../../utils/cashFlowFigures'

/**
 * supabase-js resolves a failed query as `{ data: null, error }` rather than rejecting, and every
 * read in this file falls back to `[]`. Unchecked, that turns one dropped request into an
 * executive report of zeros — "€0 revenue, 0 units sold" reads as a business fact rather than as
 * a missing answer, and it is exported to PDF that way. So a single failed query fails the whole
 * report, which `useCachedData` hands the page as an error to render instead of the numbers.
 */
function throwIfAnyFailed(responses: readonly { error: { message: string } | null }[]): void {
  const failed = responses.find(response => response.error !== null)
  if (failed?.error) throw new Error(failed.error.message)
}

export async function fetchGeneralReportData(
  selectedProject: string,
  dateRange: { start: string; end: string }
): Promise<ComprehensiveReport> {
  const responses = await Promise.all([
    supabase.from('projects').select('*'),
    supabase.from('apartments').select('*'),
    supabase.from('sales').select('sale_price, apartment_id'),
    supabase.from('customers').select('*'),
    supabase.from('contracts').select('*, contract_types(name)'),
    supabase.from('subcontractors').select('*'),
    supabase.from('project_phases').select('*'),
    supabase.from('work_logs').select('*'),
    supabase.from('accounting_invoices').select('*'),
    supabase.from('accounting_payments').select('*'),
    supabase.from('banks').select('*'),
    supabase.from('company_bank_accounts').select('*'),
    supabase.from('tic_cost_structures').select('*'),
    supabase.from('office_suppliers').select('*'),
    supabase.from('bank_credits').select('*'),
    supabase.from('company_loans').select('*'),
    supabase.from('credit_allocations').select('*'),
    supabase.from('buildings').select('*'),
    supabase.from('garages').select('*'),
    supabase.from('repositories').select('*'),
    supabase.from('subcontractor_milestones').select('*'),
    supabase.from('retail_projects').select('*'),
    supabase.from('retail_contracts').select('*'),
    supabase.from('retail_project_phases').select('*'),
    supabase.from('retail_land_plots').select('*'),
    supabase.from('retail_customers').select('*'),
    supabase.from('retail_suppliers').select('*'),
    // The one row of organisation settings: its name heads the report (GEN-19).
    supabase.from('organization_settings').select('name'),
  ])

  throwIfAnyFailed(responses)

  const [
    { data: projects },
    { data: apartments },
    { data: sales },
    { data: customers },
    { data: contracts },
    { data: subcontractors },
    { data: projectPhases },
    { data: workLogs },
    { data: accountingInvoices },
    { data: accountingPayments },
    { data: banks },
    { data: companyBankAccounts },
    { data: ticCostStructures },
    { data: officeSuppliers },
    { data: bankCredits },
    { data: companyLoans },
    { data: creditAllocations },
    { data: buildings },
    { data: garages },
    { data: repositories },
    { data: subcontractorMilestones },
    { data: retailProjects },
    { data: retailContracts },
    { data: retailPhases },
    { data: retailLandPlots },
    { data: retailCustomers },
    { data: retailSuppliers },
    { data: organizationSettings },
  ] = responses

  const projectsArray = projects || []
  const apartmentsArray = apartments || []
  const salesArray = sales || []
  const customersArray = customers || []
  const contractsArray = contracts || []
  const subcontractorsArray = subcontractors || []
  const projectPhasesArray = projectPhases || []
  const workLogsArray = workLogs || []

  const accountingInvoicesArray = accountingInvoices || []
  const accountingPaymentsArray = accountingPayments || []
  const banksArray = banks || []
  const companyBankAccountsArray = companyBankAccounts || []
  const ticCostStructuresArray = ticCostStructures || []
  // Planned budget comes from the TIC and nowhere else, so a project without one has none.
  // `projects.budget` still holds whatever was typed before the TIC took over, and reporting
  // that as the plan is how Precko Zapad's leftover €1.000.000.000 ended up as 89% of a
  // €1.118M "portfolio value" on a page headed Executive Report.
  const ticTotalByProject = new Map<string, number>()
  for (const tic of ticCostStructuresArray) {
    if (!tic.project_id) continue
    const total = ticGrandTotal((tic.line_items || []) as LineItem[])
    if (total > 0) ticTotalByProject.set(tic.project_id as string, total)
  }
  const plannedBudget = (projectId: string) => ticTotalByProject.get(projectId) ?? 0
  const officeSuppliersArray = officeSuppliers || []
  const bankCreditsArray = bankCredits || []
  const companyLoansArray = companyLoans || []
  const creditAllocationsArray = creditAllocations || []

  const buildingsArray = buildings || []
  const garagesArray = garages || []
  const repositoriesArray = repositories || []
  const subcontractorMilestonesArray = subcontractorMilestones || []

  const retailProjectsArray = retailProjects || []
  const retailContractsArray = retailContracts || []
  const retailPhasesArray = retailPhases || []
  const retailLandPlotsArray = retailLandPlots || []
  const retailCustomersArray = retailCustomers || []
  const retailSuppliersArray = retailSuppliers || []

  // Fetch garages and repositories for calculating total revenue
  const garageIds = apartmentsArray.map(apt => apt.garage_id).filter(Boolean)
  const storageIds = apartmentsArray.map(apt => apt.repository_id).filter(Boolean)

  const unitExtraResponses = await Promise.all([
    supabase
      .from('garages')
      .select('id, price')
      .in('id', garageIds.length > 0 ? garageIds : ['']),
    supabase
      .from('repositories')
      .select('id, price')
      .in('id', storageIds.length > 0 ? storageIds : ['']),
  ])

  // These two prices feed per-project revenue, so losing them understates it silently.
  throwIfAnyFailed(unitExtraResponses)

  const [{ data: garagesData }, { data: storagesData }] = unitExtraResponses

  const garageMap = new Map((garagesData || []).map(g => [g.id, g.price]))
  const storageMap = new Map((storagesData || []).map(s => [s.id, s.price]))

  const filteredProjects = selectedProject === 'all'
    ? projectsArray
    : projectsArray.filter(p => p.id === selectedProject)

  // List prices of the sold apartments; linked garages and storage are not in the portfolio total.
  const totalRevenue = soldRevenue(apartmentsArray)

  // Expenses are costs: every operating invoice the company pays, credit fees included (see
  // COST_INVOICE_TYPES). Repaying principal moves cash but is not an expense.
  const totalExpenses = costPaid(accountingPaymentsArray, accountingInvoicesArray)
  const totalProfit = totalRevenue - totalExpenses
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  const portfolioValue = projectsArray.reduce((sum, p) => sum + plannedBudget(p.id), 0)
  // Same definitions as the Director dashboard: debt is what is still owed on live, non-equity
  // credits; equity is the equity facilities (GEN-2).
  const liveDebt = liveDebtFigures(bankCreditsArray)
  const totalEquity = equityOf(bankCreditsArray)
  const totalDebt = liveDebt.outstanding
  const debtEquityRatio = debtToEquity(totalDebt, totalEquity)
  const creditLines = creditLineTotals(bankCreditsArray)
  const roi = totalEquity > 0 ? (totalProfit / totalEquity) * 100 : 0

  const {
    total: totalUnits,
    sold: soldUnits,
    reserved: reservedUnits,
    available: availableUnits,
  } = unitStatusCounts(apartmentsArray)
  const portfolioSalesRate = salesRate(soldUnits, totalUnits)
  const avgSalePrice = averagePer(totalRevenue, soldUnits)

  const customerCounts = customerFunnel(customersArray)

  const totalContractValue = contractsArray.reduce((sum, c) => sum + c.contract_amount, 0)
  const budgetRealized = contractsArray.reduce((sum, c) => sum + c.budget_realized, 0)
  const budgetUtilization = totalContractValue > 0 ? (budgetRealized / totalContractValue) * 100 : 0

  const completedPhases = projectPhasesArray.filter(p => p.status === 'completed').length
  // Today and the six days before it, in local days (subMonths(now, 0.25) was not seven days).
  const recentWorkLogs = workLogsArray.filter(w => {
    const days = daysFromToday(w.date)
    return days <= 0 && days >= -6 // NaN (no date) fails both
  }).length

  const totalMilestones = subcontractorMilestonesArray.length
  // 'completed' is the trigger's word for *partly* paid; a milestone is done when it is 'paid'.
  const completedMilestones = subcontractorMilestonesArray.filter(m => m.status === 'paid').length

  // Cash, month by month: every payment on the side the shared direction map puts it, and
  // drawdowns and repayments of principal under financing, apart from operations.
  const invoiceTypeById = new Map(accountingInvoicesArray.map(inv => [inv.id, inv.invoice_type]))
  const cashFlow = monthlyCashFlow(
    accountingPaymentsArray.map(p => ({ ...p, invoiceType: invoiceTypeById.get(p.invoice_id) })),
    dateRange,
  )

  const projectDetails: ProjectData[] = await Promise.all(
    filteredProjects.map(async (project) => {
      const projectApartments = apartmentsArray.filter(a => a.project_id === project.id)
      const projectContracts = contractsArray.filter(c => c.project_id === project.id)
      const projectPhases = projectPhasesArray.filter(p => p.project_id === project.id)
      // Not the portfolio's definitions (GEN-27).
      const funding = projectFunding(project.id, creditAllocationsArray, bankCreditsArray)

      const projectExpenses = costPaid(accountingPaymentsArray, accountingInvoicesArray, inv => inv.project_id === project.id)

      const projectUnits = unitStatusCounts(projectApartments)
      // `garage_id` and `repository_id` are not columns of apartments, so this adds nothing (GEN-26).
      const projectRevenue = soldRevenue(projectApartments, a =>
        (a.garage_id ? garageMap.get(a.garage_id) || 0 : 0) +
        (a.repository_id ? storageMap.get(a.repository_id) || 0 : 0))
      const projectProfit = projectRevenue - projectExpenses
      const projectProfitMargin = projectRevenue > 0 ? (projectProfit / projectRevenue) * 100 : 0
      const projectSalesRate = salesRate(projectUnits.sold, projectUnits.total)

      let riskLevel: 'Low' | 'Medium' | 'High' = 'Low'
      if (projectSalesRate < 20 || projectProfitMargin < 0) riskLevel = 'High'
      else if (projectSalesRate < 50 || projectProfitMargin < 15) riskLevel = 'Medium'

      return {
        id: project.id,
        name: project.name,
        location: project.location,
        status: project.status,
        category: project.category ?? null,
        budget: plannedBudget(project.id),
        // False when the project has no TIC, so the renderer can say "not set" rather than €0.
        has_budget: plannedBudget(project.id) > 0,
        revenue: projectRevenue,
        expenses: projectExpenses,
        units_sold: projectUnits.sold,
        total_units: projectUnits.total,
        contracts: projectContracts.length,
        phases_done: projectPhases.filter(p => p.status === 'completed').length,
        total_phases: projectPhases.length,
        equity: funding.equity,
        debt: funding.debt,
        sales_rate: projectSalesRate,
        profit: projectProfit,
        profit_margin: projectProfitMargin,
        risk_level: riskLevel
      }
    })
  )

  // A risk carries its key and its count; the renderer turns that into a sentence in the language
  // it is rendering in — `GeneralReports.tsx` on screen, `reports.general.risks.*` in the PDF.
  // A service has no translator and must not decide anyone's language.
  const risks: ReportRisk[] = []
  const slowSalesProjects = projectDetails.filter(p => p.sales_rate < 40 && p.total_units > 0)
  if (slowSalesProjects.length > 0) {
    risks.push({ kind: 'slow_sales', count: slowSalesProjects.length })
  }

  const topProjects = [...projectDetails]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3)
    .map(p => ({ name: p.name, revenue: p.revenue, sales_rate: p.sales_rate }))

  // Keys, for the same reason as the risks above. Both readers translate them at the render site.
  const recommendationKeys: string[] = []
  if (portfolioSalesRate < 50) recommendationKeys.push('reports.general.recs.marketing')
  if (availableUnits > soldUnits) recommendationKeys.push('reports.general.recs.inventory')
  recommendationKeys.push('reports.general.recs.budgets')
  recommendationKeys.push('reports.general.recs.partners')

  const totalInvoices = accountingInvoicesArray.length
  const totalInvoiceValue = accountingInvoicesArray.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
  const paidInvoices = accountingInvoicesArray.filter(inv => inv.status === 'PAID').length
  const paidValue = accountingInvoicesArray
    .filter(inv => inv.status === 'PAID')
    .reduce((sum, inv) => sum + (inv.total_amount || 0), 0)

  const pendingInvoices = accountingInvoicesArray.filter(inv =>
    inv.status === 'UNPAID' || inv.status === 'PARTIALLY_PAID'
  ).length
  const pendingValue = accountingInvoicesArray
    .filter(inv => inv.status === 'UNPAID' || inv.status === 'PARTIALLY_PAID')
    .reduce((sum, inv) => sum + (inv.remaining_amount || 0), 0)

  const overdueInvoices = accountingInvoicesArray.filter(inv =>
    (inv.status === 'UNPAID' || inv.status === 'PARTIALLY_PAID') &&
    inv.due_date &&
    daysFromToday(inv.due_date) < 0
  ).length
  const overdueValue = accountingInvoicesArray
    .filter(inv =>
      (inv.status === 'UNPAID' || inv.status === 'PARTIALLY_PAID') &&
      inv.due_date &&
      daysFromToday(inv.due_date) < 0
    )
    .reduce((sum, inv) => sum + (inv.remaining_amount || 0), 0)

  const paymentCompletionRate = totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0

  // This section printed zeros for its whole life: it summed tic.budgeted_amount and
  // tic.actual_spent, neither of which is a column on tic_cost_structures — the money lives in
  // the line_items jsonb. TypeScript could not catch it because the Supabase client is created
  // without the <Database> generic, so those reads were `any`.
  //
  // Reshaped rather than repaired. `actual_spent` has no source anywhere, and
  // `companies_over_budget` counted companies against a per-PROJECT plan, so both were dropped
  // instead of being faked. What is left is answerable from the data: how much is planned, and
  // how many projects have no plan at all.
  const ticTotals = ticCostStructuresArray.map(tic =>
    ticGrandTotal((tic.line_items || []) as LineItem[])
  )
  const totalTicBudget = ticTotals.reduce((sum, total) => sum + total, 0)
  const projectsWithTic = ticTotals.filter(total => total > 0).length
  const projectsWithoutTic = projectsArray.length - projectsWithTic

  const totalOfficeSuppliers = officeSuppliersArray.length
  const officeInvoices = accountingInvoicesArray.filter(inv => inv.invoice_category === 'OFFICE')
  const totalOfficeInvoices = officeInvoices.length
  const totalOfficeSpent = officeInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
  const avgOfficeInvoice = totalOfficeInvoices > 0 ? totalOfficeSpent / totalOfficeInvoices : 0

  const cesija = cesijaFromCredit(accountingPaymentsArray)
  const bankAccounts = bankAccountTotals(companyBankAccountsArray)

  const loans = loanTotals(companyLoansArray)
  const allocations = allocationTotals(creditAllocationsArray)

  const totalBuildings = buildingsArray.length
  const totalGarages = garagesArray.length
  const totalRepositories = repositoriesArray.length

  const totalRetailProjects = retailProjectsArray.length
  const activeRetailProjects = retailProjectsArray.filter(rp => rp.status === 'active').length
  const totalRetailContracts = retailContractsArray.length
  const retailContractValue = retailContractsArray.reduce((sum, rc) => sum + (rc.contract_amount || 0), 0)
  const retailBudgetRealized = retailContractsArray.reduce((sum, rc) => sum + (rc.budget_realized || 0), 0)
  const retailPhasesCount = retailPhasesArray.length
  const completedRetailPhases = retailPhasesArray.filter(rp => rp.status === 'completed').length
  const totalRetailCustomers = retailCustomersArray.length
  const totalRetailSuppliers = retailSuppliersArray.length
  const totalLandPlots = retailLandPlotsArray.length

  const contractTypeCounts: { [key: string]: number } = {}
  contractsArray.forEach(c => {
    const typeName = (c as { contract_types?: { name?: string } | null }).contract_types?.name || ''
    contractTypeCounts[typeName] = (contractTypeCounts[typeName] || 0) + 1
  })
  const contractTypesData = Object.entries(contractTypeCounts).map(([name, count]) => ({ name, count }))

  return {
    organization_name: normalizeOrgName(organizationSettings?.[0]?.name),
    executive_summary: {
      total_projects: projectsArray.length,
      active_projects: projectsArray.filter(p => p.status === 'In Progress').length,
      completed_projects: projectsArray.filter(p => p.status === 'Completed').length,
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      total_profit: totalProfit,
      profit_margin: profitMargin,
      portfolio_value: portfolioValue,
      roi: roi
    },
    kpis: {
      portfolio_value: portfolioValue,
      total_revenue: totalRevenue,
      net_profit: totalProfit,
      roi: roi,
      sales_rate: portfolioSalesRate,
      debt_equity_ratio: debtEquityRatio,
      active_projects: projectsArray.filter(p => p.status === 'In Progress').length,
      total_customers: customerCounts.total
    },
    sales_performance: {
      total_units: totalUnits,
      units_sold: soldUnits,
      available_units: availableUnits,
      reserved_units: reservedUnits,
      total_revenue: totalRevenue,
      avg_sale_price: avgSalePrice,
      total_sales: salesArray.length,
      buyers: customerCounts.buyers,
      active_leads: customerCounts.activeLeads,
      conversion_rate: customerCounts.conversionRate
    },
    funding_structure: {
      total_equity: totalEquity,
      total_debt: totalDebt,
      debt_equity_ratio: debtEquityRatio,
      total_credit_lines: creditLines.total,
      // Undrawn headroom. It read available_balance/drawn_amount, which bank_credits does not have.
      available_credit: creditLines.available,
      active_investors: activeFunderCount(creditAllocationsArray, bankCreditsArray),
      active_banks: banksArray.length,
      bank_credits: creditLines.count,
      avg_interest_rate: liveDebt.avgInterestRate,
      monthly_debt_service: liveDebt.monthlyDebtService
    },
    construction_status: {
      total_contracts: contractsArray.length,
      active_contracts: contractsArray.filter(c => c.status === 'active').length,
      completed_contracts: contractsArray.filter(c => c.status === 'completed').length,
      contract_value: totalContractValue,
      budget_realized: budgetRealized,
      budget_utilization: budgetUtilization,
      total_subcontractors: subcontractorsArray.length,
      total_phases: projectPhasesArray.length,
      completed_phases: completedPhases,
      work_logs_7days: recentWorkLogs,
      total_milestones: totalMilestones,
      completed_milestones: completedMilestones
    },
    accounting_overview: {
      total_invoices: totalInvoices,
      total_invoice_value: totalInvoiceValue,
      paid_invoices: paidInvoices,
      paid_value: paidValue,
      pending_invoices: pendingInvoices,
      pending_value: pendingValue,
      overdue_invoices: overdueInvoices,
      overdue_value: overdueValue,
      payment_completion_rate: paymentCompletionRate
    },
    tic_cost_management: {
      total_tic_budget: totalTicBudget,
      projects_with_tic: projectsWithTic,
      projects_without_tic: projectsWithoutTic
    },
    office_expenses: {
      total_office_suppliers: totalOfficeSuppliers,
      total_office_invoices: totalOfficeInvoices,
      total_office_spent: totalOfficeSpent,
      avg_office_invoice: avgOfficeInvoice
    },
    company_credits: {
      total_credits: creditLines.count,
      total_credit_value: creditLines.total,
      credits_available: creditLines.available,
      credits_used: creditLines.used,
      cesija_payments: cesija.count,
      cesija_value: cesija.value,
      total_allocations: allocations.count,
      allocated_amount: allocations.allocated
    },
    company_loans: {
      total_loans: loans.count,
      total_loan_amount: loans.amount,
      total_outstanding: loans.outstanding,
      active_loans: loans.active
    },
    bank_accounts: {
      total_accounts: bankAccounts.count,
      total_balance: bankAccounts.balance,
      positive_balance_accounts: bankAccounts.positive,
      negative_balance_accounts: bankAccounts.negative
    },
    buildings_units: {
      total_buildings: totalBuildings,
      total_units: totalUnits,
      sold_units: soldUnits,
      reserved_units: reservedUnits,
      available_units: availableUnits,
      total_garages: totalGarages,
      total_repositories: totalRepositories
    },
    retail_portfolio: {
      total_retail_projects: totalRetailProjects,
      active_retail_projects: activeRetailProjects,
      total_land_plots: totalLandPlots,
      total_retail_contracts: totalRetailContracts,
      retail_contract_value: retailContractValue,
      retail_budget_realized: retailBudgetRealized,
      retail_phases: retailPhasesCount,
      completed_retail_phases: completedRetailPhases,
      total_retail_customers: totalRetailCustomers,
      retail_suppliers: totalRetailSuppliers
    },
    contract_types: contractTypesData,
    cash_flow: cashFlow,
    projects: projectDetails,
    risks: risks,
    insights: {
      top_projects: topProjects,
      recommendation_keys: recommendationKeys
    }
  }
}
