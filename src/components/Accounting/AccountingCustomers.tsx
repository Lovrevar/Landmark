import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Users, Search, DollarSign, TrendingUp, TrendingDown, FileText, Eye, X, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

interface Customer {
  id: string
  name: string
  surname: string
  email: string | null
  phone: string | null
  created_at: string
}

interface Invoice {
  id: string
  invoice_number: string
  invoice_type: 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES'
  total_amount: number
  paid_amount: number
  remaining_amount: number
  status: string
  issue_date: string
  company?: { name: string }
}

interface Property {
  apartment_price: number
  garage_price: number | null
  repository_price: number | null
  total_property_price: number
}

interface CustomerStats {
  id: string
  name: string
  surname: string
  full_name: string
  email: string | null
  phone: string | null
  total_invoices: number
  total_amount: number
  total_paid: number
  total_unpaid: number
  property_price: number
  total_apartments: number
  invoices: Invoice[]
}

const AccountingCustomers: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerStats | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('name')

      if (customersError) throw customersError

      const customersWithStats = await Promise.all(
        (customersData || []).map(async (customer) => {
          const { data: invoicesData } = await supabase
            .from('accounting_invoices')
            .select(`
              id,
              invoice_number,
              invoice_type,
              total_amount,
              paid_amount,
              remaining_amount,
              status,
              issue_date,
              company:company_id (name)
            `)
            .eq('customer_id', customer.id)
            .order('issue_date', { ascending: false })

          const invoices = invoicesData || []

          const totalAmount = invoices.reduce((sum, i) => sum + i.total_amount, 0)
          const totalPaid = invoices.reduce((sum, i) => sum + i.paid_amount, 0)
          const totalUnpaid = invoices.reduce((sum, i) => sum + i.remaining_amount, 0)

          const { data: propertyData } = await supabase
            .from('sales')
            .select(`
              apartment_id,
              apartments!inner (
                price,
                garage_id,
                repository_id,
                garages (price),
                repositories (price)
              )
            `)
            .eq('customer_id', customer.id)

          let propertyPrice = 0
          let totalApartments = 0
          if (propertyData && propertyData.length > 0) {
            totalApartments = propertyData.length
            propertyData.forEach((sale) => {
              if (sale.apartments) {
                const apt = sale.apartments
                propertyPrice += Number(apt.price || 0)
                if (apt.garages) {
                  propertyPrice += Number(apt.garages.price || 0)
                }
                if (apt.repositories) {
                  propertyPrice += Number(apt.repositories.price || 0)
                }
              }
            })
          }

          return {
            id: customer.id,
            name: customer.name,
            surname: customer.surname,
            full_name: `${customer.name} ${customer.surname}`.trim(),
            email: customer.email,
            phone: customer.phone,
            total_invoices: invoices.length,
            total_amount: totalAmount,
            total_paid: totalPaid,
            total_unpaid: totalUnpaid,
            property_price: propertyPrice,
            total_apartments: totalApartments,
            invoices: invoices
          }
        })
      )

      setCustomers(customersWithStats)
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const isIncomeInvoice = (invoiceType: string) => {
    return invoiceType === 'INCOMING_INVESTMENT' || invoiceType === 'OUTGOING_SALES'
  }

  const handleOpenDetails = (customer: CustomerStats) => {
    setSelectedCustomer(customer)
    document.body.style.overflow = 'hidden'
    setShowDetailsModal(true)
  }

  const handleCloseDetails = () => {
    document.body.style.overflow = 'unset'
    setShowDetailsModal(false)
    setSelectedCustomer(null)
  }

  const filteredCustomers = customers.filter(c =>
    c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  )

  const totalStats = {
    total_invoices: customers.reduce((sum, c) => sum + c.total_invoices, 0),
    total_property_value: customers.reduce((sum, c) => sum + c.property_price, 0),
    total_paid: customers.reduce((sum, c) => sum + c.total_paid, 0),
    total_debt: customers.reduce((sum, c) => sum + (c.property_price - c.total_paid), 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kupci</h1>
          <p className="text-gray-600 mt-1">Pregled svih kupaca i njihovih računa</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ukupno računa</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalStats.total_invoices}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Vrijednost nekretnina</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">€{totalStats.total_property_value.toLocaleString('hr-HR')}</p>
            </div>
            <DollarSign className="w-8 h-8 text-gray-600" />
          </div>
        </div>

        <div className="bg-green-50 rounded-xl shadow-sm border border-green-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">Plaćeno</p>
              <p className="text-2xl font-bold text-green-900 mt-1">€{totalStats.total_paid.toLocaleString('hr-HR')}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700">Dužno</p>
              <p className="text-2xl font-bold text-red-900 mt-1">€{totalStats.total_debt.toLocaleString()}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Pretraži kupce..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 mt-2">Učitavanje...</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Nema kupaca</p>
            </div>
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
                      <span className="text-sm font-medium text-gray-900">€{customer.property_price.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-green-600">€{customer.total_paid.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-red-600">€{(customer.property_price - customer.total_paid).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleOpenDetails(customer)}
                        className="text-blue-600 hover:text-blue-900 inline-flex items-center space-x-1"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Detalji</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showDetailsModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedCustomer.full_name}</h2>
                <p className="text-gray-600 mt-1">Detalji kupca i računi</p>
              </div>
              <button
                onClick={handleCloseDetails}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm font-medium text-blue-700">Ukupno računa</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">{selectedCustomer.total_invoices}</p>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm font-medium text-blue-700">Apartmani</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">{selectedCustomer.total_apartments}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm font-medium text-gray-700">Cijena nekretnine</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">€{selectedCustomer.property_price.toLocaleString()}</p>
                </div>

                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <p className="text-sm font-medium text-green-700">Plaćeno</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">€{selectedCustomer.total_paid.toLocaleString()}</p>
                </div>

                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <p className="text-sm font-medium text-red-700">Dužno</p>
                  <p className="text-2xl font-bold text-red-900 mt-1">€{(selectedCustomer.property_price - selectedCustomer.total_paid).toLocaleString()}</p>
                </div>
              </div>

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
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                isIncomeInvoice(invoice.invoice_type) ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                              }`}>
                                {isIncomeInvoice(invoice.invoice_type) ? 'PRIHOD' : 'RASHOD'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              Firma: {invoice.company?.name || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500">{new Date(invoice.issue_date).toLocaleDateString('hr-HR')}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                            invoice.status === 'PARTIALLY_PAID' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {invoice.status === 'PAID' ? 'Plaćeno' :
                             invoice.status === 'PARTIALLY_PAID' ? 'Djelomično' : 'Neplaćeno'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-300">
                          <div>
                            <p className="text-xs text-gray-600">Ukupno</p>
                            <p className="font-semibold text-gray-900">€{invoice.total_amount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Plaćeno</p>
                            <p className="font-semibold text-green-600">€{invoice.paid_amount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Preostalo</p>
                            <p className="font-semibold text-red-600">€{invoice.remaining_amount.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={handleCloseDetails}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
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

export default AccountingCustomers
