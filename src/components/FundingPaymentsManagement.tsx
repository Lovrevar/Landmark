import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DollarSign, Calendar, Building2, Users, TrendingUp, AlertCircle, Filter, Download } from 'lucide-react'
import { format } from 'date-fns'

interface FundingPayment {
  id: string
  amount: number
  payment_date: string
  payment_method: string
  reference_number: string
  notes: string
  created_at: string
  investor_id?: string
  bank_id?: string
  project_id?: string
  investor_name?: string
  bank_name?: string
  project_name?: string
  payment_type: 'investor' | 'bank'
}

const FundingPaymentsManagement: React.FC = () => {
  const [payments, setPayments] = useState<FundingPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'investor' | 'bank'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [stats, setStats] = useState({
    totalPayments: 0,
    totalAmount: 0,
    investorPayments: 0,
    bankPayments: 0
  })

  useEffect(() => {
    fetchPayments()
  }, [])

  const fetchPayments = async () => {
    setLoading(true)
    try {
      // Fetch all funding payments
      const { data: paymentsData, error } = await supabase
        .from('funding_payments')
        .select('*')
        .order('payment_date', { ascending: false })

      if (error) throw error

      // Get all unique investor and bank IDs
      const investorIds = [...new Set(paymentsData?.filter(p => p.investor_id).map(p => p.investor_id))]
      const bankIds = [...new Set(paymentsData?.filter(p => p.bank_id).map(p => p.bank_id))]
      const investmentIds = [...new Set(paymentsData?.filter(p => p.project_investment_id).map(p => p.project_investment_id))]
      const creditIds = [...new Set(paymentsData?.filter(p => p.bank_credit_id).map(p => p.bank_credit_id))]

      // Fetch investors
      let investors = []
      if (investorIds.length > 0) {
        const { data: invData } = await supabase
          .from('investors')
          .select('id, name')
          .in('id', investorIds)
        investors = invData || []
      }

      // Fetch banks
      let banks = []
      if (bankIds.length > 0) {
        const { data: bankData } = await supabase
          .from('banks')
          .select('id, name')
          .in('id', bankIds)
        banks = bankData || []
      }

      // Fetch project investments to get project info
      let projectInvestments = []
      if (investmentIds.length > 0) {
        const { data: invData } = await supabase
          .from('project_investments')
          .select('id, project_id')
          .in('id', investmentIds)
        projectInvestments = invData || []
      }

      // Fetch bank credits to get project info
      let bankCredits = []
      if (creditIds.length > 0) {
        const { data: creditData } = await supabase
          .from('bank_credits')
          .select('id, project_id')
          .in('id', creditIds)
        bankCredits = creditData || []
      }

      // Get all project IDs
      const projectIds = [
        ...projectInvestments.map(pi => pi.project_id),
        ...bankCredits.map(bc => bc.project_id)
      ].filter(id => id)

      // Fetch projects
      let projects = []
      if (projectIds.length > 0) {
        const { data: projData } = await supabase
          .from('projects')
          .select('id, name')
          .in('id', [...new Set(projectIds)])
        projects = projData || []
      }

      // Enrich payments with names
      const allPayments: FundingPayment[] = (paymentsData || []).map((payment: any) => {
        const investor = investors.find(inv => inv.id === payment.investor_id)
        const bank = banks.find(b => b.id === payment.bank_id)

        // Get project from investment or credit
        let projectId = null
        if (payment.project_investment_id) {
          const investment = projectInvestments.find(pi => pi.id === payment.project_investment_id)
          projectId = investment?.project_id
        } else if (payment.bank_credit_id) {
          const credit = bankCredits.find(bc => bc.id === payment.bank_credit_id)
          projectId = credit?.project_id
        }

        const project = projects.find(p => p.id === projectId)

        return {
          id: payment.id,
          amount: payment.amount,
          payment_date: payment.payment_date,
          payment_method: 'Wire Transfer',
          reference_number: '',
          notes: payment.notes || '',
          created_at: payment.created_at,
          investor_id: payment.investor_id,
          bank_id: payment.bank_id,
          project_id: projectId,
          investor_name: investor?.name,
          bank_name: bank?.name,
          project_name: project?.name || 'N/A',
          payment_type: payment.investor_id ? 'investor' : 'bank'
        }
      })

      setPayments(allPayments)
      calculateStats(allPayments)
    } catch (error) {
      console.error('Error fetching funding payments:', error)
      alert('Failed to load funding payments')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (paymentsData: FundingPayment[]) => {
    const totalPayments = paymentsData.length
    const totalAmount = paymentsData.reduce((sum, p) => sum + p.amount, 0)
    const investorPayments = paymentsData.filter(p => p.payment_type === 'investor').length
    const bankPayments = paymentsData.filter(p => p.payment_type === 'bank').length

    setStats({
      totalPayments,
      totalAmount,
      investorPayments,
      bankPayments
    })
  }

  const getFilteredPayments = () => {
    let filtered = payments

    if (filterType !== 'all') {
      filtered = filtered.filter(p => p.payment_type === filterType)
    }

    if (searchTerm) {
      filtered = filtered.filter(p => {
        const searchLower = searchTerm.toLowerCase()
        return (
          (p.investor_name?.toLowerCase().includes(searchLower)) ||
          (p.bank_name?.toLowerCase().includes(searchLower)) ||
          (p.project_name?.toLowerCase().includes(searchLower)) ||
          (p.reference_number?.toLowerCase().includes(searchLower))
        )
      })
    }

    return filtered
  }

  const filteredPayments = getFilteredPayments()

  if (loading) {
    return <div className="text-center py-12">Loading funding payments...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Funding Payments</h1>
        <p className="text-gray-600 mt-2">Track payments to/from investors and banks</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Payments</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalPayments}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Amount</p>
              <p className="text-2xl font-bold text-green-600">€{stats.totalAmount.toLocaleString()}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Investor Payments</p>
              <p className="text-2xl font-bold text-purple-600">{stats.investorPayments}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Bank Payments</p>
              <p className="text-2xl font-bold text-blue-600">{stats.bankPayments}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by investor, bank, project, or reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Payments</option>
              <option value="investor">Investor Payments</option>
              <option value="bank">Bank Payments</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payments List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {filteredPayments.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No payments found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Investor/Bank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reference
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">
                          {format(new Date(payment.payment_date), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        payment.payment_type === 'investor'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {payment.payment_type === 'investor' ? 'Investor' : 'Bank'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {payment.payment_type === 'investor' ? payment.investor_name : payment.bank_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{payment.project_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-green-600">
                        €{payment.amount.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{payment.reference_number || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{payment.payment_method}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default FundingPaymentsManagement
