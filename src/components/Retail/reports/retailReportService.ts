import { supabase } from '../../../lib/supabase'
import type {
  RetailReportData,
  ProjectReportData,
  PhaseReportData,
  CustomerReportData,
  SupplierReportData,
  SupplierTypeSummary,
  InvoiceSummary
} from './retailReportTypes'

const emptyPhase = (): PhaseReportData => ({
  budget_allocated: 0,
  contract_cost: 0,
  budget_realized: 0,
  unpaid: 0,
  contracts_count: 0
})

const num = (val: unknown): number => parseFloat(String(val || 0)) || 0

export async function fetchRetailReportData(): Promise<RetailReportData> {
  const [
    { data: projects },
    { data: phases },
    { data: contracts },
    { data: plots },
    { data: customers },
    { data: suppliers },
    { data: invoices }
  ] = await Promise.all([
    supabase.from('retail_projects').select('*').order('name'),
    supabase.from('retail_project_phases').select('*'),
    supabase.from('retail_contracts').select(`
      *,
      supplier:retail_suppliers(id, name, supplier_type:retail_supplier_types(id, name)),
      customer:retail_customers(id, name)
    `),
    supabase.from('retail_land_plots').select('id, purchased_area_m2, total_price, payment_status'),
    supabase.from('retail_customers').select('id, name'),
    supabase.from('retail_suppliers').select('id, name, supplier_type:retail_supplier_types(id, name)'),
    supabase.from('accounting_invoices')
      .select('id, status, total_amount, paid_amount, remaining_amount, due_date, retail_contract_id, retail_customer_id')
      .or('retail_contract_id.not.is.null,retail_customer_id.not.is.null')
  ])

  const allProjects = projects || []
  const allPhases = phases || []
  const allContracts = contracts || []
  const allPlots = plots || []
  const allCustomers = customers || []
  const allSuppliers = suppliers || []
  const allInvoices = invoices || []

  const phasesByProject = new Map<string, typeof allPhases>()
  allPhases.forEach(p => {
    const list = phasesByProject.get(p.project_id) || []
    list.push(p)
    phasesByProject.set(p.project_id, list)
  })

  const contractsByPhase = new Map<string, typeof allContracts>()
  allContracts.forEach(c => {
    const list = contractsByPhase.get(c.phase_id) || []
    list.push(c)
    contractsByPhase.set(c.phase_id, list)
  })

  const invoicesByContract = new Map<string, typeof allInvoices>()
  allInvoices.forEach(inv => {
    if (inv.retail_contract_id) {
      const list = invoicesByContract.get(inv.retail_contract_id) || []
      list.push(inv)
      invoicesByContract.set(inv.retail_contract_id, list)
    }
  })

  const projectReports = buildProjectReports(
    allProjects, phasesByProject, contractsByPhase, invoicesByContract
  )

  const customerReports = buildCustomerReports(allContracts, allPhases, invoicesByContract)
  const supplierReports = buildSupplierReports(allContracts, invoicesByContract)
  const supplierTypes = buildSupplierTypeSummary(supplierReports)
  const invoiceSummary = buildInvoiceSummary(allInvoices)

  const totalLandInvestment = allPlots.reduce((s, p) => s + num(p.total_price), 0)
  const totalLandArea = allPlots.reduce((s, p) => s + num(p.purchased_area_m2), 0)
  const totalDevCost = projectReports.reduce((s, p) => s + p.development.budget_realized, 0)
  const totalConstCost = projectReports.reduce((s, p) => s + p.construction.budget_realized, 0)
  const totalSalesRevenue = projectReports.reduce((s, p) => s + p.sales.contract_cost, 0)
  const totalCollected = projectReports.reduce((s, p) => s + p.total_collected, 0)
  const totalOutstanding = projectReports.reduce((s, p) => s + p.total_outstanding, 0)
  const totalCosts = totalLandInvestment + totalDevCost + totalConstCost
  const profit = totalCollected - totalCosts
  const salesArea = allContracts
    .filter(c => c.customer_id)
    .reduce((s, c) => s + num(c.total_surface_m2 || c.land_area_m2), 0)

  return {
    portfolio: {
      total_projects: allProjects.length,
      active_projects: allProjects.filter(p => p.status === 'In Progress').length,
      completed_projects: allProjects.filter(p => p.status === 'Completed').length,
      total_land_area: totalLandArea,
      total_land_investment: totalLandInvestment,
      total_land_plots: allPlots.length,
      total_development_cost: totalDevCost,
      total_construction_cost: totalConstCost,
      total_sales_revenue: totalSalesRevenue,
      total_collected: totalCollected,
      total_outstanding: totalOutstanding,
      total_costs: totalCosts,
      profit,
      roi: totalCosts > 0 ? (profit / totalCosts) * 100 : 0,
      total_customers: allCustomers.length,
      total_suppliers: allSuppliers.length,
      avg_price_per_m2: salesArea > 0 ? totalSalesRevenue / salesArea : 0
    },
    projects: projectReports,
    customers: customerReports,
    suppliers: supplierReports,
    supplier_types: supplierTypes,
    invoices: invoiceSummary
  }
}

