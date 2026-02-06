import React, { useState, useEffect } from 'react'
import { supabase, BankCreditPayment, InvestorPayment } from '../../lib/supabase'
import { DollarSign, Calendar, FileText, Download, Filter, TrendingUp, AlertCircle, Building2, Users } from 'lucide-react'
import { LoadingSpinner, PageHeader, StatGrid, StatCard, SearchInput, Select, Button, FormField, Input, Badge, EmptyState, Table } from '../ui'
import { format } from 'date-fns'

interface BankPaymentWithDetails extends BankCreditPayment {
  bank_name?: string
  credit_type?: string
  project_name?: string
  payment_type: 'bank'
}

interface InvestorPaymentWithDetails extends InvestorPayment {
  investor_name?: string
  investment_type?: string
  project_name?: string
  payment_type: 'investor'
}

type CombinedPayment = BankPaymentWithDetails | InvestorPaymentWithDetails

const FundingPaymentsManagement: React.FC = () => {
  const [payments, setPayments] = useState<CombinedPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'recent' | 'large'>('all')
  const [filterType, setFilterType] = useState<'all' | 'bank' | 'investor'>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [stats, setStats] = useState({
    totalPayments: 0,
    totalAmount: 0,
    paymentsThisMonth: 0,
    amountThisMonth: 0,
    bankPayments: 0,
    investorPayments: 0
  })

  useEffect(() => {
    fetchPayments()
  }, [])

  const fetchPayments = async () => {
    setLoading(true)
    try {
      // Fetch bank credit payments from accounting_payments
      const { data: bankPaymentsData, error: bankError } = await supabase
        .from('accounting_payments')
        .select(`
          *,
          invoice:accounting_invoices!inner(
            bank_credit_id,
            bank_credits(
              credit_type,
              project_id,
              bank_id,
              banks(name)
            )
          )
        `)
        .not('invoice.bank_credit_id', 'is', null)
        .order('payment_date', { ascending: false })

      if (bankError) throw bankError

      // Fetch investor payments from accounting_payments
      const { data: investorPaymentsData, error: investorError } = await supabase
        .from('accounting_payments')
        .select(`
          *,
          invoice:accounting_invoices!inner(
            investment_id,
            project_investments(
              investment_type,
              project_id,
              investor_id,
              investors(name)
            )
          )
        `)
        .not('invoice.investment_id', 'is', null)
        .order('payment_date', { ascending: false })

      if (investorError) throw investorError

      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')

      if (projectsError) throw projectsError

      const enrichedBankPayments: BankPaymentWithDetails[] = (bankPaymentsData || []).map(payment => {
        const bankCredit = payment.invoice?.bank_credits
        const project = bankCredit?.project_id
          ? projectsData?.find(p => p.id === bankCredit.project_id)
          : undefined

        return {
          ...payment,
          bank_name: bankCredit?.banks?.name || 'Unknown Bank',
          credit_type: bankCredit?.credit_type || 'N/A',
          project_name: project?.name || 'No Project',
          payment_type: 'bank' as const,
          created_at: payment.created_at,
          notes: payment.description
        }
      })

      const enrichedInvestorPayments: InvestorPaymentWithDetails[] = (investorPaymentsData || []).map(payment => {
        const investment = payment.invoice?.project_investments
        const project = investment?.project_id
          ? projectsData?.find(p => p.id === investment.project_id)
          : undefined

        return {
          ...payment,
          investor_name: investment?.investors?.name || 'Unknown Investor',
          investment_type: investment?.investment_type || 'N/A',
          project_name: project?.name || 'No Project',
          payment_type: 'investor' as const,
          created_at: payment.created_at,
          notes: payment.description
        }
      })

      const combinedPayments = [...enrichedBankPayments, ...enrichedInvestorPayments].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setPayments(combinedPayments)
      calculateStats(combinedPayments)
    } catch (error) {
      console.error('Error fetching payments:', error)
      alert('Failed to load payments')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (paymentsData: CombinedPayment[]) => {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const totalAmount = paymentsData.reduce((sum, p) => sum + Number(p.amount), 0)
    const paymentsThisMonth = paymentsData.filter(p => new Date(p.created_at) >= firstDayOfMonth)
    const amountThisMonth = paymentsThisMonth.reduce((sum, p) => sum + Number(p.amount), 0)
    const bankPayments = paymentsData.filter(p => p.payment_type === 'bank').length
    const investorPayments = paymentsData.filter(p => p.payment_type === 'investor').length

    setStats({
      totalPayments: paymentsData.length,
      totalAmount,
      paymentsThisMonth: paymentsThisMonth.length,
      amountThisMonth,
      bankPayments,
      investorPayments
    })
  }

  const filteredPayments = payments.filter(payment => {
    const matchesSearch =
      (payment.payment_type === 'bank'
        ? (payment as BankPaymentWithDetails).bank_name?.toLowerCase().includes(searchTerm.toLowerCase())
        : (payment as InvestorPaymentWithDetails).investor_name?.toLowerCase().includes(searchTerm.toLowerCase())
      ) ||
      payment.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.notes?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDateRange =
      (!dateRange.start || new Date(payment.payment_date || payment.created_at) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(payment.payment_date || payment.created_at) <= new Date(dateRange.end))

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'recent' && new Date(payment.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (filterStatus === 'large' && Number(payment.amount) > 50000)

    const matchesType =
      filterType === 'all' ||
      payment.payment_type === filterType

    return matchesSearch && matchesDateRange && matchesFilter && matchesType
  })

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Recipient', 'Project', 'Category', 'Amount', 'Notes']
    const rows = filteredPayments.map(p => [
      p.payment_date ? format(new Date(p.payment_date), 'yyyy-MM-dd') : format(new Date(p.created_at), 'yyyy-MM-dd'),
      p.payment_type === 'bank' ? 'Bank' : 'Investor',
      p.payment_type === 'bank' ? (p as BankPaymentWithDetails).bank_name : (p as InvestorPaymentWithDetails).investor_name,
      p.project_name,
      p.payment_type === 'bank' ? (p as BankPaymentWithDetails).credit_type : (p as InvestorPaymentWithDetails).investment_type,
      p.amount.toString(),
      p.notes || ''
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `funding-payments-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  if (loading) {
    return <LoadingSpinner message="Loading payments..." />
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title="Funding Payments" description="Track and manage all funding payments across banks and investors" />

      <StatGrid columns={4}>
        <StatCard label="Total Payments" value={stats.totalPayments} subtitle={`${stats.bankPayments} bank, ${stats.investorPayments} investor`} icon={FileText} color="blue" />
        <StatCard label="Total Amount" value={`€${stats.totalAmount.toLocaleString('hr-HR')}`} icon={DollarSign} color="green" />
        <StatCard label="This Month" value={stats.paymentsThisMonth} subtitle="payments" icon={Calendar} color="blue" />
        <StatCard label="Month Amount" value={`€${stats.amountThisMonth.toLocaleString('hr-HR')}`} icon={TrendingUp} color="green" />
      </StatGrid>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
              placeholder="Search payments..."
            />
          </div>

          <Select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
            <option value="all">All Types</option>
            <option value="bank">Banks</option>
            <option value="investor">Investors</option>
          </Select>

          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
            <option value="all">All Payments</option>
            <option value="recent">Recent (7 days)</option>
            <option value="large">Large (&gt; €50k)</option>
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
              <Table.Th>Type</Table.Th>
              <Table.Th>Recipient</Table.Th>
              <Table.Th>Project</Table.Th>
              <Table.Th>Category</Table.Th>
              <Table.Th align="right">Amount</Table.Th>
              <Table.Th>Notes</Table.Th>
            </Table.Tr>
          </Table.Head>
          <Table.Body>
            {filteredPayments.map((payment) => (
              <Table.Tr key={payment.id}>
                <Table.Td>
                  {payment.payment_date
                    ? format(new Date(payment.payment_date), 'MMM dd, yyyy')
                    : format(new Date(payment.created_at), 'MMM dd, yyyy')}
                </Table.Td>
                <Table.Td>
                  <Badge variant={payment.payment_type === 'bank' ? 'blue' : 'gray'}>
                    {payment.payment_type === 'bank' ? (
                      <span className="inline-flex items-center"><Building2 className="w-3 h-3 mr-1" />Bank</span>
                    ) : (
                      <span className="inline-flex items-center"><Users className="w-3 h-3 mr-1" />Investor</span>
                    )}
                  </Badge>
                </Table.Td>
                <Table.Td className="font-medium">
                  {payment.payment_type === 'bank'
                    ? (payment as BankPaymentWithDetails).bank_name
                    : (payment as InvestorPaymentWithDetails).investor_name}
                </Table.Td>
                <Table.Td>{payment.project_name}</Table.Td>
                <Table.Td className="text-gray-500">
                  {payment.payment_type === 'bank'
                    ? (payment as BankPaymentWithDetails).credit_type?.replace('_', ' ').toUpperCase()
                    : (payment as InvestorPaymentWithDetails).investment_type?.toUpperCase()}
                </Table.Td>
                <Table.Td align="right" className="font-semibold text-green-600">
                  €{Number(payment.amount).toLocaleString('hr-HR')}
                </Table.Td>
                <Table.Td className="text-gray-500 max-w-xs truncate">
                  {payment.notes || '-'}
                </Table.Td>
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

export default FundingPaymentsManagement
