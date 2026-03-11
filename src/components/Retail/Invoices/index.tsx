import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { LoadingSpinner, PageHeader, StatGrid, StatCard, SearchInput, Select, Button, FormField, Input, Badge, EmptyState } from '../../ui'
import { FileText, Calendar, Download, TrendingUp, AlertCircle, Building2, CheckSquare, Square } from 'lucide-react'
import { format } from 'date-fns'

interface RetailInvoiceWithDetails {
  id: string
  invoice_number: string
  invoice_type: string
  issue_date: string
  due_date: string
  total_amount: number
  base_amount: number
  vat_amount: number
  status: string
  created_at: string
  approved: boolean
  supplier_name?: string
  customer_name?: string
  project_name?: string
  company_name?: string
}

const RetailInvoicesManagement: React.FC = () => {
  const [invoices, setInvoices] = useState<RetailInvoiceWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterApproved, setFilterApproved] = useState<'all' | 'approved' | 'not_approved'>('all')
  const [filterType, setFilterType] = useState<'all' | 'incoming' | 'outgoing'>('all')
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
          retail_supplier:retail_suppliers!accounting_invoices_retail_supplier_id_fkey(
            id,
            name
          ),
          retail_customer:retail_customers!accounting_invoices_retail_customer_id_fkey(
            id,
            name
          ),
          retail_project:retail_projects!accounting_invoices_retail_project_id_fkey(
            id,
            name
          ),
          company:accounting_companies!accounting_invoices_company_id_fkey(
            id,
            name
          )
        `)
        .eq('invoice_category', 'RETAIL')
        .order('issue_date', { ascending: false })

      if (invoicesError) throw invoicesError

      const enrichedInvoices = (invoicesData || []).map((invoice) => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        invoice_type: invoice.invoice_type,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        total_amount: parseFloat(invoice.total_amount || '0'),
        base_amount: parseFloat(invoice.base_amount || '0'),
        vat_amount: parseFloat(invoice.vat_amount || '0'),
        status: invoice.status,
        created_at: invoice.created_at,
        approved: invoice.approved || false,
        supplier_name: invoice.retail_supplier?.name || null,
        customer_name: invoice.retail_customer?.name || null,
        project_name: invoice.retail_project?.name || '-',
        company_name: invoice.company?.name || '-'
      }))

      setInvoices(enrichedInvoices)
      calculateStats(enrichedInvoices)
    } catch (error) {
      console.error('Error fetching retail invoices:', error)
      alert('Greška pri učitavanju računa')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (data: RetailInvoiceWithDetails[]) => {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const totalAmount = data.reduce((sum, i) => sum + i.total_amount, 0)
    const thisMonth = data.filter(i => new Date(i.created_at) >= firstDayOfMonth)
    setStats({
      totalInvoices: data.length,
      totalAmount,
      invoicesThisMonth: thisMonth.length,
      amountThisMonth: thisMonth.reduce((sum, i) => sum + i.total_amount, 0)
    })
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
          inv.id === invoiceId ? { ...inv, approved: !currentStatus } : inv
        )
      )
    } catch (error) {
      console.error('Error updating approval status:', error)
      alert('Greška pri ažuriranju odobrenja')
    }
  }

  const filteredInvoices = invoices.filter(invoice => {
    const entityName = invoice.supplier_name || invoice.customer_name || ''
    const matchesSearch =
      invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.project_name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDateRange =
      (!dateRange.start || new Date(invoice.issue_date) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(invoice.issue_date) <= new Date(dateRange.end))

    const matchesApproved =
      filterApproved === 'all' ||
      (filterApproved === 'approved' && invoice.approved) ||
      (filterApproved === 'not_approved' && !invoice.approved)

    const matchesType =
      filterType === 'all' ||
      (filterType === 'incoming' && invoice.invoice_type.startsWith('INCOMING')) ||
      (filterType === 'outgoing' && invoice.invoice_type.startsWith('OUTGOING'))

    return matchesSearch && matchesDateRange && matchesApproved && matchesType
  })

  const exportToCSV = () => {
    const headers = ['Broj računa', 'Tip', 'Datum', 'Dospijeće', 'Projekt', 'Dobavljač/Kupac', 'Firma', 'Iznos', 'Status', 'Odobreno']
    const rows = filteredInvoices.map(i => [
      i.invoice_number,
      i.invoice_type,
      format(new Date(i.issue_date), 'yyyy-MM-dd'),
      format(new Date(i.due_date), 'yyyy-MM-dd'),
      i.project_name || '',
      i.supplier_name || i.customer_name || '',
      i.company_name || '',
      i.total_amount.toString(),
      i.status,
      i.approved ? 'Da' : 'Ne'
    ])
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `retail-invoices-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  const getInvoiceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      INCOMING_SUPPLIER: 'Ulazni - Dobavljač',
      OUTGOING_SALES: 'Izlazni - Prodaja',
      OUTGOING_SUPPLIER: 'Izlazni - Dobavljač',
      INCOMING_INVESTMENT: 'Ulazni - Investicija'
    }
    return labels[type] || type
  }

  if (loading) return <LoadingSpinner message="Učitavanje retail računa..." />

  return (
    <div className="p-6">
      <PageHeader
        title="Retail Računi"
        description="Pregled i odobravanje retail računa za slanje u cashflow"
      />

      <StatGrid columns={4} className="mb-8">
        <StatCard label="Ukupno računa" value={stats.totalInvoices} icon={FileText} color="blue" />
        <StatCard label="Ukupan iznos" value={`€${stats.totalAmount.toLocaleString('hr-HR')}`} icon={FileText} color="green" />
        <StatCard label="Ovaj mjesec" value={stats.invoicesThisMonth} subtitle="računa" icon={Calendar} />
        <StatCard label="Iznos ovaj mj." value={`€${stats.amountThisMonth.toLocaleString('hr-HR')}`} icon={TrendingUp} color="teal" />
      </StatGrid>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <SearchInput
              placeholder="Pretraži račune..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
            />
          </div>

          <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">Svi tipovi</option>
            <option value="incoming">Ulazni</option>
            <option value="outgoing">Izlazni</option>
          </Select>

          <Select value={filterApproved} onChange={(e) => setFilterApproved(e.target.value)}>
            <option value="all">Sve</option>
            <option value="approved">Odobreno</option>
            <option value="not_approved">Nije odobreno</option>
          </Select>

          <Button variant="success" icon={Download} onClick={exportToCSV} fullWidth>
            Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <FormField label="Datum od">
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </FormField>
          <FormField label="Datum do">
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
          title="Nema računa"
          description="Nema retail računa koji odgovaraju zadanim filterima"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full min-w-[1200px] bg-white">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">Odobri</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broj računa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tip</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dospijeće</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projekt</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dobavljač / Kupac</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firma</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Iznos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className={`hover:bg-gray-50 transition-colors ${invoice.approved ? 'bg-green-50/30' : ''}`}
                >
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleApprove(invoice.id, invoice.approved)}
                      title={invoice.approved ? 'Odobreno - klikni za poništenje' : 'Klikni za odobravanje'}
                      className={`p-1 rounded transition-colors ${
                        invoice.approved
                          ? 'text-green-600 hover:text-green-800'
                          : 'text-gray-400 hover:text-blue-600'
                      }`}
                    >
                      {invoice.approved
                        ? <CheckSquare className="w-5 h-5" />
                        : <Square className="w-5 h-5" />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {invoice.invoice_number}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge
                      variant={invoice.invoice_type.startsWith('INCOMING') ? 'blue' : 'gray'}
                      size="sm"
                    >
                      {getInvoiceTypeLabel(invoice.invoice_type)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                    {format(new Date(invoice.issue_date), 'dd.MM.yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                    {format(new Date(invoice.due_date), 'dd.MM.yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                    {invoice.project_name}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {invoice.supplier_name || invoice.customer_name || '-'}
                  </td>
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

export default RetailInvoicesManagement
