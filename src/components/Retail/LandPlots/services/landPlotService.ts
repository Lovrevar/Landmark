import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import type { RetailLandPlot, RetailSale } from '../../../../types/retail'

export interface LandPlotWithProject extends RetailLandPlot {
  connectedProject?: { id: string; land_plot_id: string | null; name: string } | null
}

export interface LandPlotSaleRow extends Omit<RetailSale, 'customer'> {
  customer?: { name: string } | null
}

export interface PaginatedLandPlotsResult {
  plots: LandPlotWithProject[]
  totalCount: number
}

export interface LandPlotStats {
  total_plots: number
  total_invested: number
  total_area: number
  paid_count: number
}

export async function fetchLandPlotsWithProjects(
  page: number,
  pageSize: number,
  searchTerm: string
): Promise<PaginatedLandPlotsResult> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('retail_land_plots')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  const term = searchTerm.trim()
  if (term) {
    query = query.or(
      `plot_number.ilike.%${term}%,owner_first_name.ilike.%${term}%,owner_last_name.ilike.%${term}%,location.ilike.%${term}%`
    )
  }

  const { data: plots, error, count } = await query
  if (error) throw error

  const plotList = plots || []
  if (plotList.length === 0) {
    return { plots: [], totalCount: count ?? 0 }
  }

  const plotIds = plotList.map(p => p.id)
  const { data: projects, error: projectsError } = await supabase
    .from('retail_projects')
    .select('id, land_plot_id, name')
    .in('land_plot_id', plotIds)

  if (projectsError) throw projectsError

  return {
    plots: plotList.map(plot => ({
      ...plot,
      connectedProject: projects?.find(p => p.land_plot_id === plot.id) || null
    })),
    totalCount: count ?? 0
  }
}

export async function fetchLandPlotStats(): Promise<LandPlotStats> {
  const { data, error, count } = await supabase
    .from('retail_land_plots')
    .select('total_price, purchased_area_m2, payment_status', { count: 'exact' })

  if (error) throw error

  const plots = data || []
  return {
    total_plots: count ?? plots.length,
    total_invested: plots.reduce((sum, p) => sum + (p.total_price || 0), 0),
    total_area: plots.reduce((sum, p) => sum + (p.purchased_area_m2 || 0), 0),
    paid_count: plots.filter(p => p.payment_status === 'paid').length,
  }
}

export async function fetchLandPlotSales(plotId: string): Promise<LandPlotSaleRow[]> {
  const { data, error } = await supabase
    .from('retail_sales')
    .select('*, customer:retail_customers(*)')
    .eq('land_plot_id', plotId)

  if (error) throw error
  return (data || []) as LandPlotSaleRow[]
}

export interface LandPlotPayload {
  owner_first_name: string
  owner_last_name: string
  plot_number: string
  location: string | null
  total_area_m2: number
  purchased_area_m2: number
  price_per_m2: number
  payment_date: string | null
  payment_status: 'paid' | 'pending' | 'partial'
  notes: string | null
}

export async function upsertLandPlot(payload: LandPlotPayload, id?: string): Promise<void> {
  if (id) {
    const { error } = await supabase.from('retail_land_plots').update(payload).eq('id', id)
    if (error) throw error

    logActivity({ action: 'land_plot.update', entity: 'land_plot', entityId: id, metadata: { severity: 'medium', entity_name: payload.plot_number } })
  } else {
    const { data: inserted, error } = await supabase.from('retail_land_plots').insert([payload]).select('id').maybeSingle()
    if (error) throw error

    logActivity({ action: 'land_plot.create', entity: 'land_plot', entityId: inserted?.id ?? null, metadata: { severity: 'medium', entity_name: payload.plot_number } })
  }
}

export async function deleteLandPlot(id: string): Promise<void> {
  const { error } = await supabase.from('retail_land_plots').delete().eq('id', id)
  if (error) throw error
}
