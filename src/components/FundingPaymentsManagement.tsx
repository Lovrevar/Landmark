import React, { useState, useEffect } from 'react'
import { supabase, BankCreditPayment, InvestorPayment } from '../lib/supabase'
import { DollarSign, Calendar, FileText, Search, Download, Filter, TrendingUp, AlertCircle, Building2, Users } from 'lucide-react'
import { format } from 'date-fns'

interface BankPaymentWithDetails extends BankCreditPayment {
  bank_name?: string
  credit_type?: string
  project_name?: string
  payment_type: 'bank'
}

interface InvestorPaymentWithDetails extends InvestorPayment {
  investor_name?: string
  investment_type?: string
  project_name?: string
  payment_type: 'investor'
}

type CombinedPayment = BankPaymentWithDetails | InvestorPaymentWithDetails

const FundingPaymentsManagement: React.FC = () => {
  const [payments, setPayments] = useState<CombinedPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'recent' | 'large'>('all')
  const [filterType, setFilterType] = useState<'all' | 'bank' | 'investor'>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [stats, setStats] = useState({
    totalPayments: 0,
    totalAmount: 0,
    paymentsThisMonth: 0,
    amountThisMonth: 0,
    bankPayments: 0,
    investorPayments: 0
  })

  useEffect(() => {
    fetchPayments()
  }, [])

  const fetchPayments = async () => {
    setLoading(true)
    try {
      const { data: bankPaymentsData, error: bankError } = await supabase
        .from('accounting_payments')
        .select(`
          *,
          invoice:accounting_invoices!inner(
            bank_credit_id,
            bank_credits(
              credit_type,
              project_id,
              bank_id,
              banks(name)
            )
          )
        `)
        .not('invoice.bank_credit_id', 'is', null)
        .order('payment_date', { ascending: false })

      if (bankError) throw bankError

      const { data: investorPaymentsData, error: investorError } = await supabase
        .from('accounting_payments')
        .select(`
          *,
          invoice:accounting_invoices!inner(
            investment_id,
            project_investments(
              investment_type,
              project_id,
              investor_id,
              investors(name)
            )
          )
        `)
        .not('invoice.investment_id', 'is', null)
        .order('payment_date', { ascending: false })

      if (investorError) throw investorError

      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')

      if (projectsError) throw projectsError

      const enrichedBankPayments: BankPaymentWithDetails[] = (bankPaymentsData || []).map(payment => {
        const bankCredit = payment.invoice?.bank_credits
        const project = bankCredit?.project_id
          ? projectsData?.find(p => p.id === bankCredit.project_id)
          : undefined

        return {
          ...payment,
          bank_name: bankCredit?.banks?.name || 'Unknown Bank',
          credit_type: bankCredit?.credit_type || 'N/A',
          project_name: project?.name || 'No Project',
          payment_type: 'bank' as const,
          created_at: payment.created_at,
          notes: payment.description
        }
      })

      const enrichedInvestorPayments: InvestorPaymentWithDetails[] = (investorPaymentsData || []).map(payment => {
        const investment = payment.invoice?.project_investments
        const project = investment?.project_id
          ? projectsData?.find(p => p.id === investment.project_id)
          : undefined

        return {
          ...payment,
          investor_name: investment?.investors?.name || 'Unknown Investor',
          investment_type: investment?.investment_type || 'N/A',
          project_name: project?.name || 'No Project',
          payment_type: 'investor' as const,
          created_at: payment.created_at,
          notes: payment.description
        }
      })

      const combinedPayments = [...enrichedBankPayments, ...enrichedInvestorPayments].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setPayments(combinedPayments)
      calculateStats(combinedPayments)
    } catch (error) {
      console.error('Error fetching payments:', error)
      alert('Failed to load payments')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (paymentsData: CombinedPayment[]) => {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const totalAmount = paymentsData.reduce((sum, p) => sum + Number(p.amount), 0)
    const paymentsThisMonth = paymentsData.filter(p => new Date(p.created_at) >= firstDayOfMonth)
    const amountThisMonth = paymentsThisMonth.reduce((sum, p) => sum + Number(p.amount), 0)
    const bankPayments = paymentsData.filter(p => p.payment_type === 'bank').length
    const investorPayments = paymentsData.filter(p => p.payment_type === 'investor').length

    setStats({
      totalPayments: paymentsData.length,
      totalAmount,
      paymentsThisMonth: paymentsThisMonth.length,
      amountThisMonth,
      bankPayments,
      investorPayments
    })
  }

  const filteredPayments = payments.filter(payment => {
    const matchesSearch =
      (payment.payment_type === 'bank'
        ? (payment as BankPaymentWithDetails).bank_name?.toLowerCase().includes(searchTerm.toLowerCase())
        : (payment as InvestorPaymentWithDetails).investor_name?.toLowerCase().includes(searchTerm.toLowerCase())
      ) ||
      payment.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.notes?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDateRange =
      (!dateRange.start || new Date(payment.payment_date || payment.created_at) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(payment.payment_date || payment.created_at) <= new Date(dateRange.end))

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'recent' && new Date(payment.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (filterStatus === 'large' && Number(payment.amount) > 50000)

    const matchesType =
      filterType === 'all' ||
      payment.payment_type === filterType

    return matchesSearch && matchesDateRange && matchesFilter && matchesType
  })

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Recipient', 'Project', 'Category', 'Amount', 'Notes']
    const rows = filteredPayments.map(p => [
      p.payment_date ? format(new Date(p.payment_date), 'yyyy-MM-dd') : format(new Date(p.created_at), 'yyyy-MM-dd'),
      p.payment_type === 'bank' ? 'Bank' : 'Investor',
      p.payment_type === 'bank' ? (p as BankPaymentWithDetails).bank_name : (p as InvestorPaymentWithDetails).investor_name,
      p.project_name,
      p.payment_type === 'bank' ? (p as BankPaymentWithDetails).credit_type : (p as InvestorPaymentWithDetails).investment_type,
      p.amount.toString(),
      p.notes || ''
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `funding-payments-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading payments...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Funding Payments</h1>
        <p className="text-gray-600">Track and manage all funding payments across banks and investors</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Payments</h3>
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalPayments}</p>
          <p className="text-xs text-gray-500 mt-1">{stats.bankPayments} bank, {stats.investorPayments} investor</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Amount</h3>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">€{stats.totalAmount.toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">This Month</h3>
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.paymentsThisMonth}</p>
          <p className="text-xs text-gray-500 mt-1">payments</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Month Amount</h3>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">€{stats.amountThisMonth.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search payments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="bank">Banks</option>
              <option value="investor">Investors</option>
            </select>
          </div>

          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Payments</option>
              <option value="recent">Recent (7 days)</option>
              <option value="large">Large (&gt; €50k)</option>
            </select>
          </div>

          <div>
            <button
              onClick={exportToCSV}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center justify-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="dd/mm/yyyy"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="dd/mm/yyyy"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recipient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium mb-1">No payments found</p>
                    <p className="text-sm">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.payment_date
                        ? format(new Date(payment.payment_date), 'MMM dd, yyyy')
                        : format(new Date(payment.created_at), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${
                        payment.payment_type === 'bank'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {payment.payment_type === 'bank' ? (
                          <>
                            <Building2 className="w-3 h-3 mr-1" />
                            Bank
                          </>
                        ) : (
                          <>
                            <Users className="w-3 h-3 mr-1" />
                            Investor
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {payment.payment_type === 'bank'
                          ? (payment as BankPaymentWithDetails).bank_name
                          : (payment as InvestorPaymentWithDetails).investor_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.project_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payment.payment_type === 'bank'
                        ? (payment as BankPaymentWithDetails).credit_type?.replace('_', ' ').toUpperCase()
                        : (payment as InvestorPaymentWithDetails).investment_type?.toUpperCase()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-green-600">
                        €{Number(payment.amount).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {payment.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredPayments.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Filter className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-900">Filtered Results</span>
            </div>
            <div className="text-sm text-blue-900">
              <span className="font-semibold">{filteredPayments.length}</span> payments totaling{' '}
              <span className="font-semibold">
                €{filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FundingPaymentsManagement
