import { supabase } from '../../../lib/supabase'
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns'
import type { ComprehensiveReport, ProjectData } from '../types'

export async function fetchGeneralReportData(
  selectedProject: string,
  dateRange: { start: string; end: string }
): Promise<ComprehensiveReport> {
  const { data: projects } = await supabase.from('projects').select('*')
  const { data: apartments } = await supabase.from('apartments').select('*')
  const { data: sales } = await supabase.from('sales').select('sale_price, apartment_id')
  const { data: customers } = await supabase.from('customers').select('*')
  const { data: contracts } = await supabase.from('contracts').select('*, contract_types(name)')
  const { data: subcontractors } = await supabase.from('subcontractors').select('*')
  const { data: projectPhases } = await supabase.from('project_phases').select('*')
  const { data: workLogs } = await supabase.from('work_logs').select('*')

  const { data: accountingInvoices } = await supabase.from('accounting_invoices').select('*')
  const { data: accountingPayments } = await supabase.from('accounting_payments').select('*')
  const { data: accountingCompanies } = await supabase.from('accounting_companies').select('*')
  const { data: banks } = await supabase.from('banks').select('*')
  const { data: companyBankAccounts } = await supabase.from('company_bank_accounts').select('*')
  const { data: ticCostStructures } = await supabase.from('tic_cost_structures').select('*')
  const { data: officeSuppliers } = await supabase.from('office_suppliers').select('*')
  const { data: bankCredits } = await supabase.from('bank_credits').select('*')
  const { data: companyLoans } = await supabase.from('company_loans').select('*')
  const { data: creditAllocations } = await supabase.from('credit_allocations').select('*')

  const { data: buildings } = await supabase.from('buildings').select('*')
  const { data: garages } = await supabase.from('garages').select('*')
  const { data: repositories } = await supabase.from('repositories').select('*')
  const { data: subcontractorMilestones } = await supabase.from('subcontractor_milestones').select('*')
  const { data: contractTypes } = await supabase.from('contract_types').select('*')

  const { data: retailProjects } = await supabase.from('retail_projects').select('*')
  const { data: retailContracts } = await supabase.from('retail_contracts').select('*')
  const { data: retailPhases } = await supabase.from('retail_project_phases').select('*')
  const { data: retailLandPlots } = await supabase.from('retail_land_plots').select('*')
  const { data: retailCustomers } = await supabase.from('retail_customers').select('*')
  const { data: retailSuppliers } = await supabase.from('retail_suppliers').select('*')

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
  const accountingCompaniesArray = accountingCompanies || []
  const banksArray = banks || []
  const companyBankAccountsArray = companyBankAccounts || []
  const ticCostStructuresArray = ticCostStructures || []
  const officeSuppliersArray = officeSuppliers || []
  const bankCreditsArray = bankCredits || []
  const companyLoansArray = companyLoans || []
  const creditAllocationsArray = creditAllocations || []

  const buildingsArray = buildings || []
  const garagesArray = garages || []
  const repositoriesArray = repositories || []
  const subcontractorMilestonesArray = subcontractorMilestones || []
  const contractTypesArray = contractTypes || []

  const retailProjectsArray = retailProjects || []
  const retailContractsArray = retailContracts || []
  const retailPhasesArray = retailPhases || []
  const retailLandPlotsArray = retailLandPlots || []
  const retailCustomersArray = retailCustomers || []
  const retailSuppliersArray = retailSuppliers || []

  const inflowPaymentsArray = accountingPaymentsArray.filter(p => {
    const invoice = accountingInvoicesArray.find(inv => inv.id === p.invoice_id)
    return invoice?.invoice_type === 'OUTGOING_SALES' ||
           invoice?.invoice_type === 'OUTGOING_OFFICE' ||
           invoice?.invoice_type === 'OUTGOING_SUPPLIER' ||
           invoice?.invoice_type === 'INCOMING_INVESTMENT'
  })

  const outflowPaymentsArray = accountingPaymentsArray.filter(p => {
    const invoice = accountingInvoicesArray.find(inv => inv.id === p.invoice_id)
    return invoice?.invoice_type === 'INCOMING_SUPPLIER' ||
           invoice?.invoice_type === 'INCOMING_OFFICE'
  })

  // Fetch garages and repositories for calculating total revenue
  const garageIds = apartmentsArray.map(apt => apt.garage_id).filter(Boolean)
  const storageIds = apartmentsArray.map(apt => apt.repository_id).filter(Boolean)

  const { data: garagesData } = await supabase
    .from('garages')
    .select('id, price')
    .in('id', garageIds.length > 0 ? garageIds : [''])

  const { data: storagesData } = await supabase
    .from('repositories')
    .select('id, price')
    .in('id', storageIds.length > 0 ? storageIds : [''])

  const garageMap = new Map((garagesData || []).map(g => [g.id, g.price]))
  const storageMap = new Map((storagesData || []).map(s => [s.id, s.price]))

  const filteredProjects = selectedProject === 'all'
    ? projectsArray
    : projectsArray.filter(p => p.id === selectedProject)

  const totalRevenue = apartmentsArray
    .filter(a => a.status === 'Sold')
    .reduce((sum, a) => sum + (a.price || 0), 0)

  const totalExpenses = accountingPaymentsArray
    .filter(p => {
      const invoice = accountingInvoicesArray.find(inv => inv.id === p.invoice_id)
      return invoice?.invoice_type === 'INCOMING_SUPPLIER' || invoice?.invoice_type === 'INCOMING_OFFICE'
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0)
  const totalProfit = totalRevenue - totalExpenses
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  const portfolioValue = projectsArray.reduce((sum, p) => sum + p.budget, 0)
  const totalEquity = creditAllocationsArray.reduce((sum, alloc) => sum + (alloc.allocated_amount || 0), 0)
  const totalDebt = bankCreditsArray.reduce((sum, bc) => sum + bc.amount, 0)
  const activeFunderIds = new Set(
    creditAllocationsArray
      .map(alloc => bankCreditsArray.find(bc => bc.id === alloc.credit_id)?.bank_id)
      .filter(Boolean)
  )
  const activeFundersCount = activeFunderIds.size
  const roi = totalEquity > 0 ? (totalProfit / totalEquity) * 100 : 0

  const totalUnits = apartmentsArray.length
  const soldUnits = apartmentsArray.filter(a => a.status === 'Sold').length
  const reservedUnits = apartmentsArray.filter(a => a.status === 'Reserved').length
  const availableUnits = apartmentsArray.filter(a => a.status === 'Available').length
  const salesRate = totalUnits > 0 ? (soldUnits / totalUnits) * 100 : 0
  const avgSalePrice = soldUnits > 0 ? totalRevenue / soldUnits : 0

  const buyers = customersArray.filter(c => c.status === 'buyer').length
  const leads = customersArray.filter(c => c.status === 'lead').length
  const interested = customersArray.filter(c => c.status === 'interested').length
  const conversionRate = customersArray.length > 0 ? (buyers / customersArray.length) * 100 : 0

  const avgInterestRate = bankCreditsArray.length > 0
    ? bankCreditsArray.reduce((sum, bc) => sum + (bc.interest_rate || 0), 0) / bankCreditsArray.length
    : 0
  const monthlyDebtService = bankCreditsArray.reduce((sum, bc) => sum + (bc.monthly_payment || 0), 0)

  const totalContractValue = contractsArray.reduce((sum, c) => sum + c.contract_amount, 0)
  const budgetRealized = contractsArray.reduce((sum, c) => sum + c.budget_realized, 0)
  const budgetUtilization = totalContractValue > 0 ? (budgetRealized / totalContractValue) * 100 : 0

  const completedPhases = projectPhasesArray.filter(p => p.status === 'completed').length
  const sevenDaysAgo = subMonths(new Date(), 0.25)
  const recentWorkLogs = workLogsArray.filter(w => new Date(w.date) >= sevenDaysAgo).length

  const totalMilestones = subcontractorMilestonesArray.length
  const completedMilestones = subcontractorMilestonesArray.filter(m => m.status === 'completed').length

  const months = eachMonthOfInterval({
    start: new Date(dateRange.start),
    end: new Date(dateRange.end)
  })

  const cashFlow = months.map(month => {
    const monthStart = startOfMonth(month)
    const monthEnd = endOfMonth(month)

    const monthInflow = inflowPaymentsArray
      .filter(p => {
        const date = new Date(p.payment_date)
        return date >= monthStart && date <= monthEnd
      })
      .reduce((sum, p) => sum + p.amount, 0)

    const monthOutflow = outflowPaymentsArray
      .filter(p => {
        const date = new Date(p.payment_date)
        return date >= monthStart && date <= monthEnd
      })
      .reduce((sum, p) => sum + p.amount, 0)

    return {
      month: format(month, 'MMM yyyy'),
      inflow: monthInflow,
      outflow: monthOutflow,
      net: monthInflow - monthOutflow
    }
  })

  const projectDetails: ProjectData[] = await Promise.all(
    filteredProjects.map(async (project) => {
      const projectApartments = apartmentsArray.filter(a => a.project_id === project.id)
      const projectContracts = contractsArray.filter(c => c.project_id === project.id)
      const projectPhases = projectPhasesArray.filter(p => p.project_id === project.id)
      const projectInvestment = creditAllocationsArray
        .filter(alloc => alloc.project_id === project.id)
        .reduce((sum, alloc) => sum + (alloc.allocated_amount || 0), 0)

      const projectBankCredits = bankCreditsArray.filter(bc => bc.project_id === project.id)
      const projectDebt = projectBankCredits.reduce((sum, bc) => sum + bc.amount, 0)

      const projectInvoiceIds = new Set(
        accountingInvoicesArray
          .filter(inv =>
            inv.project_id === project.id &&
            (inv.invoice_type === 'INCOMING_SUPPLIER' || inv.invoice_type === 'INCOMING_OFFICE')
          )
          .map(inv => inv.id)
      )

      const projectExpenses = accountingPaymentsArray
        .filter(p => projectInvoiceIds.has(p.invoice_id))
        .reduce((sum, p) => sum + (p.amount || 0), 0)

      const soldApts = projectApartments.filter(a => a.status === 'Sold')
      const projectRevenue = soldApts.reduce((sum, a) => {
        let total = a.price
        if (a.garage_id) total += garageMap.get(a.garage_id) || 0
        if (a.repository_id) total += storageMap.get(a.repository_id) || 0
        return sum + total
      }, 0)
      const projectProfit = projectRevenue - projectExpenses
      const projectProfitMargin = projectRevenue > 0 ? (projectProfit / projectRevenue) * 100 : 0
      const projectSalesRate = projectApartments.length > 0
        ? (soldApts.length / projectApartments.length) * 100
        : 0

      let riskLevel: 'Low' | 'Medium' | 'High' = 'Low'
      if (projectSalesRate < 20 || projectProfitMargin < 0) riskLevel = 'High'
      else if (projectSalesRate < 50 || projectProfitMargin < 15) riskLevel = 'Medium'

      return {
        id: project.id,
        name: project.name,
        location: project.location,
        status: project.status,
        budget: project.budget,
        revenue: projectRevenue,
        expenses: projectExpenses,
        units_sold: soldApts.length,
        total_units: projectApartments.length,
        contracts: projectContracts.length,
        phases_done: projectPhases.filter(p => p.status === 'completed').length,
        total_phases: projectPhases.length,
        equity: projectInvestment,
        debt: projectDebt,
        sales_rate: projectSalesRate,
        profit: projectProfit,
        profit_margin: projectProfitMargin,
        risk_level: riskLevel
      }
    })
  )

  const risks: Array<{ type: string; count: number; description: string }> = []
  const slowSalesProjects = projectDetails.filter(p => p.sales_rate < 40 && p.total_units > 0)
  if (slowSalesProjects.length > 0) {
    risks.push({
      type: 'SLOW SALES',
      count: slowSalesProjects.length,
      description: `${slowSalesProjects.length} project(s) with sales rate below 40%`
    })
  }

  const topProjects = [...projectDetails]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3)
    .map(p => ({ name: p.name, revenue: p.revenue, sales_rate: p.sales_rate }))

  const recommendations: string[] = []
  if (salesRate < 50) recommendations.push('Intensify marketing efforts to accelerate sales velocity')
  if (availableUnits > soldUnits) recommendations.push('Significant inventory available - consider pricing strategies')
  recommendations.push('Continue monitoring project budgets and timeline adherence')
  recommendations.push('Maintain strong relationships with financing partners')

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

  const today = new Date()
  const overdueInvoices = accountingInvoicesArray.filter(inv =>
    (inv.status === 'UNPAID' || inv.status === 'PARTIALLY_PAID') &&
    inv.due_date &&
    new Date(inv.due_date) < today
  ).length
  const overdueValue = accountingInvoicesArray
    .filter(inv =>
      (inv.status === 'UNPAID' || inv.status === 'PARTIALLY_PAID') &&
      inv.due_date &&
      new Date(inv.due_date) < today
    )
    .reduce((sum, inv) => sum + (inv.remaining_amount || 0), 0)

  const paymentCompletionRate = totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0

  const totalCompanies = accountingCompaniesArray.length
  const totalTicBudget = ticCostStructuresArray.reduce((sum, tic) => sum + (tic.budgeted_amount || 0), 0)
  const totalTicSpent = ticCostStructuresArray.reduce((sum, tic) => sum + (tic.actual_spent || 0), 0)
  const ticUtilization = totalTicBudget > 0 ? (totalTicSpent / totalTicBudget) * 100 : 0
  const companiesOverBudget = ticCostStructuresArray.filter(tic => (tic.actual_spent || 0) > (tic.budgeted_amount || 0)).length

  const totalOfficeSuppliers = officeSuppliersArray.length
  const officeInvoices = accountingInvoicesArray.filter(inv => inv.invoice_category === 'OFFICE')
  const totalOfficeInvoices = officeInvoices.length
  const totalOfficeSpent = officeInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
  const avgOfficeInvoice = totalOfficeInvoices > 0 ? totalOfficeSpent / totalOfficeInvoices : 0

  const totalCredits = bankCreditsArray.length
  const totalCreditValue = bankCreditsArray.reduce((sum, cr) => sum + (cr.amount || 0), 0)
  const creditsUsed = bankCreditsArray.reduce((sum, cr) => sum + (cr.used_amount || 0), 0)
  const creditsAvailable = bankCreditsArray.reduce((sum, cr) => sum + ((cr.amount || 0) - (cr.used_amount || 0)), 0)
  const cesijaPayments = accountingPaymentsArray.filter(p => p.cesija_credit_id).length
  const cesijaValue = accountingPaymentsArray
    .filter(p => p.cesija_credit_id)
    .reduce((sum, p) => sum + (p.amount || 0), 0)

  const totalBankAccounts = companyBankAccountsArray.length
  const totalBalance = companyBankAccountsArray.reduce((sum, acc) => sum + (acc.current_balance || 0), 0)
  const positiveBalanceAccounts = companyBankAccountsArray.filter(acc => (acc.current_balance || 0) > 0).length
  const negativeBalanceAccounts = companyBankAccountsArray.filter(acc => (acc.current_balance || 0) < 0).length

  const totalLoans = companyLoansArray.length
  const totalLoanAmount = companyLoansArray.reduce((sum, loan) => sum + (loan.amount || 0), 0)
  const totalLoanOutstanding = companyLoansArray.reduce((sum, loan) => sum + (loan.current_balance || 0), 0)
  const activeLoans = companyLoansArray.filter(loan => (loan.current_balance || 0) > 0).length

  const totalAllocations = creditAllocationsArray.length
  const allocatedAmount = creditAllocationsArray.reduce((sum, alloc) => sum + (alloc.allocated_amount || 0), 0)

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
    const typeName = (c as any).contract_types?.name || 'Uncategorized'
    contractTypeCounts[typeName] = (contractTypeCounts[typeName] || 0) + 1
  })
  const contractTypesData = Object.entries(contractTypeCounts).map(([name, count]) => ({ name, count }))

  return {
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
      sales_rate: salesRate,
      debt_equity_ratio: totalEquity > 0 ? totalDebt / totalEquity : 0,
      active_projects: projectsArray.filter(p => p.status === 'In Progress').length,
      total_customers: customersArray.length
    },
    sales_performance: {
      total_units: totalUnits,
      units_sold: soldUnits,
      available_units: availableUnits,
      reserved_units: reservedUnits,
      total_revenue: totalRevenue,
      avg_sale_price: avgSalePrice,
      total_sales: salesArray.length,
      buyers: buyers,
      active_leads: leads + interested,
      conversion_rate: conversionRate
    },
    funding_structure: {
      total_equity: totalEquity,
      total_debt: totalDebt,
      debt_equity_ratio: totalEquity > 0 ? totalDebt / totalEquity : 0,
      total_credit_lines: bankCreditsArray.reduce((sum, bc) => sum + (bc.amount || 0), 0),
      available_credit: bankCreditsArray.reduce((sum, bc) => sum + ((bc.available_balance || 0) - (bc.drawn_amount || 0)), 0),
      active_investors: activeFundersCount,
      active_banks: banksArray.length,
      bank_credits: bankCreditsArray.length,
      avg_interest_rate: avgInterestRate,
      monthly_debt_service: monthlyDebtService
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
      total_companies: totalCompanies,
      total_tic_budget: totalTicBudget,
      total_tic_spent: totalTicSpent,
      tic_utilization: ticUtilization,
      companies_over_budget: companiesOverBudget
    },
    office_expenses: {
      total_office_suppliers: totalOfficeSuppliers,
      total_office_invoices: totalOfficeInvoices,
      total_office_spent: totalOfficeSpent,
      avg_office_invoice: avgOfficeInvoice
    },
    company_credits: {
      total_credits: totalCredits,
      total_credit_value: totalCreditValue,
      credits_available: creditsAvailable,
      credits_used: creditsUsed,
      cesija_payments: cesijaPayments,
      cesija_value: cesijaValue,
      total_allocations: totalAllocations,
      allocated_amount: allocatedAmount
    },
    company_loans: {
      total_loans: totalLoans,
      total_loan_amount: totalLoanAmount,
      total_outstanding: totalLoanOutstanding,
      active_loans: activeLoans
    },
    bank_accounts: {
      total_accounts: totalBankAccounts,
      total_balance: totalBalance,
      positive_balance_accounts: positiveBalanceAccounts,
      negative_balance_accounts: negativeBalanceAccounts
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
      recommendations: recommendations
    }
  }
}
