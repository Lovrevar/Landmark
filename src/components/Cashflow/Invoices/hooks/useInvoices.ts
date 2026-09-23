import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { Invoice, Company, CompanyBankAccount, CompanyCredit, CreditAllocation, Supplier, OfficeSupplier, Customer, Project, Refund, Contract, Milestone } from '../types'
import * as invoiceService from '../services/invoiceService'
import { validateInvoice, isInvoiceNumberDuplicateError, checkDuplicateInvoiceNumber, getCounterpartyColumn } from '../services/invoiceValidation'
import { lockBodyScroll, unlockBodyScroll } from '../../../../hooks/useModalOverflow'
import { useInvoiceColumns } from './useInvoiceColumns'
import { getDefaultInvoiceFormData, getDefaultPaymentFormData } from '../services/invoiceFormDefaults'
import { useToast } from '../../../../contexts/ToastContext'
import { isInvoiceCategoryValidForDirection, type InvoiceDirection } from '../../services/invoiceHelpers'
import { validatePaymentForm } from '../../Payments/services/paymentValidation'
import { toLoadError } from '../../services/loadError'
import { toErrorMessage } from '../../../../lib/errorMessage'

export const useInvoices = () => {
  const toast = useToast()
  const { t } = useTranslation()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyBankAccounts, setCompanyBankAccounts] = useState<CompanyBankAccount[]>([])
  const [companyCredits, setCompanyCredits] = useState<CompanyCredit[]>([])
  const [creditAllocations, setCreditAllocations] = useState<CreditAllocation[]>([])
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [officeSuppliers, setOfficeSuppliers] = useState<OfficeSupplier[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [customerSales, setCustomerSales] = useState<Record<string, unknown>[]>([])
  const [customerApartments, setCustomerApartments] = useState<Record<string, unknown>[]>([])
  const [invoiceCategories, setInvoiceCategories] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  // True once the first fetch has settled. Later refetches keep the page mounted (so the
  // search box keeps focus) instead of swapping everything for a full-page spinner.
  const [hasLoaded, setHasLoaded] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [filteredTotalCount, setFilteredTotalCount] = useState(0)
  const [filteredUnpaidAmount, setFilteredUnpaidAmount] = useState(0)
  const [totalUnpaidAmount, setTotalUnpaidAmount] = useState(0)
  const pageSize = 100

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [filterDirection, setFilterDirectionState] = useState<InvoiceDirection>('INCOMING')
  const [filterCategory, setFilterCategory] = useState<string>('ALL')
  // A category picked under one direction may not exist under the other (there is no
  // OUTGOING_INVESTMENT), which would request a type no invoice can have. Fall back to ALL.
  const setFilterDirection = useCallback((direction: InvoiceDirection) => {
    setFilterDirectionState(direction)
    setFilterCategory(prev =>
      prev === 'ALL' || isInvoiceCategoryValidForDirection(direction, prev) ? prev : 'ALL'
    )
  }, [])
  const filterType = filterCategory === 'ALL'
    ? (filterDirection === 'INCOMING' ? 'INCOMING' : 'OUTGOING')
    : `${filterDirection}_${filterCategory}`
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'UNPAID' | 'PAID' | 'PARTIALLY_PAID' | 'UNPAID_AND_PARTIAL'>('ALL')
  const [filterCompany, setFilterCompany] = useState<string>('ALL')
  const [sortField, setSortField] = useState<invoiceService.InvoiceSortField | null>(null)
  const [sortDirection, setSortDirection] = useState<invoiceService.InvoiceSortDirection>('asc')
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const { visibleColumns, setVisibleColumns, showColumnMenu, setShowColumnMenu } = useInvoiceColumns()

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Changing a filter or the sort while on page > 1 fires two fetches (the new criteria on the
  // old page, then page 1). Only the latest one may write state, or a slow earlier response
  // could land last and show the wrong page.
  const latestRequestRef = useRef(0)

  const fetchData = useCallback(async () => {
    const requestId = ++latestRequestRef.current
    try {
      setLoading(true)
      setError(null)

      const result = await invoiceService.fetchData(
        filterType,
        filterStatus,
        filterCompany,
        debouncedSearchTerm,
        currentPage,
        pageSize,
        sortField,
        sortDirection
      )

      if (requestId !== latestRequestRef.current) return

      setInvoices(result.invoices as unknown as Invoice[])
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
      if (requestId === latestRequestRef.current) {
        console.error('Error fetching data:', error)
        // Whatever is on screen stays, with the stats it was loaded with — the page shows a
        // retry rather than swapping in a register that reads "0 invoices, €0 unpaid".
        setError(toLoadError(error))
      }
    } finally {
      if (requestId === latestRequestRef.current) {
        setLoading(false)
        setHasLoaded(true)
      }
    }
  }, [filterType, filterStatus, filterCompany, debouncedSearchTerm, currentPage, pageSize, sortField, sortDirection])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setCurrentPage(1)
  }, [filterDirection, filterCategory, filterStatus, filterCompany, debouncedSearchTerm, sortField, sortDirection])

  useEffect(() => {
    const loadMilestones = async () => {
      if (formData.contract_id) {
        try {
          const data = await invoiceService.fetchMilestones(formData.contract_id)
          setMilestones(data)
        } catch (error) {
          // "No milestones available" in the form would be a claim about the contract.
          console.error('Error loading milestones:', error)
          setMilestones([])
          toast.error(t('invoices.toast.milestones_load_error'))
        }
      } else {
        setMilestones([])
        setFormData(prev => ({ ...prev, milestone_id: '' }))
      }
    }

    loadMilestones()
    // `toast` is context-stable and `t` only changes on a language switch; neither should
    // re-trigger a milestone fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.contract_id])

  const handleOpenModal = (invoice?: Invoice) => {
    setFieldErrors({})
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
    setFieldErrors({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors = validateInvoice(formData as unknown as Record<string, unknown>, t)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})

    try {
      const counterpartyColumn = getCounterpartyColumn(formData.invoice_type as string)
      if (counterpartyColumn) {
        const counterpartyId = String(
          (formData as unknown as Record<string, unknown>)[counterpartyColumn] || ''
        )
        if (counterpartyId) {
          const isDuplicate = await checkDuplicateInvoiceNumber({
            companyId: formData.company_id as string,
            counterpartyColumn,
            counterpartyId,
            invoiceNumber: formData.invoice_number as string,
            issueDate: formData.issue_date as string,
            excludeId: editingInvoice?.id,
          })
          if (isDuplicate) {
            setFieldErrors({ invoice_number: t('invoices.form.error_invoice_number_duplicate') })
            return
          }
        }
      }

      await invoiceService.handleSubmit(formData, editingInvoice, isOfficeInvoice)
      await fetchData()
      handleCloseModal()
    } catch (error) {
      console.error('Error saving invoice:', error)
      if (isInvoiceNumberDuplicateError(error)) {
        setFieldErrors({
          invoice_number: t('invoices.form.error_invoice_number_duplicate'),
        })
      } else {
        toast.error(toErrorMessage(error, t('invoices.form.error_save')))
      }
    }
  }

  const fetchCreditAllocationsHandler = async (creditId: string) => {
    try {
      const data = await invoiceService.fetchCreditAllocations(creditId)
      setCreditAllocations(data)
    } catch (error) {
      console.error('Error fetching credit allocations:', error)
      setCreditAllocations([])
      toast.error(t('payments.toast.allocations_load_error'))
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

    const validationError = validatePaymentForm(paymentFormData, {
      remainingAmount: payingInvoice.remaining_amount
    })
    if (validationError) {
      toast.error(t(validationError))
      return
    }

    try {
      await invoiceService.handlePaymentSubmit(paymentFormData, payingInvoice)
      await fetchData()
      handleClosePaymentModal()
      toast.success(t('payments.toast.create_success'))
    } catch (error) {
      console.error('Error saving payment:', error)
      toast.error(toErrorMessage(error, t('payments.form.error_save')))
    }
  }

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = (id: string) => setPendingDeleteId(id)

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    setDeleting(true)
    try {
      await invoiceService.handleDelete(pendingDeleteId)
      await fetchData()
    } catch (error) {
      console.error('Error deleting invoice:', error)
      toast.error(toErrorMessage(error, t('invoices.toast.delete_error')))
    } finally {
      setDeleting(false)
      setPendingDeleteId(null)
    }
  }

  const cancelDelete = () => setPendingDeleteId(null)

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
    error,
    refetch: fetchData,
    dismissError: () => setError(null),
    hasLoaded,
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
    fieldErrors,
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
    confirmDelete,
    cancelDelete,
    pendingDeleteId,
    deleting,
    fetchData
  }
}
