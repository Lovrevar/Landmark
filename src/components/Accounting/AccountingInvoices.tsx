import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { FileText, Plus, Search, Filter, Edit, Trash2, DollarSign, X, Columns, Check, ShoppingCart, Eye, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { format } from 'date-fns'
import { RetailInvoiceFormModal } from './RetailInvoiceFormModal'
import BankInvoiceFormModal from './BankInvoiceFormModal'
import DateInput from '../Common/DateInput'
import CurrencyInput, { formatCurrency, formatCurrencyFlexible } from '../Common/CurrencyInput'

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

interface CompanyCredit {
  id: string
  company_id: string
  credit_name: string
  amount: number
  outstanding_balance: number
  used_amount: number
  repaid_amount: number
}

interface CreditAllocation {
  id: string
  credit_id: string
  project_id: string | null
  allocated_amount: number
  used_amount: number
  description: string | null
  project?: {
    id: string
    name: string
  }
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

interface Refund {
  id: number
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
  invoice_type: 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES' | 'INCOMING_OFFICE' | 'OUTGOING_OFFICE' | 'INCOMING_BANK' | 'OUTGOING_BANK'
  invoice_category?: string
  company_id: string
  company_bank_account_id: string | null
  supplier_id: string | null
  customer_id: string | null
  retail_supplier_id: string | null
  retail_customer_id: string | null
  investor_id: string | null
  bank_id: string | null
  apartment_id: string | null
  contract_id: string | null
  milestone_id: string | null
  office_supplier_id: string | null
  invoice_number: string
  reference_number?: string | null
  iban?: string | null
  issue_date: string
  due_date: string
  base_amount: number
  vat_rate: number
  vat_amount: number
  base_amount_1: number
  vat_rate_1: number
  vat_amount_1: number
  base_amount_2: number
  vat_rate_2: number
  vat_amount_2: number
  base_amount_3: number
  vat_rate_3: number
  vat_amount_3: number
  base_amount_4: number
  vat_rate_4: number
  vat_amount_4: number
  total_amount: number
  category: string
  project_id: string | null
  refund_id: number | null
  description: string
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'
  paid_amount: number
  remaining_amount: number
  approved: boolean
  created_at: string
  companies?: { name: string }
  subcontractors?: { name: string }
  customers?: { name: string; surname: string }
  retail_suppliers?: { name: string }
  retail_customers?: { name: string }
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
  const [companyCredits, setCompanyCredits] = useState<CompanyCredit[]>([])
  const [creditAllocations, setCreditAllocations] = useState<CreditAllocation[]>([])
  const [refunds, setRefunds] = useState<Refund[]>([])
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
  const [invoiceCategories, setInvoiceCategories] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [filteredTotalCount, setFilteredTotalCount] = useState(0)
  const [filteredUnpaidAmount, setFilteredUnpaidAmount] = useState(0)
  const [totalUnpaidAmount, setTotalUnpaidAmount] = useState(0)
  const pageSize = 100

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'ALL' | 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES' | 'INCOMING_OFFICE' | 'OUTGOING_OFFICE' | 'INCOMING_BANK' | 'OUTGOING_BANK'>('ALL')
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'UNPAID' | 'PAID' | 'PARTIALLY_PAID' | 'UNPAID_AND_PARTIAL'>('ALL')
  const [filterCompany, setFilterCompany] = useState<string>('ALL')
  const [sortField, setSortField] = useState<'due_date' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [isOfficeInvoice, setIsOfficeInvoice] = useState(false)
  const [showRetailInvoiceModal, setShowRetailInvoiceModal] = useState(false)
  const [showBankInvoiceModal, setShowBankInvoiceModal] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null)

  const [formData, setFormData] = useState({
    invoice_type: 'INCOMING_SUPPLIER' as 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES' | 'INCOMING_OFFICE' | 'OUTGOING_OFFICE' | 'INCOMING_BANK' | 'OUTGOING_BANK',
    company_id: '',
    supplier_id: '',
    office_supplier_id: '',
    customer_id: '',
    investor_id: '',
    bank_id: '',
    apartment_id: '',
    contract_id: '',
    milestone_id: '',
    invoice_number: '',
    reference_number: '',
    iban: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    base_amount: 0,
    vat_rate: 25,
    base_amount_1: 0,
    base_amount_2: 0,
    base_amount_3: 0,
    base_amount_4: 0,
    category: '',
    project_id: '',
    refund_id: '',
    description: ''
  })

  const [paymentFormData, setPaymentFormData] = useState({
    payment_source_type: 'bank_account' as 'bank_account' | 'credit',
    company_bank_account_id: '',
    credit_id: '',
    credit_allocation_id: '',
    is_cesija: false,
    cesija_company_id: '',
    cesija_bank_account_id: '',
    cesija_credit_id: '',
    cesija_credit_allocation_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    amount: 0,
    payment_method: 'WIRE' as 'WIRE' | 'CASH' | 'CHECK' | 'CARD',
    reference_number: '',
    description: ''
  })

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('accountingInvoicesColumns')
    return saved ? JSON.parse(saved) : {
      approved: true,
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
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    fetchData()
  }, [currentPage, filterType, filterStatus, filterCompany, debouncedSearchTerm])

  useEffect(() => {
    setCurrentPage(1)
  }, [filterType, filterStatus, filterCompany, debouncedSearchTerm])

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
    approved: 'Odobreno',
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

      const [
        invoicesResult,
        statisticsResult,
        companiesResult,
        bankAccountsResult,
        creditsResult,
        suppliersResult,
        officeSuppliersResult,
        customersResult,
        investorsResult,
        banksResult,
        projectsResult,
        contractsResult,
        salesResult,
        invoiceCategoriesResult,
        refundsResult
      ] = await Promise.all([
        supabase.rpc('get_filtered_invoices', {
          p_invoice_type: filterType,
          p_status: filterStatus,
          p_company_id: filterCompany !== 'ALL' ? filterCompany : null,
          p_search_term: debouncedSearchTerm || null,
          p_offset: (currentPage - 1) * pageSize,
          p_limit: pageSize
        }),

        supabase.rpc('get_invoice_statistics', {
          p_invoice_type: filterType,
          p_status: filterStatus,
          p_company_id: filterCompany !== 'ALL' ? filterCompany : null,
          p_search_term: debouncedSearchTerm || null
        }),

        supabase
          .from('accounting_companies')
          .select('id, name, oib')
          .order('name'),

        supabase
          .from('company_bank_accounts')
          .select('*')
          .order('bank_name'),

        supabase
          .from('bank_credits')
          .select('*')
          .order('credit_name'),

        supabase
          .from('subcontractors')
          .select('id, name, contact')
          .order('name'),

        supabase
          .from('office_suppliers')
          .select('id, name, contact, email')
          .order('name'),

        supabase
          .from('customers')
          .select('id, name, surname, email')
          .order('name'),

        supabase
          .from('investors')
          .select('id, name, type')
          .order('name'),

        supabase
          .from('banks')
          .select('id, name')
          .order('name'),

        supabase
          .from('projects')
          .select('id, name')
          .order('name'),

        supabase
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
          .order('contract_number'),

        supabase
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
          `),

        supabase
          .from('invoice_categories')
          .select('id, name')
          .eq('is_active', true)
          .order('sort_order'),

        supabase
          .from('accounting_invoices_refund')
          .select('id, name')
          .order('name')
      ])

      if (invoicesResult.error) throw invoicesResult.error
      const transformedInvoices = (invoicesResult.data || []).map((inv: any) => ({
        ...inv,
        companies: inv.company_name ? { name: inv.company_name } : null,
        subcontractors: inv.supplier_name ? { name: inv.supplier_name } : null,
        customers: inv.customer_name ? { name: inv.customer_name, surname: inv.customer_surname || '' } : null,
        investors: inv.investor_name ? { name: inv.investor_name } : null,
        banks: inv.bank_name ? { name: inv.bank_name } : null,
        projects: inv.project_name ? { name: inv.project_name } : null,
        contracts: inv.contract_number ? { contract_number: inv.contract_number, job_description: inv.contract_job_description || '' } : null,
        office_suppliers: inv.office_supplier_name ? { name: inv.office_supplier_name } : null,
        retail_suppliers: inv.retail_supplier_name ? { name: inv.retail_supplier_name } : null,
        retail_customers: inv.retail_customer_name ? { name: inv.retail_customer_name } : null
      }))
      setInvoices(transformedInvoices)

      if (statisticsResult.error) throw statisticsResult.error
      if (statisticsResult.data && statisticsResult.data.length > 0) {
        const stats = statisticsResult.data[0]
        const count = Number(stats.filtered_count) || 0
        setTotalCount(count)
        setFilteredTotalCount(count)
        setFilteredUnpaidAmount(Number(stats.filtered_unpaid_sum) || 0)
        setTotalUnpaidAmount(Number(stats.total_unpaid_sum) || 0)
      } else {
        setTotalCount(0)
        setFilteredTotalCount(0)
        setFilteredUnpaidAmount(0)
        setTotalUnpaidAmount(0)
      }

      if (companiesResult.error) {
        console.error('Error loading companies:', companiesResult.error)
        throw companiesResult.error
      }
      console.log('Loaded companies:', companiesResult.data)
      setCompanies(companiesResult.data || [])

      if (bankAccountsResult.error) {
        console.error('Error loading bank accounts:', bankAccountsResult.error)
      }
      setCompanyBankAccounts(bankAccountsResult.data || [])

      if (creditsResult.error) {
        console.error('Error loading credits:', creditsResult.error)
      }
      setCompanyCredits(creditsResult.data || [])

      if (suppliersResult.error) {
        console.error('Error loading suppliers:', suppliersResult.error)
        throw suppliersResult.error
      }
      console.log('Loaded suppliers:', suppliersResult.data)
      setSuppliers(suppliersResult.data || [])

      if (officeSuppliersResult.error) {
        console.error('Error loading office suppliers:', officeSuppliersResult.error)
        throw officeSuppliersResult.error
      }
      console.log('Loaded office suppliers:', officeSuppliersResult.data)
      setOfficeSuppliers(officeSuppliersResult.data || [])

      if (customersResult.error) {
        console.error('Error loading customers:', customersResult.error)
        throw customersResult.error
      }
      console.log('Loaded customers:', customersResult.data)
      setCustomers(customersResult.data || [])

      if (investorsResult.error) throw investorsResult.error
      setInvestors(investorsResult.data || [])

      if (banksResult.error) throw banksResult.error
      setBanks(banksResult.data || [])

      if (projectsResult.error) {
        console.error('Error loading projects:', projectsResult.error)
        throw projectsResult.error
      }
      console.log('Loaded projects:', projectsResult.data)
      setProjects(projectsResult.data || [])

      if (contractsResult.error) throw contractsResult.error
      setContracts(contractsResult.data || [])

      if (salesResult.error) throw salesResult.error
      setCustomerSales(salesResult.data || [])

      const aptList = (salesResult.data || []).map(sale => ({
        ...sale.apartments,
        customer_id: sale.customer_id,
        apartment_id: sale.apartment_id
      }))
      setCustomerApartments(aptList)

      if (!invoiceCategoriesResult.error) {
        setInvoiceCategories(invoiceCategoriesResult.data || [])
      }

      if (!refundsResult.error) {
        setRefunds(refundsResult.data || [])
      }

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (invoice?: Invoice) => {
    if (invoice) {
      // Prevent editing retail invoices through regular modal
      if (invoice.invoice_category === 'RETAIL') {
        alert('Retail računi se ne mogu editovati ovdje. Molimo koristite "Novi Retail Račun" formu ili obrišite i kreirajte novi.')
        return
      }

      setEditingInvoice(invoice)
      setIsOfficeInvoice(invoice.invoice_type === 'INCOMING_OFFICE' || invoice.invoice_type === 'OUTGOING_OFFICE')
      setFormData({
        invoice_type: invoice.invoice_type,
        company_id: invoice.company_id,
        supplier_id: invoice.supplier_id || '',
        office_supplier_id: invoice.office_supplier_id || '',
        customer_id: invoice.customer_id || '',
        investor_id: invoice.investor_id || '',
        bank_id: invoice.bank_id || '',
        apartment_id: invoice.apartment_id || '',
        contract_id: invoice.contract_id || '',
        milestone_id: invoice.milestone_id || '',
        invoice_number: invoice.invoice_number,
        reference_number: invoice.reference_number || '',
        iban: invoice.iban || '',
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        base_amount: invoice.base_amount,
        vat_rate: invoice.vat_rate,
        base_amount_1: invoice.base_amount_1 || 0,
        base_amount_2: invoice.base_amount_2 || 0,
        base_amount_3: invoice.base_amount_3 || 0,
        base_amount_4: invoice.base_amount_4 || 0,
        category: invoice.category,
        project_id: invoice.project_id || '',
        refund_id: invoice.refund_id ? String(invoice.refund_id) : '',
        description: invoice.description
      })
    } else {
      setEditingInvoice(null)
      setIsOfficeInvoice(false)
      setFormData({
        invoice_type: 'INCOMING_SUPPLIER',
        company_id: '',
        supplier_id: '',
        office_supplier_id: '',
        customer_id: '',
        investor_id: '',
        bank_id: '',
        apartment_id: '',
        contract_id: '',
        milestone_id: '',
        invoice_number: '',
        reference_number: '',
        iban: '',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: '',
        base_amount: 0,
        vat_rate: 25,
        base_amount_1: 0,
        base_amount_2: 0,
        base_amount_3: 0,
        base_amount_4: 0,
        category: '',
        project_id: '',
        refund_id: '',
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

      // Determine approved status based on invoice type
      let approved = false
      if (formData.invoice_type === 'INCOMING_OFFICE' || formData.invoice_type === 'OUTGOING_OFFICE') {
        approved = true // Office invoices are auto-approved
      } else if (formData.invoice_type === 'INCOMING_INVESTMENT' && bank_id) {
        approved = true // Bank invoices are auto-approved
      }

      const invoiceData = {
        invoice_type: formData.invoice_type,
        invoice_category,
        company_id: formData.company_id,
        company_bank_account_id: null,
        supplier_id,
        office_supplier_id,
        customer_id,
        investor_id,
        bank_id,
        apartment_id: formData.apartment_id || null,
        contract_id: formData.contract_id || null,
        milestone_id: formData.milestone_id || null,
        invoice_number: formData.invoice_number,
        reference_number: formData.reference_number || null,
        iban: formData.iban || null,
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        base_amount_1: formData.base_amount_1 || 0,
        base_amount_2: formData.base_amount_2 || 0,
        base_amount_3: formData.base_amount_3 || 0,
        base_amount_4: formData.base_amount_4 || 0,
        category: formData.category,
        project_id: formData.project_id || null,
        refund_id: formData.refund_id ? parseInt(formData.refund_id) : null,
        description: formData.description,
        approved,
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

  const fetchCreditAllocations = async (creditId: string) => {
    try {
      const { data, error } = await supabase
        .from('credit_allocations')
        .select(`
          id,
          credit_id,
          project_id,
          allocated_amount,
          used_amount,
          description,
          project:projects(id, name)
        `)
        .eq('credit_id', creditId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCreditAllocations(data || [])
    } catch (error) {
      console.error('Error fetching credit allocations:', error)
      setCreditAllocations([])
    }
  }

  const handleOpenPaymentModal = (invoice: Invoice) => {
    setPayingInvoice(invoice)
    setPaymentFormData({
      payment_source_type: 'bank_account',
      company_bank_account_id: '',
      credit_id: '',
      credit_allocation_id: '',
      is_cesija: false,
      cesija_company_id: '',
      cesija_bank_account_id: '',
      cesija_credit_id: '',
      cesija_credit_allocation_id: '',
      payment_date: new Date().toISOString().split('T')[0],
      amount: invoice.remaining_amount,
      payment_method: 'WIRE',
      reference_number: '',
      description: ''
    })
    setCreditAllocations([])
    document.body.style.overflow = 'hidden'
    setShowPaymentModal(true)
  }

  const handleClosePaymentModal = () => {
    document.body.style.overflow = 'unset'
    setShowPaymentModal(false)
    setPayingInvoice(null)
  }

  const handleViewInvoice = (invoice: Invoice) => {
    setViewingInvoice(invoice)
    document.body.style.overflow = 'hidden'
  }

  const handleCloseViewModal = () => {
    setViewingInvoice(null)
    document.body.style.overflow = 'unset'
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!payingInvoice) return

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const paymentData = {
        invoice_id: payingInvoice.id,
        payment_source_type: paymentFormData.payment_source_type,
        company_bank_account_id: paymentFormData.is_cesija ? null : (paymentFormData.payment_source_type === 'bank_account' ? (paymentFormData.company_bank_account_id || null) : null),
        credit_id: paymentFormData.is_cesija ? null : (paymentFormData.payment_source_type === 'credit' ? (paymentFormData.credit_id || null) : null),
        credit_allocation_id: paymentFormData.is_cesija ? null : (paymentFormData.payment_source_type === 'credit' ? (paymentFormData.credit_allocation_id || null) : null),
        is_cesija: paymentFormData.is_cesija,
        cesija_company_id: paymentFormData.is_cesija ? (paymentFormData.cesija_company_id || null) : null,
        cesija_bank_account_id: paymentFormData.is_cesija && paymentFormData.payment_source_type === 'bank_account' ? (paymentFormData.cesija_bank_account_id || null) : null,
        cesija_credit_id: paymentFormData.is_cesija && paymentFormData.payment_source_type === 'credit' ? (paymentFormData.cesija_credit_id || null) : null,
        cesija_credit_allocation_id: paymentFormData.is_cesija && paymentFormData.payment_source_type === 'credit' ? (paymentFormData.cesija_credit_allocation_id || null) : null,
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

  const handleSort = (field: 'due_date') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const filteredInvoices = [...invoices].sort((a, b) => {
    if (!sortField) return 0

    if (sortField === 'due_date') {
      const dateA = new Date(a.due_date).getTime()
      const dateB = new Date(b.due_date).getTime()
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA
    }

    return 0
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
    if (type === 'INCOMING_SUPPLIER' || type === 'INCOMING_OFFICE' || type === 'INCOMING_BANK') {
      return 'text-red-600'
    }
    return 'text-green-600'
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'INCOMING_SUPPLIER': return 'ULAZNI (DOB)'
      case 'INCOMING_INVESTMENT': return 'ULAZNI (INV)'
      case 'INCOMING_OFFICE': return 'ULAZNI (URED)'
      case 'INCOMING_BANK': return 'ULAZNI (BANKA)'
      case 'OUTGOING_OFFICE': return 'IZLAZNI (URED)'
      case 'OUTGOING_SUPPLIER': return 'IZLAZNI (DOB)'
      case 'OUTGOING_SALES': return 'IZLAZNI (PROD)'
      case 'OUTGOING_BANK': return 'IZLAZNI (BANKA)'
      default: return type
    }
  }

  const getSupplierCustomerName = (invoice: Invoice) => {
    if (invoice.subcontractors?.name) return invoice.subcontractors.name
    if (invoice.retail_suppliers?.name) return invoice.retail_suppliers.name
    if (invoice.office_suppliers?.name) return invoice.office_suppliers.name
    if (invoice.customers) return `${invoice.customers.name} ${invoice.customers.surname}`
    if (invoice.retail_customers?.name) return invoice.retail_customers.name
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
                refund_id: '',
                category: ''
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
            onClick={() => setShowRetailInvoiceModal(true)}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 whitespace-nowrap"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Novi Retail Račun
          </button>
          <button
            onClick={() => setShowBankInvoiceModal(true)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 whitespace-nowrap"
          >
            <DollarSign className="w-5 h-5 mr-2" />
            Novi Račun Banka
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Prikazano računa</p>
              <p className="text-2xl font-bold text-gray-900">{filteredTotalCount}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Prikazano Neplaćeno</p>
              <p className="text-2xl font-bold text-red-600">
                €{new Intl.NumberFormat('hr-HR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(filteredUnpaidAmount)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-red-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno Neplaćeno</p>
              <p className="text-2xl font-bold text-orange-600">
                €{new Intl.NumberFormat('hr-HR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(totalUnpaidAmount)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-orange-600" />
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
            <option value="INCOMING_BANK">Ulazni (Banka)</option>
            <option value="OUTGOING_SUPPLIER">Izlazni (Dobavljač)</option>
            <option value="OUTGOING_OFFICE">Izlazni (Ured)</option>
            <option value="OUTGOING_SALES">Izlazni (Prodaja)</option>
            <option value="OUTGOING_BANK">Izlazni (Banka)</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">Svi statusi</option>
            <option value="PAID">Plaćeno</option>
            <option value="UNPAID">Neplaćeno</option>
            <option value="PARTIALLY_PAID">Djelomično plaćeno</option>
            <option value="UNPAID_AND_PARTIAL">Neplaćeno + Djelomično</option>
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
                setSortField(null)
                setSortDirection('asc')
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
                {visibleColumns.approved && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Odobreno</th>}
                {visibleColumns.type && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tip</th>}
                {visibleColumns.invoice_number && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broj računa</th>}
                {visibleColumns.company && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firma</th>}
                {visibleColumns.supplier_customer && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dobavljač/Kupac</th>}
                {visibleColumns.category && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategorija</th>}
                {visibleColumns.issue_date && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum izdavanja</th>}
                {visibleColumns.due_date && (
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('due_date')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Dospijeće</span>
                      {sortField === 'due_date' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-4 h-4" />
                        ) : (
                          <ArrowDown className="w-4 h-4" />
                        )
                      ) : (
                        <ArrowUpDown className="w-4 h-4 opacity-40" />
                      )}
                    </div>
                  </th>
                )}
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
                    {visibleColumns.approved && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center w-5 h-5">
                          {invoice.approved ? (
                            <Check className="w-5 h-5 text-green-600" />
                          ) : (
                            <X className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                      </td>
                    )}
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
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {(invoice.base_amount_1 > 0 || invoice.base_amount_2 > 0 || invoice.base_amount_3 > 0 || invoice.base_amount_4 > 0) ? (
                          <div className="space-y-0.5">
                            {invoice.base_amount_1 > 0 && (
                              <div className="text-xs">€{formatCurrency(invoice.base_amount_1)}</div>
                            )}
                            {invoice.base_amount_2 > 0 && (
                              <div className="text-xs">€{formatCurrency(invoice.base_amount_2)}</div>
                            )}
                            {invoice.base_amount_4 > 0 && (
                              <div className="text-xs">€{formatCurrency(invoice.base_amount_4)}</div>
                            )}
                            {invoice.base_amount_3 > 0 && (
                              <div className="text-xs">€{formatCurrency(invoice.base_amount_3)}</div>
                            )}
                          </div>
                        ) : (
                          <div>€{formatCurrency(invoice.base_amount)}</div>
                        )}
                      </td>
                    )}
                    {visibleColumns.vat && (
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {(invoice.base_amount_1 > 0 || invoice.base_amount_2 > 0 || invoice.base_amount_3 > 0 || invoice.base_amount_4 > 0) ? (
                          <div className="space-y-0.5">
                            {invoice.base_amount_1 > 0 && invoice.vat_amount_1 > 0 && (
                              <div className="text-xs">25%: €{formatCurrency(invoice.vat_amount_1)}</div>
                            )}
                            {invoice.base_amount_2 > 0 && invoice.vat_amount_2 > 0 && (
                              <div className="text-xs">13%: €{formatCurrency(invoice.vat_amount_2)}</div>
                            )}
                            {invoice.base_amount_4 > 0 && invoice.vat_amount_4 > 0 && (
                              <div className="text-xs">5%: €{formatCurrency(invoice.vat_amount_4)}</div>
                            )}
                            {invoice.base_amount_3 > 0 && (
                              <div className="text-xs">0%: €0.00</div>
                            )}
                          </div>
                        ) : (
                          <div>{invoice.vat_rate}% (€{formatCurrency(invoice.vat_amount)})</div>
                        )}
                      </td>
                    )}
                    {visibleColumns.total_amount && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        €{formatCurrency(invoice.total_amount)}
                      </td>
                    )}
                    {visibleColumns.paid_amount && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-green-600">
                        €{formatCurrency(invoice.paid_amount)}
                      </td>
                    )}
                    {visibleColumns.remaining_amount && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                        €{formatCurrency(invoice.remaining_amount)}
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
                        <button
                          onClick={() => handleViewInvoice(invoice)}
                          title="Pregled"
                          className="p-1 text-gray-600 hover:bg-gray-50 rounded transition-colors duration-200"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
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
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              Prikazano: {Math.min((currentPage - 1) * pageSize + 1, totalCount)}-{Math.min(currentPage * pageSize, totalCount)} od {totalCount} računa
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prethodna
              </button>
              <span className="text-sm text-gray-600">
                Stranica {currentPage} od {Math.ceil(totalCount / pageSize)}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(Math.ceil(totalCount / pageSize), currentPage + 1))}
                disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sljedeća
              </button>
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

                {formData.invoice_type === 'INCOMING_SUPPLIER' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Refundacija (opcionalno)
                    </label>
                    <select
                      value={formData.refund_id}
                      onChange={(e) => setFormData({ ...formData, refund_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Bez refundacije</option>
                      {refunds.map(refund => (
                        <option key={refund.id} value={refund.id}>{refund.name}</option>
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

                {formData.invoice_type === 'INCOMING_OFFICE' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Refundacija (opcionalno)
                    </label>
                    <select
                      value={formData.refund_id}
                      onChange={(e) => setFormData({ ...formData, refund_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Bez refundacije</option>
                      {refunds.map(refund => (
                        <option key={refund.id} value={refund.id}>{refund.name}</option>
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
                    Firma *
                  </label>
                  <select
                    value={formData.company_id}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Odaberi firmu</option>
                    {companies.map(company => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>

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
                    Poziv na broj
                  </label>
                  <input
                    type="text"
                    value={formData.reference_number}
                    onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="HR12-3456-7890"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IBAN
                  </label>
                  <input
                    type="text"
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="HR1234567890123456789"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Datum izdavanja *
                  </label>
                  <DateInput
                    value={formData.issue_date}
                    onChange={(value) => setFormData({ ...formData, issue_date: value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Datum dospijeća *
                  </label>
                  <DateInput
                    value={formData.due_date}
                    onChange={(value) => setFormData({ ...formData, due_date: value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Osnovica PDV 25%
                  </label>
                  <CurrencyInput
                    value={formData.base_amount_1}
                    onChange={(value) => setFormData({ ...formData, base_amount_1: value })}
                    placeholder="0,00"
                    min={0}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Osnovica PDV 13%
                  </label>
                  <CurrencyInput
                    value={formData.base_amount_2}
                    onChange={(value) => setFormData({ ...formData, base_amount_2: value })}
                    placeholder="0,00"
                    min={0}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Osnovica PDV 5%
                  </label>
                  <CurrencyInput
                    value={formData.base_amount_4}
                    onChange={(value) => setFormData({ ...formData, base_amount_4: value })}
                    placeholder="0,00"
                    min={0}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Osnovica PDV 0%
                  </label>
                  <CurrencyInput
                    value={formData.base_amount_3}
                    onChange={(value) => setFormData({ ...formData, base_amount_3: value })}
                    placeholder="0,00"
                    min={0}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kategorija *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Odaberi kategoriju</option>
                    {invoiceCategories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
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
                          {apt.projects?.name} - {apt.buildings?.name} - Apt {apt.number} (€{formatCurrency(apt.price)})
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

              {(formData.base_amount_1 > 0 || formData.base_amount_2 > 0 || formData.base_amount_3 > 0 || formData.base_amount_4 > 0) && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="text-sm font-medium text-gray-700 mb-2">Pregled računa:</div>

                  {formData.base_amount_1 > 0 && (
                    <div className="space-y-1 pb-2 border-b border-gray-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Osnovica (PDV 25%):</span>
                        <span className="font-medium">€{formatCurrency(formData.base_amount_1)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">PDV 25%:</span>
                        <span className="font-medium">€{formatCurrency(formData.base_amount_1 * 0.25)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-gray-600">Subtotal:</span>
                        <span>€{formatCurrency(formData.base_amount_1 * 1.25)}</span>
                      </div>
                    </div>
                  )}

                  {formData.base_amount_2 > 0 && (
                    <div className="space-y-1 pb-2 border-b border-gray-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Osnovica (PDV 13%):</span>
                        <span className="font-medium">€{formatCurrency(formData.base_amount_2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">PDV 13%:</span>
                        <span className="font-medium">€{formatCurrency(formData.base_amount_2 * 0.13)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-gray-600">Subtotal:</span>
                        <span>€{formatCurrency(formData.base_amount_2 * 1.13)}</span>
                      </div>
                    </div>
                  )}

                  {formData.base_amount_4 > 0 && (
                    <div className="space-y-1 pb-2 border-b border-gray-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Osnovica (PDV 5%):</span>
                        <span className="font-medium">€{formatCurrency(formData.base_amount_4)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">PDV 5%:</span>
                        <span className="font-medium">€{formatCurrency(formData.base_amount_4 * 0.05)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-gray-600">Subtotal:</span>
                        <span>€{formatCurrency(formData.base_amount_4 * 1.05)}</span>
                      </div>
                    </div>
                  )}

                  {formData.base_amount_3 > 0 && (
                    <div className="space-y-1 pb-2 border-b border-gray-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Osnovica (PDV 0%):</span>
                        <span className="font-medium">€{formatCurrency(formData.base_amount_3)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">PDV 0%:</span>
                        <span className="font-medium">€0.00</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-gray-600">Subtotal:</span>
                        <span>€{formatCurrency(formData.base_amount_3)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between text-base font-bold pt-2">
                    <span>UKUPNO:</span>
                    <span>€{formatCurrency(
                      (formData.base_amount_1 * 1.25) +
                      (formData.base_amount_2 * 1.13) +
                      (formData.base_amount_4 * 1.05) +
                      formData.base_amount_3
                    )}</span>
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
                  <span className="font-medium">€{formatCurrency(payingInvoice.total_amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Plaćeno:</span>
                  <span className="font-medium text-green-600">€{formatCurrency(payingInvoice.paid_amount)}</span>
                </div>
                <div className="flex justify-between text-base border-t border-gray-300 pt-2">
                  <span className="font-semibold text-gray-900">Preostalo za plaćanje:</span>
                  <span className="font-bold text-red-600">€{formatCurrency(payingInvoice.remaining_amount)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!paymentFormData.is_cesija && (
                  <>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Izvor plaćanja *
                      </label>
                      <select
                        value={paymentFormData.payment_source_type}
                        onChange={(e) => setPaymentFormData({
                          ...paymentFormData,
                          payment_source_type: e.target.value as 'bank_account' | 'credit',
                          company_bank_account_id: '',
                          credit_id: ''
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        <option value="bank_account">Bankovni račun</option>
                        <option value="credit">Kredit</option>
                      </select>
                    </div>

                    {paymentFormData.payment_source_type === 'bank_account' && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bankovni račun *
                        </label>
                        <select
                          value={paymentFormData.company_bank_account_id}
                          onChange={(e) => setPaymentFormData({ ...paymentFormData, company_bank_account_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        >
                          <option value="">Odaberi bankovni račun</option>
                          {companyBankAccounts
                            .filter(acc => acc.company_id === payingInvoice.company_id)
                            .map(account => (
                              <option key={account.id} value={account.id}>
                                {account.bank_name} {account.account_number ? `- ${account.account_number}` : ''} (Saldo: €{formatCurrency(account.current_balance)})
                              </option>
                            ))}
                        </select>
                        {companyBankAccounts.filter(acc => acc.company_id === payingInvoice.company_id).length === 0 && (
                          <p className="text-xs text-red-600 mt-1">
                            Ova firma nema dodanih bankovnih računa. Molimo dodajte račun u sekciji Firme.
                          </p>
                        )}
                      </div>
                    )}

                    {paymentFormData.payment_source_type === 'credit' && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Kredit *
                        </label>
                        <select
                          value={paymentFormData.credit_id}
                          onChange={(e) => {
                            const newCreditId = e.target.value
                            setPaymentFormData({ ...paymentFormData, credit_id: newCreditId, credit_allocation_id: '' })
                            if (newCreditId) {
                              fetchCreditAllocations(newCreditId)
                            } else {
                              setCreditAllocations([])
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        >
                          <option value="">Odaberi kredit</option>
                          {companyCredits
                            .filter(credit => credit.company_id === payingInvoice.company_id)
                            .map(credit => {
                              const available = credit.amount - credit.used_amount
                              return (
                                <option key={credit.id} value={credit.id}>
                                  {credit.credit_name} (Dostupno: €{formatCurrency(available)})
                                </option>
                              )
                            })}
                        </select>
                        {companyCredits.filter(credit => credit.company_id === payingInvoice.company_id).length === 0 && (
                          <p className="text-xs text-red-600 mt-1">
                            Ova firma nema dodanih kredita. Molimo dodajte kredit u sekciji Krediti.
                          </p>
                        )}
                      </div>
                    )}

                    {paymentFormData.payment_source_type === 'credit' && paymentFormData.credit_id && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Projekt *
                        </label>
                        <select
                          value={paymentFormData.credit_allocation_id}
                          onChange={(e) => setPaymentFormData({ ...paymentFormData, credit_allocation_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        >
                          <option value="">Odaberi projekt</option>
                          {creditAllocations.map(allocation => {
                            const available = allocation.allocated_amount - allocation.used_amount
                            return (
                              <option key={allocation.id} value={allocation.id}>
                                {allocation.project?.name || 'OPEX (Bez projekta)'} (Dostupno: €{formatCurrency(available)})
                              </option>
                            )
                          })}
                        </select>
                        {creditAllocations.length === 0 && (
                          <p className="text-xs text-red-600 mt-1">
                            Ovaj kredit nema alociranih projekata. Molimo definirajte namjenu kredita u Funding sekciji.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div className="md:col-span-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={paymentFormData.is_cesija}
                      onChange={(e) => setPaymentFormData({
                        ...paymentFormData,
                        is_cesija: e.target.checked,
                        company_bank_account_id: e.target.checked ? '' : paymentFormData.company_bank_account_id,
                        cesija_company_id: '',
                        cesija_bank_account_id: ''
                      })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Ugovor o cesiji (plaćanje iz bankovnog računa druge firme)
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    Označite ako želite platiti račun s bankovnog računa druge firme
                  </p>
                </div>

                {paymentFormData.is_cesija && (
                  <>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Firma koja plaća (cesija) *
                      </label>
                      <select
                        value={paymentFormData.cesija_company_id}
                        onChange={(e) => setPaymentFormData({
                          ...paymentFormData,
                          cesija_company_id: e.target.value,
                          cesija_bank_account_id: ''
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        <option value="">Odaberi firmu koja plaća</option>
                        {companies.map(company => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {paymentFormData.cesija_company_id && (
                      <>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Izvor plaćanja (cesija) *
                          </label>
                          <select
                            value={paymentFormData.payment_source_type}
                            onChange={(e) => setPaymentFormData({
                              ...paymentFormData,
                              payment_source_type: e.target.value as 'bank_account' | 'credit',
                              cesija_bank_account_id: '',
                              cesija_credit_id: ''
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          >
                            <option value="bank_account">Bankovni račun</option>
                            <option value="credit">Kredit</option>
                          </select>
                        </div>

                        {paymentFormData.payment_source_type === 'bank_account' && (
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Bankovni račun (cesija) *
                            </label>
                            <select
                              value={paymentFormData.cesija_bank_account_id}
                              onChange={(e) => setPaymentFormData({ ...paymentFormData, cesija_bank_account_id: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              required
                            >
                              <option value="">Odaberi bankovni račun</option>
                              {companyBankAccounts
                                .filter(acc => acc.company_id === paymentFormData.cesija_company_id)
                                .map(account => (
                                  <option key={account.id} value={account.id}>
                                    {account.bank_name} {account.account_number ? `- ${account.account_number}` : ''} (Saldo: €{formatCurrency(account.current_balance)})
                                  </option>
                                ))}
                            </select>
                            {paymentFormData.cesija_company_id && companyBankAccounts.filter(acc => acc.company_id === paymentFormData.cesija_company_id).length === 0 && (
                              <p className="text-xs text-red-600 mt-1">
                                Ova firma nema dodanih bankovnih računa. Molimo dodajte račun u sekciji Firme.
                              </p>
                            )}
                          </div>
                        )}

                        {paymentFormData.payment_source_type === 'credit' && (
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Kredit (cesija) *
                            </label>
                            <select
                              value={paymentFormData.cesija_credit_id}
                              onChange={(e) => {
                                const newCreditId = e.target.value
                                setPaymentFormData({ ...paymentFormData, cesija_credit_id: newCreditId, cesija_credit_allocation_id: '' })
                                if (newCreditId) {
                                  fetchCreditAllocations(newCreditId)
                                } else {
                                  setCreditAllocations([])
                                }
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              required
                            >
                              <option value="">Odaberi kredit</option>
                              {companyCredits
                                .filter(credit => credit.company_id === paymentFormData.cesija_company_id)
                                .map(credit => {
                                  const available = credit.amount - credit.used_amount
                                  return (
                                    <option key={credit.id} value={credit.id}>
                                      {credit.credit_name} (Dostupno: €{formatCurrency(available)})
                                    </option>
                                  )
                                })}
                            </select>
                            {paymentFormData.cesija_company_id && companyCredits.filter(credit => credit.company_id === paymentFormData.cesija_company_id).length === 0 && (
                              <p className="text-xs text-red-600 mt-1">
                                Ova firma nema dodanih kredita. Molimo dodajte kredit u sekciji Krediti.
                              </p>
                            )}
                          </div>
                        )}

                        {paymentFormData.payment_source_type === 'credit' && paymentFormData.cesija_credit_id && (
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Projekt (cesija) *
                            </label>
                            <select
                              value={paymentFormData.cesija_credit_allocation_id}
                              onChange={(e) => setPaymentFormData({ ...paymentFormData, cesija_credit_allocation_id: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              required
                            >
                              <option value="">Odaberi projekt</option>
                              {creditAllocations.map(allocation => {
                                const available = allocation.allocated_amount - allocation.used_amount
                                return (
                                  <option key={allocation.id} value={allocation.id}>
                                    {allocation.project?.name || 'OPEX (Bez projekta)'} (Dostupno: €{formatCurrency(available)})
                                  </option>
                                )
                              })}
                            </select>
                            {creditAllocations.length === 0 && (
                              <p className="text-xs text-red-600 mt-1">
                                Ovaj kredit nema alociranih projekata. Molimo definirajte namjenu kredita u Funding sekciji.
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Datum plaćanja *
                  </label>
                  <DateInput
                    value={paymentFormData.payment_date}
                    onChange={(value) => setPaymentFormData({ ...paymentFormData, payment_date: value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Iznos plaćanja *
                  </label>
                  <CurrencyInput
                    value={paymentFormData.amount}
                    onChange={(value) => setPaymentFormData({ ...paymentFormData, amount: value })}
                    placeholder="0,00"
                    min={0.01}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Max iznos: €{formatCurrency(payingInvoice.remaining_amount)}
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
                      : `Preostalo nakon plaćanja: €${formatCurrency(payingInvoice.remaining_amount - paymentFormData.amount)}`}
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

      {viewingInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Detalji računa</h2>
              <button
                onClick={handleCloseViewModal}
                className="p-1 hover:bg-gray-100 rounded transition-colors duration-200"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Osnovni podaci</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-500">Broj računa:</span>
                      <p className="text-sm font-medium text-gray-900">{viewingInvoice.invoice_number}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Tip računa:</span>
                      <p className={`text-sm font-semibold ${getTypeColor(viewingInvoice.invoice_type)}`}>
                        {getTypeLabel(viewingInvoice.invoice_type)}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Status:</span>
                      <p>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(viewingInvoice.status)}`}>
                          {viewingInvoice.status === 'UNPAID' ? 'Neplaćeno' :
                           viewingInvoice.status === 'PARTIALLY_PAID' ? 'Djelomično plaćeno' : 'Plaćeno'}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Odobren:</span>
                      <p className="flex items-center gap-2">
                        {viewingInvoice.approved ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                            <Check className="w-4 h-4" /> Da
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                            <X className="w-4 h-4" /> Ne
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Datumi</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-500">Datum izdavanja:</span>
                      <p className="text-sm font-medium text-gray-900">
                        {format(new Date(viewingInvoice.issue_date), 'dd.MM.yyyy')}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Datum dospijeća:</span>
                      <p className={`text-sm font-medium ${isOverdue(viewingInvoice.due_date, viewingInvoice.status) ? 'text-red-600' : 'text-gray-900'}`}>
                        {format(new Date(viewingInvoice.due_date), 'dd.MM.yyyy')}
                        {isOverdue(viewingInvoice.due_date, viewingInvoice.status) && (
                          <span className="ml-2 text-xs">(Zakašnjelo)</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Datum kreiranja:</span>
                      <p className="text-sm font-medium text-gray-900">
                        {format(new Date(viewingInvoice.created_at), 'dd.MM.yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Subjekti</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">Kompanija:</span>
                    <p className="text-sm font-medium text-gray-900">{viewingInvoice.companies?.name || '-'}</p>
                  </div>
                  {(viewingInvoice.subcontractors || viewingInvoice.customers || viewingInvoice.investors ||
                    viewingInvoice.banks || viewingInvoice.office_suppliers || viewingInvoice.retail_suppliers ||
                    viewingInvoice.retail_customers) && (
                    <div>
                      <span className="text-sm text-gray-500">
                        {viewingInvoice.invoice_type.includes('SUPPLIER') ? 'Dobavljač' :
                         viewingInvoice.invoice_type.includes('SALES') ? 'Kupac' :
                         viewingInvoice.invoice_type.includes('INVESTMENT') ? 'Investitor' :
                         viewingInvoice.invoice_type.includes('BANK') ? 'Banka' :
                         viewingInvoice.invoice_type.includes('OFFICE') ? 'Office dobavljač' : 'Partner'}:
                      </span>
                      <p className="text-sm font-medium text-gray-900">
                        {getSupplierCustomerName(viewingInvoice) || '-'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {(viewingInvoice.projects || viewingInvoice.contracts) && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Projekti i ugovori</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {viewingInvoice.projects && (
                      <div>
                        <span className="text-sm text-gray-500">Projekt:</span>
                        <p className="text-sm font-medium text-gray-900">{viewingInvoice.projects.name}</p>
                      </div>
                    )}
                    {viewingInvoice.contracts && (
                      <div>
                        <span className="text-sm text-gray-500">Ugovor:</span>
                        <p className="text-sm font-medium text-gray-900">
                          {viewingInvoice.contracts.contract_number}
                          {viewingInvoice.contracts.job_description && (
                            <span className="block text-xs text-gray-600 mt-1">
                              {viewingInvoice.contracts.job_description}
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(viewingInvoice.reference_number || viewingInvoice.iban) && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Platni detalji</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {viewingInvoice.reference_number && (
                      <div>
                        <span className="text-sm text-gray-500">Poziv na broj:</span>
                        <p className="text-sm font-medium text-gray-900">{viewingInvoice.reference_number}</p>
                      </div>
                    )}
                    {viewingInvoice.iban && (
                      <div>
                        <span className="text-sm text-gray-500">IBAN:</span>
                        <p className="text-sm font-medium text-gray-900">{viewingInvoice.iban}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Financijski podaci</h3>
                <div className="space-y-3">
                  {(viewingInvoice.base_amount_1 > 0 || viewingInvoice.base_amount_2 > 0 ||
                    viewingInvoice.base_amount_3 > 0 || viewingInvoice.base_amount_4 > 0) ? (
                    <div>
                      <span className="text-sm text-gray-500 mb-2 block">Osnovica po stopama PDV-a:</span>
                      <div className="bg-gray-50 p-3 rounded space-y-2">
                        {viewingInvoice.base_amount_1 > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-700">25% PDV:</span>
                            <div className="text-right">
                              <p className="text-sm font-medium">Osnovica: €{formatCurrency(viewingInvoice.base_amount_1)}</p>
                              <p className="text-xs text-gray-600">PDV: €{formatCurrency(viewingInvoice.vat_amount_1)}</p>
                            </div>
                          </div>
                        )}
                        {viewingInvoice.base_amount_2 > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-700">13% PDV:</span>
                            <div className="text-right">
                              <p className="text-sm font-medium">Osnovica: €{formatCurrency(viewingInvoice.base_amount_2)}</p>
                              <p className="text-xs text-gray-600">PDV: €{formatCurrency(viewingInvoice.vat_amount_2)}</p>
                            </div>
                          </div>
                        )}
                        {viewingInvoice.base_amount_4 > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-700">5% PDV:</span>
                            <div className="text-right">
                              <p className="text-sm font-medium">Osnovica: €{formatCurrency(viewingInvoice.base_amount_4)}</p>
                              <p className="text-xs text-gray-600">PDV: €{formatCurrency(viewingInvoice.vat_amount_4)}</p>
                            </div>
                          </div>
                        )}
                        {viewingInvoice.base_amount_3 > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-700">0% PDV:</span>
                            <div className="text-right">
                              <p className="text-sm font-medium">Osnovica: €{formatCurrency(viewingInvoice.base_amount_3)}</p>
                              <p className="text-xs text-gray-600">PDV: €0.00</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Osnovica:</span>
                      <p className="text-sm font-medium text-gray-900">€{formatCurrency(viewingInvoice.base_amount)}</p>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Ukupan PDV:</span>
                    <p className="text-sm font-medium text-gray-900">€{formatCurrency(viewingInvoice.vat_amount)}</p>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-base font-semibold text-gray-700">Ukupan iznos:</span>
                    <p className="text-lg font-bold text-gray-900">€{formatCurrency(viewingInvoice.total_amount)}</p>
                  </div>

                  <div className="flex justify-between items-center bg-green-50 p-2 rounded">
                    <span className="text-sm text-green-700">Plaćeni iznos:</span>
                    <p className="text-sm font-semibold text-green-700">€{formatCurrency(viewingInvoice.paid_amount)}</p>
                  </div>

                  {viewingInvoice.remaining_amount > 0 && (
                    <div className="flex justify-between items-center bg-red-50 p-2 rounded">
                      <span className="text-sm text-red-700">Preostali iznos:</span>
                      <p className="text-sm font-semibold text-red-700">€{formatCurrency(viewingInvoice.remaining_amount)}</p>
                    </div>
                  )}
                </div>
              </div>

              {viewingInvoice.category && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Kategorija</h3>
                  <p className="text-sm font-medium text-gray-900">{viewingInvoice.category}</p>
                </div>
              )}

              {viewingInvoice.description && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Opis</h3>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{viewingInvoice.description}</p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                onClick={handleCloseViewModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
              >
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}

      {showRetailInvoiceModal && (
        <RetailInvoiceFormModal
          onClose={() => setShowRetailInvoiceModal(false)}
          onSuccess={() => {
            setShowRetailInvoiceModal(false)
            fetchData()
          }}
        />
      )}

      {showBankInvoiceModal && (
        <BankInvoiceFormModal
          onClose={() => setShowBankInvoiceModal(false)}
          onSuccess={() => {
            setShowBankInvoiceModal(false)
            fetchData()
          }}
        />
      )}
    </div>
  )
}

export default AccountingInvoices
