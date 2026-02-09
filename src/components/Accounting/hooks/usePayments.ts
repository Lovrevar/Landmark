import { useState, useEffect } from 'react'
import {
  Payment,
  Invoice,
  Company,
  CompanyBankAccount,
  CompanyCredit,
  PaymentFormData,
  VisibleColumns,
  FilterMethod,
  FilterInvoiceType
} from '../types/paymentTypes'
import {
  fetchPayments,
  fetchInvoices,
  fetchCompanies,
  fetchBankAccounts,
  fetchCredits,
  createPayment,
  updatePayment,
  deletePayment
} from '../services/paymentService'

export const usePayments = () => {
  const [payments, setPayments] = useState<Payment[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyBankAccounts, setCompanyBankAccounts] = useState<CompanyBankAccount[]>([])
  const [companyCredits, setCompanyCredits] = useState<CompanyCredit[]>([])
  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState('')
  const [filterMethod, setFilterMethod] = useState<FilterMethod>('ALL')
  const [filterInvoiceType, setFilterInvoiceType] = useState<FilterInvoiceType>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null)

  const [formData, setFormData] = useState<PaymentFormData>({
    invoice_id: '',
    payment_source_type: 'bank_account',
    company_bank_account_id: '',
    credit_id: '',
    is_cesija: false,
    cesija_company_id: '',
    cesija_bank_account_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    amount: 0,
    payment_method: 'WIRE',
    reference_number: '',
    description: ''
  })

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

  const fetchData = async () => {
    try {
      setLoading(true)

      const [
        paymentsResult,
        invoicesResult,
        companiesResult,
        bankAccountsResult,
        creditsResult
      ] = await Promise.all([
        fetchPayments(),
        fetchInvoices(),
        fetchCompanies(),
        fetchBankAccounts(),
        fetchCredits()
      ])

      setInvoices(invoicesResult)
      setCompanies(companiesResult)
      setCompanyBankAccounts(bankAccountsResult)
      setCompanyCredits(creditsResult)

      const companiesMap = new Map(companiesResult.map(c => [c.id, c.name]))
      const paymentsWithCesija = paymentsResult.map((payment: any) => ({
        ...payment,
        cesija_company_name: payment.cesija_company_id ? companiesMap.get(payment.cesija_company_id) : null
      }))
      setPayments(paymentsWithCesija)

    } catch (error) {
      console.error('Error fetching data:', error)
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

  const handleOpenModal = (payment?: Payment) => {
    if (payment) {
      setEditingPayment(payment)
      setFormData({
        invoice_id: payment.invoice_id,
        payment_source_type: 'bank_account',
        company_bank_account_id: '',
        credit_id: '',
        is_cesija: false,
        cesija_company_id: '',
        cesija_bank_account_id: '',
        payment_date: payment.payment_date,
        amount: payment.amount,
        payment_method: payment.payment_method,
        reference_number: payment.reference_number || '',
        description: payment.description
      })
    } else {
      setEditingPayment(null)
      setFormData({
        invoice_id: '',
        payment_source_type: 'bank_account',
        company_bank_account_id: '',
        credit_id: '',
        is_cesija: false,
        cesija_company_id: '',
        cesija_bank_account_id: '',
        payment_date: new Date().toISOString().split('T')[0],
        amount: 0,
        payment_method: 'WIRE',
        reference_number: '',
        description: ''
      })
    }
    document.body.style.overflow = 'hidden'
    setShowPaymentModal(true)
  }

  const handleCloseModal = () => {
    document.body.style.overflow = 'unset'
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

    try {
      if (editingPayment) {
        await updatePayment(editingPayment.id, formData)
      } else {
        await createPayment(formData)
      }

      await fetchData()
      handleCloseModal()
    } catch (error) {
      console.error('Error saving payment:', error)
      alert('Greška prilikom spremanja plaćanja')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Jeste li sigurni da želite obrisati ovo plaćanje?')) return

    try {
      await deletePayment(id)
      await fetchData()
    } catch (error) {
      console.error('Error deleting payment:', error)
      alert('Greška prilikom brisanja plaćanja')
    }
  }

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

    const isExpense = invoice.invoice_type === 'INCOMING_SUPPLIER' || invoice.invoice_type === 'OUTGOING_SUPPLIER' || invoice.invoice_type === 'INCOMING_OFFICE'
    const isIncome = invoice.invoice_type === 'INCOMING_INVESTMENT' || invoice.invoice_type === 'OUTGOING_SALES' || invoice.invoice_type === 'OUTGOING_OFFICE'

    const matchesInvoiceType = filterInvoiceType === 'ALL' ||
                               (filterInvoiceType === 'EXPENSE' && isExpense) ||
                               (filterInvoiceType === 'INCOME' && isIncome)

    const paymentDate = new Date(payment.payment_date)
    const matchesDateFrom = !dateFrom || paymentDate >= new Date(dateFrom)
    const matchesDateTo = !dateTo || paymentDate <= new Date(dateTo)

    return matchesSearch && matchesMethod && matchesInvoiceType && matchesDateFrom && matchesDateTo
  })

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
    loading,
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
    filteredPayments,
    resetDateFilters
  }
}
