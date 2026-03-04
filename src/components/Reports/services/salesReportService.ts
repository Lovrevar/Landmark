import { supabase } from '../../../lib/supabase'
import type { Project } from '../../../lib/supabase'
import { format, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns'
import type { ProjectSalesReport, CustomerReport, SalesData } from '../types'

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
    .map(alloc => (alloc.bank_credits as any)?.banks?.name)
    .filter(Boolean) as string[]

  const fundingSources = [...new Set([...bankNamesFromCredits, ...bankNamesFromAllocations])].join(', ') || 'N/A'

  const projectWithFunding = { ...project, investor: fundingSources }

  const { data: apartmentsData, error: apartmentsError } = await supabase
    .from('apartments')
    .select('*')
    .eq('project_id', selectedProject)

  if (apartmentsError) throw apartmentsError

  const apartments = apartmentsData || []
  const apartmentIds = apartments.map(apt => apt.id)

  const { data: aptGaragesData } = await supabase
    .from('apartment_garages')
    .select('apartment_id, garage_id, garages(id, price)')
    .in('apartment_id', apartmentIds.length > 0 ? apartmentIds : [''])

  const { data: aptReposData } = await supabase
    .from('apartment_repositories')
    .select('apartment_id, repository_id, repositories(id, price)')
    .in('apartment_id', apartmentIds.length > 0 ? apartmentIds : [''])

  const aptGaragePriceMap = new Map<string, number>()
  for (const row of (aptGaragesData || [])) {
    const price = (row.garages as any)?.price || 0
    aptGaragePriceMap.set(row.apartment_id, (aptGaragePriceMap.get(row.apartment_id) || 0) + price)
  }

  const aptRepoPriceMap = new Map<string, number>()
  for (const row of (aptReposData || [])) {
    const price = (row.repositories as any)?.price || 0
    aptRepoPriceMap.set(row.apartment_id, (aptRepoPriceMap.get(row.apartment_id) || 0) + price)
  }

  const { data: salesData, error: salesError } = await supabase
    .from('sales')
    .select('*, apartments!inner(project_id)')
    .eq('apartments.project_id', selectedProject)
    .gte('sale_date', dateRange.start)
    .lte('sale_date', dateRange.end)

  if (salesError) throw salesError

  const sales = salesData || []

  const total_revenue = sales.reduce((sum, sale) => {
    const garagePrice = aptGaragePriceMap.get(sale.apartment_id) || 0
    const repoPrice = aptRepoPriceMap.get(sale.apartment_id) || 0
    return sum + sale.sale_price + garagePrice + repoPrice
  }, 0)

  const total_units = apartments.length
  const sold_units = apartments.filter(apt => apt.status === 'Sold').length
  const available_units = apartments.filter(apt => apt.status === 'Available').length
  const reserved_units = apartments.filter(apt => apt.status === 'Reserved').length

  const totalValue = apartments.reduce((sum, apt) => {
    return sum + apt.price + (aptGaragePriceMap.get(apt.id) || 0) + (aptRepoPriceMap.get(apt.id) || 0)
  }, 0)
  const average_price = total_units > 0 ? totalValue / total_units : 0
  const sales_rate = total_units > 0 ? (sold_units / total_units) * 100 : 0

  const startDate = new Date(dateRange.start)
  const endDate = new Date(dateRange.end)
  const months = eachMonthOfInterval({ start: startDate, end: endDate })

  const monthly_sales: SalesData[] = months.map(month => {
    const monthStart = startOfMonth(month)
    const monthEnd = endOfMonth(month)

    const monthSales = sales.filter(sale => {
      const saleDate = new Date(sale.sale_date)
      return saleDate >= monthStart && saleDate <= monthEnd
    })

    const monthRevenue = monthSales.reduce((sum, sale) => {
      const garagePrice = aptGaragePriceMap.get(sale.apartment_id) || 0
      const repoPrice = aptRepoPriceMap.get(sale.apartment_id) || 0
      return sum + sale.sale_price + garagePrice + repoPrice
    }, 0)

    return {
      month: format(month, 'MMM yyyy'),
      sales: monthSales.length,
      revenue: monthRevenue,
      units_sold: monthSales.length
    }
  })

  return {
    project: projectWithFunding,
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

  const total_customers = customers.length
  const buyers = customers.filter(c => c.status === 'buyer').length
  const interested = customers.filter(c => c.status === 'interested').length
  const leads = customers.filter(c => c.status === 'lead').length
  const total_revenue = sales.reduce((sum, sale) => sum + sale.sale_price, 0)
  const average_purchase = sales.length > 0 ? total_revenue / sales.length : 0

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
