import { useState, useEffect, useMemo } from 'react'
import {
  fetchLandPlotsWithProjects,
  fetchLandPlotSales,
  upsertLandPlot,
  deleteLandPlot,
  type LandPlotWithProject,
  type LandPlotPayload,
  type LandPlotSaleRow
} from '../services/landPlotService'
import { useToast } from '../../../../contexts/ToastContext'

export interface LandPlotWithSales extends LandPlotWithProject {
  sales?: LandPlotSaleRow[]
}

export function useLandPlots() {
  const toast = useToast()
  const [landPlots, setLandPlots] = useState<LandPlotWithProject[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      setLandPlots(await fetchLandPlotsWithProjects())
    } catch (error) {
      console.error('Error fetching land plots:', error)
      toast.error('Greška pri učitavanju zemljišta')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSave = async (payload: LandPlotPayload, id?: string) => {
    await upsertLandPlot(payload, id)
    await loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Jeste li sigurni da želite obrisati ovu česticu?')) return
    try {
      await deleteLandPlot(id)
      await loadData()
    } catch (error) {
      console.error('Error deleting land plot:', error)
      toast.error('Greška pri brisanju zemljišta')
    }
  }

  const loadPlotDetails = async (plot: LandPlotWithProject): Promise<LandPlotWithSales> => {
    const sales = await fetchLandPlotSales(plot.id)
    return { ...plot, sales }
  }

  const filteredPlots = useMemo(() =>
    landPlots.filter(plot =>
      plot.owner_first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plot.owner_last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plot.plot_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (plot.location && plot.location.toLowerCase().includes(searchTerm.toLowerCase()))
    ),
    [landPlots, searchTerm]
  )

  const totalStats = useMemo(() => ({
    total_plots: landPlots.length,
    total_invested: landPlots.reduce((sum, p) => sum + p.total_price, 0),
    total_area: landPlots.reduce((sum, p) => sum + p.purchased_area_m2, 0),
    paid_count: landPlots.filter(p => p.payment_status === 'paid').length
  }), [landPlots])

  return {
    loading,
    filteredPlots,
    totalStats,
    searchTerm,
    setSearchTerm,
    handleSave,
    handleDelete,
    loadPlotDetails
  }
}
