import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { TrendingUp, Plus, Search, Trash2, X, Building2, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import DateInput from '../Common/DateInput'
import CurrencyInput from '../Common/CurrencyInput'

interface CompanyLoan {
  id: string
  from_company_id: string
  from_bank_account_id: string
  to_company_id: string
  to_bank_account_id: string
  amount: number
  loan_date: string
  created_at: string
  from_company: { name: string }
  to_company: { name: string }
  from_bank_account: { bank_name: string; account_number: string | null }
  to_bank_account: { bank_name: string; account_number: string | null }
}

interface Company {
  id: string
  name: string
  oib: string
}

interface BankAccount {
  id: string
  company_id: string
  bank_name: string
  account_number: string | null
  current_balance: number
}

const AccountingLoans: React.FC = () => {
  const [loans, setLoans] = useState<CompanyLoan[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  const [formData, setFormData] = useState({
    from_company_id: '',
    from_bank_account_id: '',
    to_company_id: '',
    to_bank_account_id: '',
    amount: '',
    loan_date: format(new Date(), 'yyyy-MM-dd')
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [loansRes, companiesRes, accountsRes] = await Promise.all([
        supabase
          .from('company_loans')
          .select(`
            *,
            from_company:accounting_companies!from_company_id(name),
            to_company:accounting_companies!to_company_id(name),
            from_bank_account:company_bank_accounts!from_bank_account_id(bank_name, account_number),
            to_bank_account:company_bank_accounts!to_bank_account_id(bank_name, account_number)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('accounting_companies')
          .select('id, name, oib')
          .order('name'),
        supabase
          .from('company_bank_accounts')
          .select('id, company_id, bank_name, account_number, current_balance')
          .order('bank_name')
      ])

      if (loansRes.data) setLoans(loansRes.data as any)
      if (companiesRes.data) setCompanies(companiesRes.data)
      if (accountsRes.data) setBankAccounts(accountsRes.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.from_company_id || !formData.from_bank_account_id ||
        !formData.to_company_id || !formData.to_bank_account_id ||
        !formData.amount) {
      alert('Molimo popunite sva obavezna polja')
      return
    }

    try {
      const { error } = await supabase
        .from('company_loans')
        .insert({
          from_company_id: formData.from_company_id,
          from_bank_account_id: formData.from_bank_account_id,
          to_company_id: formData.to_company_id,
          to_bank_account_id: formData.to_bank_account_id,
          amount: parseFloat(formData.amount),
          loan_date: formData.loan_date || null
        })

      if (error) throw error

      await fetchData()
      setShowAddModal(false)
      resetForm()
    } catch (error) {
      console.error('Error creating loan:', error)
      alert('Greška pri kreiranju pozajmice')
    }
  }

  const handleDeleteLoan = async (loanId: string) => {
    if (!confirm('Jeste li sigurni da želite obrisati ovu pozajmicu?')) return

    try {
      const { error } = await supabase
        .from('company_loans')
        .delete()
        .eq('id', loanId)

      if (error) throw error
      await fetchData()
    } catch (error) {
      console.error('Error deleting loan:', error)
      alert('Greška pri brisanju pozajmice')
    }
  }

  const resetForm = () => {
    setFormData({
      from_company_id: '',
      from_bank_account_id: '',
      to_company_id: '',
      to_bank_account_id: '',
      amount: '',
      loan_date: format(new Date(), 'yyyy-MM-dd')
    })
  }

  const getFromCompanyAccounts = () => {
    return bankAccounts.filter(acc => acc.company_id === formData.from_company_id)
  }

  const getToCompanyAccounts = () => {
    return bankAccounts.filter(acc => acc.company_id === formData.to_company_id)
  }

  const filteredLoans = loans.filter(loan =>
    loan.from_company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loan.to_company.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pozajmice</h1>
            <p className="text-sm text-gray-600">Evidencija pozajmica između firmi</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          <Plus className="w-5 h-5" />
          <span>Nova Pozajmica</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Pretraži pozajmice..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Datum
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Daje
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Račun (Daje)
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Prima
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Račun (Prima)
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Iznos
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Akcije
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Nema pozajmica
                  </td>
                </tr>
              ) : (
                filteredLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(loan.loan_date), 'dd.MM.yyyy')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {loan.from_company.name}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        <div className="font-medium">{loan.from_bank_account.bank_name}</div>
                        {loan.from_bank_account.account_number && (
                          <div className="text-xs text-gray-500">{loan.from_bank_account.account_number}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {loan.to_company.name}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        <div className="font-medium">{loan.to_bank_account.bank_name}</div>
                        {loan.to_bank_account.account_number && (
                          <div className="text-xs text-gray-500">{loan.to_bank_account.account_number}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        €{loan.amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleDeleteLoan(loan.id)}
                        className="text-red-600 hover:text-red-800 transition-colors duration-200"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Nova Pozajmica</h2>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  resetForm()
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddLoan} className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Daje <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <select
                      value={formData.from_company_id}
                      onChange={(e) => setFormData({
                        ...formData,
                        from_company_id: e.target.value,
                        from_bank_account_id: ''
                      })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Odaberite firmu</option>
                      {companies.map(company => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {formData.from_company_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Račun (Daje) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.from_bank_account_id}
                      onChange={(e) => setFormData({ ...formData, from_bank_account_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Odaberite račun</option>
                      {getFromCompanyAccounts().map(account => (
                        <option key={account.id} value={account.id}>
                          {account.bank_name} {account.account_number ? `- ${account.account_number}` : ''} (Stanje: €{account.current_balance.toLocaleString('hr-HR', { minimumFractionDigits: 2 })})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-4"></div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prima <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <select
                      value={formData.to_company_id}
                      onChange={(e) => setFormData({
                        ...formData,
                        to_company_id: e.target.value,
                        to_bank_account_id: ''
                      })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Odaberite firmu</option>
                      {companies.map(company => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {formData.to_company_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Račun (Prima) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.to_bank_account_id}
                      onChange={(e) => setFormData({ ...formData, to_bank_account_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Odaberite račun</option>
                      {getToCompanyAccounts().map(account => (
                        <option key={account.id} value={account.id}>
                          {account.bank_name} {account.account_number ? `- ${account.account_number}` : ''} (Stanje: €{account.current_balance.toLocaleString('hr-HR', { minimumFractionDigits: 2 })})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-4"></div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Datum
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                    <DateInput
                      value={formData.loan_date}
                      onChange={(value) => setFormData({ ...formData, loan_date: value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Iznos <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 font-medium pointer-events-none">€</span>
                    <CurrencyInput
                      value={parseFloat(formData.amount) || 0}
                      onChange={(value) => setFormData({ ...formData, amount: value.toString() })}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0,00"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    resetForm()
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Spremi Pozajmicu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AccountingLoans
