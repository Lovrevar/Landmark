import React from 'react'
import { DollarSign, Calendar, FileText, Download, Filter, TrendingUp, AlertCircle } from 'lucide-react'
import { LoadingSpinner, PageHeader, StatGrid, StatCard, SearchInput, Select, Button, FormField, Input, EmptyState, Table } from '../../ui'
import { format } from 'date-fns'
import { useRetailSales } from './hooks/useRetailSales'

const RetailSalesPaymentsManagement: React.FC = () => {
  const {
    loading,
    stats,
    filteredPayments,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    dateRange,
    setDateRange,
    handleExportCSV,
  } = useRetailSales()

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

          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'recent' | 'large')}>
            <option value="all">All Payments</option>
            <option value="recent">Recent (7 days)</option>
            <option value="large">Large (&gt; €10k)</option>
          </Select>

          <Button variant="success" icon={Download} onClick={handleExportCSV} fullWidth>
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
                  €{payment.amount.toLocaleString('hr-HR')}
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
                €{filteredPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('hr-HR')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RetailSalesPaymentsManagement
