import React, { useState, useEffect } from 'react'
import { DollarSign, Calendar, FileText, Download, Filter, TrendingUp, AlertCircle, Building2 } from 'lucide-react'
import { LoadingSpinner, PageHeader, StatGrid, StatCard, SearchInput, Select, Button, FormField, Input, Badge, EmptyState, Table } from '../../ui'
import { format } from 'date-fns'
import { usePaymentsData } from './hooks/usePaymentsData'

const FundingPaymentsManagement: React.FC = () => {
  const { payments, stats, loading, refetch } = usePaymentsData()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'recent' | 'large'>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })

  useEffect(() => {
    refetch()
  }, [refetch])

  const filteredPayments = payments.filter(payment => {
    const matchesSearch =
      payment.bank_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.notes?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDateRange =
      (!dateRange.start || new Date(payment.payment_date || payment.created_at) >= new Date(dateRange.start)) &&
      (!dateRange.end || new Date(payment.payment_date || payment.created_at) <= new Date(dateRange.end))

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'recent' && new Date(payment.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (filterStatus === 'large' && Number(payment.amount) > 50000)

    return matchesSearch && matchesDateRange && matchesFilter
  })

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Recipient', 'Project', 'Category', 'Amount', 'Notes']
    const rows = filteredPayments.map(p => [
      p.payment_date ? format(new Date(p.payment_date), 'yyyy-MM-dd') : format(new Date(p.created_at), 'yyyy-MM-dd'),
      'Bank',
      p.bank_name,
      p.project_name,
      p.credit_type,
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
      <PageHeader title="Funding Payments" description="Track and manage all bank credit payments" />

      <StatGrid columns={4}>
        <StatCard label="Total Payments" value={stats.totalPayments} subtitle={`${stats.bankPayments} bank credit payments`} icon={FileText} color="blue" />
        <StatCard label="Total Amount" value={`€${stats.totalAmount.toLocaleString('hr-HR')}`} icon={DollarSign} color="green" />
        <StatCard label="This Month" value={stats.paymentsThisMonth} subtitle="payments" icon={Calendar} color="blue" />
        <StatCard label="Month Amount" value={`€${stats.amountThisMonth.toLocaleString('hr-HR')}`} icon={TrendingUp} color="green" />
      </StatGrid>

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

          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'recent' | 'large')}>
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
                  <Badge variant="blue">
                    <span className="inline-flex items-center"><Building2 className="w-3 h-3 mr-1" />Bank</span>
                  </Badge>
                </Table.Td>
                <Table.Td className="font-medium">{payment.bank_name}</Table.Td>
                <Table.Td>{payment.project_name}</Table.Td>
                <Table.Td className="text-gray-500">
                  {payment.credit_type?.replace('_', ' ').toUpperCase()}
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
