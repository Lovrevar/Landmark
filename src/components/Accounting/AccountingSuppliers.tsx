import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Users, Plus, Search, DollarSign, FileText, Briefcase, Phone, Mail, Edit, Trash2, X, Eye, TrendingUp, ChevronLeft, ChevronRight, Store } from 'lucide-react'
import RetailSupplierModal from './RetailSupplierModal'

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
  source: 'site' | 'retail'
  supplier_type?: string
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
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(null)
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null)
  const [showRetailModal, setShowRetailModal] = useState(false)

  const itemsPerPage = 50

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

      const [
        { data: suppliersData, error: suppliersError },
        { data: retailSuppliersData, error: retailError },
        { data: paymentsData }
      ] = await Promise.all([
        supabase.from('subcontractors').select('id, name, contact').order('name'),
        supabase.from('retail_suppliers').select('id, name, supplier_type, contact_person, contact_phone, contact_email').order('name'),
        supabase.from('accounting_payments').select('invoice_id, amount')
      ])

      if (suppliersError) throw suppliersError
      if (retailError) throw retailError

      const paymentsMap = new Map<string, number>()
      ;(paymentsData || []).forEach(payment => {
        const current = paymentsMap.get(payment.invoice_id) || 0
        paymentsMap.set(payment.invoice_id, current + parseFloat(payment.amount?.toString() || '0'))
      })

      const supplierIds = (suppliersData || []).map(s => s.id)
      const retailSupplierIds = (retailSuppliersData || []).map(s => s.id)

      const [
        { data: contractsData },
        { data: invoicesData },
        { data: retailContractsData },
        { data: retailInvoicesData }
      ] = await Promise.all([
        supabase.from('contracts').select('subcontractor_id, contract_amount').in('subcontractor_id', supplierIds.length > 0 ? supplierIds : ['00000000-0000-0000-0000-000000000000']).in('status', ['draft', 'active']),
        supabase.from('accounting_invoices').select('id, supplier_id, remaining_amount, status').in('supplier_id', supplierIds.length > 0 ? supplierIds : ['00000000-0000-0000-0000-000000000000']),
        supabase.from('retail_contracts').select('supplier_id, contract_amount').in('supplier_id', retailSupplierIds.length > 0 ? retailSupplierIds : ['00000000-0000-0000-0000-000000000000']).in('status', ['Active', 'Completed']),
        supabase.from('accounting_invoices').select('id, retail_supplier_id, remaining_amount, status').in('retail_supplier_id', retailSupplierIds.length > 0 ? retailSupplierIds : ['00000000-0000-0000-0000-000000000000'])
      ])

      const buildStatsMap = (ids: string[]) => {
        const map = new Map<string, { contractCount: number; contractValue: number; totalPaid: number; totalRemaining: number; invoiceCount: number }>()
        ids.forEach(id => map.set(id, { contractCount: 0, contractValue: 0, totalPaid: 0, totalRemaining: 0, invoiceCount: 0 }))
        return map
      }

      const siteStats = buildStatsMap(supplierIds)
      ;(contractsData || []).forEach(c => {
        const s = siteStats.get(c.subcontractor_id)
        if (s) { s.contractCount++; s.contractValue += parseFloat(c.contract_amount?.toString() || '0') }
      })
      ;(invoicesData || []).forEach(inv => {
        const s = siteStats.get(inv.supplier_id)
        if (s) {
          s.invoiceCount++
          s.totalPaid += paymentsMap.get(inv.id) || 0
          if (inv.status !== 'PAID') s.totalRemaining += parseFloat(inv.remaining_amount?.toString() || '0')
        }
      })

      const retailStats = buildStatsMap(retailSupplierIds)
      ;(retailContractsData || []).forEach(c => {
        const s = retailStats.get(c.supplier_id)
        if (s) { s.contractCount++; s.contractValue += parseFloat(c.contract_amount?.toString() || '0') }
      })
      ;(retailInvoicesData || []).forEach(inv => {
        const s = retailStats.get(inv.retail_supplier_id)
        if (s) {
          s.invoiceCount++
          s.totalPaid += paymentsMap.get(inv.id) || 0
          if (inv.status !== 'PAID') s.totalRemaining += parseFloat(inv.remaining_amount?.toString() || '0')
        }
      })

      const mapToSummary = (
        data: any[],
        statsMap: Map<string, any>,
        source: 'site' | 'retail'
      ): SupplierSummary[] =>
        data.map(supplier => {
          const stats = statsMap.get(supplier.id) || { contractCount: 0, contractValue: 0, totalPaid: 0, totalRemaining: 0, invoiceCount: 0 }
          const contact = source === 'retail'
            ? [supplier.contact_person, supplier.contact_phone, supplier.contact_email].filter(Boolean).join(' | ') || '-'
            : supplier.contact
          return {
            id: supplier.id,
            name: supplier.name,
            contact,
            source,
            supplier_type: source === 'retail' ? supplier.supplier_type : undefined,
            total_contracts: stats.contractCount,
            total_contract_value: stats.contractValue,
            total_paid: stats.totalPaid,
            total_paid_neto: stats.totalPaid,
            total_paid_pdv: 0,
            total_paid_total: stats.totalPaid,
            total_remaining: stats.totalRemaining,
            total_invoices: stats.invoiceCount,
            contracts: [],
            invoices: []
          }
        })

      const siteSuppliers = mapToSummary(suppliersData || [], siteStats, 'site')
      const retailSuppliers = mapToSummary(retailSuppliersData || [], retailStats, 'retail')
      const all = [...siteSuppliers, ...retailSuppliers].sort((a, b) => a.name.localeCompare(b.name))
      setSuppliers(all)
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
          const { data: existingContracts } = await supabase
            .from('contracts')
            .select('contract_number')
            .eq('project_id', formData.project_id)
            .not('contract_number', 'is', null)

          const year = new Date().getFullYear()
          const timestamp = Date.now().toString().slice(-6)
          const prefix = `CNT-${year}-`

          let maxNumber = 0
          if (existingContracts && existingContracts.length > 0) {
            existingContracts.forEach(contract => {
              if (contract.contract_number && contract.contract_number.startsWith(prefix)) {
                const parts = contract.contract_number.replace(prefix, '').split('-')
                const num = parseInt(parts[0], 10)
                if (!isNaN(num) && num > maxNumber) {
                  maxNumber = num
                }
              }
            })
          }

          const contractNumber = `${prefix}${String(maxNumber + 1).padStart(4, '0')}-${timestamp}`

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
    } catch (error: any) {
      console.error('Error saving supplier:', error)

      if (error?.code === '23505' && error?.message?.includes('contract_number')) {
        alert('Greška: Dupliran broj ugovora. Molimo pokušajte ponovo.')
      } else if (error?.message) {
        alert(`Greška: ${error.message}`)
      } else {
        alert('Greška prilikom spremanja dobavljača')
      }
    }
  }

  const handleDelete = async (supplier: SupplierSummary) => {
    if (!confirm('Jeste li sigurni da želite obrisati ovog dobavljača? Ovo će obrisati sve vezane ugovore i račune.')) return

    try {
      const table = supplier.source === 'retail' ? 'retail_suppliers' : 'subcontractors'
      const { error } = await supabase.from(table).delete().eq('id', supplier.id)
      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('Error deleting supplier:', error)
      alert('Greška prilikom brisanja dobavljača')
    }
  }

  const handleViewDetails = async (supplier: SupplierSummary) => {
    try {
      let contractsWithPayments: Contract[] = []
      let invoicesWithPayments: Invoice[] = []

      if (supplier.source === 'retail') {
        const { data: rContracts } = await supabase
          .from('retail_contracts')
          .select(`id, contract_number, contract_amount, budget_realized, end_date, status, phase_id, phases:phase_id (phase_name)`)
          .eq('supplier_id', supplier.id)
          .in('status', ['Active', 'Completed'])

        const { data: rPhases } = await supabase
          .from('retail_project_phases')
          .select('id, phase_name, project_id, retail_projects:project_id (name)')
          .in('id', (rContracts || []).map(c => c.phase_id).filter(Boolean) as string[])

        const phaseProjectMap = new Map<string, string>()
        ;(rPhases || []).forEach((p: any) => {
          phaseProjectMap.set(p.id, p.retail_projects?.name || 'N/A')
        })

        const { data: rInvoices } = await supabase
          .from('accounting_invoices')
          .select('id, invoice_number, invoice_type, base_amount, total_amount, paid_amount, remaining_amount, status, issue_date, retail_contract_id')
          .eq('retail_supplier_id', supplier.id)

        const invoiceIds = (rInvoices || []).map(inv => inv.id)
        const { data: paymentsData } = await supabase
          .from('accounting_payments').select('invoice_id, amount')
          .in('invoice_id', invoiceIds.length > 0 ? invoiceIds : ['00000000-0000-0000-0000-000000000000'])

        const paymentsMap = new Map<string, number>()
        ;(paymentsData || []).forEach(p => {
          paymentsMap.set(p.invoice_id, (paymentsMap.get(p.invoice_id) || 0) + parseFloat(p.amount?.toString() || '0'))
        })

        invoicesWithPayments = (rInvoices || []).map(inv => ({ ...inv, actual_paid: paymentsMap.get(inv.id) || 0 }))

        const contractPayMap = new Map<string, number>()
        invoicesWithPayments.forEach(inv => {
          if ((inv as any).retail_contract_id) {
            contractPayMap.set((inv as any).retail_contract_id, (contractPayMap.get((inv as any).retail_contract_id) || 0) + (inv.actual_paid || 0))
          }
        })

        contractsWithPayments = (rContracts || []).map((c: any) => ({
          id: c.id,
          contract_number: c.contract_number,
          project_id: '',
          phase_id: c.phase_id,
          job_description: '',
          contract_amount: c.contract_amount,
          budget_realized: c.budget_realized,
          end_date: c.end_date,
          status: c.status,
          projects: { name: phaseProjectMap.get(c.phase_id) || 'N/A' },
          phases: c.phases,
          actual_paid: contractPayMap.get(c.id) || 0
        }))
      } else {
        const { data: contractsData } = await supabase
          .from('contracts')
          .select('id, contract_number, project_id, phase_id, job_description, contract_amount, budget_realized, end_date, status, projects:project_id (name), phases:phase_id (phase_name)')
          .eq('subcontractor_id', supplier.id)
          .in('status', ['draft', 'active'])

        const { data: invoicesData } = await supabase
          .from('accounting_invoices')
          .select('id, invoice_number, invoice_type, base_amount, total_amount, paid_amount, remaining_amount, status, issue_date, contract_id')
          .eq('supplier_id', supplier.id)

        const invoiceIds = (invoicesData || []).map(inv => inv.id)
        const { data: paymentsData } = await supabase
          .from('accounting_payments').select('invoice_id, amount')
          .in('invoice_id', invoiceIds.length > 0 ? invoiceIds : ['00000000-0000-0000-0000-000000000000'])

        const paymentsMap = new Map<string, number>()
        ;(paymentsData || []).forEach(p => {
          paymentsMap.set(p.invoice_id, (paymentsMap.get(p.invoice_id) || 0) + parseFloat(p.amount?.toString() || '0'))
        })

        invoicesWithPayments = (invoicesData || []).map(inv => ({ ...inv, actual_paid: paymentsMap.get(inv.id) || 0 }))

        const contractPayMap = new Map<string, number>()
        invoicesWithPayments.forEach(inv => {
          if ((inv as any).contract_id) {
            contractPayMap.set((inv as any).contract_id, (contractPayMap.get((inv as any).contract_id) || 0) + (inv.actual_paid || 0))
          }
        })

        contractsWithPayments = (contractsData || []).map(c => ({ ...c, actual_paid: contractPayMap.get(c.id) || 0 }))
      }

      setSelectedSupplier({ ...supplier, contracts: contractsWithPayments, invoices: invoicesWithPayments })
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

  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedSuppliers = filteredSuppliers.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

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
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenAddModal()}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 whitespace-nowrap"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novi dobavljač
          </button>
          <button
            onClick={() => setShowRetailModal(true)}
            className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors duration-200 whitespace-nowrap"
          >
            <Store className="w-5 h-5 mr-2" />
            Novi Retail Dobavljač
          </button>
        </div>
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

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {filteredSuppliers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchTerm ? 'Nema rezultata pretrage' : 'Nema dobavljača'}
            </h3>
            <p className="text-gray-600">
              {searchTerm ? 'Pokušajte s drugim pojmom' : 'Dodajte prvog dobavljača koristeći gumb iznad'}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200">
              {paginatedSuppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between"
                  onClick={() => handleViewDetails(supplier)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{supplier.name}</h3>
                      {supplier.source === 'retail' ? (
                        <span className="px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-800 rounded-full">Retail</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Site</span>
                      )}
                      {supplier.supplier_type && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">{supplier.supplier_type}</span>
                      )}
                    </div>
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
                    {supplier.source === 'site' && (
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
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(supplier)
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

            {totalPages > 1 && (
              <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Prethodna
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sljedeća
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Prikazano <span className="font-medium">{startIndex + 1}</span> do <span className="font-medium">{Math.min(endIndex, filteredSuppliers.length)}</span> od{' '}
                      <span className="font-medium">{filteredSuppliers.length}</span> rezultata
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          if (totalPages <= 7) return true
                          if (page === 1 || page === totalPages) return true
                          if (page >= currentPage - 1 && page <= currentPage + 1) return true
                          return false
                        })
                        .map((page, index, array) => {
                          if (index > 0 && page - array[index - 1] > 1) {
                            return (
                              <React.Fragment key={`dots-${page}`}>
                                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                  ...
                                </span>
                                <button
                                  onClick={() => setCurrentPage(page)}
                                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                    currentPage === page
                                      ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  {page}
                                </button>
                              </React.Fragment>
                            )
                          }
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                currentPage === page
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          )
                        })}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

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
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">{selectedSupplier.name}</h2>
                  {selectedSupplier.source === 'retail' ? (
                    <span className="px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-800 rounded-full">Retail</span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Site</span>
                  )}
                </div>
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

      {showRetailModal && (
        <RetailSupplierModal
          onClose={() => setShowRetailModal(false)}
          onSuccess={() => {
            setShowRetailModal(false)
            fetchData()
          }}
        />
      )}
    </div>
  )
}

export default AccountingSuppliers
