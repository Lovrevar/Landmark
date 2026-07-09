import { supabase } from '../../../lib/supabase'
import { subMonths, startOfMonth, format } from 'date-fns'
import { parseLocalDate, monthKey } from '../../../utils/dateOnly'
import type { SalesDashboardStats, ProjectStats, MonthlyTrend, RecentSale } from '../types/salesDashboardTypes'

// A unit of any of the three saleable types (stan / garaža / repozitorij),
// normalised to the project it belongs to so counts cover the whole inventory.
interface UnitRow { status: string; project_id: string | null }

export async function fetchSalesDashboardData(): Promise<{
  stats: SalesDashboardStats
  projectStats: ProjectStats[]
  monthlyTrends: MonthlyTrend[]
  paymentMethodBreakdown: Record<string, number>
  recentSales: RecentSale[]
}> {
  const [
    apartmentsData,
    garagesData,
    repositoriesData,
    buildingsData,
    salesData,
    customersData,
    projectsData,
    paymentsData
  ] = await Promise.all([
    supabase.from('apartments').select('id, status, project_id'),
    supabase.from('garages').select('status, building_id'),
    supabase.from('repositories').select('status, building_id'),
    supabase.from('buildings').select('id, project_id'),
    supabase.from('sales').select('*, apartment_id').order('sale_date', { ascending: false }),
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
  if (garagesData.error) throw garagesData.error
  if (repositoriesData.error) throw repositoriesData.error
  if (buildingsData.error) throw buildingsData.error
  if (salesData.error) throw salesData.error
  if (customersData.error) throw customersData.error
  if (projectsData.error) throw projectsData.error

  const apartments = apartmentsData.data || []
  const sales = salesData.data || []
  const customers = customersData.data || []
  const projects = projectsData.data || []
  const payments = (paymentsData.data || []) as unknown as Array<{ amount: string | number; payment_date: string; invoice?: { apartment_id: string | null; invoice_type: string } | null }>

  // Garages/repositories link to a building, not directly to a project.
  const buildingToProject = new Map<string, string>()
  for (const b of buildingsData.data || []) buildingToProject.set(b.id, b.project_id)

  // Whole-inventory unit list across all three saleable types.
  const allUnits: UnitRow[] = [
    ...apartments.map(a => ({ status: a.status, project_id: a.project_id as string | null })),
    ...(garagesData.data || []).map(g => ({ status: g.status, project_id: buildingToProject.get(g.building_id) ?? null })),
    ...(repositoriesData.data || []).map(r => ({ status: r.status, project_id: buildingToProject.get(r.building_id) ?? null }))
  ]

  // Revenue is cash actually collected; only apartment sales are invoiced
  // (accounting_invoices/sales reference apartment_id only), so garage/storage
  // sales are not represented in the revenue figures.
  const totalRevenue = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  const totalSalesValue = sales.reduce((sum, s) => sum + (Number(s.sale_price) || 0), 0)
  const totalUnits = allUnits.length
  const soldUnits = allUnits.filter(u => u.status === 'Sold').length
  const reservedUnits = allUnits.filter(u => u.status === 'Reserved').length
  const availableUnits = allUnits.filter(u => u.status === 'Available').length
  const avgSalePrice = sales.length > 0 ? totalSalesValue / sales.length : 0
  const salesRate = totalUnits > 0 ? (soldUnits / totalUnits) * 100 : 0
  const totalCustomers = customers.length
  const activeLeads = customers.filter(c => c.status === 'lead' || c.status === 'interested').length
  const currentMonth = startOfMonth(new Date())
  const monthlyRevenue = payments
    .filter(p => parseLocalDate(p.payment_date) >= currentMonth)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

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

  // Map apartment_id → project_id once, so per-project revenue is O(payments).
  const apartmentToProject = new Map<string, string | null>()
  for (const a of apartments) apartmentToProject.set(a.id, a.project_id as string | null)

  const revenueByProject = new Map<string, number>()
  for (const p of payments) {
    const projectId = p.invoice?.apartment_id ? apartmentToProject.get(p.invoice.apartment_id) : null
    if (!projectId) continue
    revenueByProject.set(projectId, (revenueByProject.get(projectId) || 0) + (Number(p.amount) || 0))
  }

  const projectStatsMap = new Map<string, ProjectStats>()
  projects.forEach(project => {
    const projectUnits = allUnits.filter(u => u.project_id === project.id)
    const total = projectUnits.length
    const sold = projectUnits.filter(u => u.status === 'Sold').length
    const reserved = projectUnits.filter(u => u.status === 'Reserved').length
    const available = projectUnits.filter(u => u.status === 'Available').length

    if (total > 0) {
      projectStatsMap.set(project.id, {
        project_id: project.id,
        project_name: project.name,
        total_units: total,
        sold_units: sold,
        reserved_units: reserved,
        available_units: available,
        total_revenue: revenueByProject.get(project.id) || 0,
        sales_rate: (sold / total) * 100
      })
    }
  })

  // 6-month trend. Bucketed by 'YYYY-MM' string keys (timezone-safe). Note:
  // sales_count is by sale_date, revenue is by payment_date — distinct events.
  const monthlyTrends: MonthlyTrend[] = []
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(new Date(), i)
    const key = format(monthDate, 'yyyy-MM')
    const monthPayments = payments.filter(p => monthKey(p.payment_date) === key)
    const monthSales = sales.filter(s => monthKey(s.sale_date) === key)
    monthlyTrends.push({
      month: format(monthDate, 'MMM yy'),
      sales_count: monthSales.length,
      revenue: monthPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    })
  }

  const paymentMethodBreakdown: Record<string, number> = {}
  sales.forEach(sale => {
    paymentMethodBreakdown[sale.payment_method] = (paymentMethodBreakdown[sale.payment_method] || 0) + 1
  })

  const recentSales = await fetchRecentSales(sales)

  return { stats, projectStats: Array.from(projectStatsMap.values()), monthlyTrends, paymentMethodBreakdown, recentSales }
}

export async function fetchRecentSales(sales: Array<{ apartment_id?: string; customer_id?: string; sale_price: string | number; sale_date?: string }>): Promise<RecentSale[]> {
  // Sort by sale_date desc explicitly — don't rely on the caller's array order.
  const recentSalesSlice = [...sales]
    .sort((a, b) => (b.sale_date || '').localeCompare(a.sale_date || ''))
    .slice(0, 10)
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
  }) as unknown as RecentSale[]
}
