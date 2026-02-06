import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { DollarSign, Calendar, FileText, Download, Filter, TrendingUp, AlertCircle } from 'lucide-react'
import { LoadingSpinner, PageHeader, StatGrid, StatCard, SearchInput, Select, Button, FormField, Input, EmptyState, Table } from '../ui'
import { format } from 'date-fns'

interface RetailSalesPaymentWithDetails {
  id: string
  payment_date: string
  amount: number
  payment_method: string
  description?: string
  created_at: string
  invoice_number: string
  issue_date: string
  invoice_total_amount: number
  project_name?: string
  customer_name?: string
  contract_number?: string
  bank_account_name?: string
}

const RetailSalesPaymentsManagement: React.FC = () => {
  const [payments, setPayments] = useState<RetailSalesPaymentWithDetails[]>([])
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
      // Fetch only retail sales invoices (OUTGOING_SALES with retail_contract_id or retail_customer_id)
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('accounting_invoices')
        .select(`
          id,
          invoice_number,
          issue_date,
          total_amount,
          retail_customer_id,
          retail_contract_id,
          retail_project_id,
          retail_customers (
            name
          ),
          retail_contracts (
            contract_number,
            customer_id,
            retail_project_phases (
              retail_projects (
                name
              )
            )
          ),
          retail_projects (
            name
          )
        `)
        .eq('invoice_type', 'OUTGOING_SALES')
        .or('retail_contract_id.not.is.null,retail_customer_id.not.is.null')
        .order('issue_date', { ascending: false })

      if (invoicesError) throw invoicesError

      // Fetch all payments for these invoices
      const invoiceIds = invoicesData?.map(inv => inv.id) || []

      if (invoiceIds.length === 0) {
        setPayments([])
        calculateStats([])
        setLoading(false)
        return
      }

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('accounting_payments')
        .select('id, payment_date, amount, payment_method, description, created_at, invoice_id, company_bank_account_id')
        .in('invoice_id', invoiceIds)
        .order('payment_date', { ascending: false })

      if (paymentsError) throw paymentsError

      // Fetch bank accounts separately
      const bankAccountIds = [...new Set(paymentsData?.map(p => p.company_bank_account_id).filter(Boolean) || [])]

      let bankAccountsData: any[] = []
      if (bankAccountIds.length > 0) {
        const { data: accounts } = await supabase
          .from('company_bank_accounts')
          .select('id, bank_name')
          .in('id', bankAccountIds)
        bankAccountsData = accounts || []
      }

      // Enrich payments with invoice details
      const enrichedPayments: RetailSalesPaymentWithDetails[] = (paymentsData || []).map(payment => {
        const invoice = invoicesData?.find(inv => inv.id === payment.invoice_id)
        const bankAccount = bankAccountsData.find(ba => ba.id === payment.company_bank_account_id)

        let projectName = 'N/A'
        if ((invoice?.retail_contracts as any)?.retail_project_phases?.retail_projects?.name) {
          projectName = (invoice.retail_contracts as any).retail_project_phases.retail_projects.name
        } else if ((invoice?.retail_projects as any)?.name) {
          projectName = (invoice.retail_projects as any).name
        }

        let customerName = 'N/A'
        if ((invoice?.retail_customers as any)?.name) {
          customerName = (invoice.retail_customers as any).name
        }

        return {
          id: payment.id,
          payment_date: payment.payment_date,
          amount: parseFloat(payment.amount),
          payment_method: payment.payment_method,
          description: payment.description,
          created_at: payment.created_at,
          invoice_number: invoice?.invoice_number || 'N/A',
          issue_date: invoice?.issue_date || '',
          invoice_total_amount: invoice?.total_amount || 0,
          contract_number: (invoice?.retail_contracts as any)?.contract_number || 'N/A',
          project_name: projectName,
          customer_name: customerName,
          bank_account_name: bankAccount?.bank_name || 'N/A'
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

  const calculateStats = (paymentsData: RetailSalesPaymentWithDetails[]) => {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const totalAmount = paymentsData.reduce((sum, p) => sum + Number(p.amount), 0)
    const paymentsThisMonth = paymentsData.filter(p => new Date(p.payment_date) >= firstDayOfMonth)
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
      payment.contract_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.description?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDateRange =
      (!dateRange.start || new Date(payment.payment_date) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(payment.payment_date) <= new Date(dateRange.end))

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'recent' && new Date(payment.payment_date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (filterStatus === 'large' && Number(payment.amount) > 10000)

    return matchesSearch && matchesDateRange && matchesFilter
  })

  const exportToCSV = () => {
    const headers = ['Payment Date', 'Invoice #', 'Invoice Date', 'Contract #', 'Project', 'Customer', 'Invoice Total', 'Payment Amount', 'Payment Method', 'Bank Account', 'Description']
    const rows = filteredPayments.map(p => [
      format(new Date(p.payment_date), 'yyyy-MM-dd'),
      p.invoice_number,
      p.issue_date ? format(new Date(p.issue_date), 'yyyy-MM-dd') : '',
      p.contract_number,
      p.project_name,
      p.customer_name,
      p.invoice_total_amount.toString(),
      p.amount.toString(),
      p.payment_method,
      p.bank_account_name,
      p.description || ''
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `retail-sales-payments-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  if (loading) {
    return <LoadingSpinner message="Loading payments..." />
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title="Retail Sales Payments" description="Track all payments from retail customers" />

      <StatGrid columns={4}>
        <StatCard label="Total Payments" value={stats.totalPayments} icon={FileText} color="blue" />
        <StatCard label="Total Amount" value={`€${stats.totalAmount.toLocaleString('hr-HR')}`} icon={DollarSign} color="green" />
        <StatCard label="This Month" value={stats.paymentsThisMonth} subtitle="payments" icon={Calendar} color="blue" />
        <StatCard label="Month Amount" value={`€${stats.amountThisMonth.toLocaleString('hr-HR')}`} icon={TrendingUp} color="green" />
      </StatGrid>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <SearchInput
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
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
              <Table.Th>Payment Date</Table.Th>
              <Table.Th>Invoice</Table.Th>
              <Table.Th>Customer</Table.Th>
              <Table.Th>Contract</Table.Th>
              <Table.Th>Project</Table.Th>
              <Table.Th align="right">Invoice Total</Table.Th>
              <Table.Th align="right">Payment</Table.Th>
              <Table.Th>Method</Table.Th>
              <Table.Th>Bank</Table.Th>
            </Table.Tr>
          </Table.Head>
          <Table.Body>
            {filteredPayments.map((payment) => (
              <Table.Tr key={payment.id}>
                <Table.Td>{format(new Date(payment.payment_date), 'MMM dd, yyyy')}</Table.Td>
                <Table.Td>
                  <div className="font-medium">{payment.invoice_number}</div>
                  <div className="text-xs text-gray-500">
                    {payment.issue_date ? format(new Date(payment.issue_date), 'MMM dd, yyyy') : '-'}
                  </div>
                </Table.Td>
                <Table.Td>{payment.customer_name}</Table.Td>
                <Table.Td>{payment.contract_number}</Table.Td>
                <Table.Td>{payment.project_name}</Table.Td>
                <Table.Td align="right" className="text-gray-500">
                  €{payment.invoice_total_amount.toLocaleString('hr-HR')}
                </Table.Td>
                <Table.Td align="right" className="font-semibold text-green-600">
                  €{Number(payment.amount).toLocaleString('hr-HR')}
                </Table.Td>
                <Table.Td>{payment.payment_method}</Table.Td>
                <Table.Td className="text-gray-500">{payment.bank_account_name}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Body>
        </Table>
      )}

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
                €{filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0).toLocaleString('hr-HR')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RetailSalesPaymentsManagement
