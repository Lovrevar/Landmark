import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Users, Plus, Search, DollarSign, FileText, Briefcase, Phone, Mail, Edit, Trash2, X, Eye, TrendingUp } from 'lucide-react'

interface Contract {
  id: string
  contract_number: string
  project_id: string
  phase_id: string | null
  job_description: string
  contract_amount: number
  budget_realized: number
  end_date: string | null
  status: string
  projects?: { name: string }
  phases?: { phase_name: string }
  actual_paid?: number
}

interface Invoice {
  id: string
  invoice_number: string
  invoice_type: string
  base_amount: number
  total_amount: number
  paid_amount: number
  remaining_amount: number
  status: string
  issue_date: string
  actual_paid?: number
}

interface Payment {
  id: string
  payment_date: string
  amount: number
  payment_method: string
}

interface SupplierSummary {
  id: string
  name: string
  contact: string
  total_contracts: number
  total_contract_value: number
  total_paid: number
  total_paid_neto: number
  total_paid_pdv: number
  total_paid_total: number
  total_remaining: number
  total_invoices: number
  contracts: Contract[]
  invoices: Invoice[]
}

const AccountingSuppliers: React.FC = () => {
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(null)
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    project_id: '',
    phase_id: ''
  })

  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [phases, setPhases] = useState<{ id: string; phase_name: string }[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      const { data: suppliersData, error: suppliersError } = await supabase
        .from('subcontractors')
        .select('id, name, contact')
        .order('name')

      if (suppliersError) throw suppliersError

      const suppliersWithStats = await Promise.all(
        (suppliersData || []).map(async (supplier) => {
          const { count: contractsCount } = await supabase
            .from('contracts')
            .select('*', { count: 'exact', head: true })
            .eq('subcontractor_id', supplier.id)
            .in('status', ['draft', 'active'])

          const { data: contractsSumData } = await supabase
            .from('contracts')
            .select('contract_amount')
            .eq('subcontractor_id', supplier.id)
            .in('status', ['draft', 'active'])

          const { data: invoicesStatsData } = await supabase
            .from('accounting_invoices')
            .select('id, base_amount, status')
            .eq('supplier_id', supplier.id)

          const totalContractValue = (contractsSumData || []).reduce((sum, c) => sum + parseFloat(c.contract_amount || 0), 0)

          const invoices = invoicesStatsData || []
          const invoiceIds = invoices.map(inv => inv.id)

          const { data: paymentsData } = await supabase
            .from('accounting_payments')
            .select('amount')
            .in('invoice_id', invoiceIds.length > 0 ? invoiceIds : ['00000000-0000-0000-0000-000000000000'])

          const totalPaidFromPayments = (paymentsData || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)

          const totalRemainingFromInvoices = invoices
            .filter(i => i.status !== 'PAID')
            .reduce((sum, i) => sum + parseFloat(i.base_amount || 0), 0)

          return {
            id: supplier.id,
            name: supplier.name,
            contact: supplier.contact,
            total_contracts: contractsCount || 0,
            total_contract_value: totalContractValue,
            total_paid: totalPaidFromPayments,
            total_paid_neto: totalPaidFromPayments,
            total_paid_pdv: 0,
            total_paid_total: totalPaidFromPayments,
            total_remaining: totalRemainingFromInvoices,
            total_invoices: invoices.length,
            contracts: [],
            invoices: []
          }
        })
      )

      setSuppliers(suppliersWithStats)
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProjects = async () => {
    try {
      setLoadingProjects(true)
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name')

      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoadingProjects(false)
    }
  }

  const loadPhases = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('project_phases')
        .select('id, phase_name')
        .eq('project_id', projectId)
        .order('phase_number')

      if (error) throw error
      setPhases(data || [])
    } catch (error) {
      console.error('Error loading phases:', error)
      setPhases([])
    }
  }

  const handleOpenAddModal = (supplier?: SupplierSummary) => {
    if (supplier) {
      setEditingSupplier(supplier.id)
      setFormData({
        name: supplier.name,
        contact: supplier.contact,
        project_id: '',
        phase_id: ''
      })
    } else {
      setEditingSupplier(null)
      setFormData({
        name: '',
        contact: '',
        project_id: '',
        phase_id: ''
      })
      loadProjects()
    }
    document.body.style.overflow = 'hidden'
    setShowAddModal(true)
  }

  useEffect(() => {
    if (formData.project_id) {
      loadPhases(formData.project_id)
    } else {
      setPhases([])
    }
  }, [formData.project_id])

  const handleCloseAddModal = () => {
    document.body.style.overflow = 'unset'
    setShowAddModal(false)
    setEditingSupplier(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingSupplier && formData.project_id && !formData.phase_id) {
      alert('Molimo odaberite fazu za odabrani projekt')
      return
    }

    try {
      if (editingSupplier) {
        const { error } = await supabase
          .from('subcontractors')
          .update({
            name: formData.name,
            contact: formData.contact
          })
          .eq('id', editingSupplier)

        if (error) throw error
      } else {
        const { data: newSupplier, error: supplierError } = await supabase
          .from('subcontractors')
          .insert([{
            name: formData.name,
            contact: formData.contact
          }])
          .select()
          .single()

        if (supplierError) throw supplierError

        if (formData.project_id && formData.phase_id && newSupplier) {
          const { count } = await supabase
            .from('contracts')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', formData.project_id)

          const contractNumber = `CONTRACT-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

          const { error: contractError } = await supabase
            .from('contracts')
            .insert([{
              contract_number: contractNumber,
              project_id: formData.project_id,
              phase_id: formData.phase_id,
              subcontractor_id: newSupplier.id,
              job_description: '',
              contract_amount: 0,
              has_contract: false,
              status: 'draft'
            }])

          if (contractError) throw contractError
        }
      }

      await fetchData()
      handleCloseAddModal()
    } catch (error) {
      console.error('Error saving supplier:', error)
      alert('Greška prilikom spremanja dobavljača')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Jeste li sigurni da želite obrisati ovog dobavljača? Ovo će obrisati sve vezane ugovore i račune.')) return

    try {
      const { error } = await supabase
        .from('subcontractors')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('Error deleting supplier:', error)
      alert('Greška prilikom brisanja dobavljača')
    }
  }

  const handleViewDetails = async (supplier: SupplierSummary) => {
    try {
      const { data: contractsData } = await supabase
        .from('contracts')
        .select(`
          id,
          contract_number,
          project_id,
          phase_id,
          job_description,
          contract_amount,
          budget_realized,
          end_date,
          status,
          projects:project_id (name),
          phases:phase_id (phase_name)
        `)
        .eq('subcontractor_id', supplier.id)
        .in('status', ['draft', 'active'])

      const { data: invoicesData } = await supabase
        .from('accounting_invoices')
        .select(`
          id,
          invoice_number,
          invoice_type,
          base_amount,
          total_amount,
          paid_amount,
          remaining_amount,
          status,
          issue_date,
          contract_id
        `)
        .eq('supplier_id', supplier.id)

      const invoiceIds = (invoicesData || []).map(inv => inv.id)
      const { data: paymentsData } = await supabase
        .from('accounting_payments')
        .select('invoice_id, amount')
        .in('invoice_id', invoiceIds.length > 0 ? invoiceIds : ['00000000-0000-0000-0000-000000000000'])

      const paymentsMap = new Map<string, number>()
      ;(paymentsData || []).forEach(payment => {
        const current = paymentsMap.get(payment.invoice_id) || 0
        paymentsMap.set(payment.invoice_id, current + parseFloat(payment.amount?.toString() || '0'))
      })

      const invoicesWithPayments = (invoicesData || []).map(inv => ({
        ...inv,
        actual_paid: paymentsMap.get(inv.id) || 0
      }))

      const contractPaymentsMap = new Map<string, number>()
      invoicesWithPayments.forEach(inv => {
        if (inv.contract_id) {
          const current = contractPaymentsMap.get(inv.contract_id) || 0
          contractPaymentsMap.set(inv.contract_id, current + (inv.actual_paid || 0))
        }
      })

      const contractsWithPayments = (contractsData || []).map(contract => ({
        ...contract,
        actual_paid: contractPaymentsMap.get(contract.id) || 0
      }))

      const supplierWithDetails = {
        ...supplier,
        contracts: contractsWithPayments,
        invoices: invoicesWithPayments
      }

      setSelectedSupplier(supplierWithDetails)
      document.body.style.overflow = 'hidden'
      setShowDetailsModal(true)
    } catch (error) {
      console.error('Error loading supplier details:', error)
      alert('Greška prilikom učitavanja detalja dobavljača')
    }
  }

  const handleCloseDetailsModal = () => {
    document.body.style.overflow = 'unset'
    setShowDetailsModal(false)
    setSelectedSupplier(null)
  }

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.contact.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-2xl font-bold text-gray-900">Dobavljači</h1>
          <p className="text-sm text-gray-600 mt-1">Pregled svih dobavljača, ugovora i plaćanja</p>
        </div>
        <button
          onClick={() => handleOpenAddModal()}
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
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno ugovora</p>
              <p className="text-2xl font-bold text-gray-900">
                {suppliers.reduce((sum, s) => sum + s.total_contracts, 0)}
              </p>
            </div>
            <Briefcase className="w-8 h-8 text-gray-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno plaćeno</p>
              <p className="text-2xl font-bold text-green-600">
                €{suppliers.reduce((sum, s) => sum + s.total_paid, 0).toLocaleString('hr-HR')}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno dugovi</p>
              <p className="text-2xl font-bold text-orange-600">
                €{suppliers.reduce((sum, s) => sum + s.total_remaining, 0).toLocaleString('hr-HR')}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-600" />
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

      {searchTerm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {filteredSuppliers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Nema rezultata pretrage
              </h3>
              <p className="text-gray-600">
                Pokušajte s drugim pojmom
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredSuppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between"
                  onClick={() => handleViewDetails(supplier)}
                >
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{supplier.name}</h3>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 mr-1" />
                        {supplier.contact}
                      </div>
                      <div className="flex items-center">
                        <Briefcase className="w-4 h-4 mr-1" />
                        {supplier.total_contracts} ugovora
                      </div>
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 mr-1" />
                        {supplier.total_invoices} računa
                      </div>
                    </div>
                    <div className="flex items-center space-x-6 mt-2 text-sm">
                      <div>
                        <span className="text-gray-600">Vrijednost: </span>
                        <span className="font-semibold text-gray-900">€{supplier.total_contract_value.toLocaleString('hr-HR')}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Plaćeno: </span>
                        <span className="font-semibold text-green-600">€{supplier.total_paid.toLocaleString('hr-HR')}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Dugovi: </span>
                        <span className="font-semibold text-orange-600">€{supplier.total_remaining.toLocaleString('hr-HR')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenAddModal(supplier)
                      }}
                      className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                      title="Uredi"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(supplier.id)
                      }}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title="Obriši"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Eye className="w-5 h-5 text-blue-600 ml-2" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!searchTerm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Pretražite dobavljače
          </h3>
          <p className="text-gray-600">
            Unesite ime ili kontakt dobavljača u tražilicu iznad
          </p>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">
                {editingSupplier ? 'Uredi dobavljača' : 'Novi dobavljač'}
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
                    Naziv dobavljača *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder="npr. Elektro servis d.o.o."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kontakt (email ili telefon) *
                  </label>
                  <input
                    type="text"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder="info@example.com ili +385 99 123 4567"
                  />
                </div>

                {!editingSupplier && (
                  <>
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Poveži sa projektom (opcionalno)</h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Projekti
                          </label>
                          <select
                            value={formData.project_id}
                            onChange={(e) => setFormData({ ...formData, project_id: e.target.value, phase_id: '' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={loadingProjects}
                          >
                            <option value="">Odaberite projekt</option>
                            {projects.map((project) => (
                              <option key={project.id} value={project.id}>
                                {project.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {formData.project_id && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Faza *
                            </label>
                            <select
                              value={formData.phase_id}
                              onChange={(e) => setFormData({ ...formData, phase_id: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              required
                            >
                              <option value="">Odaberite fazu</option>
                              {phases.map((phase) => (
                                <option key={phase.id} value={phase.id}>
                                  {phase.phase_name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Napomena:</strong> Nakon dodavanja dobavljača, možete kreirati račune za njih u sekciji "Računi".
                    {!editingSupplier && formData.project_id && formData.phase_id ? (
                      <span className="block mt-2">
                        Dobavljač će biti automatski zakačen na odabrani projekt i fazu kao "bez ugovora". Možete vidjeti dobavljača u "Site Management" modulu za taj projekt.
                      </span>
                    ) : !editingSupplier ? (
                      <span className="block mt-2">
                        Za dobavljače s projektima, koristite "Site Management" za kreiranje ugovora.
                      </span>
                    ) : null}
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
                  {editingSupplier ? 'Spremi promjene' : 'Dodaj dobavljača'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailsModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedSupplier.name}</h2>
                <p className="text-sm text-gray-600">{selectedSupplier.contact}</p>
              </div>
              <button
                onClick={handleCloseDetailsModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Ukupno ugovora</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedSupplier.total_contracts}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Vrijednost</p>
                  <p className="text-2xl font-bold text-gray-900">€{selectedSupplier.total_contract_value.toLocaleString('hr-HR')}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-700">Plaćeno</p>
                  <p className="text-2xl font-bold text-green-900">€{selectedSupplier.total_paid.toLocaleString('hr-HR')}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-orange-700">Dugovi</p>
                  <p className="text-2xl font-bold text-orange-900">€{selectedSupplier.total_remaining.toLocaleString('hr-HR')}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Briefcase className="w-5 h-5 mr-2" />
                  Ugovori ({selectedSupplier.contracts.length})
                </h3>
                {selectedSupplier.contracts.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Nema ugovora</p>
                ) : (
                  <div className="space-y-3">
                    {selectedSupplier.contracts.map((contract) => (
                      <div key={contract.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{contract.contract_number}</p>
                            <p className="text-sm text-gray-600">{contract.projects?.name || 'N/A'}</p>
                            {contract.phases?.phase_name && (
                              <p className="text-xs text-gray-500">{contract.phases.phase_name}</p>
                            )}
                            <p className="text-sm text-gray-600 mt-1">{contract.job_description}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            contract.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {contract.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-200">
                          <div>
                            <p className="text-xs text-gray-500">Ugovor</p>
                            <p className="text-sm font-medium">€{parseFloat(contract.contract_amount).toLocaleString('hr-HR')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Plaćeno</p>
                            <p className="text-sm font-medium text-green-600">€{(contract.actual_paid || 0).toLocaleString('hr-HR')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Preostalo</p>
                            <p className="text-sm font-medium text-orange-600">
                              €{(parseFloat(contract.contract_amount) - (contract.actual_paid || 0)).toLocaleString('hr-HR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Računi ({selectedSupplier.invoices.length})
                </h3>
                {selectedSupplier.invoices.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Nema računa</p>
                ) : (
                  <div className="space-y-3">
                    {selectedSupplier.invoices.map((invoice) => (
                      <div key={invoice.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                            <p className="text-xs text-gray-500">{new Date(invoice.issue_date).toLocaleDateString('hr-HR')}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                            invoice.status === 'PARTIALLY_PAID' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {invoice.status === 'PAID' ? 'Plaćeno' :
                             invoice.status === 'PARTIALLY_PAID' ? 'Djelomično' : 'Neplaćeno'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-200">
                          <div>
                            <p className="text-xs text-gray-500">Ukupno (bez PDV)</p>
                            <p className="text-sm font-medium">€{parseFloat(invoice.base_amount || 0).toLocaleString('hr-HR')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Plaćeno</p>
                            <p className="text-sm font-medium text-green-600">€{(invoice.actual_paid || 0).toLocaleString('hr-HR')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Preostalo</p>
                            <p className="text-sm font-medium text-orange-600">
                              €{Math.max(0, parseFloat(invoice.base_amount || 0) - (invoice.actual_paid || 0)).toLocaleString('hr-HR')}
                            </p>
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

export default AccountingSuppliers
