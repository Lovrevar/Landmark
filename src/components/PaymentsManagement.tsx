import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DollarSign, Calendar, Search, Download, Filter, TrendingUp, TrendingDown, AlertCircle, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { format } from 'date-fns'

interface UnifiedPayment {
  id: string
  date: string
  type: 'income' | 'expense'
  category: 'Sales' | 'Bank Payment' | 'Investor Payment' | 'Subcontractor Payment'
  entity: string
  project?: string
  amount: number
  notes?: string
  created_at: string
}

const PaymentsManagement: React.FC = () => {
  const [payments, setPayments] = useState<UnifiedPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    incomeCount: 0,
    expenseCount: 0
  })

  useEffect(() => {
    fetchAllPayments()
  }, [])

  const fetchAllPayments = async () => {
    setLoading(true)
    try {
      const allPayments: UnifiedPayment[] = []

      // 1. Fetch Sales Payments (Income - Green)
      const { data: apartmentPayments } = await supabase
        .from('apartment_payments')
        .select(`
          *,
          customers (name),
          projects (name),
          apartments (
            apartment_number,
            buildings (building_name)
          )
        `)
        .order('payment_date', { ascending: false })

      if (apartmentPayments) {
        apartmentPayments.forEach(p => {
          const buildingName = p.apartments?.buildings?.building_name || ''
          const apartmentNumber = p.apartments?.apartment_number || ''
          const apartmentInfo = buildingName && apartmentNumber ? `${buildingName} - ${apartmentNumber}` : buildingName || apartmentNumber || ''

          allPayments.push({
            id: p.id,
            date: p.payment_date,
            type: 'income',
            category: 'Sales',
            entity: p.customers?.name || 'Unknown Customer',
            project: p.projects?.name || 'N/A',
            amount: parseFloat(p.amount),
            notes: apartmentInfo || p.notes || '',
            created_at: p.created_at
          })
        })
      }

      // 2. Fetch Bank Credit Payments (Expense - Red)
      const { data: bankPayments } = await supabase
        .from('bank_credit_payments')
        .select(`
          *,
          bank_credits (
            banks (name),
            projects (name)
          )
        `)
        .order('payment_date', { ascending: false })

      if (bankPayments) {
        bankPayments.forEach(p => {
          allPayments.push({
            id: p.id,
            date: p.payment_date,
            type: 'expense',
            category: 'Bank Payment',
            entity: p.bank_credits?.banks?.name || 'Unknown Bank',
            project: p.bank_credits?.projects?.name || 'N/A',
            amount: p.amount,
            notes: p.notes || '',
            created_at: p.created_at
          })
        })
      }

      // 3. Fetch Investor Payments (Expense - Red)
      const { data: investorPayments } = await supabase
        .from('investor_payments')
        .select(`
          *,
          project_investments (
            investors (name),
            projects (name)
          )
        `)
        .order('payment_date', { ascending: false })

      if (investorPayments) {
        investorPayments.forEach(p => {
          allPayments.push({
            id: p.id,
            date: p.payment_date,
            type: 'expense',
            category: 'Investor Payment',
            entity: p.project_investments?.investors?.name || 'Unknown Investor',
            project: p.project_investments?.projects?.name || 'N/A',
            amount: p.amount,
            notes: p.notes || '',
            created_at: p.created_at
          })
        })
      }

      // 4. Fetch Subcontractor Payments (Expense - Red)
      const { data: wirePayments } = await supabase
        .from('wire_payments')
        .select(`
          *,
          subcontractors (name),
          contracts (
            projects (name)
          )
        `)
        .order('created_at', { ascending: false })

      if (wirePayments) {
        wirePayments.forEach(p => {
          allPayments.push({
            id: p.id,
            date: p.payment_date || p.created_at,
            type: 'expense',
            category: 'Subcontractor Payment',
            entity: p.subcontractors?.name || 'Unknown Subcontractor',
            project: p.contracts?.projects?.name || 'N/A',
            amount: p.amount,
            notes: p.notes || '',
            created_at: p.created_at
          })
        })
      }

      // Sort all payments by date (newest first)
      allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      setPayments(allPayments)
      calculateStats(allPayments)
    } catch (error) {
      console.error('Error fetching payments:', error)
      alert('Failed to load payments')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (paymentsData: UnifiedPayment[]) => {
    const income = paymentsData.filter(p => p.type === 'income')
    const expense = paymentsData.filter(p => p.type === 'expense')

    const totalIncome = income.reduce((sum, p) => sum + p.amount, 0)
    const totalExpense = expense.reduce((sum, p) => sum + p.amount, 0)

    setStats({
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      incomeCount: income.length,
      expenseCount: expense.length
    })
  }

  const filteredPayments = payments.filter(payment => {
    const matchesSearch =
      payment.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.project?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.notes?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType =
      filterType === 'all' ||
      payment.type === filterType

    const matchesCategory =
      filterCategory === 'all' ||
      payment.category === filterCategory

    const matchesDateRange =
      (!dateRange.start || new Date(payment.date) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(payment.date) <= new Date(dateRange.end))

    return matchesSearch && matchesType && matchesCategory && matchesDateRange
  })

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Category', 'Entity', 'Project', 'Amount', 'Notes']
    const rows = filteredPayments.map(p => [
      format(new Date(p.date), 'yyyy-MM-dd'),
      p.type,
      p.category,
      p.entity,
      p.project || '',
      p.amount.toString(),
      p.notes || ''
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `all-payments-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading all payments...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">All Payments</h1>
        <p className="text-gray-600">Complete overview of all income and expenses across the company</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm p-6 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-green-800">Total Income</h3>
            <ArrowUpCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-900">€{stats.totalIncome.toLocaleString()}</p>
          <p className="text-xs text-green-700 mt-1">{stats.incomeCount} payments</p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-sm p-6 border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-red-800">Total Expenses</h3>
            <ArrowDownCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-900">€{stats.totalExpense.toLocaleString()}</p>
          <p className="text-xs text-red-700 mt-1">{stats.expenseCount} payments</p>
        </div>

        <div className={`bg-gradient-to-br ${stats.netBalance >= 0 ? 'from-blue-50 to-blue-100 border-blue-200' : 'from-orange-50 to-orange-100 border-orange-200'} rounded-xl shadow-sm p-6 border`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm font-medium ${stats.netBalance >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>Net Balance</h3>
            <DollarSign className={`w-5 h-5 ${stats.netBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
          </div>
          <p className={`text-2xl font-bold ${stats.netBalance >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
            €{Math.abs(stats.netBalance).toLocaleString()}
          </p>
          <p className={`text-xs ${stats.netBalance >= 0 ? 'text-blue-700' : 'text-orange-700'} mt-1`}>
            {stats.netBalance >= 0 ? 'Positive' : 'Negative'}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Payments</h3>
            <Calendar className="w-5 h-5 text-gray-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{payments.length}</p>
          <p className="text-xs text-gray-500 mt-1">all transactions</p>
        </div>
      </div>

      {/* Filters and Search */}
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
              <option value="income">Income Only</option>
              <option value="expense">Expenses Only</option>
            </select>
          </div>

          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              <option value="Sales">Sales</option>
              <option value="Bank Payment">Bank Payments</option>
              <option value="Investor Payment">Investor Payments</option>
              <option value="Subcontractor Payment">Subcontractor Payments</option>
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

      {/* Payments Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
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
                      {format(new Date(payment.date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {payment.type === 'income' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Income
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <TrendingDown className="w-3 h-3 mr-1" />
                          Expense
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {payment.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{payment.entity}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {payment.project}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`text-sm font-semibold ${payment.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {payment.type === 'income' ? '+' : '-'}€{payment.amount.toLocaleString()}
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

      {/* Summary */}
      {filteredPayments.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Filter className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-900">Filtered Results</span>
            </div>
            <div className="text-sm text-blue-900">
              <span className="font-semibold">{filteredPayments.length}</span> payments •{' '}
              <span className="font-semibold text-green-700">
                +€{filteredPayments.filter(p => p.type === 'income').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
              </span>
              {' • '}
              <span className="font-semibold text-red-700">
                -€{filteredPayments.filter(p => p.type === 'expense').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentsManagement
