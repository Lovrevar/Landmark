import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Users, Plus, Edit, Trash2, Eye, Phone, Mail } from 'lucide-react'
import type { RetailCustomer, RetailSale } from '../../types/retail'
import { LoadingSpinner, PageHeader, StatGrid, SearchInput, Button, Modal, FormField, Input, Textarea, Badge, EmptyState, StatCard } from '../ui'

interface CustomerWithSales extends RetailCustomer {
  sales?: RetailSale[]
  total_purchased_area?: number
  total_spent?: number
  total_paid?: number
  total_remaining?: number
}

const RetailCustomers: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerWithSales[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showFormModal, setShowFormModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithSales | null>(null)
  const [editingCustomer, setEditingCustomer] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    contact_phone: '',
    contact_email: '',
    oib: '',
    address: ''
  })

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('retail_customers')
        .select('*')
        .order('name')

      if (error) throw error

      const customersWithStats = await Promise.all(
        (data || []).map(async (customer) => {
          const { data: contracts } = await supabase
            .from('retail_contracts')
            .select('id, contract_amount, budget_realized, total_surface_m2, building_surface_m2')
            .eq('customer_id', customer.id)

          const total_purchased_area = contracts?.reduce((sum, c) => sum + (c.total_surface_m2 || c.building_surface_m2 || 0), 0) || 0
          const total_spent = contracts?.reduce((sum, c) => sum + (c.contract_amount || 0), 0) || 0

          const contractIds = contracts?.map(c => c.id) || []
          let total_paid = 0

          if (contractIds.length > 0) {
            const { data: invoices } = await supabase
              .from('accounting_invoices')
              .select('paid_amount')
              .in('retail_contract_id', contractIds)

            total_paid = invoices?.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0) || 0
          }

          const total_remaining = total_spent - total_paid

          return {
            ...customer,
            total_purchased_area,
            total_spent,
            total_paid,
            total_remaining
          }
        })
      )

      setCustomers(customersWithStats)
    } catch (error) {
      console.error('Error fetching customers:', error)
      alert('Greška pri učitavanju kupaca')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenFormModal = (customer?: CustomerWithSales) => {
    if (customer) {
      setEditingCustomer(customer.id)
      setFormData({
        name: customer.name,
        contact_phone: customer.contact_phone || '',
        contact_email: customer.contact_email || '',
        oib: customer.oib || '',
        address: customer.address || ''
      })
    } else {
      setEditingCustomer(null)
      setFormData({
        name: '',
        contact_phone: '',
        contact_email: '',
        oib: '',
        address: ''
      })
    }
    document.body.style.overflow = 'hidden'
    setShowFormModal(true)
  }

  const handleCloseFormModal = () => {
    document.body.style.overflow = 'unset'
    setShowFormModal(false)
    setEditingCustomer(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const payload = {
        name: formData.name,
        contact_phone: formData.contact_phone || null,
        contact_email: formData.contact_email || null,
        oib: formData.oib || null,
        address: formData.address || null
      }

      if (editingCustomer) {
        const { error } = await supabase
          .from('retail_customers')
          .update(payload)
          .eq('id', editingCustomer)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('retail_customers')
          .insert([payload])

        if (error) throw error
      }

      await fetchCustomers()
      handleCloseFormModal()
    } catch (error) {
      console.error('Error saving customer:', error)
      alert('Greška pri spremanju kupca')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Jeste li sigurni da želite obrisati ovog kupca?')) return

    try {
      const { error } = await supabase
        .from('retail_customers')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchCustomers()
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('Greška pri brisanju kupca. Provjerite ima li kupac povezane prodaje.')
    }
  }

  const handleViewDetails = async (customer: CustomerWithSales) => {
    try {
      const { data: contracts, error } = await supabase
        .from('retail_contracts')
        .select(`
          id,
          contract_number,
          contract_amount,
          budget_realized,
          total_surface_m2,
          building_surface_m2,
          price_per_m2,
          status,
          phase:retail_project_phases!inner(
            phase_name,
            project:retail_projects(name, plot_number)
          )
        `)
        .eq('customer_id', customer.id)

      if (error) throw error

      const contractsWithPayments = await Promise.all(
        (contracts || []).map(async (contract) => {
          const { data: invoices } = await supabase
            .from('accounting_invoices')
            .select('paid_amount, remaining_amount, status')
            .eq('retail_contract_id', contract.id)

          const paid_amount = invoices?.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0) || 0
          const remaining_amount = (contract.contract_amount || 0) - paid_amount

          return {
            ...contract,
            paid_amount,
            remaining_amount,
            payment_status: remaining_amount === 0 ? 'paid' : paid_amount > 0 ? 'partial' : 'pending'
          }
        })
      )

      setSelectedCustomer({
        ...customer,
        sales: contractsWithPayments as any
      })
      document.body.style.overflow = 'hidden'
      setShowDetailsModal(true)
    } catch (error) {
      console.error('Error loading customer details:', error)
      alert('Greška pri učitavanju detalja')
    }
  }

  const handleCloseDetailsModal = () => {
    document.body.style.overflow = 'unset'
    setShowDetailsModal(false)
    setSelectedCustomer(null)
  }

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.oib && customer.oib.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.contact_phone && customer.contact_phone.includes(searchTerm))
  )

  const totalStats = {
    total_customers: customers.length,
    total_area: customers.reduce((sum, c) => sum + (c.total_purchased_area || 0), 0),
    total_revenue: customers.reduce((sum, c) => sum + (c.total_spent || 0), 0),
    total_remaining: customers.reduce((sum, c) => sum + (c.total_remaining || 0), 0)
  }

  if (loading) {
    return <LoadingSpinner message="Učitavanje..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kupci"
        description="Upravljanje kupcima zemljišta"
        actions={
          <Button icon={Plus} onClick={() => handleOpenFormModal()}>
            Novi kupac
          </Button>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Ukupno kupaca" value={totalStats.total_customers} icon={Users} color="blue" />
        <StatCard label="Ukupna površina" value={`${totalStats.total_area.toLocaleString()} m²`} icon={Users} color="green" />
        <StatCard label="Ukupni prihod" value={`€${totalStats.total_revenue.toLocaleString('hr-HR')}`} icon={Users} color="green" />
        <StatCard label="Preostalo" value={`€${totalStats.total_remaining.toLocaleString('hr-HR')}`} icon={Users} />
      </StatGrid>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder="Pretraži po imenu, OIB-u ili telefonu..."
        />
      </div>

      {filteredCustomers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={searchTerm ? 'Nema rezultata pretrage' : 'Nema kupaca'}
          description={searchTerm ? 'Pokušajte s drugim pojmom' : 'Dodajte prvog kupca klikom na gumb iznad'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{customer.name}</h3>
                  {customer.contact_phone && (
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <Phone className="w-3 h-3 mr-1" />
                      {customer.contact_phone}
                    </div>
                  )}
                  {customer.contact_email && (
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <Mail className="w-3 h-3 mr-1" />
                      {customer.contact_email}
                    </div>
                  )}
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Površina:</span>
                  <span className="font-medium text-gray-900">{customer.total_purchased_area?.toLocaleString() || 0} m²</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="text-gray-600">Ukupno:</span>
                  <span className="font-bold text-gray-900">€{customer.total_spent?.toLocaleString('hr-HR') || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Plaćeno:</span>
                  <span className="font-medium text-green-600">€{customer.total_paid?.toLocaleString() || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Preostalo:</span>
                  <span className="font-medium text-orange-600">€{customer.total_remaining?.toLocaleString() || 0}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-3 border-t border-gray-200">
                <Button icon={Eye} size="sm" onClick={() => handleViewDetails(customer)} className="flex-1">
                  Detalji
                </Button>
                <Button icon={Edit} variant="ghost" size="icon-md" onClick={() => handleOpenFormModal(customer)} title="Uredi" />
                <Button icon={Trash2} variant="outline-danger" size="icon-md" onClick={() => handleDelete(customer.id)} title="Obriši" />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal show={showFormModal} onClose={handleCloseFormModal}>
        <Modal.Header title={editingCustomer ? 'Uredi kupca' : 'Novi kupac'} onClose={handleCloseFormModal} />
        <form onSubmit={handleSubmit}>
          <Modal.Body>
            <FormField label="Naziv / Ime i prezime *">
              <Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </FormField>
            <FormField label="Telefon">
              <Input value={formData.contact_phone} onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })} />
            </FormField>
            <FormField label="Email">
              <Input type="email" value={formData.contact_email} onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })} />
            </FormField>
            <FormField label="OIB">
              <Input value={formData.oib} onChange={(e) => setFormData({ ...formData, oib: e.target.value })} />
            </FormField>
            <FormField label="Adresa">
              <Textarea rows={3} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </FormField>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={handleCloseFormModal}>Odustani</Button>
            <Button type="submit">{editingCustomer ? 'Spremi' : 'Dodaj'}</Button>
          </Modal.Footer>
        </form>
      </Modal>

      <Modal show={showDetailsModal && !!selectedCustomer} onClose={handleCloseDetailsModal} size="xl">
        <Modal.Header title={`Detalji kupca - ${selectedCustomer?.name || ''}`} onClose={handleCloseDetailsModal} />
        {selectedCustomer && (
          <>
            <Modal.Body>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Naziv</p>
                  <p className="text-lg font-semibold">{selectedCustomer.name}</p>
                </div>
                {selectedCustomer.contact_phone && (
                  <div>
                    <p className="text-sm text-gray-600">Telefon</p>
                    <p className="text-lg font-semibold">{selectedCustomer.contact_phone}</p>
                  </div>
                )}
                {selectedCustomer.contact_email && (
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="text-lg font-semibold">{selectedCustomer.contact_email}</p>
                  </div>
                )}
                {selectedCustomer.oib && (
                  <div>
                    <p className="text-sm text-gray-600">OIB</p>
                    <p className="text-lg font-semibold">{selectedCustomer.oib}</p>
                  </div>
                )}
              </div>

              {selectedCustomer.address && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Adresa</p>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">{selectedCustomer.address}</p>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold mb-3">Prodaje ({selectedCustomer.sales?.length || 0})</h3>
                {selectedCustomer.sales && selectedCustomer.sales.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCustomer.sales.map((sale: any) => (
                      <div key={sale.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">
                              {sale.phase?.project?.name || 'N/A'} - {sale.phase?.phase_name || ''}
                            </p>
                            <p className="text-sm text-gray-600">Ugovor: {sale.contract_number}</p>
                            <p className="text-sm text-gray-600">
                              {(sale.total_surface_m2 || sale.building_surface_m2 || 0).toLocaleString()} m²
                              {sale.price_per_m2 && ` × €${sale.price_per_m2.toLocaleString()}`}
                              {' = €'}{(sale.contract_amount || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Plaćeno: €{(sale.paid_amount || 0).toLocaleString()} |
                              Preostalo: €{(sale.remaining_amount || 0).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant={
                            sale.payment_status === 'paid' ? 'green'
                              : sale.payment_status === 'partial' ? 'yellow'
                              : 'gray'
                          }>
                            {sale.payment_status === 'paid' ? 'Plaćeno' :
                             sale.payment_status === 'partial' ? 'Djelomično' :
                             'Pending'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Nema prodaja za ovog kupca</p>
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

export default RetailCustomers
