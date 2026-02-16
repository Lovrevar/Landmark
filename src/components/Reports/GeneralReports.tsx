import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Download,
  Building2,
  DollarSign,
  TrendingUp,
  Users,
  FileText,
  AlertTriangle,
  Target,
  PieChart,
  Activity,
  Wallet,
  CreditCard,
  BarChart3,
  Home
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns'
import { LoadingSpinner, Button, Badge, EmptyState, Table } from '../ui'

interface ProjectData {
  id: string
  name: string
  location: string
  status: string
  budget: number
  revenue: number
  expenses: number
  units_sold: number
  total_units: number
  contracts: number
  phases_done: number
  total_phases: number
  equity: number
  debt: number
  sales_rate: number
  profit: number
  profit_margin: number
  risk_level: 'Low' | 'Medium' | 'High'
}

interface ComprehensiveReport {
  executive_summary: {
    total_projects: number
    active_projects: number
    completed_projects: number
    total_revenue: number
    total_expenses: number
    total_profit: number
    profit_margin: number
    portfolio_value: number
    roi: number
  }
  kpis: {
    portfolio_value: number
    total_revenue: number
    net_profit: number
    roi: number
    sales_rate: number
    debt_equity_ratio: number
    active_projects: number
    total_customers: number
  }
  sales_performance: {
    total_units: number
    units_sold: number
    available_units: number
    reserved_units: number
    total_revenue: number
    avg_sale_price: number
    total_sales: number
    buyers: number
    active_leads: number
    conversion_rate: number
  }
  funding_structure: {
    total_equity: number
    total_debt: number
    debt_equity_ratio: number
    total_credit_lines: number
    available_credit: number
    active_investors: number
    active_banks: number
    bank_credits: number
    avg_interest_rate: number
    monthly_debt_service: number
  }
  construction_status: {
    total_contracts: number
    active_contracts: number
    completed_contracts: number
    contract_value: number
    budget_realized: number
    budget_utilization: number
    total_subcontractors: number
    total_phases: number
    completed_phases: number
    work_logs_7days: number
    total_milestones: number
    completed_milestones: number
  }
  accounting_overview: {
    total_invoices: number
    total_invoice_value: number
    paid_invoices: number
    paid_value: number
    pending_invoices: number
    pending_value: number
    overdue_invoices: number
    overdue_value: number
    payment_completion_rate: number
  }
  tic_cost_management: {
    total_companies: number
    total_tic_budget: number
    total_tic_spent: number
    tic_utilization: number
    companies_over_budget: number
  }
  office_expenses: {
    total_office_suppliers: number
    total_office_invoices: number
    total_office_spent: number
    avg_office_invoice: number
  }
  company_credits: {
    total_credits: number
    total_credit_value: number
    credits_available: number
    credits_used: number
    cesija_payments: number
    cesija_value: number
    total_allocations: number
    allocated_amount: number
  }
  company_loans: {
    total_loans: number
    total_loan_amount: number
    total_outstanding: number
    active_loans: number
  }
  bank_accounts: {
    total_accounts: number
    total_balance: number
    positive_balance_accounts: number
    negative_balance_accounts: number
  }
  buildings_units: {
    total_buildings: number
    total_units: number
    sold_units: number
    reserved_units: number
    available_units: number
    total_garages: number
    total_repositories: number
  }
  retail_portfolio: {
    total_retail_projects: number
    active_retail_projects: number
    total_land_plots: number
    total_retail_contracts: number
    retail_contract_value: number
    retail_budget_realized: number
    retail_phases: number
    completed_retail_phases: number
    total_retail_customers: number
    retail_suppliers: number
  }
  contract_types: Array<{
    name: string
    count: number
  }>
  cash_flow: Array<{
    month: string
    inflow: number
    outflow: number
    net: number
  }>
  projects: ProjectData[]
  risks: Array<{
    type: string
    count: number
    description: string
  }>
  insights: {
    top_projects: Array<{ name: string; revenue: number; sales_rate: number }>
    recommendations: string[]
  }
}

