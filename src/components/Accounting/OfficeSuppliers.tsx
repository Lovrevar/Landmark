import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Building2, Plus, Search, Edit, Trash2, X, Mail, Phone, MapPin, FileText, Eye, Calendar } from 'lucide-react'
import { format } from 'date-fns'

interface OfficeSupplier {
  id: string
  name: string
  contact: string | null
  email: string | null
  address: string | null
  tax_id: string | null
  vat_id: string | null
  created_at: string
}

interface OfficeSupplierWithStats extends OfficeSupplier {
  total_invoices: number
  total_amount: number
  paid_amount: number
  remaining_amount: number
}

interface Invoice {
  id: string
  invoice_number: string
  issue_date: string
  due_date: string
  base_amount: string
  total_amount: string
  paid_amount: string
  remaining_amount: string
  status: string
  description: string | null
}

const OfficeSuppliers: React.FC = () => {
  const [suppliers, setSuppliers] = useState<OfficeSupplierWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<OfficeSupplier | null>(null)
  const [showInvoicesModal, setShowInvoicesModal] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<OfficeSupplierWithStats | null>(null)
  const [supplierInvoices, setSupplierInvoices] = useState<Invoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    email: '',
    address: '',
    tax_id: '',
    vat_id: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      const { data: suppliersData, error: suppliersError } = await supabase
        .from('office_suppliers')
        .select('*')
        .order('name')

      if (suppliersError) throw suppliersError

      const suppliersWithStats = await Promise.all(
        (suppliersData || []).map(async (supplier) => {
          const { data: invoicesData } = await supabase
            .from('accounting_invoices')
            .select('base_amount, total_amount, paid_amount, remaining_amount')
            .eq('office_supplier_id', supplier.id)

          const invoices = invoicesData || []
          const total_amount = invoices.reduce((sum, inv) => sum + parseFloat(inv.base_amount || 0), 0)
          const total_amount_with_vat = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0)
          const paid_amount = invoices.reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0)

          return {
            ...supplier,
            total_invoices: invoices.length,
            total_amount,
            paid_amount,
            remaining_amount: total_amount_with_vat - paid_amount
          }
        })
      )

      setSuppliers(suppliersWithStats)
    } catch (error) {
      console.error('Error fetching office suppliers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (supplier?: OfficeSupplier) => {
    if (supplier) {
      setEditingSupplier(supplier)
      setFormData({
        name: supplier.name,
        contact: supplier.contact || '',
        email: supplier.email || '',
        address: supplier.address || '',
        tax_id: supplier.tax_id || '',
        vat_id: supplier.vat_id || ''
      })
    } else {
      setEditingSupplier(null)
      setFormData({
        name: '',
        contact: '',
        email: '',
        address: '',
        tax_id: '',
        vat_id: ''
      })
    }
    document.body.style.overflow = 'hidden'
    setShowModal(true)
  }

  const handleCloseModal = () => {
    document.body.style.overflow = 'unset'
    setShowModal(false)
    setEditingSupplier(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const supplierData = {
        name: formData.name,
        contact: formData.contact || null,
        email: formData.email || null,
        address: formData.address || null,
        tax_id: formData.tax_id || null,
        vat_id: formData.vat_id || null
      }

      if (editingSupplier) {
        const { error } = await supabase
          .from('office_suppliers')
          .update(supplierData)
          .eq('id', editingSupplier.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('office_suppliers')
          .insert([supplierData])

        if (error) throw error
      }

      await fetchData()
      handleCloseModal()
    } catch (error) {
      console.error('Error saving office supplier:', error)
      alert('Greška prilikom spremanja dobavljača')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Jeste li sigurni da želite obrisati ovog dobavljača? Ovo će obrisati sve vezane račune.')) return

    try {
      const { error } = await supabase
        .from('office_suppliers')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('Error deleting office supplier:', error)
      alert('Greška prilikom brisanja dobavljača')
    }
  }

  const handleViewInvoices = async (supplier: OfficeSupplierWithStats) => {
    setSelectedSupplier(supplier)
    setShowInvoicesModal(true)
    setLoadingInvoices(true)
    document.body.style.overflow = 'hidden'

    try {
      const { data, error } = await supabase
        .from('accounting_invoices')
        .select('*')
        .eq('office_supplier_id', supplier.id)
        .order('issue_date', { ascending: false })

      if (error) throw error
      setSupplierInvoices(data || [])
    } catch (error) {
      console.error('Error fetching supplier invoices:', error)
      alert('Greška prilikom učitavanja računa')
    } finally {
      setLoadingInvoices(false)
    }
  }

  const handleCloseInvoicesModal = () => {
    document.body.style.overflow = 'unset'
    setShowInvoicesModal(false)
    setSelectedSupplier(null)
    setSupplierInvoices([])
  }

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.contact || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

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
          <h1 className="text-2xl font-bold text-gray-900">Office Dobavljači</h1>
          <p className="text-sm text-gray-600 mt-1">Upravljanje dobavljačima za uredske troškove</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 whitespace-nowrap"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novi dobavljač
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno dobavljača</p>
              <p className="text-2xl font-bold text-gray-900">{suppliers.length}</p>
            </div>
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno računa</p>
              <p className="text-2xl font-bold text-gray-900">
                {suppliers.reduce((sum, s) => sum + s.total_invoices, 0)}
              </p>
            </div>
            <FileText className="w-8 h-8 text-gray-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno plaćeno (bez PDV)</p>
              <p className="text-2xl font-bold text-green-600">
                €{suppliers.reduce((sum, s) => sum + s.paid_amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <Building2 className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Preostalo (bez PDV)</p>
              <p className="text-2xl font-bold text-orange-600">
                €{suppliers.reduce((sum, s) => sum + s.remaining_amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <Building2 className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Pretraži dobavljače..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {filteredSuppliers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm ? 'Nema rezultata pretrage' : 'Nema office dobavljača'}
          </h3>
          <p className="text-gray-600">
            {searchTerm ? 'Pokušajte s drugim pojmom' : 'Dodajte prvog office dobavljača klikom na gumb iznad'}
          </p>
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
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenModal(supplier)
                  }}
                  className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Uredi
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(supplier.id)
                  }}
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

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">
                {editingSupplier ? 'Uredi office dobavljača' : 'Novi office dobavljač'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Naziv dobavljača *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder="npr. HR Servis d.o.o."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kontakt (telefon)
                    </label>
                    <input
                      type="text"
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+385 99 123 4567"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="info@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adresa
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ulica 123, Zagreb"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      OIB
                    </label>
                    <input
                      type="text"
                      value={formData.tax_id}
                      onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="12345678901"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      PDV ID
                    </label>
                    <input
                      type="text"
                      value={formData.vat_id}
                      onChange={(e) => setFormData({ ...formData, vat_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="HR12345678901"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Napomena:</strong> Office dobavljači se koriste za uredske troškove kao što su plaće,
                    lizinzi automobila, najam ureda, režije i slično. Ne prikazuju se u projektnim računima.
                  </p>
                </div>
              </div>

              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  {editingSupplier ? 'Spremi promjene' : 'Dodaj dobavljača'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInvoicesModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Računi - {selectedSupplier.name}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Ukupno: {supplierInvoices.length} računa |
                  Plaćeno: €{selectedSupplier.paid_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} |
                  Preostalo: €{selectedSupplier.remaining_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <button
                onClick={handleCloseInvoicesModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              {loadingInvoices ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Učitavanje računa...</p>
                  </div>
                </div>
              ) : supplierInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Nema računa</h3>
                  <p className="text-gray-600">Ovaj dobavljač nema unesenih računa.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Broj računa
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Datum izdavanja
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Datum dospijeća
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Opis
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Osnovica
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ukupno (s PDV)
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Plaćeno
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Preostalo
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {supplierInvoices.map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {invoice.invoice_number}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                              {format(new Date(invoice.issue_date), 'dd.MM.yyyy')}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                              {format(new Date(invoice.due_date), 'dd.MM.yyyy')}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                            {invoice.description || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            €{parseFloat(invoice.base_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                            €{parseFloat(invoice.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-green-600">
                            €{parseFloat(invoice.paid_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-orange-600">
                            €{parseFloat(invoice.remaining_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              invoice.status === 'PAID'
                                ? 'bg-green-100 text-green-800'
                                : invoice.status === 'PARTIALLY_PAID'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {invoice.status === 'PAID' ? 'Plaćeno' : invoice.status === 'PARTIALLY_PAID' ? 'Djelomično' : 'Neplaćeno'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                onClick={handleCloseInvoicesModal}
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

export default OfficeSuppliers
