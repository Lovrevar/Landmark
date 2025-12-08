import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Building2, Plus, Search, DollarSign, TrendingUp, TrendingDown, FileText, Eye, Edit, Trash2, X, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

interface Company {
  id: string
  name: string
  oib: string
  initial_balance: number
  created_at: string
}

interface BankAccount {
  id: string
  bank_name: string
  account_number: string | null
  initial_balance: number
  current_balance: number
}

interface Credit {
  id: string
  credit_name: string
  start_date: string
  end_date: string
  grace_period_months: number
  interest_rate: number
  initial_amount: number
  current_balance: number
}

interface Invoice {
  id: string
  invoice_number: string
  invoice_type: 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES' | 'INCOMING_OFFICE' | 'OUTGOING_OFFICE' | 'OUTGOING_RETAIL_DEVELOPMENT' | 'OUTGOING_RETAIL_CONSTRUCTION' | 'INCOMING_RETAIL_SALES'
  invoice_category: string
  total_amount: number
  paid_amount: number
  remaining_amount: number
  status: string
  issue_date: string
  supplier?: { name: string }
  customer?: { name: string; surname: string }
  office_supplier?: { name: string }
  retail_supplier?: { name: string }
  retail_customer?: { name: string }
  company?: { name: string }
  is_cesija_payment?: boolean
  cesija_company_id?: string
  cesija_company_name?: string
  payments?: Array<{
    is_cesija: boolean
    cesija_company_id: string | null
    cesija_bank_account_id: string | null
  }>
}

interface CompanyStats {
  id: string
  name: string
  oib: string
  initial_balance: number
  total_income_invoices: number
  total_income_amount: number
  total_income_paid: number
  total_income_unpaid: number
  total_expense_invoices: number
  total_expense_amount: number
  total_expense_paid: number
  total_expense_unpaid: number
  current_balance: number
  profit: number
  revenue: number
  bank_accounts: BankAccount[]
  credits: Credit[]
  invoices: Invoice[]
}

