import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Building2, Plus, Search, DollarSign, TrendingUp, TrendingDown, FileText, Eye, Edit, Trash2, X, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

interface Company {
  id: string
  name: string
  oib: string
  initial_balance: number
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
  supplier?: { name: string }
  customer?: { name: string; surname: string }
}

interface CompanyStats {
  id: string
  name: string
  oib: string
  initial_balance: number
  total_income_invoices: number
  total_income_amount: number
  total_income_paid: number
  total_income_unpaid: number
  total_expense_invoices: number
  total_expense_amount: number
  total_expense_paid: number
  total_expense_unpaid: number
  current_balance: number
  profit: number
  revenue: number
  invoices: Invoice[]
}

const AccountingCompanies: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<CompanyStats | null>(null)
  const [editingCompany, setEditingCompany] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    oib: '',
    initial_balance: 0
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      const { data: companiesData, error: companiesError } = await supabase
        .from('accounting_companies')
        .select('*')
        .order('name')

      if (companiesError) throw companiesError

      const companiesWithStats = await Promise.all(
        (companiesData || []).map(async (company) => {
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
              supplier:supplier_id (name),
              customer:customer_id (name, surname)
            `)
            .eq('company_id', company.id)
            .order('issue_date', { ascending: false })

          const invoices = invoicesData || []

          const incomeInvoices = invoices.filter(i =>
            i.invoice_type === 'INCOMING_INVESTMENT' || i.invoice_type === 'OUTGOING_SALES'
          )
          const expenseInvoices = invoices.filter(i =>
            i.invoice_type === 'INCOMING_SUPPLIER' || i.invoice_type === 'OUTGOING_SUPPLIER'
          )

          const totalIncomeAmount = incomeInvoices.reduce((sum, i) => sum + i.total_amount, 0)
          const totalIncomePaid = incomeInvoices.reduce((sum, i) => sum + i.paid_amount, 0)
          const totalIncomeUnpaid = incomeInvoices.reduce((sum, i) => sum + i.remaining_amount, 0)

          const totalExpenseAmount = expenseInvoices.reduce((sum, i) => sum + i.total_amount, 0)
          const totalExpensePaid = expenseInvoices.reduce((sum, i) => sum + i.paid_amount, 0)
          const totalExpenseUnpaid = expenseInvoices.reduce((sum, i) => sum + i.remaining_amount, 0)

          const currentBalance = company.initial_balance + totalIncomePaid - totalExpensePaid
          const profit = totalIncomePaid - totalExpensePaid
          const revenue = totalIncomeAmount

          return {
            id: company.id,
            name: company.name,
            oib: company.oib,
            initial_balance: company.initial_balance,
            total_income_invoices: incomeInvoices.length,
            total_income_amount: totalIncomeAmount,
            total_income_paid: totalIncomePaid,
            total_income_unpaid: totalIncomeUnpaid,
            total_expense_invoices: expenseInvoices.length,
            total_expense_amount: totalExpenseAmount,
            total_expense_paid: totalExpensePaid,
            total_expense_unpaid: totalExpenseUnpaid,
            current_balance: currentBalance,
            profit: profit,
            revenue: revenue,
            invoices: invoices
          }
        })
      )

      setCompanies(companiesWithStats)
    } catch (error) {
      console.error('Error fetching companies:', error)
    } finally {
      setLoading(false)
    }
  }

  const isIncomeInvoice = (invoiceType: string) => {
    return invoiceType === 'INCOMING_INVESTMENT' || invoiceType === 'OUTGOING_SALES'
  }

  const getInvoiceEntityName = (invoice: Invoice) => {
    if (invoice.invoice_type === 'INCOMING_INVESTMENT' || invoice.invoice_type === 'OUTGOING_SALES') {
      if (invoice.customer) {
        return `${invoice.customer.name} ${invoice.customer.surname}`.trim()
      }
      return 'N/A'
    } else {
      return invoice.supplier?.name || 'N/A'
    }
  }

  const handleOpenAddModal = (company?: CompanyStats) => {
    if (company) {
      setEditingCompany(company.id)
      setFormData({
        name: company.name,
        oib: company.oib,
        initial_balance: company.initial_balance
      })
    } else {
      setEditingCompany(null)
      setFormData({
        name: '',
        oib: '',
        initial_balance: 0
      })
    }
    document.body.style.overflow = 'hidden'
    setShowAddModal(true)
  }

  const handleCloseAddModal = () => {
    document.body.style.overflow = 'unset'
    setShowAddModal(false)
    setEditingCompany(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingCompany) {
        const { error } = await supabase
          .from('accounting_companies')
          .update({
            name: formData.name,
            oib: formData.oib,
            initial_balance: formData.initial_balance,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCompany)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('accounting_companies')
          .insert([{
            name: formData.name,
            oib: formData.oib,
            initial_balance: formData.initial_balance
          }])

        if (error) throw error
      }

      await fetchData()
      handleCloseAddModal()
    } catch (error: any) {
      console.error('Error saving company:', error)
      if (error.code === '23505') {
        alert('OIB već postoji u sustavu!')
      } else {
        alert('Greška prilikom spremanja firme')
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Jeste li sigurni da želite obrisati ovu firmu? Svi računi povezani s firmom će biti odspojeni.')) return

    try {
      const { error } = await supabase
        .from('accounting_companies')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('Error deleting company:', error)
      alert('Greška prilikom brisanja firme')
    }
  }

  const handleViewDetails = (company: CompanyStats) => {
    setSelectedCompany(company)
    document.body.style.overflow = 'hidden'
    setShowDetailsModal(true)
  }

  const handleCloseDetailsModal = () => {
    document.body.style.overflow = 'unset'
    setShowDetailsModal(false)
    setSelectedCompany(null)
  }

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.oib.includes(searchTerm)
  )

  const totalBalance = companies.reduce((sum, c) => sum + c.current_balance, 0)
  const totalRevenue = companies.reduce((sum, c) => sum + c.revenue, 0)
  const totalProfit = companies.reduce((sum, c) => sum + c.profit, 0)
  const totalExpensePaid = companies.reduce((sum, c) => sum + c.total_expense_paid, 0)

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
          <h1 className="text-2xl font-bold text-gray-900">Moje firme</h1>
          <p className="text-sm text-gray-600 mt-1">Financijski pregled svih firmi pod Landmarkom</p>
        </div>
        <button
          onClick={() => handleOpenAddModal()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 whitespace-nowrap"
        >
          <Plus className="w-5 h-5 mr-2" />
          Dodaj novu firmu
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno firmi</p>
              <p className="text-2xl font-bold text-gray-900">{companies.length}</p>
            </div>
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno stanje</p>
              <p className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                €{totalBalance.toLocaleString()}
              </p>
            </div>
            <DollarSign className={`w-8 h-8 ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupan promet</p>
              <p className="text-2xl font-bold text-blue-600">
                €{totalRevenue.toLocaleString()}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Dobit/Gubitak</p>
              <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                €{totalProfit.toLocaleString()}
              </p>
            </div>
            {totalProfit >= 0 ? (
              <TrendingUp className="w-8 h-8 text-green-600" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-600" />
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Pretraži firme po imenu ili OIB-u..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {filteredCompanies.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm ? 'Nema rezultata pretrage' : 'Nema firmi'}
          </h3>
          <p className="text-gray-600">
            {searchTerm ? 'Pokušajte s drugim pojmom' : 'Dodajte prvu firmu klikom na gumb iznad'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompanies.map((company) => (
            <div
              key={company.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{company.name}</h3>
                  <p className="text-sm text-gray-600">OIB: {company.oib}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Trenutno stanje</p>
                  <p className={`text-xl font-bold ${company.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    €{company.current_balance.toLocaleString()}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center mb-1">
                      <ArrowUpCircle className="w-4 h-4 text-green-600 mr-1" />
                      <p className="text-xs text-green-700">Izdano</p>
                    </div>
                    <p className="text-sm font-bold text-green-900">€{company.total_income_paid.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">{company.total_income_invoices} računa</p>
                  </div>

                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="flex items-center mb-1">
                      <ArrowDownCircle className="w-4 h-4 text-red-600 mr-1" />
                      <p className="text-xs text-red-700">Plaćeno</p>
                    </div>
                    <p className="text-sm font-bold text-red-900">€{company.total_expense_paid.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">{company.total_expense_invoices} računa</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Promet:</span>
                    <span className="font-medium text-gray-900">€{company.revenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Dobit/Gubitak:</span>
                    <span className={`font-medium ${company.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      €{company.profit.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Neplaćeno (prihod):</span>
                    <span className="text-orange-600">€{company.total_income_unpaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Neplaćeno (rashod):</span>
                    <span className="text-orange-600">€{company.total_expense_unpaid.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleViewDetails(company)}
                  className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Detalji
                </button>
                <button
                  onClick={() => handleOpenAddModal(company)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Uredi"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(company.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Obriši"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCompany ? 'Uredi firmu' : 'Nova firma'}
              </h2>
              <button
                onClick={handleCloseAddModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Naziv firme *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder="npr. Landmark d.o.o."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    OIB *
                  </label>
                  <input
                    type="text"
                    value={formData.oib}
                    onChange={(e) => setFormData({ ...formData, oib: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder="12345678901"
                    maxLength={11}
                    pattern="[0-9]{11}"
                    title="OIB mora imati točno 11 brojeva"
                  />
                  <p className="text-xs text-gray-500 mt-1">Unesite 11-znamenkasti OIB</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Početno stanje (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.initial_balance}
                    onChange={(e) => setFormData({ ...formData, initial_balance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">Početno stanje na računu firme</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Napomena:</strong> Nakon dodavanja firme, možete kreirathi račune i povezati ih s ovom firmom
                    u sekciji "Računi". Stanje će se automatski ažurirati.
                  </p>
                </div>
              </div>

              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  {editingCompany ? 'Spremi promjene' : 'Dodaj firmu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailsModal && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedCompany.name}</h2>
                <p className="text-sm text-gray-600">OIB: {selectedCompany.oib}</p>
              </div>
              <button
                onClick={handleCloseDetailsModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-700">Početno stanje</p>
                  <p className="text-2xl font-bold text-blue-900">€{selectedCompany.initial_balance.toLocaleString()}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-700">Izdano računa</p>
                  <p className="text-2xl font-bold text-green-900">€{selectedCompany.total_income_paid.toLocaleString()}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-red-700">Plaćeno računa</p>
                  <p className="text-2xl font-bold text-red-900">€{selectedCompany.total_expense_paid.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700">Trenutno stanje</p>
                  <p className={`text-2xl font-bold ${selectedCompany.current_balance >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                    €{selectedCompany.current_balance.toLocaleString()}
                  </p>
                </div>
                <div className={`${selectedCompany.profit >= 0 ? 'bg-green-50' : 'bg-red-50'} p-4 rounded-lg`}>
                  <p className={`text-sm ${selectedCompany.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {selectedCompany.profit >= 0 ? 'Dobit' : 'Gubitak'}
                  </p>
                  <p className={`text-2xl font-bold ${selectedCompany.profit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                    €{Math.abs(selectedCompany.profit).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Svi računi ({selectedCompany.invoices.length})
                </h3>
                {selectedCompany.invoices.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Nema računa</p>
                ) : (
                  <div className="space-y-3">
                    {selectedCompany.invoices.map((invoice) => (
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
                              {isIncomeInvoice(invoice.invoice_type)
                                ? `Kupac: ${getInvoiceEntityName(invoice)}`
                                : `Dobavljač: ${getInvoiceEntityName(invoice)}`}
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
                            <p className="text-sm font-medium">€{invoice.total_amount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Plaćeno</p>
                            <p className="text-sm font-medium text-green-700">€{invoice.paid_amount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Preostalo</p>
                            <p className="text-sm font-medium text-orange-700">€{invoice.remaining_amount.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                onClick={handleCloseDetailsModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
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

export default AccountingCompanies
