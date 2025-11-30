import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ShoppingCart, Plus, Search, Edit, Trash2, DollarSign, X, Calendar } from 'lucide-react'
import type { RetailSale, RetailLandPlot, RetailCustomer } from '../../types/retail'
import { format } from 'date-fns'

interface SaleWithRelations extends RetailSale {
  land_plot?: RetailLandPlot
  customer?: RetailCustomer
}

const RetailSales: React.FC = () => {
  const [sales, setSales] = useState<SaleWithRelations[]>([])
  const [landPlots, setLandPlots] = useState<RetailLandPlot[]>([])
  const [customers, setCustomers] = useState<RetailCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showFormModal, setShowFormModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedSale, setSelectedSale] = useState<SaleWithRelations | null>(null)
  const [editingSale, setEditingSale] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    land_plot_id: '',
    customer_id: '',
    sale_area_m2: '',
    sale_price_per_m2: '',
    payment_deadline: '',
    contract_number: '',
    notes: ''
  })

  const [paymentAmount, setPaymentAmount] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      const [salesRes, plotsRes, customersRes] = await Promise.all([
        supabase
          .from('retail_sales')
          .select(`
            *,
            land_plot:retail_land_plots(*),
            customer:retail_customers(*)
          `)
          .order('payment_deadline', { ascending: true }),
        supabase
          .from('retail_land_plots')
          .select('*')
          .order('plot_number'),
        supabase
          .from('retail_customers')
          .select('*')
          .order('name')
      ])

      if (salesRes.error) throw salesRes.error
      if (plotsRes.error) throw plotsRes.error
      if (customersRes.error) throw customersRes.error

      const updatedSales = (salesRes.data || []).map(sale => {
        const isOverdue = new Date(sale.payment_deadline) < new Date() && sale.payment_status !== 'paid'
        return {
          ...sale,
          payment_status: isOverdue ? 'overdue' : sale.payment_status
        }
      })

      setSales(updatedSales)
      setLandPlots(plotsRes.data || [])
      setCustomers(customersRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      alert('Greška pri učitavanju podataka')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenFormModal = (sale?: SaleWithRelations) => {
    if (sale) {
      setEditingSale(sale.id)
      setFormData({
        land_plot_id: sale.land_plot_id,
        customer_id: sale.customer_id,
        sale_area_m2: sale.sale_area_m2.toString(),
        sale_price_per_m2: sale.sale_price_per_m2.toString(),
        payment_deadline: sale.payment_deadline,
        contract_number: sale.contract_number || '',
        notes: sale.notes || ''
      })
    } else {
      setEditingSale(null)
      setFormData({
        land_plot_id: '',
        customer_id: '',
        sale_area_m2: '',
        sale_price_per_m2: '',
        payment_deadline: '',
        contract_number: '',
        notes: ''
      })
    }
    document.body.style.overflow = 'hidden'
    setShowFormModal(true)
  }

  const handleCloseFormModal = () => {
    document.body.style.overflow = 'unset'
    setShowFormModal(false)
    setEditingSale(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const payload = {
        land_plot_id: formData.land_plot_id,
        customer_id: formData.customer_id,
        sale_area_m2: parseFloat(formData.sale_area_m2),
        sale_price_per_m2: parseFloat(formData.sale_price_per_m2),
        payment_deadline: formData.payment_deadline,
        contract_number: formData.contract_number || null,
        notes: formData.notes || null
      }

      if (editingSale) {
        const { error } = await supabase
          .from('retail_sales')
          .update(payload)
          .eq('id', editingSale)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('retail_sales')
          .insert([payload])

        if (error) throw error
      }

      await fetchData()
      handleCloseFormModal()
    } catch (error) {
      console.error('Error saving sale:', error)
      alert('Greška pri spremanju prodaje')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Jeste li sigurni da želite obrisati ovu prodaju?')) return

    try {
      const { error } = await supabase
        .from('retail_sales')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('Error deleting sale:', error)
      alert('Greška pri brisanju prodaje')
    }
  }

  const handleOpenPaymentModal = (sale: SaleWithRelations) => {
    setSelectedSale(sale)
    setPaymentAmount('')
    document.body.style.overflow = 'hidden'
    setShowPaymentModal(true)
  }

  const handleClosePaymentModal = () => {
    document.body.style.overflow = 'unset'
    setShowPaymentModal(false)
    setSelectedSale(null)
    setPaymentAmount('')
  }

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSale) return

    try {
      const amount = parseFloat(paymentAmount)
      const newPaidAmount = selectedSale.paid_amount + amount
      const remaining = selectedSale.total_sale_price - newPaidAmount

      let newStatus: 'paid' | 'pending' | 'partial' | 'overdue' = 'pending'
      if (remaining <= 0) {
        newStatus = 'paid'
      } else if (newPaidAmount > 0) {
        newStatus = 'partial'
      }

      const { error } = await supabase
        .from('retail_sales')
        .update({
          paid_amount: newPaidAmount,
          payment_status: newStatus
        })
        .eq('id', selectedSale.id)

      if (error) throw error

      await fetchData()
      handleClosePaymentModal()
    } catch (error) {
      console.error('Error adding payment:', error)
      alert('Greška pri dodavanju plaćanja')
    }
  }

  const filteredSales = sales.filter(sale => {
    const matchesSearch =
      (sale.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.land_plot?.plot_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.contract_number || '').toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || sale.payment_status === statusFilter

    return matchesSearch && matchesStatus
  })

  const totalStats = {
    total_sales: sales.length,
    total_revenue: sales.reduce((sum, s) => sum + s.total_sale_price, 0),
    total_paid: sales.reduce((sum, s) => sum + s.paid_amount, 0),
    total_remaining: sales.reduce((sum, s) => sum + s.remaining_amount, 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Učitavanje...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prodaje</h1>
          <p className="text-sm text-gray-600 mt-1">Upravljanje prodajama i rokovima plaćanja</p>
        </div>
        <button
          onClick={() => handleOpenFormModal()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova prodaja
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno prodaja</p>
              <p className="text-2xl font-bold text-gray-900">{totalStats.total_sales}</p>
            </div>
            <ShoppingCart className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupni prihod</p>
              <p className="text-2xl font-bold text-green-600">€{totalStats.total_revenue.toLocaleString()}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Plaćeno</p>
              <p className="text-2xl font-bold text-green-600">€{totalStats.total_paid.toLocaleString()}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Za naplatu</p>
              <p className="text-2xl font-bold text-orange-600">€{totalStats.total_remaining.toLocaleString()}</p>
            </div>
            <DollarSign className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Pretraži po kupcu, čestici ili ugovoru..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Svi statusi</option>
            <option value="pending">Pending</option>
            <option value="partial">Djelomično</option>
            <option value="paid">Plaćeno</option>
            <option value="overdue">Kašnjenje</option>
          </select>
        </div>
      </div>

      {filteredSales.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm || statusFilter !== 'all' ? 'Nema rezultata pretrage' : 'Nema prodaja'}
          </h3>
          <p className="text-gray-600">
            {searchTerm || statusFilter !== 'all' ? 'Pokušajte s drugim kriterijima' : 'Dodajte prvu prodaju klikom na gumb iznad'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kupac
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Čestica
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Površina
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ukupno
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plaćeno
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rok
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Akcije
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {sale.customer?.name || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{sale.land_plot?.plot_number || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{sale.sale_area_m2.toLocaleString()} m²</div>
                      <div className="text-xs text-gray-500">€{sale.sale_price_per_m2}/m²</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">€{sale.total_sale_price.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-green-600">€{sale.paid_amount.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">Preostalo: €{sale.remaining_amount.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{format(new Date(sale.payment_deadline), 'dd.MM.yyyy')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        sale.payment_status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : sale.payment_status === 'partial'
                          ? 'bg-yellow-100 text-yellow-800'
                          : sale.payment_status === 'overdue'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {sale.payment_status === 'paid' ? 'Plaćeno' :
                         sale.payment_status === 'partial' ? 'Djelomično' :
                         sale.payment_status === 'overdue' ? 'Kašnjenje' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {sale.payment_status !== 'paid' && (
                          <button
                            onClick={() => handleOpenPaymentModal(sale)}
                            className="text-green-600 hover:text-green-900"
                            title="Dodaj plaćanje"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenFormModal(sale)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Uredi"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(sale.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Obriši"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showFormModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">
                {editingSale ? 'Uredi prodaju' : 'Nova prodaja'}
              </h2>
              <button
                onClick={handleCloseFormModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Čestica *
                  </label>
                  <select
                    required
                    value={formData.land_plot_id}
                    onChange={(e) => setFormData({ ...formData, land_plot_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Odaberite česticu</option>
                    {landPlots.map((plot) => (
                      <option key={plot.id} value={plot.id}>
                        {plot.plot_number} - {plot.owner_first_name} {plot.owner_last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kupac *
                  </label>
                  <select
                    required
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Odaberite kupca</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Površina (m²) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.sale_area_m2}
                      onChange={(e) => setFormData({ ...formData, sale_area_m2: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cijena po m² (€) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.sale_price_per_m2}
                      onChange={(e) => setFormData({ ...formData, sale_price_per_m2: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rok plaćanja *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.payment_deadline}
                    onChange={(e) => setFormData({ ...formData, payment_deadline: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Broj ugovora
                  </label>
                  <input
                    type="text"
                    value={formData.contract_number}
                    onChange={(e) => setFormData({ ...formData, contract_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Napomene
                  </label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseFormModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingSale ? 'Spremi' : 'Dodaj'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                Dodaj plaćanje
              </h2>
              <button
                onClick={handleClosePaymentModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddPayment} className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600">Kupac</p>
                <p className="text-lg font-semibold">{selectedSale.customer?.name}</p>
              </div>

              <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Ukupno:</span>
                  <span className="font-semibold">€{selectedSale.total_sale_price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Plaćeno:</span>
                  <span className="font-semibold text-green-600">€{selectedSale.paid_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm text-gray-600">Preostalo:</span>
                  <span className="font-bold text-orange-600">€{selectedSale.remaining_amount.toLocaleString()}</span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Iznos plaćanja (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  max={selectedSale.remaining_amount}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleClosePaymentModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Dodaj plaćanje
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default RetailSales
