import { supabase } from '../../../../lib/supabase'
import type { RetailLandPlot, RetailSale } from '../../../../types/retail'

export interface LandPlotWithProject extends RetailLandPlot {
  connectedProject?: { id: string; land_plot_id: string | null; name: string } | null
}

export interface LandPlotSaleRow extends Omit<RetailSale, 'customer'> {
  customer?: { name: string } | null
}

export async function fetchLandPlotsWithProjects(): Promise<LandPlotWithProject[]> {
  const [plotsRes, projectsRes] = await Promise.all([
    supabase.from('retail_land_plots').select('*').order('created_at', { ascending: false }),
    supabase.from('retail_projects').select('id, land_plot_id, name').not('land_plot_id', 'is', null)
  ])

  if (plotsRes.error) throw plotsRes.error
  if (projectsRes.error) throw projectsRes.error

  return (plotsRes.data || []).map(plot => ({
    ...plot,
    connectedProject: projectsRes.data?.find(p => p.land_plot_id === plot.id) || null
  }))
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
  } else {
    const { error } = await supabase.from('retail_land_plots').insert([payload])
    if (error) throw error
  }
}

export async function deleteLandPlot(id: string): Promise<void> {
  const { error } = await supabase.from('retail_land_plots').delete().eq('id', id)
  if (error) throw error
}
