import React from 'react'
import { Building2, Plus, Edit, Trash2, Mail, Phone, MapPin, FileText, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { useOfficeSuppliers } from './hooks/useOfficeSuppliers'
import OfficeSupplierFormModal from './forms/OfficeSupplierFormModal'
import { PageHeader, StatGrid, LoadingSpinner, SearchInput, Button, StatCard, EmptyState, Modal, Table, Badge } from '../ui'

const OfficeSuppliers: React.FC = () => {
  const {
    suppliers,
    loading,
    searchTerm,
    setSearchTerm,
    showModal,
    editingSupplier,
    showInvoicesModal,
    selectedSupplier,
    supplierInvoices,
    loadingInvoices,
    formData,
    setFormData,
    filteredSuppliers,
    handleOpenModal,
    handleCloseModal,
    handleSubmit,
    handleDelete,
    handleViewInvoices,
    handleCloseInvoicesModal
  } = useOfficeSuppliers()

  if (loading) {
    return <LoadingSpinner message="Učitavanje..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Office Dobavljači"
        description="Upravljanje dobavljačima za uredske troškove"
        actions={
          <Button
            onClick={() => handleOpenModal()}
            icon={Plus}
          >
            Novi dobavljač
          </Button>
        }
      />

      <StatGrid columns={4}>
        <StatCard
          label="Ukupno dobavljača"
          value={suppliers.length}
          icon={Building2}
          color="white"
        />

        <StatCard
          label="Ukupno računa"
          value={suppliers.reduce((sum, s) => sum + s.total_invoices, 0)}
          icon={FileText}
          color="gray"
        />

        <StatCard
          label="Ukupno plaćeno (bez PDV)"
          value={`€${suppliers.reduce((sum, s) => sum + s.paid_amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={Building2}
          color="green"
        />

        <StatCard
          label="Preostalo (bez PDV)"
          value={`€${suppliers.reduce((sum, s) => sum + s.remaining_amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={Building2}
          color="yellow"
        />
      </StatGrid>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder="Pretraži dobavljače..."
        />
      </div>

      {filteredSuppliers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <EmptyState
            icon={Building2}
            title={searchTerm ? 'Nema rezultata pretrage' : 'Nema office dobavljača'}
            description={searchTerm ? 'Pokušajte s drugim pojmom' : 'Dodajte prvog office dobavljača klikom na gumb iznad'}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer"
              onClick={() => handleViewInvoices(supplier)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{supplier.name}</h3>
                  {supplier.contact && (
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <Phone className="w-3 h-3 mr-1" />
                      {supplier.contact}
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <Mail className="w-3 h-3 mr-1" />
                      {supplier.email}
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <MapPin className="w-3 h-3 mr-1" />
                      {supplier.address}
                    </div>
                  )}
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {supplier.tax_id && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">OIB:</span>
                    <span className="font-medium text-gray-900">{supplier.tax_id}</span>
                  </div>
                )}
                {supplier.vat_id && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">PDV ID:</span>
                    <span className="font-medium text-gray-900">{supplier.vat_id}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="text-gray-600">Računi:</span>
                  <span className="font-medium text-gray-900">{supplier.total_invoices}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Ukupno (bez PDV):</span>
                  <span className="font-bold text-gray-900">€{supplier.total_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Plaćeno:</span>
                  <span className="font-medium text-green-600">€{supplier.paid_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Preostalo:</span>
                  <span className="font-medium text-orange-600">€{supplier.remaining_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenModal(supplier)
                  }}
                  icon={Edit}
                  size="sm"
                  fullWidth
                >
                  Uredi
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(supplier.id)
                  }}
                  variant="outline-danger"
                  size="icon-md"
                  icon={Trash2}
                  title="Obriši"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <OfficeSupplierFormModal
        showModal={showModal}
        editingSupplier={editingSupplier}
        formData={formData}
        setFormData={setFormData}
        handleCloseModal={handleCloseModal}
        handleSubmit={handleSubmit}
      />

      <Modal show={showInvoicesModal && !!selectedSupplier} onClose={handleCloseInvoicesModal} size="full">
        {selectedSupplier && (
          <>
            <Modal.Header
              title={`Računi - ${selectedSupplier.name}`}
              subtitle={`Ukupno: ${supplierInvoices.length} računa | Plaćeno: €${selectedSupplier.paid_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Preostalo: €${selectedSupplier.remaining_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              onClose={handleCloseInvoicesModal}
            />

            <Modal.Body noPadding={false}>
              {loadingInvoices ? (
                <LoadingSpinner message="Učitavanje računa..." />
              ) : supplierInvoices.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="Nema računa"
                  description="Ovaj dobavljač nema unesenih računa."
                />
              ) : (
                <Table>
                  <Table.Head>
                    <Table.Tr hoverable={false}>
                      <Table.Th>Broj računa</Table.Th>
                      <Table.Th>Datum izdavanja</Table.Th>
                      <Table.Th>Datum dospijeća</Table.Th>
                      <Table.Th>Opis</Table.Th>
                      <Table.Th className="text-right">Osnovica</Table.Th>
                      <Table.Th className="text-right">Ukupno (s PDV)</Table.Th>
                      <Table.Th className="text-right">Plaćeno</Table.Th>
                      <Table.Th className="text-right">Preostalo</Table.Th>
                      <Table.Th className="text-center">Status</Table.Th>
                    </Table.Tr>
                  </Table.Head>
                  <Table.Body>
                    {supplierInvoices.map((invoice) => (
                      <Table.Tr key={invoice.id}>
                        <Table.Td className="font-medium">
                          {invoice.invoice_number}
                        </Table.Td>
                        <Table.Td className="text-gray-600">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                            {format(new Date(invoice.issue_date), 'dd.MM.yyyy')}
                          </div>
                        </Table.Td>
                        <Table.Td className="text-gray-600">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                            {format(new Date(invoice.due_date), 'dd.MM.yyyy')}
                          </div>
                        </Table.Td>
                        <Table.Td className="text-gray-600 max-w-xs truncate">
                          {invoice.description || '-'}
                        </Table.Td>
                        <Table.Td className="text-right">
                          €{parseFloat(invoice.base_amount).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Table.Td>
                        <Table.Td className="text-right font-medium">
                          €{parseFloat(invoice.total_amount).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Table.Td>
                        <Table.Td className="text-right text-green-600">
                          €{parseFloat(invoice.paid_amount).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Table.Td>
                        <Table.Td className="text-right text-orange-600">
                          €{parseFloat(invoice.remaining_amount).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Table.Td>
                        <Table.Td className="text-center">
                          <Badge
                            variant={
                              invoice.status === 'PAID'
                                ? 'green'
                                : invoice.status === 'PARTIALLY_PAID'
                                ? 'yellow'
                                : 'red'
                            }
                            size="sm"
                          >
                            {invoice.status === 'PAID' ? 'Plaćeno' : invoice.status === 'PARTIALLY_PAID' ? 'Djelomično' : 'Neplaćeno'}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Modal.Body>

            <Modal.Footer sticky>
              <Button
                onClick={handleCloseInvoicesModal}
                variant="ghost"
              >
                Zatvori
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    </div>
  )
}

export default OfficeSuppliers
