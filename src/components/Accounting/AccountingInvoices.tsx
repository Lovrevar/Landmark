import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { FileText, Plus, Search, Filter, Edit, Trash2, DollarSign, X, Columns, Check } from 'lucide-react'
import { format } from 'date-fns'

interface Company {
  id: string
  name: string
  tax_id: string
  vat_id: string
}

interface CompanyBankAccount {
  id: string
  company_id: string
  bank_name: string
  account_number: string | null
  current_balance: number
}

interface Supplier {
  id: string
  name: string
  contact: string
}

interface OfficeSupplier {
  id: string
  name: string
  contact: string | null
  email: string | null
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

interface Contract {
  id: string
  contract_number: string
  project_id: string
  phase_id: string | null
  subcontractor_id: string
  job_description: string
  contract_amount: number
  projects?: { name: string }
  phases?: { phase_name: string }
}

interface Milestone {
  id: string
  contract_id: string
  milestone_number: number
  milestone_name: string
  description: string
  percentage: number
  due_date: string | null
  status: 'pending' | 'completed' | 'paid'
}

interface Invoice {
  id: string
  invoice_type: 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES' | 'INCOMING_OFFICE' | 'OUTGOING_OFFICE'
  invoice_category?: string
  company_id: string
  company_bank_account_id: string | null
  supplier_id: string | null
  customer_id: string | null
  investor_id: string | null
  bank_id: string | null
  apartment_id: string | null
  contract_id: string | null
  milestone_id: string | null
  office_supplier_id: string | null
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
  investors?: { name: string }
  banks?: { name: string }
  projects?: { name: string }
  contracts?: { contract_number: string; job_description: string }
  office_suppliers?: { name: string }
}

const AccountingInvoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyBankAccounts, setCompanyBankAccounts] = useState<CompanyBankAccount[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [officeSuppliers, setOfficeSuppliers] = useState<OfficeSupplier[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [investors, setInvestors] = useState<any[]>([])
  const [banks, setBanks] = useState<any[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [customerSales, setCustomerSales] = useState<any[]>([])
  const [customerApartments, setCustomerApartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'ALL' | 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES' | 'INCOMING_OFFICE' | 'OUTGOING_OFFICE'>('ALL')
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'>('ALL')
  const [filterCompany, setFilterCompany] = useState<string>('ALL')
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [isOfficeInvoice, setIsOfficeInvoice] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null)

  const [formData, setFormData] = useState({
    invoice_type: 'INCOMING_SUPPLIER' as 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES' | 'INCOMING_OFFICE' | 'OUTGOING_OFFICE',
    company_id: '',
    company_bank_account_id: '',
    supplier_id: '',
    office_supplier_id: '',
    customer_id: '',
    investor_id: '',
    bank_id: '',
    apartment_id: '',
    contract_id: '',
    milestone_id: '',
    invoice_number: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    base_amount: 0,
    vat_rate: 25,
    category: '',
    project_id: '',
    description: ''
  })

  const [paymentFormData, setPaymentFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: 0,
    payment_method: 'WIRE' as 'WIRE' | 'CASH' | 'CHECK' | 'CARD',
    reference_number: '',
    description: ''
  })

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('accountingInvoicesColumns')
    return saved ? JSON.parse(saved) : {
      type: true,
      invoice_number: true,
      company: true,
      supplier_customer: true,
      category: true,
      issue_date: true,
      due_date: true,
      base_amount: true,
      vat: true,
      total_amount: true,
      paid_amount: true,
      remaining_amount: true,
      status: true
    }
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    localStorage.setItem('accountingInvoicesColumns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.column-menu-container')) {
        setShowColumnMenu(false)
      }
    }

    if (showColumnMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showColumnMenu])

  const toggleColumn = (column: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }))
  }

  const columnLabels = {
    type: 'Tip',
    invoice_number: 'Broj računa',
    company: 'Firma',
    supplier_customer: 'Dobavljač/Kupac',
    category: 'Kategorija',
    issue_date: 'Datum izdavanja',
    due_date: 'Dospijeće',
    base_amount: 'Osnovica',
    vat: 'PDV',
    total_amount: 'Ukupno',
    paid_amount: 'Plaćeno',
    remaining_amount: 'Preostalo',
    status: 'Status'
  }

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
          investors:investor_id (name),
          banks:bank_id (name),
          projects:project_id (name),
          contracts:contract_id (contract_number, job_description),
          office_suppliers:office_supplier_id (name)
        `)
        .order('issue_date', { ascending: false })

      if (invoicesError) throw invoicesError
      setInvoices(invoicesData || [])

      const { data: companiesData, error: companiesError } = await supabase
        .from('accounting_companies')
        .select('id, name, oib')
        .order('name')

      if (companiesError) {
        console.error('Error loading companies:', companiesError)
        throw companiesError
      }
      console.log('Loaded companies:', companiesData)
      setCompanies(companiesData || [])

      const { data: bankAccountsData, error: bankAccountsError } = await supabase
        .from('company_bank_accounts')
        .select('*')
        .order('bank_name')

      if (bankAccountsError) {
        console.error('Error loading bank accounts:', bankAccountsError)
      }
      setCompanyBankAccounts(bankAccountsData || [])

      const { data: suppliersData, error: suppliersError } = await supabase
        .from('subcontractors')
        .select('id, name, contact')
        .order('name')

      if (suppliersError) {
        console.error('Error loading suppliers:', suppliersError)
        throw suppliersError
      }
      console.log('Loaded suppliers:', suppliersData)
      setSuppliers(suppliersData || [])

      const { data: officeSuppliersData, error: officeSuppliersError } = await supabase
        .from('office_suppliers')
        .select('id, name, contact, email')
        .order('name')

      if (officeSuppliersError) {
        console.error('Error loading office suppliers:', officeSuppliersError)
        throw officeSuppliersError
      }
      console.log('Loaded office suppliers:', officeSuppliersData)
      setOfficeSuppliers(officeSuppliersData || [])

      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name, surname, email')
        .order('name')

      if (customersError) {
        console.error('Error loading customers:', customersError)
        throw customersError
      }
      console.log('Loaded customers:', customersData)
      setCustomers(customersData || [])

      const { data: investorsData, error: investorsError } = await supabase
        .from('investors')
        .select('id, name, type')
        .order('name')

      if (investorsError) throw investorsError
      setInvestors(investorsData || [])

      const { data: banksData, error: banksError } = await supabase
        .from('banks')
        .select('id, name')
        .order('name')

      if (banksError) throw banksError
      setBanks(banksData || [])

      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .order('name')

      if (projectsError) {
        console.error('Error loading projects:', projectsError)
        throw projectsError
      }
      console.log('Loaded projects:', projectsData)
      setProjects(projectsData || [])

      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select(`
          id,
          contract_number,
          project_id,
          phase_id,
          subcontractor_id,
          job_description,
          contract_amount,
          projects:project_id (name),
          phases:phase_id (phase_name)
        `)
        .in('status', ['draft', 'active'])
        .order('contract_number')

      if (contractsError) throw contractsError
      setContracts(contractsData || [])

      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          customer_id,
          apartment_id,
          apartments!inner (
            id,
            number,
            project_id,
            price,
            projects:project_id (name),
            buildings:building_id (name)
          )
        `)

      if (salesError) throw salesError
      setCustomerSales(salesData || [])

      // Transform sales data to apartment list with customer info
      const aptList = (salesData || []).map(sale => ({
        ...sale.apartments,
        customer_id: sale.customer_id,
        apartment_id: sale.apartment_id
      }))
      setCustomerApartments(aptList)

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (invoice?: Invoice) => {
    if (invoice) {
      setEditingInvoice(invoice)
      setIsOfficeInvoice(invoice.invoice_type === 'INCOMING_OFFICE' || invoice.invoice_type === 'OUTGOING_OFFICE')
      setFormData({
        invoice_type: invoice.invoice_type,
        company_id: invoice.company_id,
        company_bank_account_id: invoice.company_bank_account_id || '',
        supplier_id: invoice.supplier_id || '',
        office_supplier_id: invoice.office_supplier_id || '',
        customer_id: invoice.customer_id || '',
        investor_id: invoice.investor_id || '',
        bank_id: invoice.bank_id || '',
        apartment_id: invoice.apartment_id || '',
        contract_id: invoice.contract_id || '',
        milestone_id: invoice.milestone_id || '',
        invoice_number: invoice.invoice_number,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        base_amount: invoice.base_amount,
        vat_rate: invoice.vat_rate,
        category: invoice.category,
        project_id: invoice.project_id || '',
        description: invoice.description
      })
    } else {
      setEditingInvoice(null)
      setIsOfficeInvoice(false)
      setFormData({
        invoice_type: 'INCOMING_SUPPLIER',
        company_id: '',
        company_bank_account_id: '',
        supplier_id: '',
        office_supplier_id: '',
        customer_id: '',
        investor_id: '',
        bank_id: '',
        apartment_id: '',
        contract_id: '',
        milestone_id: '',
        invoice_number: '',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: '',
        base_amount: 0,
        vat_rate: 25,
        category: '',
        project_id: '',
        description: ''
      })
    }
    document.body.style.overflow = 'hidden'
    setShowInvoiceModal(true)
  }

  const handleCloseModal = () => {
    document.body.style.overflow = 'unset'
    setShowInvoiceModal(false)
    setEditingInvoice(null)
    setIsOfficeInvoice(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Map form data based on invoice type
      let supplier_id = null
      let office_supplier_id = null
      let customer_id = null
      let investor_id = null
      let bank_id = null
      let invoice_category = 'GENERAL'

      if (formData.invoice_type === 'INCOMING_SUPPLIER' || formData.invoice_type === 'OUTGOING_SUPPLIER') {
        supplier_id = formData.supplier_id || null
        invoice_category = 'SUBCONTRACTOR'
      } else if (formData.invoice_type === 'INCOMING_OFFICE' || formData.invoice_type === 'OUTGOING_OFFICE') {
        office_supplier_id = formData.office_supplier_id || null
        invoice_category = 'OFFICE'
      } else if (formData.invoice_type === 'INCOMING_INVESTMENT') {
        investor_id = formData.investor_id || null
        bank_id = formData.bank_id || null
        invoice_category = investor_id ? 'INVESTOR' : 'BANK_CREDIT'
      } else if (formData.invoice_type === 'OUTGOING_SALES') {
        customer_id = formData.customer_id || null
        invoice_category = 'CUSTOMER'
      }

      const invoiceData = {
        invoice_type: formData.invoice_type,
        invoice_category,
        company_id: formData.company_id,
        company_bank_account_id: formData.company_bank_account_id || null,
        supplier_id,
        office_supplier_id,
        customer_id,
        investor_id,
        bank_id,
        apartment_id: formData.apartment_id || null,
        contract_id: formData.contract_id || null,
        milestone_id: formData.milestone_id || null,
        invoice_number: formData.invoice_number,
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        base_amount: formData.base_amount,
        vat_rate: formData.vat_rate,
        category: formData.category,
        project_id: formData.project_id || null,
        description: formData.description,
        created_by: user?.id
      }

      if (editingInvoice) {
        const { error } = await supabase
          .from('accounting_invoices')
          .update(invoiceData)
          .eq('id', editingInvoice.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('accounting_invoices')
          .insert([invoiceData])

        if (error) throw error
      }

      await fetchData()
      handleCloseModal()
    } catch (error) {
      console.error('Error saving invoice:', error)
      alert('Greška prilikom spremanja računa')
    }
  }

  const handleOpenPaymentModal = (invoice: Invoice) => {
    setPayingInvoice(invoice)
    setPaymentFormData({
      payment_date: new Date().toISOString().split('T')[0],
      amount: invoice.remaining_amount,
      payment_method: 'WIRE',
      reference_number: '',
      description: ''
    })
    document.body.style.overflow = 'hidden'
    setShowPaymentModal(true)
  }

  const handleClosePaymentModal = () => {
    document.body.style.overflow = 'unset'
    setShowPaymentModal(false)
    setPayingInvoice(null)
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!payingInvoice) return

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const paymentData = {
        invoice_id: payingInvoice.id,
        payment_date: paymentFormData.payment_date,
        amount: paymentFormData.amount,
        payment_method: paymentFormData.payment_method,
        reference_number: paymentFormData.reference_number || null,
        description: paymentFormData.description,
        created_by: user?.id
      }

      const { error } = await supabase
        .from('accounting_payments')
        .insert([paymentData])

      if (error) throw error

      await fetchData()
      handleClosePaymentModal()
    } catch (error) {
      console.error('Error saving payment:', error)
      alert('Greška prilikom spremanja plaćanja')
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
    return type.startsWith('INCOMING') ? 'text-red-600' : 'text-green-600'
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'INCOMING_SUPPLIER': return 'ULAZNI (DOB)'
      case 'INCOMING_INVESTMENT': return 'ULAZNI (INV)'
      case 'INCOMING_OFFICE': return 'ULAZNI (URED)'
      case 'OUTGOING_OFFICE': return 'IZLAZNI (URED)'
      case 'OUTGOING_SUPPLIER': return 'IZLAZNI (DOB)'
      case 'OUTGOING_SALES': return 'IZLAZNI (PROD)'
      default: return type
    }
  }

  const getSupplierCustomerName = (invoice: Invoice) => {
    if (invoice.subcontractors?.name) return invoice.subcontractors.name
    if (invoice.office_suppliers?.name) return invoice.office_suppliers.name
    if (invoice.customers) return `${invoice.customers.name} ${invoice.customers.surname}`
    if (invoice.investors?.name) return invoice.investors.name
    if (invoice.banks?.name) return invoice.banks.name
    return '-'
  }

  const getCustomerProjects = (customerId: string) => {
    if (!customerId) return projects

    // Get unique project IDs where this customer has purchased apartments
    const customerProjectIds = new Set(
      customerSales
        .filter(sale => sale.customer_id === customerId)
        .map(sale => sale.apartments?.project_id)
        .filter(Boolean)
    )

    return projects.filter(project => customerProjectIds.has(project.id))
  }

  const getCustomerApartmentsByProject = (customerId: string, projectId: string) => {
    if (!customerId) return []

    return customerApartments.filter(apt =>
      apt.customer_id === customerId &&
      (!projectId || apt.project_id === projectId)
    )
  }

  const getSupplierProjects = (supplierId: string) => {
    if (!supplierId) return []

    const supplierProjectIds = new Set(
      contracts
        .filter(contract => contract.subcontractor_id === supplierId)
        .map(contract => contract.project_id)
    )

    return projects.filter(project => supplierProjectIds.has(project.id))
  }

  const getSupplierContractsByProject = (supplierId: string, projectId: string) => {
    if (!supplierId) return []

    return contracts.filter(contract =>
      contract.subcontractor_id === supplierId &&
      (!projectId || contract.project_id === projectId)
    )
  }

  const getMilestonesByContract = (contractId: string) => {
    if (!contractId) return []
    return milestones.filter(m => m.contract_id === contractId && m.status !== 'paid')
  }

  const getCompanyBankAccounts = (companyId: string) => {
    if (!companyId) return []
    return companyBankAccounts.filter(acc => acc.company_id === companyId)
  }

  useEffect(() => {
    const loadMilestones = async () => {
      if (formData.contract_id) {
        try {
          const { data, error } = await supabase
            .from('subcontractor_milestones')
            .select('*')
            .eq('contract_id', formData.contract_id)
            .order('milestone_number', { ascending: true })

          if (error) throw error
          setMilestones(data || [])
        } catch (error) {
          console.error('Error loading milestones:', error)
          setMilestones([])
        }
      } else {
        setMilestones([])
        setFormData(prev => ({ ...prev, milestone_id: '' }))
      }
    }

    loadMilestones()
  }, [formData.contract_id])

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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Računi</h1>
          <p className="text-sm text-gray-600 mt-1">Upravljanje ulaznim i izlaznim računima</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative column-menu-container">
            <button
              onClick={() => setShowColumnMenu(!showColumnMenu)}
              className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              <Columns className="w-5 h-5 mr-2" />
              Polja
            </button>
            {showColumnMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 max-h-96 overflow-y-auto">
                <div className="px-3 py-2 border-b border-gray-200">
                  <p className="text-sm font-semibold text-gray-700">Prikaži kolone</p>
                </div>
                {Object.entries(columnLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => toggleColumn(key)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="text-gray-700">{label}</span>
                    {visibleColumns[key] && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setIsOfficeInvoice(true)
              setFormData({
                ...formData,
                invoice_type: 'INCOMING_OFFICE',
                supplier_id: '',
                customer_id: '',
                investor_id: '',
                bank_id: '',
                apartment_id: '',
                contract_id: '',
                milestone_id: '',
                project_id: '',
                category: '',
                company_bank_account_id: ''
              })
              setEditingInvoice(null)
              document.body.style.overflow = 'hidden'
              setShowInvoiceModal(true)
            }}
            className="flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors duration-200 whitespace-nowrap"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novi Office Račun
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 whitespace-nowrap"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novi račun
          </button>
        </div>
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
              <p className="text-sm text-gray-600">Neto plaćeno</p>
              <p className="text-2xl font-bold text-green-600">
                €{(
                  invoices
                    .filter(i => i.invoice_type === 'OUTGOING_SALES')
                    .reduce((sum, i) => sum + i.paid_amount, 0) -
                  invoices
                    .filter(i => i.invoice_type === 'INCOMING_SUPPLIER')
                    .reduce((sum, i) => sum + i.paid_amount, 0)
                ).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">PDV za platiti</p>
              <p className="text-2xl font-bold text-blue-600">
                €{(
                  invoices
                    .filter(i => i.invoice_type === 'OUTGOING_SALES')
                    .reduce((sum, i) => sum + (i.paid_amount * i.vat_amount / i.total_amount), 0) -
                  invoices
                    .filter(i => i.invoice_type === 'INCOMING_SUPPLIER')
                    .reduce((sum, i) => sum + (i.paid_amount * i.vat_amount / i.total_amount), 0)
                ).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-600" />
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
            <option value="INCOMING_SUPPLIER">Ulazni (Dobavljač)</option>
            <option value="INCOMING_OFFICE">Ulazni (Ured)</option>
            <option value="INCOMING_INVESTMENT">Ulazni (Investicije)</option>
            <option value="OUTGOING_SUPPLIER">Izlazni (Dobavljač)</option>
            <option value="OUTGOING_OFFICE">Izlazni (Ured)</option>
            <option value="OUTGOING_SALES">Izlazni (Prodaja)</option>
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
          <table className="w-full min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                {visibleColumns.type && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tip</th>}
                {visibleColumns.invoice_number && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broj računa</th>}
                {visibleColumns.company && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firma</th>}
                {visibleColumns.supplier_customer && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dobavljač/Kupac</th>}
                {visibleColumns.category && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategorija</th>}
                {visibleColumns.issue_date && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum izdavanja</th>}
                {visibleColumns.due_date && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dospijeće</th>}
                {visibleColumns.base_amount && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Osnovica</th>}
                {visibleColumns.vat && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PDV</th>}
                {visibleColumns.total_amount && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ukupno</th>}
                {visibleColumns.paid_amount && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plaćeno</th>}
                {visibleColumns.remaining_amount && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preostalo</th>}
                {visibleColumns.status && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50">Akcije</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="px-6 py-12 text-center">
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
                    {visibleColumns.type && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`text-xs font-semibold ${getTypeColor(invoice.invoice_type)}`}>
                          {getTypeLabel(invoice.invoice_type)}
                        </span>
                      </td>
                    )}
                    {visibleColumns.invoice_number && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {invoice.invoice_number}
                      </td>
                    )}
                    {visibleColumns.company && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invoice.companies?.name}
                      </td>
                    )}
                    {visibleColumns.supplier_customer && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getSupplierCustomerName(invoice)}
                      </td>
                    )}
                    {visibleColumns.category && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {invoice.category}
                      </td>
                    )}
                    {visibleColumns.issue_date && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {format(new Date(invoice.issue_date), 'dd.MM.yyyy')}
                      </td>
                    )}
                    {visibleColumns.due_date && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        <span className={isOverdue(invoice.due_date, invoice.status) ? 'text-red-600 font-semibold' : ''}>
                          {format(new Date(invoice.due_date), 'dd.MM.yyyy')}
                        </span>
                      </td>
                    )}
                    {visibleColumns.base_amount && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        €{invoice.base_amount.toLocaleString()}
                      </td>
                    )}
                    {visibleColumns.vat && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {invoice.vat_rate}% (€{invoice.vat_amount.toLocaleString()})
                      </td>
                    )}
                    {visibleColumns.total_amount && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        €{invoice.total_amount.toLocaleString()}
                      </td>
                    )}
                    {visibleColumns.paid_amount && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-green-600">
                        €{invoice.paid_amount.toLocaleString()}
                      </td>
                    )}
                    {visibleColumns.remaining_amount && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                        €{invoice.remaining_amount.toLocaleString()}
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                          {invoice.status === 'UNPAID' ? 'Neplaćeno' :
                           invoice.status === 'PARTIALLY_PAID' ? 'Djelomično' : 'Plaćeno'}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-4 whitespace-nowrap text-sm sticky right-0 bg-white">
                      <div className="flex items-center space-x-2">
                        {invoice.status !== 'PAID' && (
                          <button
                            onClick={() => handleOpenPaymentModal(invoice)}
                            title="Plaćanje"
                            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors duration-200"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenModal(invoice)}
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
              <span className="text-gray-600">Neto plaćeno (bez PDV): </span>
              <span className={`font-semibold ${
                filteredInvoices
                  .filter(i => i.invoice_type === 'OUTGOING_SALES')
                  .reduce((sum, i) => sum + (i.paid_amount * i.base_amount / i.total_amount), 0) -
                filteredInvoices
                  .filter(i => i.invoice_type === 'INCOMING_SUPPLIER')
                  .reduce((sum, i) => sum + (i.paid_amount * i.base_amount / i.total_amount), 0) >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                €{(
                  filteredInvoices
                    .filter(i => i.invoice_type === 'OUTGOING_SALES')
                    .reduce((sum, i) => sum + (i.paid_amount * i.base_amount / i.total_amount), 0) -
                  filteredInvoices
                    .filter(i => i.invoice_type === 'INCOMING_SUPPLIER')
                    .reduce((sum, i) => sum + (i.paid_amount * i.base_amount / i.total_amount), 0)
                ).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">
                {editingInvoice ? 'Uredi račun' : 'Novi račun'}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tip računa *
                  </label>
                  <select
                    value={formData.invoice_type}
                    onChange={(e) => setFormData({
                      ...formData,
                      invoice_type: e.target.value as 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES' | 'INCOMING_OFFICE' | 'OUTGOING_OFFICE',
                      supplier_id: '',
                      office_supplier_id: '',
                      customer_id: '',
                      investor_id: '',
                      bank_id: '',
                      apartment_id: '',
                      contract_id: '',
                      milestone_id: ''
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={editingInvoice !== null}
                  >
                    {isOfficeInvoice ? (
                      <>
                        <option value="INCOMING_OFFICE">Ulazni</option>
                        <option value="OUTGOING_OFFICE">Izlazni</option>
                      </>
                    ) : (
                      <>
                        <option value="INCOMING_SUPPLIER">Ulazni (Dobavljač)</option>
                        <option value="INCOMING_INVESTMENT">Ulazni (Investicije)</option>
                        <option value="OUTGOING_SUPPLIER">Izlazni (Dobavljač)</option>
                        <option value="OUTGOING_SALES">Izlazni (Prodaja)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Conditional dropdown based on invoice type */}
                {formData.invoice_type === 'INCOMING_SUPPLIER' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dobavljač *
                    </label>
                    <select
                      value={formData.supplier_id}
                      onChange={(e) => {
                        const newSupplierId = e.target.value
                        const supplierProjects = getSupplierProjects(newSupplierId)
                        const currentProjectInList = supplierProjects.some(p => p.id === formData.project_id)

                        setFormData({
                          ...formData,
                          supplier_id: newSupplierId,
                          project_id: currentProjectInList ? formData.project_id : '',
                          contract_id: '',
                          milestone_id: ''
                        })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Odaberi dobavljača</option>
                      {suppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {(formData.invoice_type === 'INCOMING_OFFICE' || formData.invoice_type === 'OUTGOING_OFFICE') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Office Dobavljač *
                    </label>
                    <select
                      value={formData.office_supplier_id}
                      onChange={(e) => setFormData({ ...formData, office_supplier_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Odaberi office dobavljača</option>
                      {officeSuppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.invoice_type === 'INCOMING_INVESTMENT' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Investor (opcionalno)
                      </label>
                      <select
                        value={formData.investor_id}
                        onChange={(e) => setFormData({ ...formData, investor_id: e.target.value, bank_id: '' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Bez investora</option>
                        {investors.map(investor => (
                          <option key={investor.id} value={investor.id}>{investor.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Banka (opcionalno)
                      </label>
                      <select
                        value={formData.bank_id}
                        onChange={(e) => setFormData({ ...formData, bank_id: e.target.value, investor_id: '' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Bez banke</option>
                        {banks.map(bank => (
                          <option key={bank.id} value={bank.id}>{bank.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {formData.invoice_type === 'OUTGOING_SUPPLIER' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dobavljač *
                    </label>
                    <select
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Odaberi dobavljača</option>
                      {suppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.invoice_type === 'OUTGOING_SALES' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kupac *
                    </label>
                    <select
                      value={formData.customer_id}
                      onChange={(e) => {
                        const newCustomerId = e.target.value
                        const customerProjects = getCustomerProjects(newCustomerId)
                        const currentProjectInList = customerProjects.some(p => p.id === formData.project_id)

                        setFormData({
                          ...formData,
                          customer_id: newCustomerId,
                          project_id: currentProjectInList ? formData.project_id : '',
                          apartment_id: ''
                        })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Odaberi kupca</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} {customer.surname}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Firma (koja izdaje račun) *
                  </label>
                  <select
                    value={formData.company_id}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value, company_bank_account_id: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Odaberi firmu</option>
                    {companies.map(company => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>

                {formData.company_id && getCompanyBankAccounts(formData.company_id).length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bankovni račun *
                    </label>
                    <select
                      value={formData.company_bank_account_id}
                      onChange={(e) => setFormData({ ...formData, company_bank_account_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Odaberi bankovni račun</option>
                      {getCompanyBankAccounts(formData.company_id).map(account => (
                        <option key={account.id} value={account.id}>
                          {account.bank_name} (Stanje: €{account.current_balance.toLocaleString()})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Odabirom bankovnog računa, plaćanja će automatski ažurirati stanje
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Broj računa *
                  </label>
                  <input
                    type="text"
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Datum izdavanja *
                  </label>
                  <input
                    type="date"
                    value={formData.issue_date}
                    onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Datum dospijeća *
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Osnovica (bez PDV-a) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.base_amount}
                    onChange={(e) => setFormData({ ...formData, base_amount: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PDV stopa *
                  </label>
                  <select
                    value={formData.vat_rate}
                    onChange={(e) => setFormData({ ...formData, vat_rate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="0">0%</option>
                    <option value="13">13%</option>
                    <option value="25">25%</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kategorija *
                  </label>
                  {(formData.invoice_type === 'INCOMING_OFFICE' || formData.invoice_type === 'OUTGOING_OFFICE') ? (
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Odaberi kategoriju</option>
                      <option value="Plaće">Plaće</option>
                      <option value="Lizing automobila">Lizing automobila</option>
                      <option value="Najam ureda">Najam ureda</option>
                      <option value="Struja">Struja</option>
                      <option value="Voda">Voda</option>
                      <option value="Internet">Internet</option>
                      <option value="Telefon">Telefon</option>
                      <option value="Održavanje">Održavanje</option>
                      <option value="Osiguranje">Osiguranje</option>
                      <option value="Računovodstvo">Računovodstvo</option>
                      <option value="Pravne usluge">Pravne usluge</option>
                      <option value="Ostalo">Ostalo</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      placeholder="npr. Materijal, Usluge, Opći troškovi..."
                    />
                  )}
                </div>

                {!isOfficeInvoice && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Projekt (opcionalno)
                    </label>
                    <select
                      value={formData.project_id}
                      onChange={(e) => setFormData({
                        ...formData,
                        project_id: e.target.value,
                        apartment_id: '',
                        contract_id: '',
                        milestone_id: ''
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Bez projekta</option>
                      {(formData.invoice_type === 'OUTGOING_SALES' && formData.customer_id
                        ? getCustomerProjects(formData.customer_id)
                        : formData.invoice_type === 'INCOMING_SUPPLIER' && formData.supplier_id
                        ? getSupplierProjects(formData.supplier_id)
                        : projects
                      ).map(project => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {(formData.invoice_type === 'INCOMING_SUPPLIER' || formData.invoice_type === 'OUTGOING_SUPPLIER') && formData.supplier_id && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ugovor / Faza (opcionalno)
                      </label>
                      <select
                        value={formData.contract_id}
                        onChange={(e) => setFormData({ ...formData, contract_id: e.target.value, milestone_id: '' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Bez ugovora</option>
                        {getSupplierContractsByProject(formData.supplier_id, formData.project_id).map(contract => (
                          <option key={contract.id} value={contract.id}>
                            {contract.contract_number} - {contract.projects?.name || 'N/A'}
                            {contract.phases?.phase_name && ` - ${contract.phases.phase_name}`}
                            {contract.job_description && ` (${contract.job_description})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {formData.contract_id && getMilestonesByContract(formData.contract_id).length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Milestone (opcionalno)
                        </label>
                        <select
                          value={formData.milestone_id}
                          onChange={(e) => setFormData({ ...formData, milestone_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Bez milestone-a</option>
                          {getMilestonesByContract(formData.contract_id).map(milestone => (
                            <option key={milestone.id} value={milestone.id}>
                              #{milestone.milestone_number} - {milestone.milestone_name} ({milestone.percentage}%)
                              {milestone.status === 'completed' && ' - Završeno'}
                              {milestone.status === 'pending' && ' - Na čekanju'}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Odabir milestone-a će automatski ažurirati njegov status na "plaćen"
                        </p>
                      </div>
                    )}
                  </>
                )}

                {formData.invoice_type === 'OUTGOING_SALES' && formData.customer_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stan (opcionalno)
                    </label>
                    <select
                      value={formData.apartment_id}
                      onChange={(e) => setFormData({ ...formData, apartment_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Odaberi stan</option>
                      {getCustomerApartmentsByProject(formData.customer_id, formData.project_id).map(apt => (
                        <option key={apt.id} value={apt.id}>
                          {apt.projects?.name} - {apt.buildings?.name} - Apt {apt.number} (€{apt.price.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Opis (opcionalno)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Dodatne napomene..."
                />
              </div>

              {formData.base_amount > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Osnovica:</span>
                    <span className="font-medium">€{formData.base_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">PDV ({formData.vat_rate}%):</span>
                    <span className="font-medium">€{(formData.base_amount * (formData.vat_rate / 100)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t border-gray-300 pt-2">
                    <span>Ukupno:</span>
                    <span>€{(formData.base_amount * (1 + formData.vat_rate / 100)).toLocaleString()}</span>
                  </div>
                </div>
              )}

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
                  {editingInvoice ? 'Spremi promjene' : 'Kreiraj račun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && payingInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">
                Plati račun: {payingInvoice.invoice_number}
              </h2>
              <button
                onClick={handleClosePaymentModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="overflow-y-auto flex-1">
              <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Ukupan iznos:</span>
                  <span className="font-medium">€{payingInvoice.total_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Plaćeno:</span>
                  <span className="font-medium text-green-600">€{payingInvoice.paid_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base border-t border-gray-300 pt-2">
                  <span className="font-semibold text-gray-900">Preostalo za plaćanje:</span>
                  <span className="font-bold text-red-600">€{payingInvoice.remaining_amount.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Datum plaćanja *
                </label>
                <input
                  type="date"
                  value={paymentFormData.payment_date}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Iznos plaćanja *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={payingInvoice.remaining_amount}
                  value={paymentFormData.amount}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Max iznos: €{payingInvoice.remaining_amount.toLocaleString()}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Način plaćanja *
                </label>
                <select
                  value={paymentFormData.payment_method}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_method: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="WIRE">Virman</option>
                  <option value="CASH">Gotovina</option>
                  <option value="CHECK">Ček</option>
                  <option value="CARD">Kartica</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referenca (opcionalno)
                </label>
                <input
                  type="text"
                  value={paymentFormData.reference_number}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, reference_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Poziv na broj..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Opis (opcionalno)
                </label>
                <textarea
                  value={paymentFormData.description}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Dodatne napomene..."
                />
              </div>

              {paymentFormData.amount > 0 && paymentFormData.amount <= payingInvoice.remaining_amount && (
                <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-blue-800 font-medium">
                    {paymentFormData.amount === payingInvoice.remaining_amount
                      ? 'Račun će biti označen kao PLAĆEN'
                      : `Preostalo nakon plaćanja: €${(payingInvoice.remaining_amount - paymentFormData.amount).toLocaleString()}`}
                  </p>
                  {paymentFormData.amount < payingInvoice.remaining_amount && (
                    <p className="text-xs text-blue-700">
                      Status će biti promijenjen na DJELOMIČNO PLAĆENO
                    </p>
                  )}
                </div>
              )}

              </div>
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleClosePaymentModal}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  Potvrdi plaćanje
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AccountingInvoices
