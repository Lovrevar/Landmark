import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  DollarSign,
  Calendar,
  FileText,
  Search,
  Download,
  Filter,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Building2,
  Users,
  Home,
  ArrowUpCircle,
  ArrowDownCircle
} from 'lucide-react'
import { format } from 'date-fns'

type PaymentCategory = 'income' | 'expense'
type PaymentType = 'sales' | 'supervision' | 'bank' | 'investor'

interface BasePayment {
  id: string
  amount: number
  payment_date: string | null
  notes: string | null
  created_at: string
  category: PaymentCategory
  type: PaymentType
  source_recipient: string
  project_name: string
  description?: string
}

const GeneralPaymentsManagement: React.FC = () => {
  const [payments, setPayments] = useState<BasePayment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState<'all' | 'income' | 'expense'>('all')
  const [filterType, setFilterType] = useState<'all' | PaymentType>('all')
  const [filterAmount, setFilterAmount] = useState<'all' | 'small' | 'medium' | 'large' | 'very_large'>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [stats, setStats] = useState({
    totalPayments: 0,
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    paymentsThisMonth: 0,
    incomeThisMonth: 0,
    expenseThisMonth: 0,
    salesCount: 0,
    supervisionCount: 0,
    bankCount: 0,
    investorCount: 0
  })

  useEffect(() => {
    fetchAllPayments()
  }, [])

  const fetchAllPayments = async () => {
    setLoading(true)
    try {
      const allPayments: BasePayment[] = []

      const { data: salesPaymentsData, error: salesError } = await supabase
        .from('apartment_payments')
        .select(`
          *,
          apartments (
            project_id,
            number
          ),
          customers (
            name,
            surname
          )
        `)
        .order('created_at', { ascending: false })

      if (salesError) throw salesError

      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name')

      const salesPayments: BasePayment[] = (salesPaymentsData || []).map(payment => {
        const customerName = payment.customers
          ? `${payment.customers.name} ${payment.customers.surname}`
          : 'Unknown Customer'

        const project = projectsData?.find(p => p.id === payment.project_id)

        return {
          id: payment.id,
          amount: Number(payment.amount),
          payment_date: payment.payment_date,
          notes: payment.notes,
          created_at: payment.created_at,
          category: 'income' as PaymentCategory,
          type: 'sales' as PaymentType,
          source_recipient: customerName,
          project_name: project?.name || 'No Project',
          description: `Apartment Payment - ${payment.payment_type || 'installment'}`
        }
      })
      allPayments.push(...salesPayments)

      const { data: wirePaymentsData, error: wireError } = await supabase
        .from('subcontractor_payments')
        .select(`
          *,
          contracts (
            project_id
          ),
          subcontractors (
            name
          ),
          subcontractor_milestones (
            project_id
          )
        `)
        .order('created_at', { ascending: false })

      if (wireError) throw wireError

      const supervisionPayments: BasePayment[] = (wirePaymentsData || []).map(payment => {
        let projectId = null

        if (payment.contracts?.project_id) {
          projectId = payment.contracts.project_id
        } else if (payment.subcontractor_milestones?.project_id) {
          projectId = payment.subcontractor_milestones.project_id
        }

        const project = projectId ? projectsData?.find(p => p.id === projectId) : null

        return {
          id: payment.id,
          amount: Number(payment.amount),
          payment_date: payment.payment_date,
          notes: payment.notes,
          created_at: payment.created_at,
          category: 'expense' as PaymentCategory,
          type: 'supervision' as PaymentType,
          source_recipient: payment.subcontractors?.name || 'Unknown Subcontractor',
          project_name: project?.name || 'No Project',
          description: 'Subcontractor Payment'
        }
      })
      allPayments.push(...supervisionPayments)

      const { data: bankPaymentsData, error: bankError } = await supabase
        .from('bank_credit_payments')
        .select(`
          *,
          bank_credits (
            project_id,
            credit_type
          ),
          banks (
            name
          )
        `)
        .order('created_at', { ascending: false })

      if (bankError) throw bankError

      const bankPayments: BasePayment[] = (bankPaymentsData || []).map(payment => {
        const project = payment.bank_credits?.project_id
          ? projectsData?.find(p => p.id === payment.bank_credits.project_id)
          : null

        return {
          id: payment.id,
          amount: Number(payment.amount),
          payment_date: payment.payment_date,
          notes: payment.notes,
          created_at: payment.created_at,
          category: 'expense' as PaymentCategory,
          type: 'bank' as PaymentType,
          source_recipient: payment.banks?.name || 'Unknown Bank',
          project_name: project?.name || 'No Project',
          description: `Bank Payment - ${payment.bank_credits?.credit_type?.replace('_', ' ') || 'Credit'}`
        }
      })
      allPayments.push(...bankPayments)

      const { data: investorPaymentsData, error: investorError } = await supabase
        .from('investor_payments')
        .select(`
          *,
          project_investments (
            project_id,
            investment_type
          ),
          investors (
            name
          )
        `)
        .order('created_at', { ascending: false })

      if (investorError) throw investorError

      const investorPayments: BasePayment[] = (investorPaymentsData || []).map(payment => {
        const project = payment.project_investments?.project_id
          ? projectsData?.find(p => p.id === payment.project_investments.project_id)
          : null

        return {
          id: payment.id,
          amount: Number(payment.amount),
          payment_date: payment.payment_date,
          notes: payment.notes,
          created_at: payment.created_at,
          category: 'expense' as PaymentCategory,
          type: 'investor' as PaymentType,
          source_recipient: payment.investors?.name || 'Unknown Investor',
          project_name: project?.name || 'No Project',
          description: `Investor Payment - ${payment.project_investments?.investment_type || 'Investment'}`
        }
      })
      allPayments.push(...investorPayments)

      allPayments.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setPayments(allPayments)
      calculateStats(allPayments)
    } catch (error) {
      console.error('Error fetching payments:', error)
      alert('Failed to load payments')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (paymentsData: BasePayment[]) => {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const totalIncome = paymentsData
      .filter(p => p.category === 'income')
      .reduce((sum, p) => sum + p.amount, 0)

    const totalExpense = paymentsData
      .filter(p => p.category === 'expense')
      .reduce((sum, p) => sum + p.amount, 0)

    const paymentsThisMonth = paymentsData.filter(p =>
      new Date(p.created_at) >= firstDayOfMonth
    )

    const incomeThisMonth = paymentsThisMonth
      .filter(p => p.category === 'income')
      .reduce((sum, p) => sum + p.amount, 0)

    const expenseThisMonth = paymentsThisMonth
      .filter(p => p.category === 'expense')
      .reduce((sum, p) => sum + p.amount, 0)

    setStats({
      totalPayments: paymentsData.length,
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      paymentsThisMonth: paymentsThisMonth.length,
      incomeThisMonth,
      expenseThisMonth,
      salesCount: paymentsData.filter(p => p.type === 'sales').length,
      supervisionCount: paymentsData.filter(p => p.type === 'supervision').length,
      bankCount: paymentsData.filter(p => p.type === 'bank').length,
      investorCount: paymentsData.filter(p => p.type === 'investor').length
    })
  }

  const filteredPayments = payments.filter(payment => {
    const matchesSearch =
      payment.source_recipient?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.notes?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory =
      filterCategory === 'all' || payment.category === filterCategory

    const matchesType =
      filterType === 'all' || payment.type === filterType

    const matchesAmount =
      filterAmount === 'all' ||
      (filterAmount === 'small' && payment.amount <= 5000) ||
      (filterAmount === 'medium' && payment.amount > 5000 && payment.amount <= 20000) ||
      (filterAmount === 'large' && payment.amount > 20000 && payment.amount <= 50000) ||
      (filterAmount === 'very_large' && payment.amount > 50000)

    const matchesDateRange =
      (!dateRange.start || new Date(payment.payment_date || payment.created_at) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(payment.payment_date || payment.created_at) <= new Date(dateRange.end))

    return matchesSearch && matchesCategory && matchesType && matchesAmount && matchesDateRange
  })

  const exportToCSV = () => {
    const headers = ['Date', 'Category', 'Type', 'Source/Recipient', 'Project', 'Description', 'Amount', 'Notes']
    const rows = filteredPayments.map(p => [
      p.payment_date ? format(new Date(p.payment_date), 'yyyy-MM-dd') : format(new Date(p.created_at), 'yyyy-MM-dd'),
      p.category.toUpperCase(),
      p.type.charAt(0).toUpperCase() + p.type.slice(1),
      p.source_recipient,
      p.project_name,
      p.description || '',
      p.amount.toString(),
      p.notes || ''
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `general-payments-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  const getTypeIcon = (type: PaymentType) => {
    switch (type) {
      case 'sales':
        return <Home className="w-3 h-3 mr-1" />
      case 'supervision':
        return <Users className="w-3 h-3 mr-1" />
      case 'bank':
        return <Building2 className="w-3 h-3 mr-1" />
      case 'investor':
        return <Users className="w-3 h-3 mr-1" />
    }
  }

  const getTypeColor = (type: PaymentType) => {
    switch (type) {
      case 'sales':
        return 'bg-emerald-100 text-emerald-800'
      case 'supervision':
        return 'bg-amber-100 text-amber-800'
      case 'bank':
        return 'bg-blue-100 text-blue-800'
      case 'investor':
        return 'bg-violet-100 text-violet-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payments...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">General Payments Overview</h1>
        <p className="text-gray-600">Complete financial overview across all payment types</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Income</h3>
            <ArrowUpCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">€{stats.totalIncome.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">{stats.salesCount} sales payments</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Expenses</h3>
            <ArrowDownCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-600">€{stats.totalExpense.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.supervisionCount + stats.bankCount + stats.investorCount} expense payments
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Net Balance</h3>
            {stats.netBalance >= 0 ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )}
          </div>
          <p className={`text-2xl font-bold ${stats.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            €{stats.netBalance.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.netBalance >= 0 ? 'Profit' : 'Loss'}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">This Month</h3>
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.paymentsThisMonth}</p>
          <div className="text-xs text-gray-500 mt-1 space-y-1">
            <div className="flex justify-between">
              <span>Income:</span>
              <span className="text-green-600 font-medium">€{stats.incomeThisMonth.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Expenses:</span>
              <span className="text-red-600 font-medium">€{stats.expenseThisMonth.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              <option value="income">Income Only</option>
              <option value="expense">Expenses Only</option>
            </select>
          </div>

          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="sales">Sales</option>
              <option value="supervision">Supervision</option>
              <option value="bank">Banks</option>
              <option value="investor">Investors</option>
            </select>
          </div>

          <div>
            <select
              value={filterAmount}
              onChange={(e) => setFilterAmount(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Amounts</option>
              <option value="small">&lt; €5k</option>
              <option value="medium">€5k - €20k</option>
              <option value="large">€20k - €50k</option>
              <option value="very_large">&gt; €50k</option>
            </select>
          </div>

          <div>
            <button
              onClick={exportToCSV}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center justify-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
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
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source/Recipient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium mb-1">No payments found</p>
                    <p className="text-sm">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={`${payment.type}-${payment.id}`} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.payment_date
                        ? format(new Date(payment.payment_date), 'MMM dd, yyyy')
                        : format(new Date(payment.created_at), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${
                        payment.category === 'income'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {payment.category === 'income' ? (
                          <>
                            <ArrowUpCircle className="w-3 h-3 mr-1" />
                            Income
                          </>
                        ) : (
                          <>
                            <ArrowDownCircle className="w-3 h-3 mr-1" />
                            Expense
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${getTypeColor(payment.type)}`}>
                        {getTypeIcon(payment.type)}
                        {payment.type.charAt(0).toUpperCase() + payment.type.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{payment.source_recipient}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.project_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payment.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`text-sm font-semibold ${
                        payment.category === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {payment.category === 'income' ? '+' : '-'}€{payment.amount.toLocaleString()}
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
            <div className="text-sm text-blue-900 space-x-4">
              <span>
                <span className="font-semibold">{filteredPayments.length}</span> payments
              </span>
              <span className="text-green-700">
                Income: <span className="font-semibold">
                  €{filteredPayments
                    .filter(p => p.category === 'income')
                    .reduce((sum, p) => sum + p.amount, 0)
                    .toLocaleString()}
                </span>
              </span>
              <span className="text-red-700">
                Expenses: <span className="font-semibold">
                  €{filteredPayments
                    .filter(p => p.category === 'expense')
                    .reduce((sum, p) => sum + p.amount, 0)
                    .toLocaleString()}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GeneralPaymentsManagement