const AccountingCompanies: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<CompanyStats | null>(null)
  const [editingCompany, setEditingCompany] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    oib: '',
    accountCount: 1,
    bankAccounts: [{ bank_name: '', initial_balance: 0 }]
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      const { data: statsData, error: statsError } = await supabase
        .from('company_statistics')
        .select('*')
        .order('name')

      if (statsError) throw statsError

      const companiesWithStats = (statsData || []).map((stats: any) => ({
        id: stats.id,
        name: stats.name,
        oib: stats.oib,
        initial_balance: stats.initial_balance,
        total_income_invoices: stats.total_income_invoices,
        total_income_amount: stats.total_income_amount,
        total_income_paid: stats.total_income_paid,
        total_income_unpaid: stats.total_income_unpaid,
        total_expense_invoices: stats.total_expense_invoices,
        total_expense_amount: stats.total_expense_amount,
        total_expense_paid: stats.total_expense_paid,
        total_expense_unpaid: stats.total_expense_unpaid,
        current_balance: stats.total_bank_balance + stats.total_credits_available,
        profit: stats.total_income_paid - stats.total_expense_paid,
        revenue: stats.total_income_amount,
        bank_accounts: [],
        credits: [],
        invoices: []
      }))

      setCompanies(companiesWithStats)
    } catch (error) {
      console.error('Error fetching companies:', error)
    } finally {
      setLoading(false)
    }
  }

  const isIncomeInvoice = (invoiceType: string) => {
    return invoiceType === 'INCOMING_INVESTMENT' || invoiceType === 'OUTGOING_SALES' || invoiceType === 'OUTGOING_OFFICE' || invoiceType === 'INCOMING_RETAIL_SALES'
  }

  const getInvoiceEntityName = (invoice: Invoice) => {
    if (invoice.invoice_category === 'RETAIL') {
      if (invoice.invoice_type === 'INCOMING_SUPPLIER') {
        return invoice.retail_supplier?.name || 'N/A'
      } else if (invoice.invoice_type === 'OUTGOING_SALES') {
        return invoice.retail_customer?.name || 'N/A'
      }
    }

    if (invoice.invoice_type === 'INCOMING_INVESTMENT' || invoice.invoice_type === 'OUTGOING_SALES') {
      if (invoice.customer) {
        return `${invoice.customer.name} ${invoice.customer.surname}`.trim()
      }
      return 'N/A'
    } else if (invoice.invoice_type === 'INCOMING_OFFICE' || invoice.invoice_type === 'OUTGOING_OFFICE') {
      return invoice.office_supplier?.name || 'N/A'
    } else if (invoice.invoice_type === 'OUTGOING_RETAIL_DEVELOPMENT' || invoice.invoice_type === 'OUTGOING_RETAIL_CONSTRUCTION') {
      return invoice.retail_supplier?.name || 'N/A'
    } else if (invoice.invoice_type === 'INCOMING_RETAIL_SALES') {
      return invoice.retail_customer?.name || 'N/A'
    } else {
      return invoice.supplier?.name || 'N/A'
    }
  }

  const handleOpenAddModal = (company?: CompanyStats) => {
    if (company) {
      setEditingCompany(company.id)
      const bankAccountsForEdit = company.bank_accounts.map(acc => ({
        id: acc.id,
        bank_name: acc.bank_name,
        initial_balance: acc.initial_balance
      }))
      setFormData({
        name: company.name,
        oib: company.oib,
        accountCount: bankAccountsForEdit.length,
        bankAccounts: bankAccountsForEdit
      })
    } else {
      setEditingCompany(null)
      setFormData({
        name: '',
        oib: '',
        accountCount: 1,
        bankAccounts: [{ bank_name: '', initial_balance: 0 }]
      })
    }
    document.body.style.overflow = 'hidden'
    setShowAddModal(true)
  }

  const handleCloseAddModal = () => {
    setFormData({ name: '', oib: '', accountCount: 1, bankAccounts: [{ bank_name: '', initial_balance: 0 }] })
    document.body.style.overflow = 'unset'
    setShowAddModal(false)
    setEditingCompany(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingCompany) {
        const { error } = await supabase
          .from('accounting_companies')
          .update({
            name: formData.name,
            oib: formData.oib,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCompany)

        if (error) throw error

        for (const account of formData.bankAccounts) {
          if (account.id) {
            const { error: updateError } = await supabase
              .from('company_bank_accounts')
              .update({
                initial_balance: account.initial_balance,
                updated_at: new Date().toISOString()
              })
              .eq('id', account.id)

            if (updateError) throw updateError

            const { data: paymentsSum } = await supabase
              .from('accounting_payments')
              .select('amount, invoice:accounting_invoices!inner(invoice_type)')
              .eq('invoice.company_bank_account_id', account.id)

            let totalChange = 0
            if (paymentsSum && paymentsSum.length > 0) {
              totalChange = paymentsSum.reduce((sum, payment: any) => {
                const invoiceType = payment.invoice?.invoice_type
                if (invoiceType && ['INCOMING_INVESTMENT', 'OUTGOING_SALES'].includes(invoiceType)) {
                  return sum + payment.amount
                } else if (invoiceType && ['INCOMING_SUPPLIER', 'INCOMING_OFFICE', 'OUTGOING_SUPPLIER', 'OUTGOING_OFFICE'].includes(invoiceType)) {
                  return sum - payment.amount
                }
                return sum
              }, 0)
            }

            const { error: balanceError } = await supabase
              .from('company_bank_accounts')
              .update({
                current_balance: account.initial_balance + totalChange
              })
              .eq('id', account.id)

            if (balanceError) throw balanceError
          }
        }
      } else {
        const { data: companyData, error: companyError } = await supabase
          .from('accounting_companies')
          .insert([{
            name: formData.name,
            oib: formData.oib,
            initial_balance: 0
          }])
          .select()
          .single()

        if (companyError) throw companyError

        const bankAccountsToInsert = formData.bankAccounts.map(acc => ({
          company_id: companyData.id,
          bank_name: acc.bank_name,
          initial_balance: acc.initial_balance,
          current_balance: acc.initial_balance
        }))

        const { error: bankError } = await supabase
          .from('company_bank_accounts')
          .insert(bankAccountsToInsert)

        if (bankError) throw bankError
      }

      await fetchData()
      handleCloseAddModal()
    } catch (error: any) {
      console.error('Error saving company:', error)
      if (error.code === '23505') {
        alert('OIB već postoji u sustavu!')
      } else {
        alert('Greška prilikom spremanja firme')
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Jeste li sigurni da želite obrisati ovu firmu? Svi računi povezani s firmom će biti odspojeni.')) return

    try {
      const { error } = await supabase
        .from('accounting_companies')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('Error deleting company:', error)
      alert('Greška prilikom brisanja firme')
    }
  }

  const handleViewDetails = async (company: CompanyStats) => {
    try {
      const [
        bankAccountsResult,
        creditsResult,
        invoicesResult
      ] = await Promise.all([
        supabase
          .from('company_bank_accounts')
          .select('*')
          .eq('company_id', company.id)
          .order('bank_name'),

        supabase
          .from('company_credits')
          .select('*')
          .eq('company_id', company.id)
          .order('credit_name'),

        supabase
          .from('accounting_invoices')
          .select(`
            id,
            invoice_number,
            invoice_type,
            invoice_category,
            total_amount,
            paid_amount,
            remaining_amount,
            status,
            issue_date,
            supplier:supplier_id (name),
            customer:customer_id (name, surname),
            office_supplier:office_supplier_id (name),
            retail_supplier:retail_suppliers!accounting_invoices_retail_supplier_id_fkey (name),
            retail_customer:retail_customers!accounting_invoices_retail_customer_id_fkey (name),
            company:company_id (name)
          `)
          .eq('company_id', company.id)
          .order('issue_date', { ascending: false })
          .limit(100)
      ])

      const bankAccounts = bankAccountsResult.data || []
      const bankAccountIds = bankAccounts.map(ba => ba.id)
      const credits = creditsResult.data || []
      const creditIds = credits.map(c => c.id)

      let cesijaPaidInvoices: any[] = []

      const { data: paymentsWhereWePayOthers } = await supabase
        .from('accounting_payments')
        .select(`
          invoice_id,
          cesija_company_id,
          accounting_invoices!inner(company_id)
        `)
        .eq('is_cesija', true)
        .or(`cesija_credit_id.in.(${creditIds.length > 0 ? creditIds.join(',') : 'null'}),cesija_bank_account_id.in.(${bankAccountIds.length > 0 ? bankAccountIds.join(',') : 'null'})`)

      const ownInvoiceIds = (invoicesResult.data || []).map(inv => inv.id)
      const { data: paymentsWhereOthersPayUs } = await supabase
        .from('accounting_payments')
        .select(`
          invoice_id,
          cesija_company_id
        `)
        .eq('is_cesija', true)
        .in('invoice_id', ownInvoiceIds.length > 0 ? ownInvoiceIds : ['null'])

      const allCesijaPayments = [
        ...(paymentsWhereWePayOthers || []),
        ...(paymentsWhereOthersPayUs || [])
      ]

      const cesijaPaidInvoiceIds = [...new Set(allCesijaPayments.map(p => p.invoice_id))]

      if (cesijaPaidInvoiceIds.length > 0) {
        const { data: cesiaInvoicesData } = await supabase
          .from('accounting_invoices')
          .select(`
            id,
            invoice_number,
            invoice_type,
            invoice_category,
            total_amount,
            paid_amount,
            remaining_amount,
            status,
            issue_date,
            supplier:supplier_id (name),
            customer:customer_id (name, surname),
            office_supplier:office_supplier_id (name),
            retail_supplier:retail_suppliers!accounting_invoices_retail_supplier_id_fkey (name),
            retail_customer:retail_customers!accounting_invoices_retail_customer_id_fkey (name),
            company:company_id (name)
          `)
          .in('id', cesijaPaidInvoiceIds)
          .order('issue_date', { ascending: false })

        cesijaPaidInvoices = (cesiaInvoicesData || []).map(inv => {
          const payment = allCesijaPayments.find(p => p.invoice_id === inv.id)
          return {
            ...inv,
            is_cesija_payment: true,
            cesija_company_id: payment?.cesija_company_id
          }
        })
      }

      const ownInvoices = (invoicesResult.data || []).map(inv => {
        const payment = allCesijaPayments.find(p => p.invoice_id === inv.id)
        return {
          ...inv,
          is_cesija_payment: !!payment,
          cesija_company_id: payment?.cesija_company_id
        }
      })

      const allInvoicesMap = new Map()
      ownInvoices.forEach(inv => allInvoicesMap.set(inv.id, inv))
      cesijaPaidInvoices.forEach(inv => {
        if (!allInvoicesMap.has(inv.id)) {
          allInvoicesMap.set(inv.id, inv)
        }
      })

      const allInvoices = Array.from(allInvoicesMap.values()).sort((a, b) =>
        new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime()
      )

      const companiesData = await supabase
        .from('accounting_companies')
        .select('id, name')

      const companiesMap = new Map((companiesData.data || []).map(c => [c.id, c.name]))

      const allInvoicesWithCesija = allInvoices.map(inv => {
        let cesija_name = null

        if (inv.is_cesija_payment) {
          if (inv.cesija_company_id === company.id) {
            cesija_name = inv.company?.name || companiesMap.get(inv.company_id)
          } else {
            cesija_name = companiesMap.get(inv.cesija_company_id)
          }
        }

        return {
          ...inv,
          cesija_company_name: cesija_name
        }
      })

      const companyWithDetails = {
        ...company,
        bank_accounts: bankAccounts,
        credits,
        invoices: allInvoicesWithCesija
      }

      setSelectedCompany(companyWithDetails)
      document.body.style.overflow = 'hidden'
      setShowDetailsModal(true)
    } catch (error) {
      console.error('Error loading company details:', error)
      alert('Greška pri učitavanju detalja firme')
    }
  }

  const handleCloseDetailsModal = () => {
    document.body.style.overflow = 'unset'
    setShowDetailsModal(false)
    setSelectedCompany(null)
  }

  const handleAccountCountChange = (count: number) => {
    const newCount = Math.max(1, Math.min(10, count))
    const currentAccounts = formData.bankAccounts

    if (newCount > currentAccounts.length) {
      const newAccounts = [...currentAccounts]
      for (let i = currentAccounts.length; i < newCount; i++) {
        newAccounts.push({ bank_name: '', initial_balance: 0 })
      }
      setFormData({ ...formData, accountCount: newCount, bankAccounts: newAccounts })
    } else if (newCount < currentAccounts.length) {
      setFormData({ ...formData, accountCount: newCount, bankAccounts: currentAccounts.slice(0, newCount) })
    }
  }

  const handleBankAccountChange = (index: number, field: 'bank_name' | 'initial_balance', value: string | number) => {
    const newAccounts = [...formData.bankAccounts]
    newAccounts[index] = { ...newAccounts[index], [field]: value }
    setFormData({ ...formData, bankAccounts: newAccounts })
  }

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.oib.includes(searchTerm)
  )

  const totalBalance = companies.reduce((sum, c) => sum + c.current_balance, 0)
  const totalRevenue = companies.reduce((sum, c) => sum + c.revenue, 0)
  const totalProfit = companies.reduce((sum, c) => sum + c.profit, 0)
  const totalExpensePaid = companies.reduce((sum, c) => sum + c.total_expense_paid, 0)

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
          <h1 className="text-2xl font-bold text-gray-900">Moje firme</h1>
          <p className="text-sm text-gray-600 mt-1">Financijski pregled svih firmi pod Landmarkom</p>
        </div>
        <button
          onClick={() => handleOpenAddModal()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 whitespace-nowrap"
        >
          <Plus className="w-5 h-5 mr-2" />
          Dodaj novu firmu
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno firmi</p>
              <p className="text-2xl font-bold text-gray-900">{companies.length}</p>
            </div>
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupno stanje</p>
              <p className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                €{totalBalance.toLocaleString()}
              </p>
            </div>
            <DollarSign className={`w-8 h-8 ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ukupan promet</p>
              <p className="text-2xl font-bold text-blue-600">
                €{totalRevenue.toLocaleString()}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Dobit/Gubitak</p>
              <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                €{totalProfit.toLocaleString()}
              </p>
            </div>
            {totalProfit >= 0 ? (
              <TrendingUp className="w-8 h-8 text-green-600" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-600" />
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Pretraži firme po imenu ili OIB-u..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {filteredCompanies.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm ? 'Nema rezultata pretrage' : 'Nema firmi'}
          </h3>
          <p className="text-gray-600">
            {searchTerm ? 'Pokušajte s drugim pojmom' : 'Dodajte prvu firmu klikom na gumb iznad'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompanies.map((company) => (
            <div
              key={company.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{company.name}</h3>
                  <p className="text-sm text-gray-600">OIB: {company.oib}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Trenutno stanje</p>
                  <p className={`text-xl font-bold ${company.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    €{company.current_balance.toLocaleString()}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center mb-1">
                      <ArrowUpCircle className="w-4 h-4 text-green-600 mr-1" />
                      <p className="text-xs text-green-700">Izdano</p>
                    </div>
                    <p className="text-sm font-bold text-green-900">€{company.total_income_paid.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">{company.total_income_invoices} računa</p>
                  </div>

                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="flex items-center mb-1">
                      <ArrowDownCircle className="w-4 h-4 text-red-600 mr-1" />
                      <p className="text-xs text-red-700">Plaćeno</p>
                    </div>
                    <p className="text-sm font-bold text-red-900">€{company.total_expense_paid.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">{company.total_expense_invoices} računa</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Promet:</span>
                    <span className="font-medium text-gray-900">€{company.revenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Dobit/Gubitak:</span>
                    <span className={`font-medium ${company.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      €{company.profit.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Neplaćeno (prihod):</span>
                    <span className="text-orange-600">€{company.total_income_unpaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Neplaćeno (rashod):</span>
                    <span className="text-orange-600">€{company.total_expense_unpaid.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleViewDetails(company)}
                  className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Detalji
                </button>
                <button
                  onClick={() => handleOpenAddModal(company)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Uredi"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(company.id)}
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

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCompany ? 'Uredi firmu' : 'Nova firma'}
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
                    Naziv firme *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder="npr. Landmark d.o.o."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    OIB *
                  </label>
                  <input
                    type="text"
                    value={formData.oib}
                    onChange={(e) => setFormData({ ...formData, oib: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder="12345678901"
                    maxLength={11}
                    pattern="[0-9]{11}"
                    title="OIB mora imati točno 11 brojeva"
                  />
                  <p className="text-xs text-gray-500 mt-1">Unesite 11-znamenkasti OIB</p>
                </div>

                {!editingCompany && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Broj bankovnih računa *
                    </label>
                    <select
                      value={formData.accountCount}
                      onChange={(e) => handleAccountCountChange(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Odaberite broj bankovnih računa</p>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Bankovni računi</h3>
                  {formData.bankAccounts.map((account, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg space-y-3 border border-gray-200">
                      <p className="text-sm font-medium text-gray-700">Račun #{index + 1}</p>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Naziv banke *
                        </label>
                        <input
                          type="text"
                          value={account.bank_name}
                          onChange={(e) => handleBankAccountChange(index, 'bank_name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          required
                          placeholder="npr. Erste banka"
                          disabled={editingCompany !== null}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Početno stanje (€) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={account.initial_balance}
                          onChange={(e) => handleBankAccountChange(index, 'initial_balance', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          required
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    {editingCompany ? (
                      <>
                        <strong>Napomena:</strong> Možete promijeniti početna stanja računa. Current balance će se preračunati
                        automatski na osnovu novih početnih stanja.
                      </>
                    ) : (
                      <>
                        <strong>Napomena:</strong> Nakon dodavanja firme i bankovnih računa, svaki račun će se automatski
                        ažurirati kada izdajete ili plaćate račune.
                      </>
                    )}
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
                  {editingCompany ? 'Spremi promjene' : 'Dodaj firmu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailsModal && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedCompany.name}</h2>
                <p className="text-sm text-gray-600">OIB: {selectedCompany.oib}</p>
              </div>
              <button
                onClick={handleCloseDetailsModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-700">Početno stanje</p>
                  <p className="text-2xl font-bold text-blue-900">€{selectedCompany.initial_balance.toLocaleString()}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-700">Izdano računa</p>
                  <p className="text-2xl font-bold text-green-900">€{selectedCompany.total_income_paid.toLocaleString()}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-red-700">Plaćeno računa</p>
                  <p className="text-2xl font-bold text-red-900">€{selectedCompany.total_expense_paid.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700">Trenutno stanje</p>
                  <p className={`text-2xl font-bold ${selectedCompany.current_balance >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                    €{selectedCompany.current_balance.toLocaleString()}
                  </p>
                </div>
                <div className={`${selectedCompany.profit >= 0 ? 'bg-green-50' : 'bg-red-50'} p-4 rounded-lg`}>
                  <p className={`text-sm ${selectedCompany.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {selectedCompany.profit >= 0 ? 'Dobit' : 'Gubitak'}
                  </p>
                  <p className={`text-2xl font-bold ${selectedCompany.profit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                    €{Math.abs(selectedCompany.profit).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Bankovni računi ({selectedCompany.bank_accounts.length})
                </h3>
                {selectedCompany.bank_accounts.length === 0 ? (
                  <p className="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">Nema dodanih bankovnih računa</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedCompany.bank_accounts.map((account) => (
                      <div key={account.id} className="bg-white border-2 border-blue-200 rounded-lg p-4">
                        <p className="font-semibold text-gray-900 mb-2">{account.bank_name}</p>
                        {account.account_number && (
                          <p className="text-xs text-gray-500 mb-2">{account.account_number}</p>
                        )}
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Početno:</span>
                            <span className="font-medium text-gray-900">€{account.initial_balance.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Trenutno:</span>
                            <span className={`font-bold ${account.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              €{account.current_balance.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Krediti ({selectedCompany.credits.length})
                </h3>
                {selectedCompany.credits.length === 0 ? (
                  <p className="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">Nema dodanih kredita</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedCompany.credits.map((credit) => {
                      const available = credit.initial_amount - credit.current_balance
                      const utilizationPercent = credit.initial_amount > 0 ? (credit.current_balance / credit.initial_amount) * 100 : 0
                      const isExpired = new Date(credit.end_date) < new Date()

                      return (
                        <div key={credit.id} className="bg-white border-2 border-orange-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-semibold text-gray-900">{credit.credit_name}</p>
                            {isExpired && (
                              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">
                                ISTEKAO
                              </span>
                            )}
                          </div>
                          <div className="space-y-1 mb-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Limit:</span>
                              <span className="font-medium text-gray-900">€{credit.initial_amount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Iskorišteno:</span>
                              <span className="font-medium text-orange-600">€{credit.current_balance.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Dostupno:</span>
                              <span className="font-bold text-green-600">€{available.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Kamata:</span>
                              <span className="font-medium text-gray-900">{credit.interest_rate}%</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                utilizationPercent >= 90 ? 'bg-red-500' :
                                utilizationPercent >= 70 ? 'bg-orange-500' :
                                'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1 text-right">{utilizationPercent.toFixed(1)}% iskorišteno</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Svi računi ({selectedCompany.invoices.length})
                </h3>
                {selectedCompany.invoices.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Nema računa</p>
                ) : (
                  <div className="space-y-3">
                    {selectedCompany.invoices.map((invoice) => (
                      <div key={invoice.id} className={`border-2 rounded-lg p-4 ${
                        invoice.is_cesija_payment
                          ? 'border-purple-200 bg-purple-50'
                          : isIncomeInvoice(invoice.invoice_type) ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                      }`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              {isIncomeInvoice(invoice.invoice_type) ? (
                                <ArrowUpCircle className="w-5 h-5 text-green-600" />
                              ) : (
                                <ArrowDownCircle className="w-5 h-5 text-red-600" />
                              )}
                              <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                isIncomeInvoice(invoice.invoice_type) ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                              }`}>
                                {isIncomeInvoice(invoice.invoice_type) ? 'PRIHOD' : 'RASHOD'}
                              </span>
                              {invoice.is_cesija_payment && (
                                <span className="px-2 py-1 rounded text-xs font-bold bg-purple-200 text-purple-900 border border-purple-400">
                                  CESIJA - {invoice.cesija_company_name || 'Nepoznata firma'}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {invoice.invoice_type === 'INCOMING_OFFICE' || invoice.invoice_type === 'OUTGOING_OFFICE'
                                ? `Office dobavljač: ${getInvoiceEntityName(invoice)}`
                                : isIncomeInvoice(invoice.invoice_type)
                                ? `Kupac: ${getInvoiceEntityName(invoice)}`
                                : `Dobavljač: ${getInvoiceEntityName(invoice)}`}
                            </p>
                            <p className="text-xs text-gray-500">{new Date(invoice.issue_date).toLocaleDateString('hr-HR')}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                            invoice.status === 'PARTIALLY_PAID' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {invoice.status === 'PAID' ? 'Plaćeno' :
                             invoice.status === 'PARTIALLY_PAID' ? 'Djelomično' : 'Neplaćeno'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-300">
                          <div>
                            <p className="text-xs text-gray-600">Ukupno</p>
                            <p className="text-sm font-medium">€{invoice.total_amount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Plaćeno</p>
                            <p className="text-sm font-medium text-green-700">€{invoice.paid_amount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Preostalo</p>
                            <p className="text-sm font-medium text-orange-700">€{invoice.remaining_amount.toLocaleString()}</p>
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

export default AccountingCompanies
