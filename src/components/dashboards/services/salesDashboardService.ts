import { supabase } from '../../../lib/supabase'
import { subMonths, startOfMonth, format } from 'date-fns'
import { collectedByMonth, collectedByProject, collectedFromSales, collectedSince, contractedSales, salesByMonth, salesRate, unitStatusCounts } from '../../../utils/salesFigures'
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
  // The one query whose error used to go unchecked: revenue, the monthly figure and every
  // per-project amount come from it, so a failed read rendered a confident €0.
  if (paymentsData.error) throw paymentsData.error

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

  // Revenue is cash actually collected ("Naplaćeno od prodaje", GEN-9); only apartment sales are
  // invoiced, so garage/storage sales are not represented in the revenue figures.
  const totalRevenue = collectedFromSales(payments)
  const {
    total: totalUnits,
    sold: soldUnits,
    reserved: reservedUnits,
    available: availableUnits,
  } = unitStatusCounts(allUnits)
  // Σ sale_price over the sale rows; linked garages and storage play no part (GEN-38).
  const avgSalePrice = contractedSales(sales).average
  const unitSalesRate = salesRate(soldUnits, totalUnits)
  const totalCustomers = customers.length
  const activeLeads = customers.filter(c => c.status === 'lead' || c.status === 'interested').length
  const currentMonth = startOfMonth(new Date())
  const monthlyRevenue = collectedSince(payments, currentMonth)

  const stats: SalesDashboardStats = {
    totalUnits,
    availableUnits,
    reservedUnits,
    soldUnits,
    totalRevenue,
    avgSalePrice,
    salesRate: unitSalesRate,
    totalCustomers,
    activeLeads,
    monthlyRevenue
  }

  // Map apartment_id → project_id once, so per-project revenue is O(payments).
  const apartmentToProject = new Map<string, string | null>()
  for (const a of apartments) apartmentToProject.set(a.id, a.project_id as string | null)

  const revenueByProject = collectedByProject(payments, p =>
    p.invoice?.apartment_id ? apartmentToProject.get(p.invoice.apartment_id) : null)

  const projectStatsMap = new Map<string, ProjectStats>()
  projects.forEach(project => {
    const { total, sold, reserved, available } = unitStatusCounts(allUnits.filter(u => u.project_id === project.id))

    if (total > 0) {
      projectStatsMap.set(project.id, {
        project_id: project.id,
        project_name: project.name,
        total_units: total,
        sold_units: sold,
        reserved_units: reserved,
        available_units: available,
        total_revenue: revenueByProject.get(project.id) || 0,
        sales_rate: salesRate(sold, total)
      })
    }
  })

  // 6-month trend. Bucketed by 'YYYY-MM' string keys (timezone-safe). Note:
  // sales_count is by sale_date, revenue is by payment_date — distinct events.
  const monthlyTrends: MonthlyTrend[] = []
  const collectedPerMonth = collectedByMonth(payments)
  const salesPerMonth = salesByMonth(sales)
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(new Date(), i)
    const key = format(monthDate, 'yyyy-MM')
    monthlyTrends.push({
      // A machine key, not a label: nothing but the dashboard reads this, and it is the one
      // that knows which language to render it in.
      month: format(startOfMonth(monthDate), 'yyyy-MM-dd'),
      sales_count: salesPerMonth.get(key)?.length ?? 0,
      revenue: collectedPerMonth.get(key) || 0
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

  const [apartmentsResult, customersResult] = await Promise.all([
    supabase.from('apartments').select('id, number, project_id').in('id', apartmentIds),
    supabase.from('customers').select('id, name, surname').in('id', customerIds)
  ])
  // Unchecked, these rendered every recent sale as "Unknown — N/A" rather than saying the
  // list could not be read.
  if (apartmentsResult.error) throw apartmentsResult.error
  if (customersResult.error) throw customersResult.error
  const { data: apartmentsData } = apartmentsResult
  const { data: customersData } = customersResult

  const projectIds = [...new Set((apartmentsData || []).map(a => a.project_id).filter(Boolean))]
  const { data: projectsData, error: projectsError } = await supabase.from('projects').select('id, name').in('id', projectIds)
  if (projectsError) throw projectsError

  const aptMap = new Map((apartmentsData || []).map(a => [a.id, a]))
  const custMap = new Map((customersData || []).map(c => [c.id, c]))
  const projMap = new Map((projectsData || []).map(p => [p.id, p]))

  return recentSalesSlice.map(sale => {
    const apt = aptMap.get(sale.apartment_id)
    const cust = custMap.get(sale.customer_id)
    const proj = apt ? projMap.get(apt.project_id) : undefined

    return {
      ...sale,
      // Empty when the row is missing; the dashboard renders the localised fallback.
      apartment_number: apt?.number || '',
      project_name: proj?.name || '',
      customer_name: cust ? `${cust.name} ${cust.surname}` : ''
    }
  }) as unknown as RecentSale[]
}
