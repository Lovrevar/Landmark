import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { MapPin, Plus, Search, Edit, Trash2, Eye, X, Calendar } from 'lucide-react'
import type { RetailLandPlot, RetailSale } from '../../types/retail'

interface LandPlotWithSales extends RetailLandPlot {
  sales?: RetailSale[]
}

const RetailLandPlots: React.FC = () => {
  const [landPlots, setLandPlots] = useState<LandPlotWithSales[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedPlot, setSelectedPlot] = useState<LandPlotWithSales | null>(null)
  const [editingPlot, setEditingPlot] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    owner_first_name: '',
    owner_last_name: '',
    plot_number: '',
    location: '',
    total_area_m2: '',
    purchased_area_m2: '',
    price_per_m2: '',
    payment_date: '',
    payment_status: 'pending' as 'paid' | 'pending' | 'partial',
    notes: ''
  })

  useEffect(() => {
    fetchLandPlots()
  }, [])

  const fetchLandPlots = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('retail_land_plots')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setLandPlots(data || [])
    } catch (error) {
      console.error('Error fetching land plots:', error)
      alert('Greška pri učitavanju zemljišta')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenFormModal = (plot?: LandPlotWithSales) => {
    if (plot) {
      setEditingPlot(plot.id)
      setFormData({
        owner_first_name: plot.owner_first_name,
        owner_last_name: plot.owner_last_name,
        plot_number: plot.plot_number,
        location: plot.location || '',
        total_area_m2: plot.total_area_m2.toString(),
        purchased_area_m2: plot.purchased_area_m2.toString(),
        price_per_m2: plot.price_per_m2.toString(),
        payment_date: plot.payment_date || '',
        payment_status: plot.payment_status,
        notes: plot.notes || ''
      })
    } else {
      setEditingPlot(null)
      setFormData({
        owner_first_name: '',
        owner_last_name: '',
        plot_number: '',
        location: '',
        total_area_m2: '',
        purchased_area_m2: '',
        price_per_m2: '',
        payment_date: '',
        payment_status: 'pending',
        notes: ''
      })
    }
    document.body.style.overflow = 'hidden'
    setShowFormModal(true)
  }

  const handleCloseFormModal = () => {
    document.body.style.overflow = 'unset'
    setShowFormModal(false)
    setEditingPlot(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const payload = {
        owner_first_name: formData.owner_first_name,
        owner_last_name: formData.owner_last_name,
        plot_number: formData.plot_number,
        location: formData.location || null,
        total_area_m2: parseFloat(formData.total_area_m2),
        purchased_area_m2: parseFloat(formData.purchased_area_m2),
        price_per_m2: parseFloat(formData.price_per_m2),
        payment_date: formData.payment_date || null,
        payment_status: formData.payment_status,
        notes: formData.notes || null
      }

      if (editingPlot) {
        const { error } = await supabase
          .from('retail_land_plots')
          .update(payload)
          .eq('id', editingPlot)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('retail_land_plots')
          .insert([payload])

        if (error) throw error
      }

      await fetchLandPlots()
      handleCloseFormModal()
    } catch (error) {
      console.error('Error saving land plot:', error)
      alert('Greška pri spremanju zemljišta')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Jeste li sigurni da želite obrisati ovu česticu?')) return

    try {
      const { error } = await supabase
        .from('retail_land_plots')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchLandPlots()
    } catch (error) {
      console.error('Error deleting land plot:', error)
      alert('Greška pri brisanju zemljišta')
    }
  }

  const handleViewDetails = async (plot: LandPlotWithSales) => {
    try {
      const { data: sales, error } = await supabase
        .from('retail_sales')
        .select(`
          *,
          customer:retail_customers(*)
        `)
        .eq('land_plot_id', plot.id)

      if (error) throw error

      setSelectedPlot({
        ...plot,
        sales: sales || []
      })
      document.body.style.overflow = 'hidden'
      setShowDetailsModal(true)
    } catch (error) {
      console.error('Error loading plot details:', error)
      alert('Greška pri učitavanju detalja')
    }
  }

  const handleCloseDetailsModal = () => {
    document.body.style.overflow = 'unset'
    setShowDetailsModal(false)
    setSelectedPlot(null)
  }

  const filteredPlots = landPlots.filter(plot =>
    plot.owner_first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plot.owner_last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plot.plot_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (plot.location && plot.location.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const totalStats = {
    total_plots: landPlots.length,
    total_invested: landPlots.reduce((sum, p) => sum + p.total_price, 0),
    total_area: landPlots.reduce((sum, p) => sum + p.purchased_area_m2, 0),
    paid_count: landPlots.filter(p => p.payment_status === 'paid').length
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
          <h1 className="text-2xl font-bold text-gray-900">Zemljišta</h1>
          <p className="text-sm text-gray-600 mt-1">Upravljanje zemljištima i česticama</p>
        </div>
        <button
          onClick={() => handleOpenFormModal()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo zemljište
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno čestica</p>
              <p className="text-2xl font-bold text-gray-900">{totalStats.total_plots}</p>
            </div>
            <MapPin className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupna površina</p>
              <p className="text-2xl font-bold text-gray-900">{totalStats.total_area.toLocaleString()} m²</p>
            </div>
            <MapPin className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno investirano</p>
              <p className="text-2xl font-bold text-orange-600">€{totalStats.total_invested.toLocaleString()}</p>
            </div>
            <Calendar className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Plaćeno</p>
              <p className="text-2xl font-bold text-green-600">{totalStats.paid_count}/{totalStats.total_plots}</p>
            </div>
            <Calendar className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Pretraži po vlasniku, broju čestice ili lokaciji..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {filteredPlots.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm ? 'Nema rezultata pretrage' : 'Nema zemljišta'}
          </h3>
          <p className="text-gray-600">
            {searchTerm ? 'Pokušajte s drugim pojmom' : 'Dodajte prvo zemljište klikom na gumb iznad'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vlasnik
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Čestica
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lokacija
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Površina
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cijena/m²
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ukupno
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
                {filteredPlots.map((plot) => (
                  <tr key={plot.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {plot.owner_first_name} {plot.owner_last_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{plot.plot_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{plot.location || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{plot.purchased_area_m2.toLocaleString()} m²</div>
                      {plot.purchased_area_m2 < plot.total_area_m2 && (
                        <div className="text-xs text-gray-500">od {plot.total_area_m2.toLocaleString()} m²</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">€{plot.price_per_m2.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">€{plot.total_price.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        plot.payment_status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : plot.payment_status === 'partial'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {plot.payment_status === 'paid' ? 'Plaćeno' : plot.payment_status === 'partial' ? 'Djelomično' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleViewDetails(plot)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Detalji"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenFormModal(plot)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Uredi"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(plot.id)}
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
                {editingPlot ? 'Uredi zemljište' : 'Novo zemljište'}
              </h2>
              <button
                onClick={handleCloseFormModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ime vlasnika *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.owner_first_name}
                    onChange={(e) => setFormData({ ...formData, owner_first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prezime vlasnika *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.owner_last_name}
                    onChange={(e) => setFormData({ ...formData, owner_last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Broj čestice *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.plot_number}
                    onChange={(e) => setFormData({ ...formData, plot_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lokacija
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Npr. Banja Luka, Kozarska Dubica..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ukupna površina (m²) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.total_area_m2}
                    onChange={(e) => setFormData({ ...formData, total_area_m2: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kupljena površina (m²) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.purchased_area_m2}
                    onChange={(e) => setFormData({ ...formData, purchased_area_m2: e.target.value })}
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
                    value={formData.price_per_m2}
                    onChange={(e) => setFormData({ ...formData, price_per_m2: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Datum plaćanja
                  </label>
                  <input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status plaćanja *
                  </label>
                  <select
                    value={formData.payment_status}
                    onChange={(e) => setFormData({ ...formData, payment_status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="pending">Pending</option>
                    <option value="partial">Djelomično</option>
                    <option value="paid">Plaćeno</option>
                  </select>
                </div>

                <div className="col-span-2">
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
                  {editingPlot ? 'Spremi' : 'Dodaj'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailsModal && selectedPlot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">
                Detalji zemljišta - {selectedPlot.plot_number}
              </h2>
              <button
                onClick={handleCloseDetailsModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Vlasnik</p>
                  <p className="text-lg font-semibold">{selectedPlot.owner_first_name} {selectedPlot.owner_last_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Broj čestice</p>
                  <p className="text-lg font-semibold">{selectedPlot.plot_number}</p>
                </div>
                {selectedPlot.location && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600">Lokacija</p>
                    <p className="text-lg font-semibold">{selectedPlot.location}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Ukupna površina</p>
                  <p className="text-lg font-semibold">{selectedPlot.total_area_m2.toLocaleString()} m²</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Kupljena površina</p>
                  <p className="text-lg font-semibold">{selectedPlot.purchased_area_m2.toLocaleString()} m²</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cijena po m²</p>
                  <p className="text-lg font-semibold">€{selectedPlot.price_per_m2.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Ukupna cijena</p>
                  <p className="text-lg font-semibold text-green-600">€{selectedPlot.total_price.toLocaleString()}</p>
                </div>
              </div>

              {selectedPlot.notes && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Napomene</p>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">{selectedPlot.notes}</p>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold mb-3">Prodaje ({selectedPlot.sales?.length || 0})</h3>
                {selectedPlot.sales && selectedPlot.sales.length > 0 ? (
                  <div className="space-y-2">
                    {selectedPlot.sales.map((sale) => (
                      <div key={sale.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{(sale.customer as any)?.name || 'N/A'}</p>
                            <p className="text-sm text-gray-600">{sale.sale_area_m2} m² × €{sale.sale_price_per_m2} = €{sale.total_sale_price.toLocaleString()}</p>
                          </div>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            sale.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                            sale.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                            sale.payment_status === 'overdue' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {sale.payment_status === 'paid' ? 'Plaćeno' :
                             sale.payment_status === 'partial' ? 'Djelomično' :
                             sale.payment_status === 'overdue' ? 'Kašnjenje' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Nema prodaja za ovu česticu</p>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end flex-shrink-0">
              <button
                onClick={handleCloseDetailsModal}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RetailLandPlots
