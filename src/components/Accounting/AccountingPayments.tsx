import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { CreditCard, Plus, Search, Filter, Edit, Trash2, X, Columns, Check, DollarSign } from 'lucide-react'
import { format } from 'date-fns'

interface Invoice {
  id: string
  invoice_number: string
  invoice_type: 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES' | 'INCOMING_OFFICE' | 'OUTGOING_OFFICE' | 'INCOMING_BANK' | 'OUTGOING_BANK'
  total_amount: number
  paid_amount: number
  remaining_amount: number
  vat_amount: number
  company_id: string
  companies?: { name: string }
  subcontractors?: { name: string }
  customers?: { name: string; surname: string }
  office_suppliers?: { name: string }
  bank_company?: { name: string }
}

interface CompanyBankAccount {
  id: string
  company_id: string
  bank_name: string
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

interface Company {
  id: string
  name: string
}

interface Payment {
  id: string
  invoice_id: string
  payment_date: string
  amount: number
  payment_method: 'WIRE' | 'CASH' | 'CHECK' | 'CARD'
  reference_number: string | null
  description: string
  created_at: string
  is_cesija: boolean
  cesija_company_id: string | null
  cesija_company_name?: string
  accounting_invoices?: Invoice
}

const AccountingPayments: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyBankAccounts, setCompanyBankAccounts] = useState<CompanyBankAccount[]>([])
  const [companyCredits, setCompanyCredits] = useState<CompanyCredit[]>([])
  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState('')
  const [filterMethod, setFilterMethod] = useState<'ALL' | 'WIRE' | 'CASH' | 'CHECK' | 'CARD'>('ALL')
  const [filterInvoiceType, setFilterInvoiceType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL')
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)

  const [formData, setFormData] = useState({
    invoice_id: '',
    payment_source_type: 'bank_account' as 'bank_account' | 'credit',
    company_bank_account_id: '',
    credit_id: '',
    is_cesija: false,
    cesija_company_id: '',
    cesija_bank_account_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    amount: 0,
    payment_method: 'WIRE' as 'WIRE' | 'CASH' | 'CHECK' | 'CARD',
    reference_number: '',
    description: ''
  })

  const [visibleColumns, setVisibleColumns] = useState(() => {
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

  const columnLabels = {
    payment_date: 'Datum plaćanja',
    invoice_number: 'Broj računa',
    my_company: 'Moja Firma',
    invoice_type: 'Tip računa',
    company_supplier: 'Firma/Dobavljač',
    amount: 'Iznos',
    payment_method: 'Način plaćanja',
    reference_number: 'Referenca',
    description: 'Opis'
  }

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
        supabase
          .from('accounting_payments')
          .select(`
            *,
            accounting_invoices (
              id,
              invoice_number,
              invoice_type,
              total_amount,
              paid_amount,
              remaining_amount,
              vat_amount,
              companies:company_id (name),
              subcontractors:supplier_id (name),
              customers:customer_id (name, surname),
              office_suppliers:office_supplier_id (name),
              bank_company:bank_id (name)
            )
          `)
          .order('payment_date', { ascending: false }),

        supabase
          .from('accounting_invoices')
          .select(`
            id,
            invoice_number,
            invoice_type,
            total_amount,
            paid_amount,
            remaining_amount,
            company_id,
            companies:company_id (name),
            subcontractors:supplier_id (name),
            customers:customer_id (name, surname),
            office_suppliers:office_supplier_id (name),
            bank_company:bank_id (name)
          `)
          .neq('status', 'PAID')
          .order('invoice_number'),

        supabase
          .from('accounting_companies')
          .select('id, name')
          .order('name'),

        supabase
          .from('company_bank_accounts')
          .select('*')
          .order('bank_name'),

        supabase
          .from('bank_credits')
          .select('*')
          .order('credit_name')
      ])

      if (paymentsResult.error) throw paymentsResult.error

      if (invoicesResult.error) throw invoicesResult.error
      setInvoices(invoicesResult.data || [])

      if (companiesResult.error) throw companiesResult.error
      const companiesData = companiesResult.data || []
      setCompanies(companiesData)

      if (bankAccountsResult.error) throw bankAccountsResult.error
      setCompanyBankAccounts(bankAccountsResult.data || [])

      if (creditsResult.error) throw creditsResult.error
      setCompanyCredits(creditsResult.data || [])

      const companiesMap = new Map(companiesData.map(c => [c.id, c.name]))
      const paymentsWithCesija = (paymentsResult.data || []).map((payment: any) => ({
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const paymentData = {
        invoice_id: formData.invoice_id,
        payment_source_type: formData.is_cesija ? 'bank_account' : formData.payment_source_type,
        company_bank_account_id: formData.is_cesija ? null : (formData.payment_source_type === 'bank_account' ? (formData.company_bank_account_id || null) : null),
        credit_id: formData.is_cesija ? null : (formData.payment_source_type === 'credit' ? (formData.credit_id || null) : null),
        is_cesija: formData.is_cesija,
        cesija_company_id: formData.is_cesija ? (formData.cesija_company_id || null) : null,
        cesija_bank_account_id: formData.is_cesija ? (formData.cesija_bank_account_id || null) : null,
        payment_date: formData.payment_date,
        amount: formData.amount,
        payment_method: formData.payment_method,
        reference_number: formData.reference_number || null,
        description: formData.description,
        created_by: user?.id
      }

      if (editingPayment) {
        const { error } = await supabase
          .from('accounting_payments')
          .update(paymentData)
          .eq('id', editingPayment.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('accounting_payments')
          .insert([paymentData])

        if (error) throw error
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
      const { error } = await supabase
        .from('accounting_payments')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('Error deleting payment:', error)
      alert('Greška prilikom brisanja plaćanja')
    }
  }

  const filteredPayments = payments.filter(payment => {
    const invoice = payment.accounting_invoices
    if (!invoice) return false

    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (payment.reference_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.description.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesMethod = filterMethod === 'ALL' || payment.payment_method === filterMethod

    const isExpense = invoice.invoice_type === 'INCOMING_SUPPLIER' || invoice.invoice_type === 'OUTGOING_SUPPLIER' || invoice.invoice_type === 'INCOMING_OFFICE'
    const isIncome = invoice.invoice_type === 'INCOMING_INVESTMENT' || invoice.invoice_type === 'OUTGOING_SALES' || invoice.invoice_type === 'OUTGOING_OFFICE'

    const matchesInvoiceType = filterInvoiceType === 'ALL' ||
                               (filterInvoiceType === 'EXPENSE' && isExpense) ||
                               (filterInvoiceType === 'INCOME' && isIncome)

    return matchesSearch && matchesMethod && matchesInvoiceType
  })

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'WIRE': return 'Virman'
      case 'CASH': return 'Gotovina'
      case 'CHECK': return 'Ček'
      case 'CARD': return 'Kartica'
      default: return method
    }
  }

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'WIRE': return 'bg-blue-100 text-blue-800'
      case 'CASH': return 'bg-green-100 text-green-800'
      case 'CHECK': return 'bg-yellow-100 text-yellow-800'
      case 'CARD': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Učitavanje...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plaćanja</h1>
          <p className="text-sm text-gray-600 mt-1">Pregled svih izvršenih plaćanja</p>
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
            onClick={() => handleOpenModal()}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 whitespace-nowrap"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo plaćanje
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex flex-col">
            <p className="text-xs text-gray-600 mb-1">Ukupno plaćanja</p>
            <p className="text-xl font-bold text-gray-900">{payments.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex flex-col">
            <p className="text-xs text-gray-600 mb-1">Ukupan iznos</p>
            <p className="text-xl font-bold text-gray-900">
              €{payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex flex-col">
            <p className="text-xs text-gray-600 mb-1">Ovaj mjesec</p>
            <p className="text-xl font-bold text-blue-600">
              €{payments
                .filter(p => {
                  const paymentMonth = new Date(p.payment_date).getMonth()
                  const currentMonth = new Date().getMonth()
                  const paymentYear = new Date(p.payment_date).getFullYear()
                  const currentYear = new Date().getFullYear()
                  return paymentMonth === currentMonth && paymentYear === currentYear
                })
                .reduce((sum, p) => sum + p.amount, 0)
                .toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-200">
          <div className="flex flex-col">
            <p className="text-xs text-red-700 mb-1">PDV Ulaz</p>
            <p className="text-xl font-bold text-red-900">
              €{payments
                .filter(p => {
                  const invoice = p.accounting_invoices
                  return invoice && (invoice.invoice_type === 'INCOMING_SUPPLIER' || invoice.invoice_type === 'OUTGOING_SUPPLIER' || invoice.invoice_type === 'INCOMING_OFFICE')
                })
                .reduce((sum, p) => {
                  const invoice = p.accounting_invoices
                  if (!invoice) return sum
                  const vatRatio = p.amount / invoice.total_amount
                  return sum + (invoice.vat_amount * vatRatio)
                }, 0)
                .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg shadow-sm border border-green-200">
          <div className="flex flex-col">
            <p className="text-xs text-green-700 mb-1">PDV Izlaz</p>
            <p className="text-xl font-bold text-green-900">
              €{payments
                .filter(p => {
                  const invoice = p.accounting_invoices
                  return invoice && (invoice.invoice_type === 'INCOMING_INVESTMENT' || invoice.invoice_type === 'OUTGOING_SALES' || invoice.invoice_type === 'OUTGOING_OFFICE')
                })
                .reduce((sum, p) => {
                  const invoice = p.accounting_invoices
                  if (!invoice) return sum
                  const vatRatio = p.amount / invoice.total_amount
                  return sum + (invoice.vat_amount * vatRatio)
                }, 0)
                .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-200">
          <div className="flex flex-col">
            <p className="text-xs text-red-700 mb-1">Ukupno Rashod</p>
            <p className="text-xl font-bold text-red-900">
              €{payments
                .filter(p => {
                  const invoice = p.accounting_invoices
                  return invoice && (invoice.invoice_type === 'INCOMING_SUPPLIER' || invoice.invoice_type === 'OUTGOING_SUPPLIER' || invoice.invoice_type === 'INCOMING_OFFICE')
                })
                .reduce((sum, p) => sum + p.amount, 0)
                .toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg shadow-sm border border-green-200">
          <div className="flex flex-col">
            <p className="text-xs text-green-700 mb-1">Ukupno Prihod</p>
            <p className="text-xl font-bold text-green-900">
              €{payments
                .filter(p => {
                  const invoice = p.accounting_invoices
                  return invoice && (invoice.invoice_type === 'INCOMING_INVESTMENT' || invoice.invoice_type === 'OUTGOING_SALES' || invoice.invoice_type === 'OUTGOING_OFFICE')
                })
                .reduce((sum, p) => sum + p.amount, 0)
                .toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Pretraži po broju računa, referenci..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">Svi načini plaćanja</option>
            <option value="WIRE">Virman</option>
            <option value="CASH">Gotovina</option>
            <option value="CHECK">Ček</option>
            <option value="CARD">Kartica</option>
          </select>

          <select
            value={filterInvoiceType}
            onChange={(e) => setFilterInvoiceType(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">Svi tipovi računa</option>
            <option value="EXPENSE">Ulazni</option>
            <option value="INCOME">Izlazni</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                {visibleColumns.payment_date && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum plaćanja</th>}
                {visibleColumns.invoice_number && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broj računa</th>}
                {visibleColumns.my_company && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Moja Firma</th>}
                {visibleColumns.invoice_type && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tip</th>}
                {visibleColumns.company_supplier && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firma/Dobavljač</th>}
                {visibleColumns.amount && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Iznos</th>}
                {visibleColumns.payment_method && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Način plaćanja</th>}
                {visibleColumns.reference_number && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referenca</th>}
                {visibleColumns.description && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opis</th>}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50">Akcije</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="px-6 py-12 text-center">
                    <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Nema pronađenih plaćanja</p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => {
                  const invoice = payment.accounting_invoices
                  if (!invoice) return null

                  return (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      {visibleColumns.payment_date && (
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {format(new Date(payment.payment_date), 'dd.MM.yyyy')}
                        </td>
                      )}
                      {visibleColumns.invoice_number && (
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {invoice.invoice_number}
                        </td>
                      )}
                      {visibleColumns.my_company && (
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                          {invoice.companies?.name || '-'}
                        </td>
                      )}
                      {visibleColumns.invoice_type && (
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`text-xs font-semibold ${
                            invoice.invoice_type === 'INCOMING_SUPPLIER' || invoice.invoice_type === 'OUTGOING_SUPPLIER' || invoice.invoice_type === 'INCOMING_OFFICE' || invoice.invoice_type === 'OUTGOING_BANK'
                            ? 'text-red-600' : 'text-green-600'}`}>
                            {invoice.invoice_type === 'INCOMING_SUPPLIER' || invoice.invoice_type === 'OUTGOING_SUPPLIER' || invoice.invoice_type === 'INCOMING_OFFICE' || invoice.invoice_type === 'OUTGOING_BANK'
                            ? 'RASHOD' : 'PRIHOD'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.company_supplier && (
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {invoice.bank_company?.name ||
                           invoice.office_suppliers?.name ||
                           invoice.subcontractors?.name ||
                           (invoice.customers ? `${invoice.customers.name} ${invoice.customers.surname}` : '') ||
                           invoice.companies?.name ||
                           '-'}
                        </td>
                      )}
                      {visibleColumns.amount && (
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                          €{payment.amount.toLocaleString()}
                        </td>
                      )}
                      {visibleColumns.payment_method && (
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentMethodColor(payment.payment_method)}`}>
                            {getPaymentMethodLabel(payment.payment_method)}
                          </span>
                        </td>
                      )}
                      {visibleColumns.reference_number && (
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                          {payment.reference_number || '-'}
                        </td>
                      )}
                      {visibleColumns.description && (
                        <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">
                          {payment.is_cesija && payment.cesija_company_name ? (
                            <span className="font-medium text-purple-700">
                              Cesija - {payment.cesija_company_name}
                            </span>
                          ) : (
                            payment.description || '-'
                          )}
                        </td>
                      )}
                      <td className="px-4 py-4 whitespace-nowrap text-sm sticky right-0 bg-white">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleOpenModal(payment)}
                            title="Uredi"
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(payment.id)}
                            title="Obriši"
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Prikazano: {filteredPayments.length} od {payments.length} plaćanja</span>
          <div className="flex items-center space-x-6 text-sm">
            <div>
              <span className="text-gray-600">Ukupan iznos filtriranih: </span>
              <span className="font-semibold text-green-600">
                €{filteredPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">
                {editingPayment ? 'Uredi plaćanje' : 'Novo plaćanje'}
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
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Račun *
                  </label>
                  <select
                    value={formData.invoice_id}
                    onChange={(e) => {
                      const selectedInvoice = invoices.find(inv => inv.id === e.target.value)
                      setFormData({
                        ...formData,
                        invoice_id: e.target.value,
                        company_bank_account_id: '',
                        amount: selectedInvoice ? selectedInvoice.remaining_amount : 0
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={!!editingPayment}
                  >
                    <option value="">Odaberi račun</option>
                    {invoices.map(invoice => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number} -
                        {invoice.invoice_type === 'EXPENSE'
                          ? ` ${invoice.subcontractors?.name}`
                          : invoice.customers ? ` ${invoice.customers.name} ${invoice.customers.surname}` : ''} -
                        Preostalo: €{invoice.remaining_amount.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

{formData.invoice_id && !formData.is_cesija && (
                  <>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Izvor plaćanja *
                      </label>
                      <select
                        value={formData.payment_source_type}
                        onChange={(e) => setFormData({
                          ...formData,
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

                    {formData.payment_source_type === 'bank_account' && (
                      <div className="md:col-span-2">
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
                          {companyBankAccounts
                            .filter(acc => {
                              const selectedInvoice = invoices.find(inv => inv.id === formData.invoice_id)
                              return selectedInvoice && acc.company_id === selectedInvoice.company_id
                            })
                            .map(account => (
                              <option key={account.id} value={account.id}>
                                {account.bank_name} (Saldo: €{account.current_balance.toLocaleString()})
                              </option>
                            ))}
                        </select>
                        {formData.invoice_id && companyBankAccounts.filter(acc => {
                          const selectedInvoice = invoices.find(inv => inv.id === formData.invoice_id)
                          return selectedInvoice && acc.company_id === selectedInvoice.company_id
                        }).length === 0 && (
                          <p className="text-xs text-red-600 mt-1">
                            Ova firma nema dodanih bankovnih računa. Molimo dodajte račun u sekciji Firme.
                          </p>
                        )}
                      </div>
                    )}

                    {formData.payment_source_type === 'credit' && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Kredit *
                        </label>
                        <select
                          value={formData.credit_id}
                          onChange={(e) => setFormData({ ...formData, credit_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        >
                          <option value="">Odaberi kredit</option>
                          {companyCredits
                            .filter(credit => {
                              const selectedInvoice = invoices.find(inv => inv.id === formData.invoice_id)
                              return selectedInvoice && credit.company_id === selectedInvoice.company_id
                            })
                            .map(credit => {
                              const available = credit.amount - credit.used_amount
                              return (
                                <option key={credit.id} value={credit.id}>
                                  {credit.credit_name} (Dostupno: €{available.toLocaleString()})
                                </option>
                              )
                            })}
                        </select>
                        {formData.invoice_id && companyCredits.filter(credit => {
                          const selectedInvoice = invoices.find(inv => inv.id === formData.invoice_id)
                          return selectedInvoice && credit.company_id === selectedInvoice.company_id
                        }).length === 0 && (
                          <p className="text-xs text-red-600 mt-1">
                            Ova firma nema dodanih kredita. Molimo dodajte kredit u sekciji Krediti.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {formData.invoice_id && (
                  <div className="md:col-span-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_cesija}
                        onChange={(e) => setFormData({
                          ...formData,
                          is_cesija: e.target.checked,
                          company_bank_account_id: e.target.checked ? '' : formData.company_bank_account_id,
                          cesija_company_id: '',
                          cesija_bank_account_id: ''
                        })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Ugovor o cesiji (plaćanje iz druge firme)
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      Označite ako želite platiti račun s bankovnog računa druge firme
                    </p>
                  </div>
                )}

                {formData.is_cesija && (
                  <>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Firma koja plaća (cesija) *
                      </label>
                      <select
                        value={formData.cesija_company_id}
                        onChange={(e) => setFormData({
                          ...formData,
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

                    {formData.cesija_company_id && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bankovni račun (cesija) *
                        </label>
                        <select
                          value={formData.cesija_bank_account_id}
                          onChange={(e) => setFormData({ ...formData, cesija_bank_account_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        >
                          <option value="">Odaberi bankovni račun</option>
                          {companyBankAccounts
                            .filter(acc => acc.company_id === formData.cesija_company_id)
                            .map(account => (
                              <option key={account.id} value={account.id}>
                                {account.bank_name} (Saldo: €{account.current_balance.toLocaleString()})
                              </option>
                            ))}
                        </select>
                        {formData.cesija_company_id && companyBankAccounts.filter(acc => acc.company_id === formData.cesija_company_id).length === 0 && (
                          <p className="text-xs text-red-600 mt-1">
                            Ova firma nema dodanih bankovnih računa. Molimo dodajte račun u sekciji Firme.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Datum plaćanja *
                  </label>
                  <input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Iznos *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Način plaćanja *
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
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
                    value={formData.reference_number}
                    onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
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
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Dodatne napomene..."
                />
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
                  {editingPayment ? 'Spremi promjene' : 'Kreiraj plaćanje'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AccountingPayments
