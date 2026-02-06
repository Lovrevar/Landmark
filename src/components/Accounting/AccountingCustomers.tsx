import React from 'react'
import { Users, DollarSign, TrendingUp, TrendingDown, FileText, Eye, X, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { useAccountingCustomers } from './hooks/useAccountingCustomers'
import { PageHeader, StatGrid, LoadingSpinner, SearchInput, StatCard, EmptyState, Button, Badge, Modal } from '../ui'

const AccountingCustomers: React.FC = () => {
  const {
    loading,
    searchTerm,
    setSearchTerm,
    showDetailsModal,
    selectedCustomer,
    isIncomeInvoice,
    handleOpenDetails,
    handleCloseDetails,
    filteredCustomers,
    totalStats
  } = useAccountingCustomers()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kupci"
        description="Pregled svih kupaca i njihovih računa"
      />

      <StatGrid columns={4}>
        <StatCard label="Ukupno računa" value={totalStats.total_invoices} icon={FileText} size="lg" />
        <StatCard label="Vrijednost nekretnina" value={`€${totalStats.total_property_value.toLocaleString('hr-HR')}`} icon={DollarSign} color="gray" size="lg" />
        <StatCard label="Plaćeno" value={`€${totalStats.total_paid.toLocaleString('hr-HR')}`} icon={TrendingUp} color="green" size="lg" />
        <StatCard label="Dužno" value={`€${totalStats.total_debt.toLocaleString('hr-HR')}`} icon={TrendingDown} color="red" size="lg" />
      </StatGrid>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm('')}
            placeholder="Pretraži kupce..."
          />
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <LoadingSpinner size="sm" message="Učitavanje..." />
          ) : filteredCustomers.length === 0 ? (
            <EmptyState icon={Users} title="Nema kupaca" />
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kupac
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kontakt
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Računi
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Apartmani
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cijena nekretnine
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plaćeno
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dužno
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Akcije
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{customer.full_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{customer.email || '-'}</div>
                      <div className="text-sm text-gray-500">{customer.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-gray-900">{customer.total_invoices}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-blue-600">{customer.total_apartments}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-gray-900">€{customer.property_price.toLocaleString('hr-HR')}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-green-600">€{customer.total_paid.toLocaleString('hr-HR')}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-red-600">€{(customer.property_price - customer.total_paid).toLocaleString('hr-HR')}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button variant="ghost" size="sm" icon={Eye} onClick={() => handleOpenDetails(customer)} className="text-blue-600 hover:text-blue-900">
                        Detalji
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showDetailsModal && selectedCustomer && (
        <Modal show={showDetailsModal} onClose={handleCloseDetails} size="xl">
          <Modal.Header title={selectedCustomer.full_name} subtitle="Detalji kupca i računi" onClose={handleCloseDetails} />
          <Modal.Body>
            <StatGrid columns={5}>
              <StatCard label="Ukupno računa" value={selectedCustomer.total_invoices} color="blue" size="sm" />
              <StatCard label="Apartmani" value={selectedCustomer.total_apartments} color="blue" size="sm" />
              <StatCard label="Cijena nekretnine" value={`€${selectedCustomer.property_price.toLocaleString('hr-HR')}`} color="gray" size="sm" />
              <StatCard label="Plaćeno" value={`€${selectedCustomer.total_paid.toLocaleString('hr-HR')}`} color="green" size="sm" />
              <StatCard label="Dužno" value={`€${(selectedCustomer.property_price - selectedCustomer.total_paid).toLocaleString('hr-HR')}`} color="red" size="sm" />
            </StatGrid>

            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Kontakt informacije</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="text-gray-900 font-medium">{selectedCustomer.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Telefon:</span>
                  <span className="text-gray-900 font-medium">{selectedCustomer.phone || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Računi</h3>
              {selectedCustomer.invoices.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nema računa</p>
              ) : (
                <div className="space-y-3">
                  {selectedCustomer.invoices.map((invoice) => (
                    <div key={invoice.id} className={`border-2 rounded-lg p-4 ${
                      isIncomeInvoice(invoice.invoice_type) ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            {isIncomeInvoice(invoice.invoice_type) ? (
                              <ArrowUpCircle className="w-5 h-5 text-green-600" />
                            ) : (
                              <ArrowDownCircle className="w-5 h-5 text-red-600" />
                            )}
                            <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                            <Badge variant={isIncomeInvoice(invoice.invoice_type) ? 'green' : 'red'} size="sm">
                              {isIncomeInvoice(invoice.invoice_type) ? 'PRIHOD' : 'RASHOD'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Firma: {invoice.company?.name || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500">{new Date(invoice.issue_date).toLocaleDateString('hr-HR')}</p>
                        </div>
                        <Badge
                          variant={invoice.status === 'PAID' ? 'green' : invoice.status === 'PARTIALLY_PAID' ? 'yellow' : 'gray'}
                          size="sm"
                        >
                          {invoice.status === 'PAID' ? 'Plaćeno' : invoice.status === 'PARTIALLY_PAID' ? 'Djelomično' : 'Neplaćeno'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-300">
                        <div>
                          <p className="text-xs text-gray-600">Ukupno</p>
                          <p className="font-semibold text-gray-900">€{invoice.total_amount.toLocaleString('hr-HR')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Plaćeno</p>
                          <p className="font-semibold text-green-600">€{invoice.paid_amount.toLocaleString('hr-HR')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Preostalo</p>
                          <p className="font-semibold text-red-600">€{invoice.remaining_amount.toLocaleString('hr-HR')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseDetails}>Zatvori</Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  )
}

export default AccountingCustomers
