import { supabase } from '../../../lib/supabase'
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns'
import type { SalesDashboardStats, ProjectStats, MonthlyTrend, RecentSale } from '../types/salesDashboardTypes'

export async function fetchSalesDashboardData(): Promise<{
  stats: SalesDashboardStats
  projectStats: ProjectStats[]
  monthlyTrends: MonthlyTrend[]
  paymentMethodBreakdown: Record<string, number>
  recentSales: RecentSale[]
}> {
  const [
    apartmentsData,
    salesData,
    customersData,
    projectsData,
    paymentsData
  ] = await Promise.all([
    supabase.from('apartments').select('*'),
    supabase.from('sales').select('*, apartment_id'),
    supabase.from('customers').select('*'),
    supabase.from('projects').select('*'),
    supabase.from('accounting_payments').select(`
      amount,
      payment_date,
      invoice:accounting_invoices!inner(
        apartment_id,
        invoice_type
      )
    `).eq('invoice.invoice_type', 'OUTGOING_SALES').not('invoice.apartment_id', 'is', null)
  ])

  if (apartmentsData.error) throw apartmentsData.error
  if (salesData.error) throw salesData.error
  if (customersData.error) throw customersData.error
  if (projectsData.error) throw projectsData.error

  const apartments = apartmentsData.data || []
  const sales = salesData.data || []
  const customers = customersData.data || []
  const projects = projectsData.data || []
  const payments = paymentsData.data || []

  const totalRevenue = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
  const totalSalesValue = sales.reduce((sum, s) => sum + parseFloat(s.sale_price), 0)
  const totalUnits = apartments.length
  const soldUnits = apartments.filter(a => a.status === 'Sold').length
  const reservedUnits = apartments.filter(a => a.status === 'Reserved').length
  const availableUnits = apartments.filter(a => a.status === 'Available').length
  const avgSalePrice = sales.length > 0 ? totalSalesValue / sales.length : 0
  const salesRate = totalUnits > 0 ? (soldUnits / totalUnits) * 100 : 0
  const totalCustomers = customers.length
  const activeLeads = customers.filter(c => c.status === 'lead' || c.status === 'interested').length
  const currentMonth = startOfMonth(new Date())
  const monthlyRevenue = payments
    .filter(p => new Date(p.payment_date) >= currentMonth)
    .reduce((sum, p) => sum + parseFloat(p.amount), 0)

  const stats: SalesDashboardStats = {
    totalUnits,
    availableUnits,
    reservedUnits,
    soldUnits,
    totalRevenue,
    avgSalePrice,
    salesRate,
    totalCustomers,
    activeLeads,
    monthlyRevenue,
    monthlyTarget: 5000000
  }

  const projectStatsMap = new Map<string, ProjectStats>()
  projects.forEach(project => {
    const projectApartments = apartments.filter(a => a.project_id === project.id)
    const projectPayments = payments.filter(p => {
      const apt = apartments.find(a => a.id === p.invoice?.apartment_id)
      return apt && apt.project_id === project.id
    })
    const revenue = projectPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
    const total = projectApartments.length
    const sold = projectApartments.filter(a => a.status === 'Sold').length
    const reserved = projectApartments.filter(a => a.status === 'Reserved').length
    const available = projectApartments.filter(a => a.status === 'Available').length

    if (total > 0) {
      projectStatsMap.set(project.id, {
        project_id: project.id,
        project_name: project.name,
        total_units: total,
        sold_units: sold,
        reserved_units: reserved,
        available_units: available,
        total_revenue: revenue,
        sales_rate: (sold / total) * 100
      })
    }
  })

  const monthlyTrends: MonthlyTrend[] = []
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(new Date(), i)
    const monthStart = startOfMonth(monthDate)
    const monthEnd = endOfMonth(monthDate)
    const monthPayments = payments.filter(p => {
      const d = new Date(p.payment_date)
      return d >= monthStart && d <= monthEnd
    })
    const monthSales = sales.filter(s => {
      const d = new Date(s.sale_date)
      return d >= monthStart && d <= monthEnd
    })
    monthlyTrends.push({
      month: format(monthDate, 'MMM'),
      sales_count: monthSales.length,
      revenue: monthPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
    })
  }

  const paymentMethodBreakdown: Record<string, number> = {}
  sales.forEach(sale => {
    paymentMethodBreakdown[sale.payment_method] = (paymentMethodBreakdown[sale.payment_method] || 0) + 1
  })

  const recentSales = await fetchRecentSales(sales)

  return { stats, projectStats: Array.from(projectStatsMap.values()), monthlyTrends, paymentMethodBreakdown, recentSales }
}

export async function fetchRecentSales(sales: any[]): Promise<RecentSale[]> {
  const recentSalesSlice = sales.slice(-10).reverse()
  if (recentSalesSlice.length === 0) return []

  const apartmentIds = [...new Set(recentSalesSlice.map(s => s.apartment_id).filter(Boolean))]
  const customerIds = [...new Set(recentSalesSlice.map(s => s.customer_id).filter(Boolean))]

  const [{ data: apartmentsData }, { data: customersData }] = await Promise.all([
    supabase.from('apartments').select('id, number, project_id').in('id', apartmentIds),
    supabase.from('customers').select('id, name, surname').in('id', customerIds)
  ])

  const projectIds = [...new Set((apartmentsData || []).map(a => a.project_id).filter(Boolean))]
  const { data: projectsData } = await supabase.from('projects').select('id, name').in('id', projectIds)

  const aptMap = new Map((apartmentsData || []).map(a => [a.id, a]))
  const custMap = new Map((customersData || []).map(c => [c.id, c]))
  const projMap = new Map((projectsData || []).map(p => [p.id, p]))

  return recentSalesSlice.map(sale => {
    const apt = aptMap.get(sale.apartment_id)
    const cust = custMap.get(sale.customer_id)
    const proj = apt ? projMap.get(apt.project_id) : undefined

    return {
      ...sale,
      apartment_number: apt?.number || 'N/A',
      project_name: proj?.name || 'Unknown',
      customer_name: cust ? `${cust.name} ${cust.surname}` : 'Unknown'
    }
  })
}
