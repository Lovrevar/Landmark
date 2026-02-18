import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { LoadingSpinner, PageHeader, StatGrid, StatCard, SearchInput, Select, Button, FormField, Input, Badge, EmptyState, Table } from '../ui'
import { FileText, Calendar, Download, TrendingUp, AlertCircle, Building2, CheckSquare, Square } from 'lucide-react'
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
    return <LoadingSpinner message="Loading invoices..." />
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Project Invoices"
        description="Track and manage supplier and supervision invoices for all projects"
      />

      <StatGrid columns={4} className="mb-8">
        <StatCard label="Total Invoices" value={stats.totalInvoices} icon={FileText} color="blue" />
        <StatCard label="Total Amount" value={`€${stats.totalAmount.toLocaleString('hr-HR')}`} icon={FileText} color="green" />
        <StatCard label="This Month" value={stats.invoicesThisMonth} subtitle="invoices" icon={Calendar} />
        <StatCard label="Month Amount" value={`€${stats.amountThisMonth.toLocaleString('hr-HR')}`} icon={TrendingUp} color="teal" />
      </StatGrid>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <SearchInput
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
            />
          </div>

          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">All Invoices</option>
            <option value="recent">Recent (7 days)</option>
            <option value="large">Large (&gt; €10k)</option>
          </Select>

          <Select
            value={filterApproved}
            onChange={(e) => setFilterApproved(e.target.value as any)}
          >
            <option value="all">All Status</option>
            <option value="approved">Approved</option>
            <option value="not_approved">Not Approved</option>
          </Select>

          <Button variant="success" icon={Download} onClick={exportToCSV} fullWidth>
            Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <FormField label="Start Date">
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </FormField>
          <FormField label="End Date">
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </FormField>
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="No invoices found"
          description="Try adjusting your search or filters"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full min-w-[1400px] bg-white">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">Appr.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contract</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phase</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-center">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      icon={invoice.approved ? CheckSquare : Square}
                      onClick={() => handleApprove(invoice.id, invoice.approved)}
                      title={invoice.approved ? "Approved" : "Click to approve"}
                      className={invoice.approved ? 'text-green-600 hover:text-green-800' : 'text-gray-400 hover:text-blue-600'}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{invoice.invoice_number}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={invoice.invoice_category === 'SUPERVISION' ? 'blue' : 'gray'} size="sm">
                      {invoice.invoice_category}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{format(new Date(invoice.issue_date), 'dd.MM.yyyy')}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{invoice.supplier_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{invoice.contract_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{invoice.project_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{invoice.phase_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-800">{invoice.company_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                    €{invoice.total_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={
                      invoice.status === 'PAID' ? 'green'
                        : invoice.status === 'PARTIALLY_PAID' ? 'yellow'
                        : 'red'
                    }>
                      {invoice.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default InvoicesManagement