const GeneralReports: React.FC = () => {
  const [report, setReport] = useState<ComprehensiveReport | null>(null)
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [dateRange, setDateRange] = useState({
    start: format(subMonths(new Date(), 6), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })
  const [loading, setLoading] = useState(true)
  const [generatingPDF, setGeneratingPDF] = useState(false)

  useEffect(() => {
    generateComprehensiveReport()
  }, [selectedProject, dateRange])

  const generateComprehensiveReport = async () => {
    setLoading(true)
    try {
      const reportData = await fetchAllData()
      setReport(reportData)
    } catch (error) {
      console.error('Error generating report:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllData = async (): Promise<ComprehensiveReport> => {
    const { data: projects } = await supabase.from('projects').select('*')
    const { data: apartments } = await supabase.from('apartments').select('*')
    const { data: sales } = await supabase.from('sales').select('*, apartments(garage_id, repository_id)')
    const { data: customers } = await supabase.from('customers').select('*')
    const { data: contracts } = await supabase.from('contracts').select('*, contract_types(name)')
    const { data: subcontractors } = await supabase.from('subcontractors').select('*')
    const { data: projectPhases } = await supabase.from('project_phases').select('*')
    const { data: workLogs } = await supabase.from('work_logs').select('*')
    const { data: investors } = await supabase.from('investors').select('*')
    const { data: projectInvestments } = await supabase.from('project_investments').select('*')

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
    const investorsArray = investors || []
    const projectInvestmentsArray = projectInvestments || []

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

    const totalRevenue = salesArray.reduce((sum, s) => {
      let saleTotal = s.sale_price
      if (s.apartments?.garage_id) {
        saleTotal += garageMap.get(s.apartments.garage_id) || 0
      }
      if (s.apartments?.repository_id) {
        saleTotal += storageMap.get(s.apartments.repository_id) || 0
      }
      return sum + saleTotal
    }, 0)

    const contractExpenses = contractsArray.map(c => {
      const contractInvoices = accountingInvoicesArray.filter(
        inv => inv.contract_id === c.id &&
        (inv.invoice_type === 'INCOMING_SUPPLIER' || inv.invoice_type === 'INCOMING_OFFICE')
      )
      const invoicedTotal = contractInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
      return Math.max(c.total_amount || 0, invoicedTotal)
    })

    const invoicesWithoutContract = accountingInvoicesArray.filter(
      inv => !inv.contract_id &&
      (inv.invoice_type === 'INCOMING_SUPPLIER' || inv.invoice_type === 'INCOMING_OFFICE')
    ).reduce((sum, inv) => sum + (inv.total_amount || 0), 0)

    const totalExpenses = contractExpenses.reduce((sum, exp) => sum + exp, 0) + invoicesWithoutContract
    const totalProfit = totalRevenue - totalExpenses
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

    const portfolioValue = projectsArray.reduce((sum, p) => sum + p.budget, 0)
    const totalEquity = projectInvestmentsArray.reduce((sum, inv) => sum + inv.amount, 0)
    const totalDebt = bankCreditsArray.reduce((sum, bc) => sum + bc.amount, 0)
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
        const projectInvestment = projectInvestmentsArray
          .filter(inv => inv.project_id === project.id)
          .reduce((sum, inv) => sum + inv.amount, 0)

        const projectBankCredits = bankCreditsArray.filter(bc => bc.project_id === project.id)
        const projectDebt = projectBankCredits.reduce((sum, bc) => sum + bc.amount, 0)

        const projectContractExpenses = projectContracts.map(c => {
          const contractInvoices = accountingInvoicesArray.filter(
            inv => inv.contract_id === c.id &&
            (inv.invoice_type === 'INCOMING_SUPPLIER' || inv.invoice_type === 'INCOMING_OFFICE')
          )
          const invoicedTotal = contractInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
          return Math.max(c.total_amount || 0, invoicedTotal)
        })

        const projectInvoicesWithoutContract = accountingInvoicesArray.filter(
          inv => inv.project_id === project.id &&
          !inv.contract_id &&
          (inv.invoice_type === 'INCOMING_SUPPLIER' || inv.invoice_type === 'INCOMING_OFFICE')
        ).reduce((sum, inv) => sum + (inv.total_amount || 0), 0)

        const projectExpenses = projectContractExpenses.reduce((sum, exp) => sum + exp, 0) + projectInvoicesWithoutContract

        const soldApts = projectApartments.filter(a => a.status === 'Sold')
        // Calculate project revenue including linked garages and storages
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
      const typeName = c.contract_types?.name || 'Uncategorized'
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
        active_investors: investorsArray.length,
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

  const generatePDF = async () => {
    if (!report) return
    setGeneratingPDF(true)

    try {
      const { jsPDF } = await import('jspdf')
      const {
        drawBarChart,
        drawPieChart,
        drawLineChart,
        drawHorizontalBarChart,
        drawProgressBar,
        hexToRgb
      } = await import('./pdfCharts')

      const pdf = new jsPDF('p', 'mm', 'a4')

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20
      let yPosition = margin

      const checkPageBreak = (height: number) => {
        if (yPosition + height > pageHeight - margin) {
          pdf.addPage()
          yPosition = margin
          return true
        }
        return false
      }

      pdf.setFillColor(15, 23, 42)
      pdf.rect(0, 0, pageWidth, pageHeight, 'F')

      pdf.setFillColor(37, 99, 235)
      pdf.rect(0, 0, 10, pageHeight, 'F')

      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(48)
      pdf.setFont('helvetica', 'bold')
      let text = 'LANDMARK'
      let textWidth = pdf.getTextWidth(text)
      pdf.text(text, pageWidth / 2 - textWidth / 2, 80)
      text = 'GROUP'
      textWidth = pdf.getTextWidth(text)
      pdf.text(text, pageWidth / 2 - textWidth / 2, 95)

      pdf.setFontSize(24)
      pdf.setFont('helvetica', 'normal')
      text = 'Executive Portfolio Report'
      textWidth = pdf.getTextWidth(text)
      pdf.text(text, pageWidth / 2 - textWidth / 2, 120)

      pdf.setDrawColor(37, 99, 235)
      pdf.setLineWidth(1)
      pdf.line(pageWidth / 2 - 40, 125, pageWidth / 2 + 40, 125)

      pdf.setFontSize(14)
      pdf.setTextColor(200, 200, 200)
      text = `Report Period: ${format(new Date(), 'MMMM yyyy')}`
      textWidth = pdf.getTextWidth(text)
      pdf.text(text, pageWidth / 2 - textWidth / 2, 145)
      text = `Generated: ${format(new Date(), 'MMMM dd, yyyy')}`
      textWidth = pdf.getTextWidth(text)
      pdf.text(text, pageWidth / 2 - textWidth / 2, 155)

      pdf.setFontSize(12)
      const summaryStats = [
        `${report.executive_summary.total_projects} Projects`,
        `€${(report.executive_summary.total_revenue / 1000000).toFixed(1)}M Revenue`,
        `${report.kpis.roi.toFixed(1)}% ROI`
      ]
      text = summaryStats.join('  |  ')
      textWidth = pdf.getTextWidth(text)
      pdf.text(text, pageWidth / 2 - textWidth / 2, 180)

      pdf.setFontSize(10)
      pdf.setTextColor(150, 150, 150)
      text = 'CONFIDENTIAL'
      textWidth = pdf.getTextWidth(text)
      pdf.text(text, pageWidth / 2 - textWidth / 2, pageHeight - 30)

      pdf.addPage()
      yPosition = margin

      pdf.setFillColor(15, 23, 42)
      pdf.rect(0, 0, pageWidth, 55, 'F')

      pdf.setFillColor(37, 99, 235)
      pdf.rect(0, 0, 8, 55, 'F')

      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(32)
      pdf.setFont('helvetica', 'bold')
      pdf.text('LANDMARK GROUP', margin, 22)

      pdf.setFontSize(18)
      pdf.setFont('helvetica', 'normal')
      pdf.text('Executive Portfolio Report', margin, 33)

      pdf.setFontSize(10)
      pdf.setTextColor(200, 200, 200)
      pdf.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, margin, 43)

      pdf.setTextColor(0, 0, 0)
      yPosition = 65

      pdf.setFillColor(240, 245, 250)
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'F')

      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(37, 99, 235)
      pdf.text('EXECUTIVE SUMMARY', margin + 5, yPosition + 10)

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0, 0, 0)

      const summaryLines = [
        `• Portfolio: ${report.executive_summary.total_projects} projects (${report.executive_summary.active_projects} active, ${report.executive_summary.completed_projects} completed)`,
        `• Financial: €${(report.executive_summary.total_revenue / 1000000).toFixed(1)}M revenue, €${(report.executive_summary.total_expenses / 1000000).toFixed(1)}M expenses, €${(report.executive_summary.total_profit / 1000000).toFixed(1)}M profit (${report.executive_summary.profit_margin.toFixed(1)}% margin)`,
        `• Capital Structure: €${(report.funding_structure.total_equity / 1000000).toFixed(1)}M equity, €${(report.funding_structure.total_debt / 1000000).toFixed(1)}M debt, ${report.funding_structure.debt_equity_ratio.toFixed(2)} D/E ratio`,
        `• Sales: ${report.sales_performance.units_sold}/${report.sales_performance.total_units} units sold (${report.sales_performance.units_sold > 0 ? ((report.sales_performance.units_sold / report.sales_performance.total_units) * 100).toFixed(1) : '0'}%), ${report.sales_performance.total_sales} transactions`,
        `• Construction: ${report.construction_status.total_contracts} contracts, ${report.construction_status.total_subcontractors} subcontractors, ${report.construction_status.work_logs_7days} work logs recorded`
      ]

      summaryLines.forEach((line, index) => {
        pdf.text(line, margin + 5, yPosition + 20 + (index * 6))
      })

      yPosition += 60

      checkPageBreak(40)
      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(37, 99, 235)
      pdf.text('KEY PERFORMANCE INDICATORS', margin, yPosition)
      yPosition += 10

      const kpiData = [
        ['€' + (report.kpis.portfolio_value / 1000000).toFixed(1) + 'M', 'Portfolio Value'],
        ['€' + (report.kpis.total_revenue / 1000000).toFixed(1) + 'M', 'Total Revenue'],
        ['€' + (report.kpis.net_profit / 1000000).toFixed(1) + 'M', 'Net Profit'],
        [report.kpis.roi.toFixed(1) + '%', 'ROI'],
        [report.kpis.sales_rate.toFixed(1) + '%', 'Sales Rate'],
        [report.kpis.debt_equity_ratio.toFixed(2), 'D/E Ratio'],
        [report.kpis.active_projects.toString(), 'Active Projects'],
        [report.kpis.total_customers.toString(), 'Total Customers']
      ]

      const kpiBoxWidth = 45
      const kpiBoxHeight = 20
      let xPos = margin
      let kpiRow = 0

      kpiData.forEach((kpi, index) => {
        if (index > 0 && index % 4 === 0) {
          kpiRow++
          xPos = margin
          yPosition += kpiBoxHeight + 5
        }

        pdf.setFillColor(240, 245, 250)
        pdf.rect(xPos, yPosition, kpiBoxWidth, kpiBoxHeight, 'F')

        pdf.setFontSize(16)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(37, 99, 235)
        let kpiTextWidth = pdf.getTextWidth(kpi[0])
        pdf.text(kpi[0], xPos + kpiBoxWidth / 2 - kpiTextWidth / 2, yPosition + 10)

        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(100, 100, 100)
        kpiTextWidth = pdf.getTextWidth(kpi[1])
        pdf.text(kpi[1], xPos + kpiBoxWidth / 2 - kpiTextWidth / 2, yPosition + 16)

        xPos += kpiBoxWidth + 2
      })

      yPosition += 30

      pdf.addPage()
      yPosition = margin

      pdf.setFontSize(16)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(37, 99, 235)
      pdf.text('PORTFOLIO ANALYTICS', margin, yPosition)
      yPosition += 10

      const fundingChartData = [
        { label: 'Equity', value: report.funding_structure.total_equity, color: '#22c55e' },
        { label: 'Debt', value: report.funding_structure.total_debt, color: '#ef4444' }
      ]
      drawPieChart(pdf, margin + 30, yPosition + 30, 25, fundingChartData, {
        title: 'Capital Structure',
        showLegend: true
      })

      const salesChartData = [
        { label: 'Sold', value: report.sales_performance.units_sold, color: '#22c55e' },
        { label: 'Reserved', value: report.sales_performance.reserved_units, color: '#f59e0b' },
        { label: 'Available', value: report.sales_performance.available_units, color: '#6b7280' }
      ]
      drawPieChart(pdf, pageWidth - margin - 30, yPosition + 30, 25, salesChartData, {
        title: 'Units Status',
        showLegend: true
      })

      yPosition += 85

      checkPageBreak(60)
      const cashFlowData = report.cash_flow.slice(0, 6).map(m => ({
        label: m.month.substring(0, 3),
        value: m.net / 1000
      }))
      drawBarChart(pdf, margin, yPosition, pageWidth - 2 * margin, 50, cashFlowData, {
        title: 'Monthly Net Cash Flow (€K)',
        color: '#2563eb',
        showValues: true
      })

      yPosition += 60

      checkPageBreak(60)
      const topProjects = report.projects
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map(p => ({
          label: p.name.substring(0, 15),
          value: p.revenue / 1000000,
          color: p.profit_margin > 20 ? '#22c55e' : p.profit_margin > 10 ? '#f59e0b' : '#ef4444'
        }))

      if (topProjects.length > 0) {
        drawHorizontalBarChart(pdf, margin + 50, yPosition, pageWidth - 2 * margin - 50, 50, topProjects, {
          title: 'Top Projects by Revenue (€M)',
          showValues: true
        })
        yPosition += 60
      }

      pdf.addPage()
      yPosition = margin

      pdf.setFillColor(22, 163, 74)
      pdf.rect(0, 0, pageWidth, 45, 'F')

      pdf.setFillColor(21, 128, 61)
      pdf.rect(0, 0, 8, 45, 'F')

      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(20)
      pdf.setFont('helvetica', 'bold')
      pdf.text('SALES PERFORMANCE', margin, 25)

      pdf.setTextColor(0, 0, 0)
      yPosition = 55

      pdf.setFillColor(220, 252, 231)
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 40, 'F')

      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(22, 163, 74)
      pdf.text('Sales Overview', margin + 5, yPosition + 10)

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0, 0, 0)

      const salesData = [
        ['Total Units:', report.sales_performance.total_units.toString(), 'Avg Sale Price:', '€' + report.sales_performance.avg_sale_price.toLocaleString()],
        ['Units Sold:', `${report.sales_performance.units_sold} (${((report.sales_performance.units_sold / report.sales_performance.total_units) * 100).toFixed(1)}%)`, 'Total Sales:', report.sales_performance.total_sales.toString()],
        ['Available:', report.sales_performance.available_units.toString(), 'Buyers:', report.sales_performance.buyers.toString()],
        ['Reserved:', report.sales_performance.reserved_units.toString(), 'Active Leads:', report.sales_performance.active_leads.toString()],
        ['Total Revenue:', '€' + report.sales_performance.total_revenue.toLocaleString(), 'Conversion Rate:', report.sales_performance.conversion_rate.toFixed(1) + '%']
      ]

      salesData.forEach((row, index) => {
        const y = yPosition + 18 + (index * 4)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[0], margin + 5, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[1], margin + 35, y)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[2], margin + 95, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[3], margin + 125, y)
      })

      yPosition += 50

      checkPageBreak(40)
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(37, 99, 235)
      pdf.text('Sales Progress', margin, yPosition)
      yPosition += 8

      const salesRate = (report.sales_performance.units_sold / report.sales_performance.total_units) * 100
      drawProgressBar(pdf, margin, yPosition, pageWidth - 2 * margin, 8, salesRate, {
        label: 'Units Sold',
        color: '#22c55e',
        showPercentage: true
      })
      yPosition += 15

      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(37, 99, 235)
      pdf.text('Construction Progress', margin, yPosition)
      yPosition += 8

      const constructionProgress = (report.construction_status.completed_phases / report.construction_status.total_phases) * 100
      drawProgressBar(pdf, margin, yPosition, pageWidth - 2 * margin, 8, constructionProgress, {
        label: 'Phases Completed',
        color: '#2563eb',
        showPercentage: true
      })
      yPosition += 15

      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(37, 99, 235)
      pdf.text('Budget Utilization', margin, yPosition)
      yPosition += 8

      drawProgressBar(pdf, margin, yPosition, pageWidth - 2 * margin, 8, report.construction_status.budget_utilization, {
        label: 'Budget Realized',
        color: report.construction_status.budget_utilization > 90 ? '#ef4444' : '#f59e0b',
        showPercentage: true
      })
      yPosition += 20

      pdf.addPage()
      yPosition = margin

      pdf.setFillColor(245, 158, 11)
      pdf.rect(0, 0, pageWidth, 45, 'F')

      pdf.setFillColor(180, 83, 9)
      pdf.rect(0, 0, 8, 45, 'F')

      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(20)
      pdf.setFont('helvetica', 'bold')
      pdf.text('FUNDING & FINANCE', margin, 25)

      pdf.setTextColor(0, 0, 0)
      yPosition = 55

      pdf.setFillColor(254, 243, 199)
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'F')

      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(245, 158, 11)
      pdf.text('Financial Structure', margin + 5, yPosition + 10)

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0, 0, 0)

      const fundingData = [
        ['Total Equity Invested:', '€' + report.funding_structure.total_equity.toLocaleString(), 'Active Investors:', report.funding_structure.active_investors.toString()],
        ['Total Debt:', '€' + report.funding_structure.total_debt.toLocaleString(), 'Active Banks:', report.funding_structure.active_banks.toString()],
        ['Debt-to-Equity Ratio:', report.funding_structure.debt_equity_ratio.toFixed(2), 'Bank Credits:', report.funding_structure.bank_credits.toString()],
        ['Total Credit Lines:', '€' + report.funding_structure.total_credit_lines.toLocaleString(), 'Avg Interest Rate:', report.funding_structure.avg_interest_rate.toFixed(2) + '%'],
        ['Available Credit:', '€' + report.funding_structure.available_credit.toLocaleString(), 'Monthly Debt Service:', '€' + report.funding_structure.monthly_debt_service.toLocaleString()]
      ]

      fundingData.forEach((row, index) => {
        const y = yPosition + 18 + (index * 5)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[0], margin + 5, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[1], margin + 50, y)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[2], margin + 105, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[3], margin + 145, y)
      })

      yPosition += 60

      pdf.addPage()
      yPosition = margin

      pdf.setFillColor(239, 68, 68)
      pdf.rect(0, 0, pageWidth, 45, 'F')

      pdf.setFillColor(185, 28, 28)
      pdf.rect(0, 0, 8, 45, 'F')

      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(20)
      pdf.setFont('helvetica', 'bold')
      pdf.text('CONSTRUCTION STATUS', margin, 25)

      pdf.setTextColor(0, 0, 0)
      yPosition = 55

      pdf.setFillColor(254, 226, 226)
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'F')

      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(220, 38, 38)
      pdf.text('Construction & Supervision Overview', margin + 5, yPosition + 10)

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0, 0, 0)

      const constructionData = [
        ['Total Contracts:', report.construction_status.total_contracts.toString(), 'Budget Utilization:', report.construction_status.budget_utilization.toFixed(1) + '%'],
        ['Active Contracts:', report.construction_status.active_contracts.toString(), 'Total Subcontractors:', report.construction_status.total_subcontractors.toString()],
        ['Completed Contracts:', report.construction_status.completed_contracts.toString(), 'Total Phases:', report.construction_status.total_phases.toString()],
        ['Contract Value:', '€' + report.construction_status.contract_value.toLocaleString(), 'Completed Phases:', report.construction_status.completed_phases.toString()],
        ['Budget Realized:', '€' + report.construction_status.budget_realized.toLocaleString(), 'Work Logs (7 days):', report.construction_status.work_logs_7days.toString()]
      ]

      constructionData.forEach((row, index) => {
        const y = yPosition + 18 + (index * 5)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[0], margin + 5, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[1], margin + 45, y)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[2], margin + 105, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[3], margin + 145, y)
      })

      yPosition += 60

      pdf.addPage()
      yPosition = margin

      pdf.setFillColor(6, 182, 212)
      pdf.rect(0, 0, pageWidth, 45, 'F')

      pdf.setFillColor(8, 145, 178)
      pdf.rect(0, 0, 8, 45, 'F')

      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(20)
      pdf.setFont('helvetica', 'bold')
      pdf.text('ACCOUNTING OVERVIEW', margin, 25)

      pdf.setTextColor(0, 0, 0)
      yPosition = 55

      pdf.setFillColor(224, 242, 254)
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 60, 'F')

      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(6, 182, 212)
      pdf.text('Invoice & Payment Summary', margin + 5, yPosition + 10)

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0, 0, 0)

      const accountingData = [
        ['Total Invoices:', report.accounting_overview.total_invoices.toString(), 'Paid Invoices:', report.accounting_overview.paid_invoices.toString()],
        ['Total Invoice Value:', '€' + (report.accounting_overview.total_invoice_value / 1000000).toFixed(2) + 'M', 'Paid Value:', '€' + (report.accounting_overview.paid_value / 1000000).toFixed(2) + 'M'],
        ['Pending Invoices:', report.accounting_overview.pending_invoices.toString(), 'Overdue Invoices:', report.accounting_overview.overdue_invoices.toString()],
        ['Pending Value:', '€' + (report.accounting_overview.pending_value / 1000000).toFixed(2) + 'M', 'Overdue Value:', '€' + (report.accounting_overview.overdue_value / 1000000).toFixed(2) + 'M'],
        ['Payment Completion Rate:', report.accounting_overview.payment_completion_rate.toFixed(1) + '%', '', '']
      ]

      accountingData.forEach((row, index) => {
        const y = yPosition + 18 + (index * 6)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[0], margin + 5, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[1], margin + 55, y)
        if (row[2]) {
          pdf.setFont('helvetica', 'bold')
          pdf.text(row[2], margin + 105, y)
          pdf.setFont('helvetica', 'normal')
          pdf.text(row[3], margin + 145, y)
        }
      })

      yPosition += 50

      checkPageBreak(70)
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(37, 99, 235)
      pdf.text('Invoice Status Distribution', margin, yPosition)
      yPosition += 8

      const invoiceStatusData = [
        { label: 'Paid', value: report.accounting_overview.paid_invoices },
        { label: 'Pending', value: report.accounting_overview.pending_invoices },
        { label: 'Overdue', value: report.accounting_overview.overdue_invoices }
      ]
      drawBarChart(pdf, margin, yPosition, pageWidth - 2 * margin, 45, invoiceStatusData, {
        color: '#06b6d4',
        showValues: true
      })
      yPosition += 55

      checkPageBreak(25)
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(37, 99, 235)
      pdf.text('Payment Completion Rate', margin, yPosition)
      yPosition += 8

      drawProgressBar(pdf, margin, yPosition, pageWidth - 2 * margin, 8, report.accounting_overview.payment_completion_rate, {
        color: '#06b6d4',
        showPercentage: true
      })
      yPosition += 20

      checkPageBreak(100)
      pdf.setFillColor(209, 250, 229)
      pdf.rect(margin, yPosition, (pageWidth - 2 * margin - 5) / 2, 45, 'F')

      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(16, 185, 129)
      pdf.text('TIC COST MANAGEMENT', margin + 5, yPosition + 10)

      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0, 0, 0)

      const ticData = [
        ['Total Companies:', report.tic_cost_management.total_companies.toString()],
        ['TIC Budget:', '€' + report.tic_cost_management.total_tic_budget.toLocaleString()],
        ['TIC Spent:', '€' + report.tic_cost_management.total_tic_spent.toLocaleString()],
        ['TIC Utilization:', report.tic_cost_management.tic_utilization.toFixed(1) + '%'],
        ['Over Budget:', report.tic_cost_management.companies_over_budget.toString()]
      ]

      ticData.forEach((row, index) => {
        const y = yPosition + 16 + (index * 5)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[0], margin + 5, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[1], margin + 35, y)
      })

      pdf.setFillColor(254, 243, 199)
      pdf.rect(margin + (pageWidth - 2 * margin + 5) / 2, yPosition, (pageWidth - 2 * margin - 5) / 2, 45, 'F')

      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(245, 158, 11)
      pdf.text('OFFICE EXPENSES', margin + (pageWidth - 2 * margin + 5) / 2 + 5, yPosition + 10)

      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0, 0, 0)

      const officeData = [
        ['Office Suppliers:', report.office_expenses.total_office_suppliers.toString()],
        ['Office Invoices:', report.office_expenses.total_office_invoices.toString()],
        ['Total Spent:', '€' + report.office_expenses.total_office_spent.toLocaleString()],
        ['Avg Invoice:', '€' + report.office_expenses.avg_office_invoice.toLocaleString()]
      ]

      officeData.forEach((row, index) => {
        const y = yPosition + 16 + (index * 5)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[0], margin + (pageWidth - 2 * margin + 5) / 2 + 5, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[1], margin + (pageWidth - 2 * margin + 5) / 2 + 35, y)
      })

      yPosition += 55

      checkPageBreak(100)
      pdf.setFillColor(254, 205, 211)
      pdf.rect(margin, yPosition, (pageWidth - 2 * margin - 5) / 2, 50, 'F')

      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(225, 29, 72)
      pdf.text('COMPANY CREDITS', margin + 5, yPosition + 10)

      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0, 0, 0)

      const creditsData = [
        ['Total Credits:', report.company_credits.total_credits.toString()],
        ['Credit Value:', '€' + report.company_credits.total_credit_value.toLocaleString()],
        ['Available:', '€' + report.company_credits.credits_available.toLocaleString()],
        ['Used:', '€' + report.company_credits.credits_used.toLocaleString()],
        ['Cesija Payments:', report.company_credits.cesija_payments.toString()],
        ['Cesija Value:', '€' + report.company_credits.cesija_value.toLocaleString()]
      ]

      creditsData.forEach((row, index) => {
        const y = yPosition + 16 + (index * 5)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[0], margin + 5, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[1], margin + 35, y)
      })

      pdf.setFillColor(241, 245, 249)
      pdf.rect(margin + (pageWidth - 2 * margin + 5) / 2, yPosition, (pageWidth - 2 * margin - 5) / 2, 50, 'F')

      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(71, 85, 105)
      pdf.text('BANK ACCOUNTS', margin + (pageWidth - 2 * margin + 5) / 2 + 5, yPosition + 10)

      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0, 0, 0)

      const bankData = [
        ['Total Accounts:', report.bank_accounts.total_accounts.toString()],
        ['Total Balance:', '€' + report.bank_accounts.total_balance.toLocaleString()],
        ['Positive Balance:', report.bank_accounts.positive_balance_accounts.toString()],
        ['Negative Balance:', report.bank_accounts.negative_balance_accounts.toString()]
      ]

      bankData.forEach((row, index) => {
        const y = yPosition + 16 + (index * 5)
        pdf.setFont('helvetica', 'bold')
        pdf.text(row[0], margin + (pageWidth - 2 * margin + 5) / 2 + 5, y)
        pdf.setFont('helvetica', 'normal')
        pdf.text(row[1], margin + (pageWidth - 2 * margin + 5) / 2 + 35, y)
      })

      yPosition += 60

      if (report.contract_types.length > 0) {
        checkPageBreak(60)
        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(37, 99, 235)
        pdf.text('CONTRACT DISTRIBUTION', margin, yPosition)
        yPosition += 8

        const contractData = report.contract_types.map((ct, idx) => ({
          label: ct.name.substring(0, 12),
          value: ct.count,
          color: ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][idx % 6]
        }))

        if (contractData.length <= 6) {
          drawPieChart(pdf, pageWidth / 2, yPosition + 35, 28, contractData, {
            showLegend: true
          })
          yPosition += 80
        } else {
          const barData = contractData.map(cd => ({
            label: cd.label,
            value: cd.value
          }))
          drawBarChart(pdf, margin, yPosition, pageWidth - 2 * margin, 45, barData, {
            color: '#2563eb',
            showValues: true
          })
          yPosition += 55
        }
      }

      checkPageBreak(70)
      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(37, 99, 235)
      pdf.text('CASH FLOW TREND', margin, yPosition)
      yPosition += 8

      const cashFlowTrend = report.cash_flow.slice(0, 6).map(m => ({
        label: m.month.substring(0, 3),
        value: m.net / 1000
      }))
      drawLineChart(pdf, margin, yPosition, pageWidth - 2 * margin, 50, cashFlowTrend, {
        color: '#2563eb',
        showPoints: true,
        fillArea: true
      })

      yPosition += 60

      checkPageBreak(60)
      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(37, 99, 235)
      pdf.text('CASH FLOW ANALYSIS', margin, yPosition)
      yPosition += 10

      pdf.setFillColor(240, 240, 240)
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F')

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Month', margin + 5, yPosition + 5)
      pdf.text('Inflow', margin + 50, yPosition + 5)
      pdf.text('Outflow', margin + 90, yPosition + 5)
      pdf.text('Net Cash Flow', margin + 130, yPosition + 5)

      yPosition += 10

      pdf.setFont('helvetica', 'normal')
      let totalInflow = 0
      let totalOutflow = 0
      let totalNet = 0

      report.cash_flow.forEach((month, index) => {
        totalInflow += month.inflow
        totalOutflow += month.outflow
        totalNet += month.net

        pdf.text(month.month, margin + 5, yPosition + (index * 5))
        pdf.text('€' + (month.inflow / 1000).toFixed(0) + 'K', margin + 50, yPosition + (index * 5))
        pdf.text('€' + (month.outflow / 1000).toFixed(0) + 'K', margin + 90, yPosition + (index * 5))

        pdf.setTextColor(month.net >= 0 ? 22 : 220, month.net >= 0 ? 163 : 38, month.net >= 0 ? 74 : 38)
        pdf.text('€' + (month.net / 1000).toFixed(0) + 'K', margin + 130, yPosition + (index * 5))
        pdf.setTextColor(0, 0, 0)
      })

      yPosition += report.cash_flow.length * 5 + 5

      pdf.setFont('helvetica', 'bold')
      pdf.text(`6-Month Totals:`, margin + 5, yPosition)
      pdf.text(`Inflow: €${(totalInflow / 1000000).toFixed(2)}M | Outflow: €${(totalOutflow / 1000000).toFixed(2)}M | Net: €${(totalNet / 1000000).toFixed(2)}M`, margin + 5, yPosition + 5)

      yPosition += 15

      if (report.projects.length > 0) {
        pdf.addPage()
        yPosition = margin

        pdf.setFillColor(15, 23, 42)
        pdf.rect(0, 0, pageWidth, 45, 'F')

        pdf.setFillColor(37, 99, 235)
        pdf.rect(0, 0, 8, 45, 'F')

        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(20)
        pdf.setFont('helvetica', 'bold')
        pdf.text('PROJECT PORTFOLIO', margin, 25)

        pdf.setTextColor(0, 0, 0)
        yPosition = 55

        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(37, 99, 235)
        pdf.text('Project Performance Overview', margin, yPosition)
        yPosition += 10

        const projectPerformance = report.projects
          .sort((a, b) => b.profit_margin - a.profit_margin)
          .slice(0, 8)
          .map(p => ({
            label: p.name.substring(0, 15),
            value: p.profit_margin,
            color: p.profit_margin > 20 ? '#22c55e' : p.profit_margin > 10 ? '#f59e0b' : '#ef4444'
          }))

        if (projectPerformance.length > 0) {
          drawHorizontalBarChart(pdf, margin + 50, yPosition, pageWidth - 2 * margin - 50, 70, projectPerformance, {
            title: 'Profit Margin (%)',
            showValues: true
          })
          yPosition += 80
        }

        checkPageBreak(15)
        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(37, 99, 235)
        pdf.text('Detailed Project Breakdown', margin, yPosition)
        yPosition += 10

        report.projects.forEach((project, idx) => {
          checkPageBreak(55)

          pdf.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255)
          pdf.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'F')

          pdf.setDrawColor(37, 99, 235)
          pdf.setLineWidth(0.5)
          pdf.line(margin, yPosition, margin, yPosition + 50)

          pdf.setFontSize(12)
          pdf.setFont('helvetica', 'bold')
          pdf.setTextColor(0, 0, 0)
          pdf.text(project.name, margin + 5, yPosition + 7)

          pdf.setFontSize(8)
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(100, 100, 100)
          pdf.text(project.location, margin + 5, yPosition + 12)

          const riskColor = project.risk_level === 'High' ? '#ef4444' : project.risk_level === 'Medium' ? '#f59e0b' : '#22c55e'
          const riskBg = hexToRgb(riskColor)
          pdf.setFillColor(riskBg.r, riskBg.g, riskBg.b)
          pdf.roundedRect(pageWidth - margin - 25, yPosition + 4, 20, 6, 2, 2, 'F')
          pdf.setTextColor(255, 255, 255)
          pdf.setFontSize(7)
          pdf.setFont('helvetica', 'bold')
          const riskTextWidth = pdf.getTextWidth(project.risk_level)
          pdf.text(project.risk_level, pageWidth - margin - 15 - riskTextWidth / 2, yPosition + 8.5)

          pdf.setTextColor(0, 0, 0)
          pdf.setFontSize(9)
          pdf.setFont('helvetica', 'normal')

          const projectData = [
            ['Budget:', '€' + (project.budget / 1000000).toFixed(1) + 'M', 'Revenue:', '€' + (project.revenue / 1000000).toFixed(1) + 'M'],
            ['Expenses:', '€' + (project.expenses / 1000000).toFixed(1) + 'M', 'Profit:', '€' + (project.profit / 1000000).toFixed(1) + 'M'],
            ['Units:', `${project.units_sold}/${project.total_units}`, 'Sales Rate:', `${project.sales_rate.toFixed(1)}%`],
            ['Phases:', `${project.phases_done}/${project.total_phases}`, 'Contracts:', project.contracts.toString()]
          ]

          projectData.forEach((row, index) => {
            const y = yPosition + 20 + (index * 6)
            pdf.setFont('helvetica', 'bold')
            pdf.text(row[0], margin + 5, y)
            pdf.setFont('helvetica', 'normal')
            pdf.text(row[1], margin + 25, y)
            pdf.setFont('helvetica', 'bold')
            pdf.text(row[2], margin + 65, y)
            pdf.setFont('helvetica', 'normal')
            pdf.text(row[3], margin + 85, y)
          })

          const profitMarginPercent = project.profit_margin
          drawProgressBar(pdf, margin + 5, yPosition + 44, pageWidth - 2 * margin - 10, 4, profitMarginPercent, {
            color: profitMarginPercent > 20 ? '#22c55e' : profitMarginPercent > 10 ? '#f59e0b' : '#ef4444',
            showPercentage: false
          })

          yPosition += 55
        })
      }

      if (report.risks.length > 0) {
        pdf.addPage()
        yPosition = margin

        pdf.setFillColor(220, 38, 38)
        pdf.rect(0, 0, pageWidth, 45, 'F')

        pdf.setFillColor(127, 29, 29)
        pdf.rect(0, 0, 8, 45, 'F')

        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(20)
        pdf.setFont('helvetica', 'bold')
        pdf.text('RISK ASSESSMENT', margin, 25)

        pdf.setTextColor(0, 0, 0)
        yPosition = 55

        report.risks.forEach((risk, index) => {
          checkPageBreak(25)

          pdf.setFillColor(254, 226, 226)
          pdf.rect(margin, yPosition, pageWidth - 2 * margin, 20, 'F')

          pdf.setDrawColor(220, 38, 38)
          pdf.setLineWidth(1)
          pdf.line(margin, yPosition, margin, yPosition + 20)

          pdf.setFontSize(11)
          pdf.setFont('helvetica', 'bold')
          pdf.setTextColor(220, 38, 38)
          pdf.text(risk.type, margin + 5, yPosition + 8)

          pdf.setFontSize(9)
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(0, 0, 0)
          pdf.text(risk.description, margin + 5, yPosition + 15)

          yPosition += 25
        })
        yPosition += 5
      }

      checkPageBreak(100)
      pdf.addPage()
      yPosition = margin

      pdf.setFillColor(22, 163, 74)
      pdf.rect(0, 0, pageWidth, 45, 'F')

      pdf.setFillColor(21, 128, 61)
      pdf.rect(0, 0, 8, 45, 'F')

      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(20)
      pdf.setFont('helvetica', 'bold')
      pdf.text('INSIGHTS & RECOMMENDATIONS', margin, 25)

      pdf.setTextColor(0, 0, 0)
      yPosition = 55

      pdf.setFillColor(220, 252, 231)
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 12, 'F')

      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(22, 163, 74)
      pdf.text('Top Performing Projects', margin + 5, yPosition + 8)
      yPosition += 15

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0, 0, 0)

      report.insights.top_projects.forEach((project, index) => {
        pdf.setFont('helvetica', 'bold')
        pdf.text(`${index + 1}. ${project.name}`, margin + 5, yPosition)
        pdf.setFont('helvetica', 'normal')
        pdf.text(`Revenue: €${(project.revenue / 1000000).toFixed(1)}M | Sales Rate: ${project.sales_rate.toFixed(1)}%`, margin + 10, yPosition + 5)
        yPosition += 10
      })

      yPosition += 5

      pdf.setFillColor(220, 252, 231)
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 12, 'F')

      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(22, 163, 74)
      pdf.text('Strategic Recommendations', margin + 5, yPosition + 8)
      yPosition += 15

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0, 0, 0)

      report.insights.recommendations.forEach((rec, index) => {
        pdf.setFillColor(240, 253, 244)
        pdf.rect(margin + 2, yPosition - 3, 3, 3, 'F')
        pdf.text(rec, margin + 8, yPosition)
        yPosition += 7
      })

      const totalPages = pdf.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i)

        pdf.setDrawColor(37, 99, 235)
        pdf.setLineWidth(0.5)
        pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15)

        pdf.setFontSize(8)
        pdf.setTextColor(100, 100, 100)
        pdf.setFont('helvetica', 'normal')
        pdf.text('LANDMARK GROUP', margin, pageHeight - 10)
        pdf.text('Confidential Executive Report', margin, pageHeight - 6)

        pdf.setFont('helvetica', 'bold')
        const pageText = `Page ${i} of ${totalPages}`
        const pageTextWidth = pdf.getTextWidth(pageText)
        pdf.text(pageText, pageWidth - margin - pageTextWidth, pageHeight - 10)
        pdf.setFont('helvetica', 'normal')
        const dateText = format(new Date(), 'yyyy-MM-dd')
        const dateTextWidth = pdf.getTextWidth(dateText)
        pdf.text(dateText, pageWidth - margin - dateTextWidth, pageHeight - 6)
      }

      pdf.save(`LANDMARK_Executive_Report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setGeneratingPDF(false)
    }
  }

  if (loading) {
    return (
      <LoadingSpinner size="lg" message="Generating comprehensive report..." className="min-h-screen" />
    )
  }

  if (!report) {
    return <EmptyState icon={FileText} title="No data available for report generation" />
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">LANDMARK GROUP</h1>
            <p className="text-xl font-light mb-1">Comprehensive Executive Report</p>
            <p className="text-sm opacity-90">Generated: {format(new Date(), 'MMMM dd, yyyy HH:mm')}</p>
          </div>
          <Button
            icon={Download}
            onClick={generatePDF}
            loading={generatingPDF}
            className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg font-semibold"
          >
            Export PDF
          </Button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <FileText className="w-6 h-6 text-blue-600 mr-2" />
          <h2 className="text-2xl font-bold text-blue-900">EXECUTIVE SUMMARY</h2>
        </div>
        <div className="space-y-2 text-gray-800">
          <p>• Portfolio: {report.executive_summary.total_projects} projects ({report.executive_summary.active_projects} active, {report.executive_summary.completed_projects} completed)</p>
          <p>• Financial: €{(report.executive_summary.total_revenue / 1000000).toFixed(1)}M revenue, €{(report.executive_summary.total_expenses / 1000000).toFixed(1)}M expenses, €{(report.executive_summary.total_profit / 1000000).toFixed(1)}M profit ({report.executive_summary.profit_margin.toFixed(1)}% margin)</p>
          <p>• Capital Structure: €{(report.funding_structure.total_equity / 1000000).toFixed(1)}M equity, €{(report.funding_structure.total_debt / 1000000).toFixed(1)}M debt, {report.funding_structure.debt_equity_ratio.toFixed(2)} D/E ratio</p>
          <p>• Sales: {report.sales_performance.units_sold}/{report.sales_performance.total_units} units sold ({report.kpis.sales_rate.toFixed(1)}%), {report.sales_performance.total_sales} transactions</p>
          <p>• Construction: {report.construction_status.total_contracts} contracts, {report.construction_status.total_subcontractors} subcontractors, {report.construction_status.work_logs_7days} work logs recorded</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-blue-900 mb-6">KEY PERFORMANCE INDICATORS</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl text-center border border-blue-200">
            <p className="text-3xl font-bold text-blue-600">€{(report.kpis.portfolio_value / 1000000).toFixed(1)}M</p>
            <p className="text-sm text-gray-600 mt-2">Portfolio Value</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl text-center border border-green-200">
            <p className="text-3xl font-bold text-green-600">€{(report.kpis.total_revenue / 1000000).toFixed(1)}M</p>
            <p className="text-sm text-gray-600 mt-2">Total Revenue</p>
          </div>
          <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-6 rounded-xl text-center border border-teal-200">
            <p className="text-3xl font-bold text-teal-600">€{(report.kpis.net_profit / 1000000).toFixed(1)}M</p>
            <p className="text-sm text-gray-600 mt-2">Net Profit</p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl text-center border border-orange-200">
            <p className="text-3xl font-bold text-orange-600">{report.kpis.roi.toFixed(1)}%</p>
            <p className="text-sm text-gray-600 mt-2">ROI</p>
          </div>
          <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-6 rounded-xl text-center border border-teal-200">
            <p className="text-3xl font-bold text-teal-600">{report.kpis.sales_rate.toFixed(1)}%</p>
            <p className="text-sm text-gray-600 mt-2">Sales Rate</p>
          </div>
          <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-6 rounded-xl text-center border border-pink-200">
            <p className="text-3xl font-bold text-pink-600">{report.kpis.debt_equity_ratio.toFixed(2)}</p>
            <p className="text-sm text-gray-600 mt-2">D/E Ratio</p>
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-xl text-center border border-slate-200">
            <p className="text-3xl font-bold text-slate-600">{report.kpis.active_projects}</p>
            <p className="text-sm text-gray-600 mt-2">Active Projects</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-xl text-center border border-yellow-200">
            <p className="text-3xl font-bold text-yellow-600">{report.kpis.total_customers}</p>
            <p className="text-sm text-gray-600 mt-2">Total Customers</p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-6">
        <div className="flex items-center mb-4">
          <Home className="w-6 h-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-bold text-green-900">SALES PERFORMANCE</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <p className="font-bold text-gray-700">Total Units:</p>
            <p className="text-xl font-bold text-gray-900">{report.sales_performance.total_units}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Units Sold:</p>
            <p className="text-xl font-bold text-gray-900">{report.sales_performance.units_sold} ({((report.sales_performance.units_sold / report.sales_performance.total_units) * 100).toFixed(1)}%)</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Available:</p>
            <p className="text-xl font-bold text-gray-900">{report.sales_performance.available_units}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Reserved:</p>
            <p className="text-xl font-bold text-gray-900">{report.sales_performance.reserved_units}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Total Revenue:</p>
            <p className="text-xl font-bold text-gray-900">€{report.sales_performance.total_revenue.toLocaleString()}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Avg Sale Price:</p>
            <p className="text-xl font-bold text-gray-900">€{report.sales_performance.avg_sale_price.toLocaleString()}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Total Sales:</p>
            <p className="text-xl font-bold text-gray-900">{report.sales_performance.total_sales}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Buyers:</p>
            <p className="text-xl font-bold text-gray-900">{report.sales_performance.buyers}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Active Leads:</p>
            <p className="text-xl font-bold text-gray-900">{report.sales_performance.active_leads}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Conversion Rate:</p>
            <p className="text-xl font-bold text-gray-900">{report.sales_performance.conversion_rate.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl shadow-sm border border-teal-200 p-6">
          <div className="flex items-center mb-4">
            <Wallet className="w-6 h-6 text-teal-600 mr-2" />
            <h2 className="text-xl font-bold text-teal-900">FUNDING & FINANCIAL STRUCTURE</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Equity Invested:</span>
              <span className="font-bold text-gray-900">€{report.funding_structure.total_equity.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Debt:</span>
              <span className="font-bold text-gray-900">€{report.funding_structure.total_debt.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Debt-to-Equity Ratio:</span>
              <span className="font-bold text-gray-900">{report.funding_structure.debt_equity_ratio.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Credit Lines:</span>
              <span className="font-bold text-gray-900">€{report.funding_structure.total_credit_lines.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Available Credit:</span>
              <span className="font-bold text-gray-900">€{report.funding_structure.available_credit.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Active Investors:</span>
              <span className="font-bold text-gray-900">{report.funding_structure.active_investors}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Active Banks:</span>
              <span className="font-bold text-gray-900">{report.funding_structure.active_banks}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Bank Credits:</span>
              <span className="font-bold text-gray-900">{report.funding_structure.bank_credits}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Avg Interest Rate:</span>
              <span className="font-bold text-gray-900">{report.funding_structure.avg_interest_rate.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Monthly Debt Service:</span>
              <span className="font-bold text-gray-900">€{report.funding_structure.monthly_debt_service.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-sm border border-orange-200 p-6">
          <div className="flex items-center mb-4">
            <Activity className="w-6 h-6 text-orange-600 mr-2" />
            <h2 className="text-xl font-bold text-orange-900">CONSTRUCTION & SUPERVISION STATUS</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Contracts:</span>
              <span className="font-bold text-gray-900">{report.construction_status.total_contracts}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Active Contracts:</span>
              <span className="font-bold text-gray-900">{report.construction_status.active_contracts}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Completed Contracts:</span>
              <span className="font-bold text-gray-900">{report.construction_status.completed_contracts}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Contract Value:</span>
              <span className="font-bold text-gray-900">€{report.construction_status.contract_value.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Budget Realized:</span>
              <span className="font-bold text-gray-900">€{report.construction_status.budget_realized.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Budget Utilization:</span>
              <span className="font-bold text-gray-900">{report.construction_status.budget_utilization.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Subcontractors:</span>
              <span className="font-bold text-gray-900">{report.construction_status.total_subcontractors}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Phases:</span>
              <span className="font-bold text-gray-900">{report.construction_status.total_phases}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Completed Phases:</span>
              <span className="font-bold text-gray-900">{report.construction_status.completed_phases}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Work Logs (7 days):</span>
              <span className="font-bold text-gray-900">{report.construction_status.work_logs_7days}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Milestones:</span>
              <span className="font-bold text-gray-900">{report.construction_status.total_milestones}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Completed Milestones:</span>
              <span className="font-bold text-gray-900">{report.construction_status.completed_milestones}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl shadow-sm border border-cyan-200 p-6">
        <div className="flex items-center mb-4">
          <FileText className="w-6 h-6 text-cyan-600 mr-2" />
          <h2 className="text-2xl font-bold text-cyan-900">ACCOUNTING OVERVIEW</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="font-bold text-gray-700">Total Invoices:</p>
            <p className="text-xl font-bold text-gray-900">{report.accounting_overview.total_invoices}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Total Invoice Value:</p>
            <p className="text-xl font-bold text-gray-900">€{(report.accounting_overview.total_invoice_value / 1000000).toFixed(2)}M</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Paid Invoices:</p>
            <p className="text-xl font-bold text-green-600">{report.accounting_overview.paid_invoices} (€{(report.accounting_overview.paid_value / 1000000).toFixed(2)}M)</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Pending Invoices:</p>
            <p className="text-xl font-bold text-yellow-600">{report.accounting_overview.pending_invoices} (€{(report.accounting_overview.pending_value / 1000000).toFixed(2)}M)</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Overdue Invoices:</p>
            <p className="text-xl font-bold text-red-600">{report.accounting_overview.overdue_invoices} (€{(report.accounting_overview.overdue_value / 1000000).toFixed(2)}M)</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Payment Completion Rate:</p>
            <p className="text-xl font-bold text-gray-900">{report.accounting_overview.payment_completion_rate.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl shadow-sm border border-amber-200 p-6">
          <div className="flex items-center mb-4">
            <Building2 className="w-6 h-6 text-amber-600 mr-2" />
            <h2 className="text-xl font-bold text-amber-900">OFFICE EXPENSES</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Office Suppliers:</span>
              <span className="font-bold text-gray-900">{report.office_expenses.total_office_suppliers}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Office Invoices:</span>
              <span className="font-bold text-gray-900">{report.office_expenses.total_office_invoices}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Office Spent:</span>
              <span className="font-bold text-gray-900">€{report.office_expenses.total_office_spent.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Avg Office Invoice:</span>
              <span className="font-bold text-gray-900">€{report.office_expenses.avg_office_invoice.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl shadow-sm border border-rose-200 p-6">
          <div className="flex items-center mb-4">
            <CreditCard className="w-6 h-6 text-rose-600 mr-2" />
            <h2 className="text-xl font-bold text-rose-900">COMPANY CREDITS</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Credits:</span>
              <span className="font-bold text-gray-900">{report.company_credits.total_credits}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Credit Value:</span>
              <span className="font-bold text-gray-900">€{report.company_credits.total_credit_value.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Credits Available:</span>
              <span className="font-bold text-green-600">€{report.company_credits.credits_available.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Credits Used:</span>
              <span className="font-bold text-gray-900">€{report.company_credits.credits_used.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Cesija Payments:</span>
              <span className="font-bold text-gray-900">{report.company_credits.cesija_payments}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Cesija Value:</span>
              <span className="font-bold text-gray-900">€{report.company_credits.cesija_value.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Credit Allocations:</span>
              <span className="font-bold text-gray-900">{report.company_credits.total_allocations}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Allocated Amount:</span>
              <span className="font-bold text-gray-900">€{report.company_credits.allocated_amount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center mb-4">
            <Wallet className="w-6 h-6 text-slate-600 mr-2" />
            <h2 className="text-xl font-bold text-slate-900">BANK ACCOUNTS</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Bank Accounts:</span>
              <span className="font-bold text-gray-900">{report.bank_accounts.total_accounts}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Balance:</span>
              <span className={`font-bold ${report.bank_accounts.total_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                €{report.bank_accounts.total_balance.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Positive Balance Accounts:</span>
              <span className="font-bold text-green-600">{report.bank_accounts.positive_balance_accounts}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Negative Balance Accounts:</span>
              <span className="font-bold text-red-600">{report.bank_accounts.negative_balance_accounts}</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl shadow-sm border border-teal-200 p-6">
          <div className="flex items-center mb-4">
            <Building2 className="w-6 h-6 text-teal-600 mr-2" />
            <h2 className="text-xl font-bold text-teal-900">BUILDINGS & UNITS</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Buildings:</span>
              <span className="font-bold text-gray-900">{report.buildings_units.total_buildings}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Total Units:</span>
              <span className="font-bold text-gray-900">{report.buildings_units.total_units}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Sold Units:</span>
              <span className="font-bold text-green-600">{report.buildings_units.sold_units}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Reserved Units:</span>
              <span className="font-bold text-yellow-600">{report.buildings_units.reserved_units}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Available Units:</span>
              <span className="font-bold text-gray-900">{report.buildings_units.available_units}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Garages:</span>
              <span className="font-bold text-gray-900">{report.buildings_units.total_garages}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-gray-700">Repositories:</span>
              <span className="font-bold text-gray-900">{report.buildings_units.total_repositories}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-6">
        <div className="flex items-center mb-4">
          <Home className="w-6 h-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-bold text-green-900">RETAIL PORTFOLIO</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <p className="font-bold text-gray-700">Retail Projects:</p>
            <p className="text-xl font-bold text-gray-900">{report.retail_portfolio.total_retail_projects}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Active Projects:</p>
            <p className="text-xl font-bold text-gray-900">{report.retail_portfolio.active_retail_projects}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Land Plots:</p>
            <p className="text-xl font-bold text-gray-900">{report.retail_portfolio.total_land_plots}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Retail Contracts:</p>
            <p className="text-xl font-bold text-gray-900">{report.retail_portfolio.total_retail_contracts}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Contract Value:</p>
            <p className="text-xl font-bold text-gray-900">€{report.retail_portfolio.retail_contract_value.toLocaleString()}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Budget Realized:</p>
            <p className="text-xl font-bold text-gray-900">€{report.retail_portfolio.retail_budget_realized.toLocaleString()}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Retail Phases:</p>
            <p className="text-xl font-bold text-gray-900">{report.retail_portfolio.retail_phases}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Completed Phases:</p>
            <p className="text-xl font-bold text-gray-900">{report.retail_portfolio.completed_retail_phases}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Retail Customers:</p>
            <p className="text-xl font-bold text-gray-900">{report.retail_portfolio.total_retail_customers}</p>
          </div>
          <div>
            <p className="font-bold text-gray-700">Retail Suppliers:</p>
            <p className="text-xl font-bold text-gray-900">{report.retail_portfolio.retail_suppliers}</p>
          </div>
        </div>
      </div>

      {report.contract_types.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <FileText className="w-6 h-6 text-gray-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900">CONTRACT TYPES</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {report.contract_types.map((ct, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="font-bold text-gray-700 text-sm">{ct.name}</p>
                <p className="text-2xl font-bold text-gray-900">{ct.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <BarChart3 className="w-6 h-6 text-blue-600 mr-2" />
          <h2 className="text-2xl font-bold text-gray-900">CASH FLOW ANALYSIS</h2>
        </div>
        <Table>
          <Table.Head>
            <Table.Tr>
              <Table.Th>Month</Table.Th>
              <Table.Th>Inflow</Table.Th>
              <Table.Th>Outflow</Table.Th>
              <Table.Th>Net Cash Flow</Table.Th>
            </Table.Tr>
          </Table.Head>
          <Table.Body>
            {report.cash_flow.map((month, index) => (
              <Table.Tr key={index}>
                <Table.Td className="font-medium text-gray-900">{month.month}</Table.Td>
                <Table.Td>€{(month.inflow / 1000).toFixed(0)}K</Table.Td>
                <Table.Td>€{(month.outflow / 1000).toFixed(0)}K</Table.Td>
                <Table.Td className={`font-bold ${month.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  €{(month.net / 1000).toFixed(0)}K
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Body>
        </Table>
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="font-bold text-gray-900">6-Month Totals:</p>
          <p className="text-sm text-gray-700">
            Inflow: €{(report.cash_flow.reduce((sum, m) => sum + m.inflow, 0) / 1000000).toFixed(2)}M |
            Outflow: €{(report.cash_flow.reduce((sum, m) => sum + m.outflow, 0) / 1000000).toFixed(2)}M |
            Net: €{(report.cash_flow.reduce((sum, m) => sum + m.net, 0) / 1000000).toFixed(2)}M
          </p>
        </div>
      </div>

      {report.projects.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">PROJECT-BY-PROJECT BREAKDOWN</h2>
          <div className="space-y-4">
            {report.projects.map((project) => (
              <div key={project.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{project.name}</h3>
                    <p className="text-sm text-gray-600">{project.location}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={
                      project.risk_level === 'High' ? 'red'
                        : project.risk_level === 'Medium' ? 'yellow'
                        : 'green'
                    }>
                      Risk: {project.risk_level}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Status</p>
                    <p className="font-bold text-gray-900">{project.status}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Budget</p>
                    <p className="font-bold text-gray-900">€{project.budget.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Revenue</p>
                    <p className="font-bold text-green-600">€{project.revenue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Expenses</p>
                    <p className="font-bold text-red-600">€{project.expenses.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Units</p>
                    <p className="font-bold text-gray-900">{project.units_sold}/{project.total_units} sold ({project.sales_rate.toFixed(1)}%)</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Contracts</p>
                    <p className="font-bold text-gray-900">{project.contracts}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Phases</p>
                    <p className="font-bold text-gray-900">{project.phases_done}/{project.total_phases} done</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Funding</p>
                    <p className="font-bold text-gray-900">€{project.equity.toLocaleString()} equity, €{project.debt.toLocaleString()} debt</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.risks.length > 0 && (
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-sm border border-red-200 p-6">
          <div className="flex items-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600 mr-2" />
            <h2 className="text-2xl font-bold text-red-900">RISK ASSESSMENT</h2>
          </div>
          <ul className="space-y-2">
            {report.risks.map((risk, index) => (
              <li key={index} className="flex items-start">
                <span className="text-red-600 mr-2">•</span>
                <span className="text-gray-800"><strong>{risk.type}:</strong> {risk.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-6">
        <div className="flex items-center mb-4">
          <Target className="w-6 h-6 text-green-600 mr-2" />
          <h2 className="text-2xl font-bold text-green-900">EXECUTIVE INSIGHTS & RECOMMENDATIONS</h2>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">TOP PERFORMING PROJECTS:</h3>
          <ul className="space-y-2">
            {report.insights.top_projects.map((project, index) => (
              <li key={index} className="flex items-start">
                <span className="text-green-600 mr-2">-</span>
                <span className="text-gray-800">{project.name}: €{(project.revenue / 1000000).toFixed(1)}M revenue, {project.sales_rate.toFixed(1)}% sales rate</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-3">STRATEGIC RECOMMENDATIONS:</h3>
          <ul className="space-y-2">
            {report.insights.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start">
                <span className="text-green-600 mr-2">•</span>
                <span className="text-gray-800">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default GeneralReports
