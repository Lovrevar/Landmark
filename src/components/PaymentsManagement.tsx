import React, { useState, useEffect } from 'react'
import { supabase, WirePayment, Contract } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { DollarSign, Calendar, FileText, Search, Download, Filter, TrendingUp, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

interface PaymentWithDetails extends WirePayment {
  contract?: Contract
  subcontractor_name?: string
  project_name?: string
  phase_name?: string
}

const PaymentsManagement: React.FC = () => {
  const { user } = useAuth()
  const [payments, setPayments] = useState<PaymentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'recent' | 'large'>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [stats, setStats] = useState({
    totalPayments: 0,
    totalAmount: 0,
    paymentsThisMonth: 0,
    amountThisMonth: 0
  })

  useEffect(() => {
    fetchPayments()
  }, [])

  const fetchPayments = async () => {
    setLoading(true)
    try {
      // Fetch all wire payments with related data
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('wire_payments')
        .select(`
          *,
          contracts (
            id,
            contract_number,
            project_id,
            phase_id,
            subcontractor_id,
            job_description,
            contract_amount,
            budget_realized,
            status
          )
        `)
        .order('created_at', { ascending: false })

      if (paymentsError) throw paymentsError

      // Fetch subcontractors for names
      const { data: subcontractorsData, error: subError } = await supabase
        .from('subcontractors')
        .select('id, name')

      if (subError) throw subError

      // Fetch projects for names
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')

      if (projectsError) throw projectsError

      // Fetch phases for names
      const { data: phasesData, error: phasesError } = await supabase
        .from('project_phases')
        .select('id, phase_name')

      if (phasesError) throw phasesError

      // Enrich payments with names
      const enrichedPayments = (paymentsData || []).map(payment => {
        const subcontractor = subcontractorsData?.find(s => s.id === payment.subcontractor_id)
        const contract = payment.contracts as Contract | undefined
        const project = contract ? projectsData?.find(p => p.id === contract.project_id) : undefined
        const phase = contract?.phase_id ? phasesData?.find(p => p.id === contract.phase_id) : undefined

        return {
          ...payment,
          contract,
          subcontractor_name: subcontractor?.name || 'Unknown',
          project_name: project?.name || 'No Project',
          phase_name: phase?.phase_name || null
        }
      })

      setPayments(enrichedPayments)
      calculateStats(enrichedPayments)
    } catch (error) {
      console.error('Error fetching payments:', error)
      alert('Failed to load payments')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (paymentsData: PaymentWithDetails[]) => {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const totalAmount = paymentsData.reduce((sum, p) => sum + p.amount, 0)
    const paymentsThisMonth = paymentsData.filter(p => new Date(p.created_at) >= firstDayOfMonth)
    const amountThisMonth = paymentsThisMonth.reduce((sum, p) => sum + p.amount, 0)

    setStats({
      totalPayments: paymentsData.length,
      totalAmount,
      paymentsThisMonth: paymentsThisMonth.length,
      amountThisMonth
    })
  }

  const filteredPayments = payments.filter(payment => {
    const matchesSearch =
      payment.subcontractor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.contract?.contract_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.notes?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDateRange =
      (!dateRange.start || new Date(payment.payment_date || payment.created_at) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(payment.payment_date || payment.created_at) <= new Date(dateRange.end))

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'recent' && new Date(payment.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (filterStatus === 'large' && payment.amount > 10000)

    return matchesSearch && matchesDateRange && matchesFilter
  })

  const exportToCSV = () => {
    const headers = ['Date', 'Subcontractor', 'Project', 'Phase', 'Contract', 'Amount', 'Notes']
    const rows = filteredPayments.map(p => [
      format(new Date(p.payment_date || p.created_at), 'yyyy-MM-dd'),
      p.subcontractor_name,
      p.project_name,
      p.phase_name || '',
      p.contract?.contract_number || '',
      p.amount.toString(),
      p.notes || ''
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payments-${format(new Date(), 'yyyy-MM-dd')}.csv`
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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Payments Management</h1>
        <p className="text-gray-600">Track and manage all payments across all projects</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Payments</h3>
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalPayments}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Amount</h3>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">${stats.totalAmount.toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">This Month</h3>
            <Calendar className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.paymentsThisMonth}</p>
          <p className="text-xs text-gray-500 mt-1">payments</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Month Amount</h3>
            <TrendingUp className="w-5 h-5 text-teal-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">${stats.amountThisMonth.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Payments</option>
              <option value="recent">Recent (7 days)</option>
              <option value="large">Large (&gt; €10k)</option>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subcontractor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phase</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contract</th>
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
                      {format(new Date(payment.payment_date || payment.created_at), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{payment.subcontractor_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.project_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payment.phase_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payment.contract?.contract_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-green-600">
                        ${payment.amount.toLocaleString()}
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
              <span className="font-semibold">{filteredPayments.length}</span> payments totaling{' '}
              <span className="font-semibold">
                ${filteredPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentsManagement
