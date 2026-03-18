import React from 'react'
import { Users, Plus, Edit, Trash2, Eye, Phone, Mail } from 'lucide-react'
import { LoadingSpinner, PageHeader, StatGrid, SearchInput, Button, Modal, FormField, Input, Textarea, Badge, EmptyState, StatCard, Form, ConfirmDialog } from '../../ui'
import { useRetailCustomers } from './hooks/useRetailCustomers'

const RetailCustomers: React.FC = () => {
  const {
    loading,
    searchTerm,
    setSearchTerm,
    filteredCustomers,
    totalStats,
    showFormModal,
    showDetailsModal,
    selectedCustomer,
    editingCustomerId,
    formData,
    setFormData,
    openFormModal,
    closeFormModal,
    handleSubmit,
    fieldErrors,
    handleDelete,
    confirmDelete,
    cancelDelete,
    pendingDeleteId,
    deleting,
    handleViewDetails,
    closeDetailsModal,
  } = useRetailCustomers()

  if (loading) {
    return <LoadingSpinner message="Učitavanje..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kupci"
        description="Upravljanje kupcima zemljišta"
        actions={
          <Button icon={Plus} onClick={() => openFormModal()}>
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
                  <span className="font-medium text-gray-900">{customer.total_purchased_area.toLocaleString()} m²</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="text-gray-600">Ukupno:</span>
                  <span className="font-bold text-gray-900">€{customer.total_spent.toLocaleString('hr-HR')}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Plaćeno:</span>
                  <span className="font-medium text-green-600">€{customer.total_paid.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Preostalo:</span>
                  <span className="font-medium text-orange-600">€{customer.total_remaining.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-3 border-t border-gray-200">
                <Button icon={Eye} size="sm" onClick={() => handleViewDetails(customer)} className="flex-1">
                  Detalji
                </Button>
                <Button icon={Edit} variant="ghost" size="icon-md" onClick={() => openFormModal(customer)} title="Uredi" />
                <Button icon={Trash2} variant="outline-danger" size="icon-md" onClick={() => handleDelete(customer.id)} title="Obriši" />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal show={showFormModal} onClose={closeFormModal}>
        <Modal.Header title={editingCustomerId ? 'Uredi kupca' : 'Novi kupac'} onClose={closeFormModal} />
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <FormField label="Naziv / Ime i prezime" required error={fieldErrors.name}>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
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
            <Button variant="secondary" type="button" onClick={closeFormModal}>Odustani</Button>
            <Button type="submit">{editingCustomerId ? 'Spremi' : 'Dodaj'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showDetailsModal && !!selectedCustomer} onClose={closeDetailsModal} size="xl">
        <Modal.Header title={`Detalji kupca - ${selectedCustomer?.name || ''}`} onClose={closeDetailsModal} />
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
                    {selectedCustomer.sales.map((sale) => (
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
                              Plaćeno: €{sale.paid_amount.toLocaleString()} |
                              Preostalo: €{sale.remaining_amount.toLocaleString()}
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
              <Button variant="secondary" onClick={closeDetailsModal}>Zatvori</Button>
            </Modal.Footer>
          </>
        )}
      </Modal>

      <ConfirmDialog
        show={!!pendingDeleteId}
        title="Potvrda brisanja"
        message="Jeste li sigurni da želite obrisati ovog kupca?"
        confirmLabel="Da, obriši"
        cancelLabel="Odustani"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        loading={deleting}
      />
    </div>
  )
}

export default RetailCustomers
