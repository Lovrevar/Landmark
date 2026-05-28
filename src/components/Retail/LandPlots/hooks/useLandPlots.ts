import { useState, useEffect, useRef, useCallback } from 'react'
import {
  fetchLandPlotsWithProjects,
  fetchLandPlotStats,
  fetchLandPlotSales,
  upsertLandPlot,
  deleteLandPlot,
  type LandPlotWithProject,
  type LandPlotPayload,
  type LandPlotSaleRow,
  type LandPlotStats
} from '../services/landPlotService'
import { useToast } from '../../../../contexts/ToastContext'

export interface LandPlotWithSales extends LandPlotWithProject {
  sales?: LandPlotSaleRow[]
}

export const LAND_PLOTS_PAGE_SIZE = 50

export function useLandPlots() {
  const toast = useToast()
  const [plots, setPlots] = useState<LandPlotWithProject[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState<LandPlotStats>({ total_plots: 0, total_invested: 0, total_area: 0, paid_count: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm])

  const loadData = useCallback(async () => {
    if (hasLoadedRef.current) setRefreshing(true)
    else setLoading(true)
    try {
      const [pageResult, statsResult] = await Promise.all([
        fetchLandPlotsWithProjects(currentPage, LAND_PLOTS_PAGE_SIZE, debouncedSearchTerm),
        fetchLandPlotStats(),
      ])
      setPlots(pageResult.plots)
      setTotalCount(pageResult.totalCount)
      setStats(statsResult)
      hasLoadedRef.current = true
    } catch (error) {
      console.error('Error fetching land plots:', error)
      toast.error('Greška pri učitavanju zemljišta')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [currentPage, debouncedSearchTerm, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSave = async (payload: LandPlotPayload, id?: string) => {
    await upsertLandPlot(payload, id)
    await loadData()
  }

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = (id: string) => setPendingDeleteId(id)

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    setDeleting(true)
    try {
      await deleteLandPlot(pendingDeleteId)
      await loadData()
    } catch (error) {
      console.error('Error deleting land plot:', error)
      toast.error('Greška pri brisanju zemljišta')
    } finally {
      setDeleting(false)
      setPendingDeleteId(null)
    }
  }

  const cancelDelete = () => setPendingDeleteId(null)

  const loadPlotDetails = async (plot: LandPlotWithProject): Promise<LandPlotWithSales> => {
    const sales = await fetchLandPlotSales(plot.id)
    return { ...plot, sales }
  }

  return {
    loading,
    refreshing,
    plots,
    totalCount,
    pageSize: LAND_PLOTS_PAGE_SIZE,
    currentPage,
    setCurrentPage,
    totalStats: stats,
    searchTerm,
    setSearchTerm,
    handleSave,
    handleDelete,
    confirmDelete,
    cancelDelete,
    pendingDeleteId,
    deleting,
    loadPlotDetails
  }
}
