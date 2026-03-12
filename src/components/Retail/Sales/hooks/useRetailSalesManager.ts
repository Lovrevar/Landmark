import { useState, useEffect, useMemo } from 'react'
import type { RetailLandPlot, RetailCustomer } from '../../../../types/retail'
import {
  fetchRetailSalesWithRelations,
  fetchRetailLandPlotsForSale,
  fetchRetailCustomersForSale,
  upsertRetailSale,
  deleteRetailSale,
  recordRetailSalePayment,
  type SaleWithRelations,
  type RetailSalePayload
} from '../services/retailSalesService'

export function useRetailSalesManager() {
  const [sales, setSales] = useState<SaleWithRelations[]>([])
  const [landPlots, setLandPlots] = useState<RetailLandPlot[]>([])
  const [customers, setCustomers] = useState<RetailCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const loadData = async () => {
    try {
      setLoading(true)
      const [salesData, plotsData, customersData] = await Promise.all([
        fetchRetailSalesWithRelations(),
        fetchRetailLandPlotsForSale(),
        fetchRetailCustomersForSale()
      ])
      setSales(salesData)
      setLandPlots(plotsData)
      setCustomers(customersData)
    } catch (error) {
      console.error('Error fetching data:', error)
      alert('Greška pri učitavanju podataka')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleSave = async (payload: RetailSalePayload, id?: string) => {
    await upsertRetailSale(payload, id)
    await loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Jeste li sigurni da želite obrisati ovu prodaju?')) return
    try {
      await deleteRetailSale(id)
      await loadData()
    } catch (error) {
      console.error('Error deleting sale:', error)
      alert('Greška pri brisanju prodaje')
    }
  }

  const handleAddPayment = async (sale: SaleWithRelations, amount: number) => {
    const newPaidAmount = sale.paid_amount + amount
    const remaining = sale.total_sale_price - newPaidAmount
    let newStatus: 'paid' | 'pending' | 'partial' | 'overdue' = 'pending'
    if (remaining <= 0) {
      newStatus = 'paid'
    } else if (newPaidAmount > 0) {
      newStatus = 'partial'
    }
    await recordRetailSalePayment(sale.id, newPaidAmount, newStatus)
    await loadData()
  }

  const filteredSales = useMemo(() =>
    sales.filter(sale => {
      const matchesSearch =
        (sale.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sale.land_plot?.plot_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sale.contract_number || '').toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || sale.payment_status === statusFilter
      return matchesSearch && matchesStatus
    }),
    [sales, searchTerm, statusFilter]
  )

  const totalStats = useMemo(() => ({
    total_sales: sales.length,
    total_revenue: sales.reduce((sum, s) => sum + s.total_sale_price, 0),
    total_paid: sales.reduce((sum, s) => sum + s.paid_amount, 0),
    total_remaining: sales.reduce((sum, s) => sum + s.remaining_amount, 0)
  }), [sales])

  return {
    loading,
    landPlots,
    customers,
    filteredSales,
    totalStats,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    handleSave,
    handleDelete,
    handleAddPayment
  }
}
