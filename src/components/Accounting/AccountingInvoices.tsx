import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { FileText, Plus, Search, Filter, Edit, Trash2, DollarSign, X } from 'lucide-react'
import { format } from 'date-fns'

interface Company {
  id: string
  name: string
  tax_id: string
  vat_id: string
}

interface Supplier {
  id: string
  name: string
  contact: string
}

interface Customer {
  id: string
  name: string
  surname: string
  email: string
}

interface Project {
  id: string
  name: string
}

interface Invoice {
  id: string
  invoice_type: 'EXPENSE' | 'INCOME'
  company_id: string
  supplier_id: string | null
  customer_id: string | null
  invoice_number: string
  issue_date: string
  due_date: string
  base_amount: number
  vat_rate: number
  vat_amount: number
  total_amount: number
  category: string
  project_id: string | null
  description: string
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'
  paid_amount: number
  remaining_amount: number
  created_at: string
  companies?: { name: string }
  subcontractors?: { name: string }
  customers?: { name: string; surname: string }
  projects?: { name: string }
}

const AccountingInvoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'ALL' | 'EXPENSE' | 'INCOME'>('ALL')
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'>('ALL')
  const [filterCompany, setFilterCompany] = useState<string>('ALL')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      const { data: invoicesData, error: invoicesError } = await supabase
        .from('accounting_invoices')
        .select(`
          *,
          companies:company_id (name),
          subcontractors:supplier_id (name),
          customers:customer_id (name, surname),
          projects:project_id (name)
        `)
        .order('issue_date', { ascending: false })

      if (invoicesError) throw invoicesError
      setInvoices(invoicesData || [])

      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name, tax_id, vat_id')
        .eq('is_active', true)
        .order('name')

      if (companiesError) throw companiesError
      setCompanies(companiesData || [])

      const { data: suppliersData, error: suppliersError } = await supabase
        .from('subcontractors')
        .select('id, name, contact')
        .order('name')

      if (suppliersError) throw suppliersError
      setSuppliers(suppliersData || [])

      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name, surname, email')
        .order('name')

      if (customersError) throw customersError
      setCustomers(customersData || [])

      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .order('name')

      if (projectsError) throw projectsError
      setProjects(projectsData || [])

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Jeste li sigurni da želite obrisati ovaj račun?')) return

    try {
      const { error } = await supabase
        .from('accounting_invoices')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('Error deleting invoice:', error)
      alert('Greška prilikom brisanja računa')
    }
  }

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.subcontractors?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.customers ? `${invoice.customers.name} ${invoice.customers.surname}` : '').toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === 'ALL' || invoice.invoice_type === filterType
    const matchesStatus = filterStatus === 'ALL' || invoice.status === filterStatus
    const matchesCompany = filterCompany === 'ALL' || invoice.company_id === filterCompany

    return matchesSearch && matchesType && matchesStatus && matchesCompany
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-green-100 text-green-800'
      case 'PARTIALLY_PAID': return 'bg-yellow-100 text-yellow-800'
      case 'UNPAID': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeColor = (type: string) => {
    return type === 'EXPENSE' ? 'text-red-600' : 'text-green-600'
  }

  const isOverdue = (dueDate: string, status: string) => {
    return status !== 'PAID' && new Date(dueDate) < new Date()
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Računi</h1>
          <p className="text-sm text-gray-600 mt-1">Upravljanje ulaznim i izlaznim računima</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
          <Plus className="w-5 h-5 mr-2" />
          Novi račun
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno računa</p>
              <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Neplaćeno</p>
              <p className="text-2xl font-bold text-red-600">
                €{invoices
                  .filter(i => i.status === 'UNPAID')
                  .reduce((sum, i) => sum + i.remaining_amount, 0)
                  .toLocaleString()}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Djelomično plaćeno</p>
              <p className="text-2xl font-bold text-yellow-600">
                €{invoices
                  .filter(i => i.status === 'PARTIALLY_PAID')
                  .reduce((sum, i) => sum + i.remaining_amount, 0)
                  .toLocaleString()}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Plaćeno</p>
              <p className="text-2xl font-bold text-green-600">
                €{invoices
                  .filter(i => i.status === 'PAID')
                  .reduce((sum, i) => sum + i.total_amount, 0)
                  .toLocaleString()}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Pretraži..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">Svi tipovi</option>
            <option value="EXPENSE">Ulazni</option>
            <option value="INCOME">Izlazni</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">Svi statusi</option>
            <option value="UNPAID">Neplaćeno</option>
            <option value="PARTIALLY_PAID">Djelomično plaćeno</option>
            <option value="PAID">Plaćeno</option>
          </select>

          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">Sve firme</option>
            {companies.map(company => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>

          {(searchTerm || filterType !== 'ALL' || filterStatus !== 'ALL' || filterCompany !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('')
                setFilterType('ALL')
                setFilterStatus('ALL')
                setFilterCompany('ALL')
              }}
              className="flex items-center justify-center px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <X className="w-4 h-4 mr-2" />
              Očisti
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tip</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broj računa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firma</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dobavljač/Kupac</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategorija</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum izdavanja</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dospijeće</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Osnovica</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PDV</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ukupno</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plaćeno</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preostalo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Akcije</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-6 py-12 text-center">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Nema pronađenih računa</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className={`hover:bg-gray-50 ${isOverdue(invoice.due_date, invoice.status) ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-xs font-semibold ${getTypeColor(invoice.invoice_type)}`}>
                        {invoice.invoice_type === 'EXPENSE' ? 'ULAZNI' : 'IZLAZNI'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invoice.invoice_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {invoice.companies?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {invoice.invoice_type === 'EXPENSE'
                        ? invoice.subcontractors?.name
                        : invoice.customers ? `${invoice.customers.name} ${invoice.customers.surname}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {invoice.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {format(new Date(invoice.issue_date), 'dd.MM.yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <span className={isOverdue(invoice.due_date, invoice.status) ? 'text-red-600 font-semibold' : ''}>
                        {format(new Date(invoice.due_date), 'dd.MM.yyyy')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      €{invoice.base_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {invoice.vat_rate}% (€{invoice.vat_amount.toLocaleString()})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      €{invoice.total_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      €{invoice.paid_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                      €{invoice.remaining_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                        {invoice.status === 'UNPAID' ? 'Neplaćeno' :
                         invoice.status === 'PARTIALLY_PAID' ? 'Djelomično' : 'Plaćeno'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center space-x-2">
                        {invoice.status !== 'PAID' && (
                          <button
                            title="Plaćanje"
                            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors duration-200"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          title="Uredi"
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(invoice.id)}
                          title="Obriši"
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Prikazano: {filteredInvoices.length} od {invoices.length} računa</span>
          <div className="flex items-center space-x-6 text-sm">
            <div>
              <span className="text-gray-600">Ukupno neplaćeno: </span>
              <span className="font-semibold text-red-600">
                €{filteredInvoices
                  .filter(i => i.status !== 'PAID')
                  .reduce((sum, i) => sum + i.remaining_amount, 0)
                  .toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Ukupno plaćeno: </span>
              <span className="font-semibold text-green-600">
                €{filteredInvoices
                  .reduce((sum, i) => sum + i.paid_amount, 0)
                  .toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccountingInvoices
