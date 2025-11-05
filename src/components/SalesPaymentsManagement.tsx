import React, { useState, useEffect } from 'react'
import { supabase, ApartmentPayment, Apartment, Building, Project, Sale, Customer } from '../lib/supabase'
import { DollarSign, Calendar, FileText, Search, Download, Filter, TrendingUp, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

interface PaymentWithDetails extends ApartmentPayment {
  apartment_number?: string
  building_name?: string
  project_name?: string
  buyer_name?: string
  sale_price?: number
}

const SalesPaymentsManagement: React.FC = () => {
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
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('apartment_payments')
        .select('*')
        .order('created_at', { ascending: false })

      if (paymentsError) throw paymentsError

      const { data: apartmentsData, error: apartmentsError } = await supabase
        .from('apartments')
        .select('id, number, building_id, project_id')

      if (apartmentsError) throw apartmentsError

      const { data: buildingsData, error: buildingsError } = await supabase
        .from('buildings')
        .select('id, name')

      if (buildingsError) throw buildingsError

      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')

      if (projectsError) throw projectsError

      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('apartment_id, customer_id, sale_price')

      if (salesError) throw salesError

      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name, surname')

      if (customersError) throw customersError

      const enrichedPayments = (paymentsData || []).map(payment => {
        let unitNumber = 'Unknown'
        let building = undefined
        let project = undefined

        if (payment.apartment_id) {
          const apartment = apartmentsData?.find(a => a.id === payment.apartment_id)
          if (apartment) {
            unitNumber = apartment.number
            building = buildingsData?.find(b => b.id === apartment.building_id)
            project = projectsData?.find(p => p.id === apartment.project_id)
          }
        } else if (payment.garage_id) {
          const garage = garagesData?.find(g => g.id === payment.garage_id)
          if (garage) {
            unitNumber = garage.number
            building = buildingsData?.find(b => b.id === garage.building_id)
            project = projectsData?.find(p => p.id === garage.project_id)
          }
        } else if (payment.storage_id) {
          unitNumber = 'Storage'
          project = projectsData?.find(p => p.id === payment.project_id)
        }

        const sale = salesData?.find(s => s.apartment_id === payment.apartment_id)
        const customer = customersData?.find(c => c.id === payment.customer_id)

        return {
          ...payment,
          apartment_number: unitNumber,
          building_name: building?.name || 'No Building',
          project_name: project?.name || 'No Project',
          buyer_name: customer ? `${customer.name} ${customer.surname}` : 'Unknown Buyer',
          sale_price: sale?.sale_price || 0
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

    const totalAmount = paymentsData.reduce((sum, p) => sum + Number(p.amount), 0)
    const paymentsThisMonth = paymentsData.filter(p => new Date(p.created_at) >= firstDayOfMonth)
    const amountThisMonth = paymentsThisMonth.reduce((sum, p) => sum + Number(p.amount), 0)

    setStats({
      totalPayments: paymentsData.length,
      totalAmount,
      paymentsThisMonth: paymentsThisMonth.length,
      amountThisMonth
    })
  }

  const filteredPayments = payments.filter(payment => {
    const matchesSearch =
      payment.apartment_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.buyer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.building_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.notes?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDateRange =
      (!dateRange.start || new Date(payment.payment_date || payment.created_at) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(payment.payment_date || payment.created_at) <= new Date(dateRange.end))

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'recent' && new Date(payment.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (filterStatus === 'large' && Number(payment.amount) > 10000)

    return matchesSearch && matchesDateRange && matchesFilter
  })

  const exportToCSV = () => {
    const headers = ['Date', 'Apartment', 'Project', 'Building', 'Buyer', 'Sale Price', 'Amount', 'Notes']
    const rows = filteredPayments.map(p => [
      p.payment_date ? format(new Date(p.payment_date), 'yyyy-MM-dd') : format(new Date(p.created_at), 'yyyy-MM-dd'),
      p.apartment_number,
      p.project_name,
      p.building_name,
      p.buyer_name,
      p.sale_price?.toString() || '0',
      p.amount.toString(),
      p.notes || ''
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `apartment-payments-${format(new Date(), 'yyyy-MM-dd')}.csv`
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Payments Management</h1>
        <p className="text-gray-600">Track and manage all payments across all projects</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Apartment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Buyer</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sale Price</th>
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
                      <div className="text-sm font-medium text-gray-900">{payment.apartment_number}</div>
                      <div className="text-xs text-gray-500">{payment.building_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.project_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.buyer_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                      €{payment.sale_price?.toLocaleString() || '0'}
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

export default SalesPaymentsManagement
