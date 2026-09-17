import { useState, useEffect } from 'react'
import {
  Payment,
  Invoice,
  Company,
  CompanyBankAccount,
  CompanyCredit,
  CreditAllocation,
  PaymentFormData,
  VisibleColumns,
  FilterMethod,
  FilterInvoiceType
} from '../types'
import {
  fetchPayments,
  fetchInvoices,
  fetchInvoiceById,
  fetchCompanies,
  fetchBankAccounts,
  fetchCredits,
  createPayment,
  updatePayment,
  deletePayment
} from '../services/paymentService'
import { fetchCreditAllocations } from '../../Invoices/services/invoiceService'
import { toLoadError } from '../../services/loadError'
import { toErrorMessage } from '../../../../lib/errorMessage'
import { validatePaymentForm } from '../services/paymentValidation'
import { lockBodyScroll, unlockBodyScroll } from '../../../../hooks/useModalOverflow'
import { useToast } from '../../../../contexts/ToastContext'
import { useTranslation } from 'react-i18next'

const createEmptyFormData = (): PaymentFormData => ({
  invoice_id: '',
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
  amount: 0,
  payment_method: 'WIRE',
  reference_number: '',
  description: ''
})

export const usePayments = () => {
  const toast = useToast()
  const { t } = useTranslation()
  const [payments, setPayments] = useState<Payment[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyBankAccounts, setCompanyBankAccounts] = useState<CompanyBankAccount[]>([])
  const [companyCredits, setCompanyCredits] = useState<CompanyCredit[]>([])
  const [creditAllocations, setCreditAllocations] = useState<CreditAllocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [filterMethod, setFilterMethod] = useState<FilterMethod>('ALL')
  const [filterInvoiceType, setFilterInvoiceType] = useState<FilterInvoiceType>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 100
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null)

  const [formData, setFormData] = useState<PaymentFormData>(createEmptyFormData)

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>(() => {
    const saved = localStorage.getItem('accountingPaymentsColumns')
    return saved ? JSON.parse(saved) : {
      payment_date: true,
      invoice_number: true,
      my_company: true,
      invoice_type: true,
      company_supplier: true,
      amount: true,
      payment_method: true,
      reference_number: true,
      description: true
    }
  })

  // Five independent fetches. `allSettled` rather than `all` so one failure (say the credit
  // list, which only the form needs) does not blank the payments table as well — whatever
  // resolved is shown, and the failure is surfaced through `error`.
  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        paymentsResult,
        invoicesResult,
        companiesResult,
        bankAccountsResult,
        creditsResult
      ] = await Promise.allSettled([
        fetchPayments(),
        fetchInvoices(),
        fetchCompanies(),
        fetchBankAccounts(),
        fetchCredits()
      ])

      const firstRejection = [
        paymentsResult,
        invoicesResult,
        companiesResult,
        bankAccountsResult,
        creditsResult
      ].find((r): r is PromiseRejectedResult => r.status === 'rejected')

      if (invoicesResult.status === 'fulfilled') setInvoices(invoicesResult.value)
      if (companiesResult.status === 'fulfilled') setCompanies(companiesResult.value)
      if (bankAccountsResult.status === 'fulfilled') setCompanyBankAccounts(bankAccountsResult.value)
      if (creditsResult.status === 'fulfilled') setCompanyCredits(creditsResult.value)

      if (paymentsResult.status === 'fulfilled') {
        const companiesMap = new Map(
          (companiesResult.status === 'fulfilled' ? companiesResult.value : []).map(c => [c.id, c.name])
        )
        const paymentsWithCesija = paymentsResult.value.map((payment: Record<string, unknown>) => ({
          ...payment,
          cesija_company_name: payment.cesija_company_id ? companiesMap.get(payment.cesija_company_id as string) : null
        }))
        setPayments(paymentsWithCesija as unknown as Payment[])
      }

      if (firstRejection) {
        console.error('Error fetching data:', firstRejection.reason)
        setError(toLoadError(firstRejection.reason))
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      setError(toLoadError(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    localStorage.setItem('accountingPaymentsColumns', JSON.stringify(visibleColumns))
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

  const handleCreditChange = async (creditId: string) => {
    if (!creditId) {
      setCreditAllocations([])
      return
    }
    try {
      setCreditAllocations(await fetchCreditAllocations(creditId))
    } catch (error) {
      // An empty allocation dropdown otherwise says this credit has nothing allocated.
      console.error('Error fetching credit allocations:', error)
      setCreditAllocations([])
      toast.error(t('payments.toast.allocations_load_error'))
    }
  }

  const handleOpenModal = async (payment?: Payment) => {
    setCreditAllocations([])
    if (payment) {
      setEditingPayment(payment)
      setFormData({
        ...createEmptyFormData(),
        invoice_id: payment.invoice_id,
        payment_source_type: payment.payment_source_type || 'bank_account',
        company_bank_account_id: payment.company_bank_account_id || '',
        credit_id: payment.credit_id || '',
        credit_allocation_id: payment.credit_allocation_id || '',
        is_cesija: payment.is_cesija || false,
        cesija_company_id: payment.cesija_company_id || '',
        cesija_bank_account_id: payment.cesija_bank_account_id || '',
        cesija_credit_id: payment.cesija_credit_id || '',
        cesija_credit_allocation_id: payment.cesija_credit_allocation_id || '',
        payment_date: payment.payment_date,
        amount: payment.amount,
        payment_method: payment.payment_method,
        reference_number: payment.reference_number || '',
        description: payment.description
      })

      // Preload allocations for the credit-funded source so the saved allocation shows
      const editCreditId = payment.is_cesija ? payment.cesija_credit_id : payment.credit_id
      if (payment.payment_source_type === 'credit' && editCreditId) {
        void handleCreditChange(editCreditId)
      }

      const alreadyInList = invoices.some(inv => inv.id === payment.invoice_id)
      if (!alreadyInList) {
        try {
          const invoice = await fetchInvoiceById(payment.invoice_id)
          if (invoice) {
            setInvoices(prev => [invoice, ...prev])
          }
        } catch (error) {
          // Without its invoice in the list the modal opens with an empty invoice field, as
          // if the payment were unattached.
          console.error('Error fetching invoice for edit:', error)
          toast.error(t('payments.toast.invoice_load_error'))
        }
      }
    } else {
      setEditingPayment(null)
      setFormData(createEmptyFormData())
    }
    lockBodyScroll()
    setShowPaymentModal(true)
  }

  const handleCloseModal = () => {
    unlockBodyScroll()
    setShowPaymentModal(false)
    setEditingPayment(null)
  }

  const handleViewPayment = (payment: Payment) => {
    setViewingPayment(payment)
  }

  const handleCloseDetailView = () => {
    setViewingPayment(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payingInvoice = invoices.find(inv => inv.id === formData.invoice_id)
    const validationError = validatePaymentForm(formData, {
      remainingAmount: payingInvoice?.remaining_amount,
      // remaining_amount already has the edited payment subtracted; add it back.
      originalAmount: editingPayment?.amount
    })
    if (validationError) {
      toast.error(t(validationError))
      return
    }

    const wasEditing = !!editingPayment
    try {
      if (editingPayment) {
        await updatePayment(editingPayment.id, formData)
      } else {
        await createPayment(formData)
      }

      await fetchData()
      handleCloseModal()
      // Until now the only sign a payment had been recorded was the page flashing a spinner.
      toast.success(wasEditing ? t('payments.toast.update_success') : t('payments.toast.create_success'))
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
      await deletePayment(pendingDeleteId)
      await fetchData()
      toast.success(t('payments.toast.delete_success'))
    } catch (error) {
      console.error('Error deleting payment:', error)
      toast.error(toErrorMessage(error, t('payments.toast.delete_error')))
    } finally {
      setDeleting(false)
      setPendingDeleteId(null)
    }
  }

  const cancelDelete = () => setPendingDeleteId(null)

  const filteredPayments = payments.filter(payment => {
    const invoice = payment.accounting_invoices
    if (!invoice) return false

    const myCompanyName = invoice.companies?.name || ''
    const companySupplierName =
      invoice.bank_company?.name ||
      invoice.office_suppliers?.name ||
      invoice.subcontractors?.name ||
      (invoice.customers ? `${invoice.customers.name} ${invoice.customers.surname}` : '') ||
      ''

    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (payment.reference_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      myCompanyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      companySupplierName.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesMethod = filterMethod === 'ALL' || payment.payment_method === filterMethod

    const isExpense = invoice.invoice_type.startsWith('INCOMING_')
    const isIncome = invoice.invoice_type.startsWith('OUTGOING_')

    const matchesInvoiceType = filterInvoiceType === 'ALL' ||
                               (filterInvoiceType === 'EXPENSE' && isExpense) ||
                               (filterInvoiceType === 'INCOME' && isIncome)

    const paymentDate = new Date(payment.payment_date)
    const matchesDateFrom = !dateFrom || paymentDate >= new Date(dateFrom)
    const matchesDateTo = !dateTo || paymentDate <= new Date(dateTo)

    return matchesSearch && matchesMethod && matchesInvoiceType && matchesDateFrom && matchesDateTo
  })

  const paginatedPayments = filteredPayments.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterMethod, filterInvoiceType, dateFrom, dateTo])

  const resetDateFilters = () => {
    setDateFrom('')
    setDateTo('')
  }

  return {
    payments,
    invoices,
    companies,
    companyBankAccounts,
    companyCredits,
    creditAllocations,
    handleCreditChange,
    loading,
    error,
    refetch: fetchData,
    dismissError: () => setError(null),
    searchTerm,
    setSearchTerm,
    filterMethod,
    setFilterMethod,
    filterInvoiceType,
    setFilterInvoiceType,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    showColumnMenu,
    setShowColumnMenu,
    showPaymentModal,
    editingPayment,
    viewingPayment,
    formData,
    setFormData,
    visibleColumns,
    toggleColumn,
    handleOpenModal,
    handleCloseModal,
    handleViewPayment,
    handleCloseDetailView,
    handleSubmit,
    handleDelete,
    confirmDelete,
    cancelDelete,
    pendingDeleteId,
    deleting,
    filteredPayments,
    paginatedPayments,
    currentPage,
    setCurrentPage,
    pageSize,
    totalCount: filteredPayments.length,
    resetDateFilters
  }
}
