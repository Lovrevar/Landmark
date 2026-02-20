import { useState, useEffect } from 'react'
import type { Invoice, Company, CompanyBankAccount, CompanyCredit, CreditAllocation, Supplier, OfficeSupplier, Customer, Project, Refund, Contract, Milestone } from '../types/invoiceTypes'
import * as invoiceService from '../services/invoiceService'
import { lockBodyScroll, unlockBodyScroll } from '../../../hooks/useModalOverflow'
import { useInvoiceColumns } from './useInvoiceColumns'
import { getDefaultInvoiceFormData, getDefaultPaymentFormData } from '../utils/invoiceFormDefaults'

export const useInvoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyBankAccounts, setCompanyBankAccounts] = useState<CompanyBankAccount[]>([])
  const [companyCredits, setCompanyCredits] = useState<CompanyCredit[]>([])
  const [creditAllocations, setCreditAllocations] = useState<CreditAllocation[]>([])
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [officeSuppliers, setOfficeSuppliers] = useState<OfficeSupplier[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
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
  const [filterDirection, setFilterDirection] = useState<'INCOMING' | 'OUTGOING'>('INCOMING')
  const [filterCategory, setFilterCategory] = useState<string>('ALL')
  const filterType = filterCategory === 'ALL'
    ? (filterDirection === 'INCOMING' ? 'INCOMING' : 'OUTGOING')
    : `${filterDirection}_${filterCategory}`
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'UNPAID' | 'PAID' | 'PARTIALLY_PAID' | 'UNPAID_AND_PARTIAL'>('ALL')
  const [filterCompany, setFilterCompany] = useState<string>('ALL')
  const [sortField, setSortField] = useState<'due_date' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [isOfficeInvoice, setIsOfficeInvoice] = useState(false)
  const [showRetailInvoiceModal, setShowRetailInvoiceModal] = useState(false)
  const [showBankInvoiceModal, setShowBankInvoiceModal] = useState(false)
  const [showLandPurchaseModal, setShowLandPurchaseModal] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null)

  const [formData, setFormData] = useState(getDefaultInvoiceFormData())
  const [paymentFormData, setPaymentFormData] = useState(getDefaultPaymentFormData())

  const { visibleColumns, setVisibleColumns, showColumnMenu, setShowColumnMenu } = useInvoiceColumns()

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    fetchData()
  }, [currentPage, filterDirection, filterCategory, filterStatus, filterCompany, debouncedSearchTerm])

  useEffect(() => {
    setCurrentPage(1)
  }, [filterDirection, filterCategory, filterStatus, filterCompany, debouncedSearchTerm])

  useEffect(() => {
    const loadMilestones = async () => {
      if (formData.contract_id) {
        try {
          const data = await invoiceService.fetchMilestones(formData.contract_id)
          setMilestones(data)
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

  const fetchData = async () => {
    try {
      setLoading(true)

      const result = await invoiceService.fetchData(
        filterType,
        filterStatus,
        filterCompany,
        debouncedSearchTerm,
        currentPage,
        pageSize
      )

      setInvoices(result.invoices)
      setTotalCount(result.stats.filtered_count)
      setFilteredTotalCount(result.stats.filtered_count)
      setFilteredUnpaidAmount(result.stats.filtered_unpaid_sum)
      setTotalUnpaidAmount(result.stats.total_unpaid_sum)
      setCompanies(result.companies)
      setCompanyBankAccounts(result.bankAccounts)
      setCompanyCredits(result.credits)
      setSuppliers(result.suppliers)
      setOfficeSuppliers(result.officeSuppliers)
      setCustomers(result.customers)
      setBanks(result.banks)
      setProjects(result.projects)
      setContracts(result.contracts)
      setCustomerSales(result.sales)
      setCustomerApartments(result.apartments)
      setInvoiceCategories(result.invoiceCategories)
      setRefunds(result.refunds)

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (invoice?: Invoice) => {
    if (invoice) {
      if (invoice.invoice_category === 'RETAIL') {
        setEditingInvoice(invoice)
        setFormData({
          invoice_type: invoice.invoice_type,
          company_id: invoice.company_id,
          supplier_id: invoice.retail_supplier_id || '',
          office_supplier_id: invoice.office_supplier_id || '',
          customer_id: invoice.retail_customer_id || '',
          bank_id: invoice.bank_id || '',
          apartment_id: invoice.apartment_id || '',
          contract_id: invoice.retail_contract_id || '',
          milestone_id: invoice.retail_milestone_id || '',
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
        lockBodyScroll()
        setShowRetailInvoiceModal(true)
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
      setFormData(getDefaultInvoiceFormData())
    }
    lockBodyScroll()
    setShowInvoiceModal(true)
  }

  const handleCloseModal = () => {
    unlockBodyScroll()
    setShowInvoiceModal(false)
    setEditingInvoice(null)
    setIsOfficeInvoice(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await invoiceService.handleSubmit(formData, editingInvoice, isOfficeInvoice)
      await fetchData()
      handleCloseModal()
    } catch (error) {
      console.error('Error saving invoice:', error)
      alert('Greška prilikom spremanja računa')
    }
  }

  const fetchCreditAllocationsHandler = async (creditId: string) => {
    try {
      const data = await invoiceService.fetchCreditAllocations(creditId)
      setCreditAllocations(data)
    } catch (error) {
      console.error('Error fetching credit allocations:', error)
      setCreditAllocations([])
    }
  }

  const handleOpenPaymentModal = (invoice: Invoice) => {
    setPayingInvoice(invoice)
    setPaymentFormData({
      ...getDefaultPaymentFormData(),
      amount: invoice.remaining_amount
    })
    setCreditAllocations([])
    lockBodyScroll()
    setShowPaymentModal(true)
  }

  const handleClosePaymentModal = () => {
    unlockBodyScroll()
    setShowPaymentModal(false)
    setPayingInvoice(null)
  }

  const handleViewInvoice = (invoice: Invoice) => {
    setViewingInvoice(invoice)
    lockBodyScroll()
  }

  const handleCloseViewModal = () => {
    setViewingInvoice(null)
    unlockBodyScroll()
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!payingInvoice) return

    try {
      await invoiceService.handlePaymentSubmit(paymentFormData, payingInvoice)
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
      await invoiceService.handleDelete(id)
      await fetchData()
    } catch (error) {
      console.error('Error deleting invoice:', error)
      alert('Greška prilikom brisanja računa')
    }
  }

  return {
    invoices,
    companies,
    companyBankAccounts,
    companyCredits,
    creditAllocations,
    refunds,
    suppliers,
    officeSuppliers,
    customers,
    banks,
    projects,
    contracts,
    milestones,
    customerSales,
    customerApartments,
    invoiceCategories,
    loading,
    currentPage,
    totalCount,
    filteredTotalCount,
    filteredUnpaidAmount,
    totalUnpaidAmount,
    pageSize,
    searchTerm,
    debouncedSearchTerm,
    filterType,
    filterDirection,
    filterCategory,
    filterStatus,
    filterCompany,
    sortField,
    sortDirection,
    showColumnMenu,
    showInvoiceModal,
    isOfficeInvoice,
    showRetailInvoiceModal,
    showBankInvoiceModal,
    showLandPurchaseModal,
    editingInvoice,
    viewingInvoice,
    showPaymentModal,
    payingInvoice,
    formData,
    paymentFormData,
    visibleColumns,
    setInvoices,
    setSearchTerm,
    setFilterDirection,
    setFilterCategory,
    setFilterStatus,
    setFilterCompany,
    setSortField,
    setSortDirection,
    setShowColumnMenu,
    setShowInvoiceModal,
    setIsOfficeInvoice,
    setShowRetailInvoiceModal,
    setShowBankInvoiceModal,
    setShowLandPurchaseModal,
    setEditingInvoice,
    setCurrentPage,
    setFormData,
    setPaymentFormData,
    setVisibleColumns,
    handleOpenModal,
    handleCloseModal,
    handleSubmit,
    fetchCreditAllocationsHandler,
    handleOpenPaymentModal,
    handleClosePaymentModal,
    handleViewInvoice,
    handleCloseViewModal,
    handlePaymentSubmit,
    handleDelete,
    fetchData
  }
}
