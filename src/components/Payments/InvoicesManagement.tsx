import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { FileText, Calendar, Search, Download, TrendingUp, AlertCircle, Building2, CheckSquare, Square } from 'lucide-react'
import { format } from 'date-fns'

interface InvoiceWithDetails {
  id: string
  invoice_number: string
  invoice_type: string
  invoice_category: string
  issue_date: string
  due_date: string
  total_amount: number
  base_amount: number
  vat_amount: number
  status: string
  created_at: string
  approved: boolean
  supplier_name?: string
  company_name?: string
  project_name?: string
  phase_name?: string
  contract_number?: string
}

const InvoicesManagement: React.FC = () => {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'recent' | 'large'>('all')
  const [filterApproved, setFilterApproved] = useState<'all' | 'approved' | 'not_approved'>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [stats, setStats] = useState({
    totalInvoices: 0,
    totalAmount: 0,
    invoicesThisMonth: 0,
    amountThisMonth: 0
  })

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('accounting_invoices')
        .select(`
          *,
          supplier:subcontractors!accounting_invoices_supplier_id_fkey(
            id,
            name
          ),
          company:accounting_companies!accounting_invoices_company_id_fkey(
            id,
            name
          ),
          project:projects!accounting_invoices_project_id_fkey(
            id,
            name
          ),
          contract:contracts!accounting_invoices_contract_id_fkey(
            id,
            contract_number,
            phase_id
          )
        `)
        .in('invoice_category', ['SUBCONTRACTOR', 'SUPERVISION'])
        .not('project_id', 'is', null)
        .order('issue_date', { ascending: false })

      if (invoicesError) throw invoicesError

      const { data: phasesData } = await supabase
        .from('project_phases')
        .select('id, phase_name')

      const enrichedInvoices = (invoicesData || []).map((invoice: any) => {
        const supplierName = invoice.supplier?.name || '-'
        const companyName = invoice.company?.name || '-'
        const projectName = invoice.project?.name || '-'

        const phase = phasesData?.find(p => p.id === invoice.contract?.phase_id)
        const phaseName = phase?.phase_name || '-'

        return {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          invoice_type: invoice.invoice_type,
          invoice_category: invoice.invoice_category,
          issue_date: invoice.issue_date,
          due_date: invoice.due_date,
          total_amount: parseFloat(invoice.total_amount),
          base_amount: parseFloat(invoice.base_amount),
          vat_amount: parseFloat(invoice.vat_amount),
          status: invoice.status,
          created_at: invoice.created_at,
          approved: invoice.approved || false,
          supplier_name: supplierName,
          company_name: companyName,
          project_name: projectName,
          phase_name: phaseName,
          contract_number: invoice.contract?.contract_number || '-'
        }
      })

      setInvoices(enrichedInvoices)
      calculateStats(enrichedInvoices)
    } catch (error) {
      console.error('Error fetching invoices:', error)
      alert('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (invoicesData: InvoiceWithDetails[]) => {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const totalAmount = invoicesData.reduce((sum, i) => sum + i.total_amount, 0)
    const invoicesThisMonth = invoicesData.filter(i => new Date(i.created_at) >= firstDayOfMonth)
    const amountThisMonth = invoicesThisMonth.reduce((sum, i) => sum + i.total_amount, 0)

    setStats({
      totalInvoices: invoicesData.length,
      totalAmount,
      invoicesThisMonth: invoicesThisMonth.length,
      amountThisMonth
    })
  }

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch =
      invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.contract_number?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDateRange =
      (!dateRange.start || new Date(invoice.issue_date) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(invoice.issue_date) <= new Date(dateRange.end))

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'recent' && new Date(invoice.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (filterStatus === 'large' && invoice.total_amount > 10000)

    const matchesApproved =
      filterApproved === 'all' ||
      (filterApproved === 'approved' && invoice.approved) ||
      (filterApproved === 'not_approved' && !invoice.approved)

    return matchesSearch && matchesDateRange && matchesFilter && matchesApproved
  })

  const exportToCSV = () => {
    const headers = ['Invoice #', 'Date', 'Supplier', 'Project', 'Phase', 'Company', 'Amount', 'Status']
    const rows = filteredInvoices.map(i => {
      return [
        i.invoice_number,
        format(new Date(i.issue_date), 'yyyy-MM-dd'),
        i.supplier_name,
        i.project_name,
        i.phase_name,
        i.company_name,
        i.total_amount.toString(),
        i.status
      ]
    })

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoices-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  const handleApprove = async (invoiceId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('accounting_invoices')
        .update({ approved: !currentStatus })
        .eq('id', invoiceId)

      if (error) throw error

      setInvoices(prev =>
        prev.map(inv =>
          inv.id === invoiceId
            ? { ...inv, approved: !currentStatus }
            : inv
        )
      )
    } catch (error) {
      console.error('Error updating invoice approval:', error)
      alert('Failed to update invoice approval status')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading invoices...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Project Invoices</h1>
        <p className="text-gray-600">Track and manage supplier and supervision invoices for all projects</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Invoices</h3>
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalInvoices}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Amount</h3>
            <FileText className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">€{stats.totalAmount.toLocaleString('hr-HR')}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">This Month</h3>
            <Calendar className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.invoicesThisMonth}</p>
          <p className="text-xs text-gray-500 mt-1">invoices</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Month Amount</h3>
            <TrendingUp className="w-5 h-5 text-teal-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">€{stats.amountThisMonth.toLocaleString('hr-HR')}</p>
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
                placeholder="Search invoices..."
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
              <option value="all">All Invoices</option>
              <option value="recent">Recent (7 days)</option>
              <option value="large">Large (&gt; €10k)</option>
            </select>
          </div>

          <div>
            <select
              value={filterApproved}
              onChange={(e) => setFilterApproved(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="not_approved">Not Approved</option>
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

      {/* Invoices Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Approved
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phase</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium mb-1">No invoices found</p>
                    <p className="text-sm">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleApprove(invoice.id, invoice.approved)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title={invoice.approved ? "Approved" : "Click to approve"}
                      >
                        {invoice.approved ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{invoice.invoice_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(invoice.issue_date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {invoice.supplier_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {invoice.project_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.phase_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-gray-900 font-medium">
                          {invoice.company_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        €{invoice.total_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        invoice.status === 'PAID'
                          ? 'bg-green-100 text-green-800'
                          : invoice.status === 'PARTIALLY_PAID'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default InvoicesManagement
