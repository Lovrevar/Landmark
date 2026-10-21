import { supabase } from '../../../lib/supabase'
import { fetchLinkedPrices } from '../../../lib/linkedUnitPrices'
import { fetchAllRows } from '../../../lib/fetchAllRows'
import type { Project } from '../../../lib/supabase'
import { format, startOfMonth, eachMonthOfInterval } from 'date-fns'
import type { ProjectSalesReport, CustomerReport, SalesData } from '../types'
import { fetchBudgetedProjectIds } from '../../Supervision/SiteManagement/services/siteService'
import { contractedSales, customerFunnel, salesByMonth, salesRate, unitStatusCounts } from '../../../utils/salesFigures'
import { parseLocalDate } from '../../../utils/dateOnly'

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('name')

  if (error) throw error
  return data || []
}

export async function generateProjectReport(
  selectedProject: string,
  projects: Project[],
  dateRange: { start: string; end: string }
): Promise<ProjectSalesReport> {
  const project = projects.find(p => p.id === selectedProject)
  if (!project) throw new Error('Project not found')

  // Fetch bank credits directly assigned to this project
  const { data: creditsData, error: creditsError } = await supabase
    .from('bank_credits')
    .select('*, banks(name)')
    .eq('project_id', selectedProject)

  if (creditsError) throw creditsError

  // Fetch credit allocations for this project (new funding model)
  const { data: allocationsData, error: allocationsError } = await supabase
    .from('credit_allocations')
    .select('*, bank_credits(banks(name))')
    .eq('project_id', selectedProject)

  if (allocationsError) throw allocationsError

  const bankNamesFromCredits = (creditsData || [])
    .map(credit => credit.banks?.name)
    .filter(Boolean) as string[]

  const bankNamesFromAllocations = (allocationsData || [])
    .map(alloc => (alloc.bank_credits as { banks?: { name?: string } | null } | null)?.banks?.name)
    .filter(Boolean) as string[]

  const fundingSources = [...new Set([...bankNamesFromCredits, ...bankNamesFromAllocations])].join(', ') || 'N/A'

  const projectWithFunding = { ...project, investor: fundingSources }

  const { data: apartmentsData, error: apartmentsError } = await supabase
    .from('apartments')
    .select('*')
    .eq('project_id', selectedProject)

  if (apartmentsError) throw apartmentsError

  const apartments = apartmentsData || []

  // Throws on a failed read, rather than leaving the garages and storage out (GEN-42).
  const linked = await fetchLinkedPrices()
  const listPrices = new Map(apartments.map(apt => [apt.id as string, apt.price as number | null]))
  const saleOptions = { linked, listPrice: (id: string) => listPrices.get(id) }

  const { data: salesData, error: salesError } = await supabase
    .from('sales')
    .select('*, apartments!inner(project_id)')
    .eq('apartments.project_id', selectedProject)
    .gte('sale_date', dateRange.start)
    .lte('sale_date', dateRange.end)

  if (salesError) throw salesError

  const sales = salesData || []

  // Contracted sales dated in the range, each at its package value (GEN-38).
  const { value: total_revenue, average: average_price } = contractedSales(sales, saleOptions)

  const {
    total: total_units,
    sold: sold_units,
    available: available_units,
    reserved: reserved_units,
  } = unitStatusCounts(apartments)

  const sales_rate = salesRate(sold_units, total_units)

  // Local dates on both sides: `new Date('2026-05-01')` is UTC, and west of UTC it read as
  // 30 April, which added a month and moved the first day's sales (GEN-34).
  const months = eachMonthOfInterval({ start: parseLocalDate(dateRange.start), end: parseLocalDate(dateRange.end) })
  const salesPerMonth = salesByMonth(sales)

  const monthly_sales: SalesData[] = months.map(month => {
    const monthSales = contractedSales(salesPerMonth.get(format(month, 'yyyy-MM')) ?? [], saleOptions)

    return {
      // A machine key, not a label — both readers format it themselves. See `SalesData` in ../types.
      month_key: format(startOfMonth(month), 'yyyy-MM-dd'),
      sales: monthSales.count,
      revenue: monthSales.value,
      units_sold: monthSales.count
    }
  })

  // Only a TIC sets a budget; without one the report says so instead of printing €0 (GEN-5).
  const budget_set = (await fetchBudgetedProjectIds()).has(selectedProject)

  return {
    project: projectWithFunding,
    budget_set,
    total_units,
    sold_units,
    available_units,
    reserved_units,
    total_revenue,
    average_price,
    sales_rate,
    monthly_sales,
    apartments,
    sales
  }
}

export async function generateCustomerReport(
  dateRange: { start: string; end: string }
): Promise<CustomerReport> {
  const { data: customersData, error: customersError } = await supabase
    .from('customers')
    .select('*')

  if (customersError) throw customersError

  const { data: salesData, error: salesError } = await supabase
    .from('sales')
    .select('*')
    .gte('sale_date', dateRange.start)
    .lte('sale_date', dateRange.end)

  if (salesError) throw salesError

  const customers = customersData || []
  const sales = salesData || []

  // Each sale at its package value: the linked garages and storage, and the list price for a 0
  // sale price (GEN-38).
  const [linked, apartments] = await Promise.all([
    fetchLinkedPrices(),
    fetchAllRows<{ id: string; price: number | null }>((from, to) =>
      supabase.from('apartments').select('id, price').order('id').range(from, to)),
  ])
  const listPrices = new Map(apartments.map(apt => [apt.id, apt.price]))

  const { total: total_customers, buyers, interested, leads } = customerFunnel(customers)
  const { value: total_revenue, average: average_purchase } = contractedSales(sales, { linked, listPrice: id => listPrices.get(id) })

  return {
    total_customers,
    buyers,
    interested,
    leads,
    total_revenue,
    average_purchase,
    customers
  }
}
