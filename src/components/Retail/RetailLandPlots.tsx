import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { MapPin, Plus, Edit, Trash2, Eye, Calendar, Link } from 'lucide-react'
import type { RetailLandPlot, RetailSale } from '../../types/retail'
import { LoadingSpinner, PageHeader, StatGrid, SearchInput, Button, Modal, FormField, Input, Select, Textarea, Badge, EmptyState, StatCard, Table } from '../ui'

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

      const { data: plots, error: plotsError } = await supabase
        .from('retail_land_plots')
        .select('*')
        .order('created_at', { ascending: false })

      if (plotsError) throw plotsError

      const { data: projects, error: projectsError } = await supabase
        .from('retail_projects')
        .select('id, land_plot_id, name')
        .not('land_plot_id', 'is', null)

      if (projectsError) throw projectsError

      const plotsWithProjects = (plots || []).map(plot => {
        const connectedProject = projects?.find(p => p.land_plot_id === plot.id)
        return {
          ...plot,
          connectedProject: connectedProject || null
        }
      })

      setLandPlots(plotsWithProjects as any)
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
    return <LoadingSpinner message="Učitavanje..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Zemljišta"
        description="Upravljanje zemljištima i česticama"
        actions={
          <Button icon={Plus} onClick={() => handleOpenFormModal()}>
            Novo zemljište
          </Button>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Ukupno čestica" value={totalStats.total_plots} icon={MapPin} color="blue" />
        <StatCard label="Ukupna površina" value={`${totalStats.total_area.toLocaleString()} m²`} icon={MapPin} color="green" />
        <StatCard label="Ukupno investirano" value={`€${totalStats.total_invested.toLocaleString()}`} icon={Calendar} />
        <StatCard label="Plaćeno" value={`${totalStats.paid_count}/${totalStats.total_plots}`} icon={Calendar} color="green" />
      </StatGrid>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder="Pretraži po vlasniku, broju čestice ili lokaciji..."
        />
      </div>

      {filteredPlots.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={searchTerm ? 'Nema rezultata pretrage' : 'Nema zemljišta'}
          description={searchTerm ? 'Pokušajte s drugim pojmom' : 'Dodajte prvo zemljište klikom na gumb iznad'}
        />
      ) : (
        <Table>
          <Table.Head>
            <Table.Tr>
              <Table.Th>Vlasnik</Table.Th>
              <Table.Th>Čestica</Table.Th>
              <Table.Th>Lokacija</Table.Th>
              <Table.Th>Površina</Table.Th>
              <Table.Th>Cijena/m²</Table.Th>
              <Table.Th>Ukupno</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th className="text-right">Akcije</Table.Th>
            </Table.Tr>
          </Table.Head>
          <Table.Body>
            {filteredPlots.map((plot) => (
              <Table.Tr key={plot.id}>
                <Table.Td className="font-medium text-gray-900">
                  {plot.owner_first_name} {plot.owner_last_name}
                </Table.Td>
                <Table.Td>{plot.plot_number}</Table.Td>
                <Table.Td>{plot.location || '-'}</Table.Td>
                <Table.Td>
                  <div>{plot.purchased_area_m2.toLocaleString()} m²</div>
                  {plot.purchased_area_m2 < plot.total_area_m2 && (
                    <div className="text-xs text-gray-500">od {plot.total_area_m2.toLocaleString()} m²</div>
                  )}
                </Table.Td>
                <Table.Td>€{plot.price_per_m2.toLocaleString()}</Table.Td>
                <Table.Td className="font-semibold">€{plot.total_price.toLocaleString()}</Table.Td>
                <Table.Td>
                  <div className="space-y-1">
                    <Badge variant={plot.payment_status === 'paid' ? 'green' : plot.payment_status === 'partial' ? 'yellow' : 'gray'}>
                      {plot.payment_status === 'paid' ? 'Plaćeno' : plot.payment_status === 'partial' ? 'Djelomično' : 'Pending'}
                    </Badge>
                    {(plot as any).connectedProject && (
                      <Badge variant="green" className="flex items-center">
                        <Link className="w-3 h-3 mr-1" />
                        U projektu
                      </Badge>
                    )}
                  </div>
                </Table.Td>
                <Table.Td className="text-right">
                  <div className="flex items-center justify-end space-x-1">
                    <Button icon={Eye} variant="ghost" size="icon-sm" onClick={() => handleViewDetails(plot)} title="Detalji" />
                    <Button icon={Edit} variant="ghost" size="icon-sm" onClick={() => handleOpenFormModal(plot)} title="Uredi" />
                    <Button icon={Trash2} variant="outline-danger" size="icon-sm" onClick={() => handleDelete(plot.id)} title="Obriši" />
                  </div>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Body>
        </Table>
      )}

      <Modal show={showFormModal} onClose={handleCloseFormModal}>
        <Modal.Header title={editingPlot ? 'Uredi zemljište' : 'Novo zemljište'} onClose={handleCloseFormModal} />
        <form onSubmit={handleSubmit}>
          <Modal.Body>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Ime vlasnika *">
                <Input required value={formData.owner_first_name} onChange={(e) => setFormData({ ...formData, owner_first_name: e.target.value })} />
              </FormField>
              <FormField label="Prezime vlasnika *">
                <Input required value={formData.owner_last_name} onChange={(e) => setFormData({ ...formData, owner_last_name: e.target.value })} />
              </FormField>
              <FormField label="Broj čestice *">
                <Input required value={formData.plot_number} onChange={(e) => setFormData({ ...formData, plot_number: e.target.value })} />
              </FormField>
              <FormField label="Lokacija">
                <Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="Npr. Banja Luka, Kozarska Dubica..." />
              </FormField>
              <FormField label="Ukupna površina (m²) *">
                <Input type="number" step="0.01" required value={formData.total_area_m2} onChange={(e) => setFormData({ ...formData, total_area_m2: e.target.value })} />
              </FormField>
              <FormField label="Kupljena površina (m²) *">
                <Input type="number" step="0.01" required value={formData.purchased_area_m2} onChange={(e) => setFormData({ ...formData, purchased_area_m2: e.target.value })} />
              </FormField>
              <FormField label="Cijena po m² (€) *">
                <Input type="number" step="0.01" required value={formData.price_per_m2} onChange={(e) => setFormData({ ...formData, price_per_m2: e.target.value })} />
              </FormField>
              <FormField label="Datum plaćanja">
                <Input type="date" value={formData.payment_date} onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })} />
              </FormField>
              <FormField label="Status plaćanja *">
                <Select value={formData.payment_status} onChange={(e) => setFormData({ ...formData, payment_status: e.target.value as any })}>
                  <option value="pending">Pending</option>
                  <option value="partial">Djelomično</option>
                  <option value="paid">Plaćeno</option>
                </Select>
              </FormField>
              <div className="col-span-2">
                <FormField label="Napomene">
                  <Textarea rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                </FormField>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={handleCloseFormModal}>Odustani</Button>
            <Button type="submit">{editingPlot ? 'Spremi' : 'Dodaj'}</Button>
          </Modal.Footer>
        </form>
      </Modal>

      <Modal show={showDetailsModal && !!selectedPlot} onClose={handleCloseDetailsModal} size="xl">
        <Modal.Header title={`Detalji zemljišta - ${selectedPlot?.plot_number || ''}`} onClose={handleCloseDetailsModal} />
        {selectedPlot && (
          <>
            <Modal.Body>
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
                            <p className="text-sm text-gray-600">{sale.sale_area_m2} m² x €{sale.sale_price_per_m2} = €{sale.total_sale_price.toLocaleString()}</p>
                          </div>
                          <Badge variant={
                            sale.payment_status === 'paid' ? 'green'
                              : sale.payment_status === 'partial' ? 'yellow'
                              : sale.payment_status === 'overdue' ? 'red'
                              : 'gray'
                          }>
                            {sale.payment_status === 'paid' ? 'Plaćeno' :
                             sale.payment_status === 'partial' ? 'Djelomično' :
                             sale.payment_status === 'overdue' ? 'Kašnjenje' : 'Pending'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Nema prodaja za ovu česticu</p>
                )}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={handleCloseDetailsModal}>Zatvori</Button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    </div>
  )
}

export default RetailLandPlots