function buildProjectReports(
  projects: any[],
  phasesByProject: Map<string, any[]>,
  contractsByPhase: Map<string, any[]>,
  invoicesByContract: Map<string, any[]>
): ProjectReportData[] {
  return projects.map(project => {
    const phases = phasesByProject.get(project.id) || []
    const dev = emptyPhase()
    const constr = emptyPhase()
    const sales = emptyPhase()

    phases.forEach(phase => {
      const phaseContracts = contractsByPhase.get(phase.id) || []
      const target = phase.phase_type === 'development' ? dev
        : phase.phase_type === 'construction' ? constr
        : sales

      target.budget_allocated += num(phase.budget_allocated)
      target.contracts_count += phaseContracts.length
      phaseContracts.forEach(c => {
        target.contract_cost += num(c.contract_amount)
        target.budget_realized += num(c.budget_realized)
        const contractInvoices = invoicesByContract.get(c.id) || []
        target.unpaid += contractInvoices
          .filter((inv: any) => inv.status !== 'PAID')
          .reduce((s: number, inv: any) => s + num(inv.remaining_amount), 0)
      })
    })

    const landCost = num(project.purchase_price)
    const totalCosts = landCost + dev.budget_realized + constr.budget_realized
    const totalCollected = sales.budget_realized
    const totalOutstanding = sales.unpaid
    const profit = totalCollected - totalCosts

    return {
      id: project.id,
      name: project.name,
      location: project.location,
      status: project.status,
      total_area_m2: num(project.total_area_m2),
      land_cost: landCost,
      development: dev,
      construction: constr,
      sales,
      total_costs: totalCosts,
      total_revenue: sales.contract_cost,
      total_collected: totalCollected,
      total_outstanding: totalOutstanding,
      profit,
      roi: totalCosts > 0 ? (profit / totalCosts) * 100 : 0
    }
  })
}

function buildCustomerReports(
  contracts: any[],
  phases: any[],
  invoicesByContract: Map<string, any[]>
): CustomerReportData[] {
  const salesPhaseIds = new Set(
    phases.filter(p => p.phase_type === 'sales').map(p => p.id)
  )

  const customerMap = new Map<string, CustomerReportData>()

  contracts
    .filter(c => c.customer_id && salesPhaseIds.has(c.phase_id))
    .forEach(c => {
      const existing = customerMap.get(c.customer_id) || {
        id: c.customer_id,
        name: (c.customer as any)?.name || 'N/A',
        total_contracts: 0,
        total_amount: 0,
        total_paid: 0,
        total_remaining: 0,
        total_area_m2: 0
      }

      existing.total_contracts += 1
      existing.total_amount += num(c.contract_amount)
      existing.total_paid += num(c.budget_realized)
      existing.total_area_m2 += num(c.total_surface_m2 || c.land_area_m2)

      const contractInvoices = invoicesByContract.get(c.id) || []
      existing.total_remaining += contractInvoices
        .filter((inv: any) => inv.status !== 'PAID')
        .reduce((s: number, inv: any) => s + num(inv.remaining_amount), 0)

      customerMap.set(c.customer_id, existing)
    })

  return Array.from(customerMap.values())
    .sort((a, b) => b.total_amount - a.total_amount)
}

function buildSupplierReports(
  contracts: any[],
  invoicesByContract: Map<string, any[]>
): SupplierReportData[] {
  const supplierMap = new Map<string, SupplierReportData>()

  contracts
    .filter(c => c.supplier_id)
    .forEach(c => {
      const existing = supplierMap.get(c.supplier_id) || {
        id: c.supplier_id,
        name: (c.supplier as any)?.name || 'N/A',
        supplier_type: (c.supplier as any)?.supplier_type?.name || 'Other',
        total_contracts: 0,
        total_amount: 0,
        total_paid: 0
      }

      existing.total_contracts += 1
      existing.total_amount += num(c.contract_amount)
      existing.total_paid += num(c.budget_realized)
      supplierMap.set(c.supplier_id, existing)
    })

  return Array.from(supplierMap.values())
    .sort((a, b) => b.total_amount - a.total_amount)
}

function buildSupplierTypeSummary(suppliers: SupplierReportData[]): SupplierTypeSummary[] {
  const typeMap = new Map<string, SupplierTypeSummary>()

  suppliers.forEach(s => {
    const existing = typeMap.get(s.supplier_type) || {
      type: s.supplier_type,
      count: 0,
      total_amount: 0,
      total_paid: 0
    }
    existing.count += s.total_contracts
    existing.total_amount += s.total_amount
    existing.total_paid += s.total_paid
    typeMap.set(s.supplier_type, existing)
  })

  return Array.from(typeMap.values())
    .sort((a, b) => b.total_amount - a.total_amount)
}

function buildInvoiceSummary(invoices: any[]): InvoiceSummary {
  const today = new Date()

  return invoices.reduce((acc, inv) => {
    acc.total += 1
    acc.total_amount += num(inv.total_amount)
    acc.paid_amount += num(inv.paid_amount)
    acc.remaining_amount += num(inv.remaining_amount)

    if (inv.status === 'PAID') {
      acc.paid += 1
    } else if (inv.due_date && new Date(inv.due_date) < today) {
      acc.overdue += 1
      acc.overdue_amount += num(inv.remaining_amount)
    } else {
      acc.pending += 1
    }

    return acc
  }, {
    total: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    total_amount: 0,
    paid_amount: 0,
    remaining_amount: 0,
    overdue_amount: 0
  } as InvoiceSummary)
}
