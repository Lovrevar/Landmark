import React, { useState, useEffect } from 'react'
import { supabase, WirePayment, Contract } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { DollarSign, Calendar, FileText, Download, Filter, TrendingUp, AlertCircle, Building2, User } from 'lucide-react'
import { LoadingSpinner, PageHeader, StatGrid, StatCard, SearchInput, Select, Button, FormField, Input, EmptyState, Table } from '../ui'
import { format } from 'date-fns'

interface PaymentWithDetails {
  id: string
  amount: number
  payment_date: string
  created_at: string
  notes?: string
  company_bank_account_id?: string
  cesija_company_id?: string
  is_cesija?: boolean
  contract?: Contract
  subcontractor_name?: string
  project_name?: string
  phase_name?: string
  paid_by_company_name?: string
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
      // Fetch payments from accounting_payments with INCOMING_SUPPLIER invoices for SUBCONTRACTOR category
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('accounting_payments')
        .select(`
          *,
          invoice:accounting_invoices(
            id,
            invoice_number,
            invoice_type,
            invoice_category,
            supplier_id,
            project_id,
            milestone_id,
            total_amount,
            status
          ),
          company_bank_account:company_bank_accounts!accounting_payments_company_bank_account_id_fkey(
            id,
            bank_name,
            company:accounting_companies(
              id,
              name
            )
          ),
          cesija_company:accounting_companies!accounting_payments_cesija_company_id_fkey(
            id,
            name
          ),
          credit:bank_credits!accounting_payments_credit_id_fkey(
            id,
            credit_name,
            company:accounting_companies(
              id,
              name
            )
          )
        `)
        .eq('invoice.invoice_type', 'INCOMING_SUPPLIER')
        .eq('invoice.invoice_category', 'SUBCONTRACTOR')
        .not('invoice.project_id', 'is', null)
        .order('payment_date', { ascending: false })

      if (paymentsError) throw paymentsError

      // Fetch subcontractors (suppliers)
      const { data: subcontractorsData, error: subError } = await supabase
        .from('subcontractors')
        .select('id, name')

      if (subError) throw subError

      // Fetch contracts with phase info
      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select(`
          id,
          contract_number,
          subcontractor_id,
          phase_id,
          project_phases(id, phase_name)
        `)

      if (contractsError) throw contractsError

      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')

      if (projectsError) throw projectsError

      // Enrich payments with names
      const enrichedPayments = (paymentsData || []).map((payment: any) => {
        const invoice = payment.invoice
        if (!invoice) return null

        const subcontractor = subcontractorsData?.find(s => s.id === invoice.supplier_id)
        const project = projectsData?.find(p => p.id === invoice.project_id)

        // Find contract either from invoice.contract_id or from contracts linked to this subcontractor
        let contract = contractsData?.find(c => c.id === invoice.contract_id)
        if (!contract) {
          // Fallback: find any contract for this subcontractor on this project
          contract = contractsData?.find(c =>
            c.subcontractor_id === invoice.supplier_id
          )
        }

        const phaseName = contract?.project_phases?.phase_name || null

        // Determine paid by company name
        let paidByCompanyName = '-'
        if (payment.is_cesija && payment.cesija_company) {
          paidByCompanyName = payment.cesija_company.name
        } else if (payment.credit?.company) {
          paidByCompanyName = payment.credit.company.name
        } else if (payment.company_bank_account?.company) {
          paidByCompanyName = payment.company_bank_account.company.name
        }

        return {
          id: payment.id,
          amount: parseFloat(payment.amount),
          payment_date: payment.payment_date,
          created_at: payment.created_at,
          notes: payment.description,
          company_bank_account_id: payment.company_bank_account_id,
          cesija_company_id: payment.cesija_company_id,
          is_cesija: payment.is_cesija,
          subcontractor_name: subcontractor?.name || 'Unknown',
          project_name: project?.name || 'No Project',
          phase_name: phaseName,
          contract: contract ? {
            id: contract.id,
            contract_number: contract.contract_number,
            subcontractor_id: contract.subcontractor_id,
            phase_id: contract.phase_id
          } as any : null,
          paid_by_company_name: paidByCompanyName
        }
      }).filter(Boolean) as PaymentWithDetails[]

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
    const headers = ['Date', 'Subcontractor', 'Project', 'Phase', 'Paid By', 'Amount', 'Notes']
    const rows = filteredPayments.map(p => {
      return [
        format(new Date(p.payment_date || p.created_at), 'yyyy-MM-dd'),
        p.subcontractor_name,
        p.project_name,
        p.phase_name || '',
        p.paid_by_company_name || '-',
        p.amount.toString(),
        p.notes || ''
      ]
    })

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payments-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  if (loading) {
    return <LoadingSpinner message="Loading payments..." />
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Payments Management" description="Track and manage all payments across all projects" />

      <StatGrid columns={4}>
        <StatCard label="Total Payments" value={stats.totalPayments} icon={FileText} color="blue" />
        <StatCard label="Total Amount" value={`€${stats.totalAmount.toLocaleString('hr-HR')}`} icon={DollarSign} color="green" />
        <StatCard label="This Month" value={stats.paymentsThisMonth} subtitle="payments" icon={Calendar} />
        <StatCard label="Month Amount" value={`€${stats.amountThisMonth.toLocaleString('hr-HR')}`} icon={TrendingUp} color="teal" />
      </StatGrid>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
              placeholder="Search payments..."
            />
          </div>

          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
            <option value="all">All Payments</option>
            <option value="recent">Recent (7 days)</option>
            <option value="large">Large (&gt; €10k)</option>
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

      {filteredPayments.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="No payments found"
          description="Try adjusting your search or filters"
        />
      ) : (
        <Table>
          <Table.Head>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Subcontractor</Table.Th>
              <Table.Th>Project</Table.Th>
              <Table.Th>Phase</Table.Th>
              <Table.Th>Paid By</Table.Th>
              <Table.Th align="right">Amount</Table.Th>
              <Table.Th>Notes</Table.Th>
            </Table.Tr>
          </Table.Head>
          <Table.Body>
            {filteredPayments.map((payment) => (
              <Table.Tr key={payment.id}>
                <Table.Td>
                  {format(new Date(payment.payment_date || payment.created_at), 'MMM dd, yyyy')}
                </Table.Td>
                <Table.Td className="font-medium">{payment.subcontractor_name}</Table.Td>
                <Table.Td>{payment.project_name}</Table.Td>
                <Table.Td className="text-gray-500">{payment.phase_name || '-'}</Table.Td>
                <Table.Td>
                  {payment.paid_by_company_name && payment.paid_by_company_name !== '-' ? (
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">{payment.paid_by_company_name}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </Table.Td>
                <Table.Td align="right" className="font-semibold text-green-600">
                  €{payment.amount.toLocaleString('hr-HR')}
                </Table.Td>
                <Table.Td className="text-gray-500 max-w-xs truncate">
                  {payment.notes || '-'}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Body>
        </Table>
      )}

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
                €{filteredPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('hr-HR')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentsManagement
