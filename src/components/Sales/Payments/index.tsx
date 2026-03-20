import React from 'react'
import { useTranslation } from 'react-i18next'
import { DollarSign, Calendar, FileText, Download, Filter, TrendingUp, AlertCircle } from 'lucide-react'
import { LoadingSpinner, PageHeader, StatGrid, StatCard, SearchInput, Select, Button, FormField, Input, EmptyState, Table } from '../../ui'
import { format } from 'date-fns'
import { useSalesPayments } from './hooks/useSalesPayments'
import { exportSalesPaymentsCSV } from './services/salesPaymentsService'

const SalesPaymentsManagement: React.FC = () => {
  const {
    loading, stats, filteredPayments,
    searchTerm, setSearchTerm,
    filterStatus, setFilterStatus,
    dateRange, setDateRange
  } = useSalesPayments()

  const { t } = useTranslation()
  if (loading) return <LoadingSpinner message={t('common.loading')} />

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title={t('customers.sales_payments.title')} description={t('customers.sales_payments.subtitle')} />

      <StatGrid columns={4}>
        <StatCard label={t('customers.sales_payments.total_payments')} value={stats.totalPayments} icon={FileText} color="blue" />
        <StatCard label={t('customers.sales_payments.total_amount')} value={`€${stats.totalAmount.toLocaleString('hr-HR')}`} icon={DollarSign} color="green" />
        <StatCard label={t('customers.sales_payments.this_month')} value={stats.paymentsThisMonth} subtitle={t('customers.sales_payments.title')} icon={Calendar} color="blue" />
        <StatCard label={t('customers.sales_payments.month_amount')} value={`€${stats.amountThisMonth.toLocaleString('hr-HR')}`} icon={TrendingUp} color="green" />
      </StatGrid>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
              placeholder={t('customers.sales_payments.search')}
            />
          </div>

          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'recent' | 'large')}>
            <option value="all">{t('customers.sales_payments.all_payments')}</option>
            <option value="recent">{t('customers.sales_payments.recent')}</option>
            <option value="large">{t('customers.sales_payments.large')}</option>
          </Select>

          <Button variant="success" icon={Download} onClick={() => exportSalesPaymentsCSV(filteredPayments)} fullWidth>
            {t('common.export_csv')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <FormField label={t('customers.sales_payments.start_date')}>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </FormField>
          <FormField label={t('customers.sales_payments.end_date')}>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </FormField>
        </div>
      </div>

      {filteredPayments.length === 0 ? (
        <EmptyState icon={AlertCircle} title={t('customers.sales_payments.no_payments')} description={t('customers.sales_payments.adjust_search')} />
      ) : (
        <Table>
          <Table.Head>
            <Table.Tr>
              <Table.Th>{t('customers.sales_payments.payment_date')}</Table.Th>
              <Table.Th>{t('customers.sales_payments.invoice')}</Table.Th>
              <Table.Th>{t('customers.sales_payments.customer')}</Table.Th>
              <Table.Th>{t('customers.sales_payments.apartment')}</Table.Th>
              <Table.Th>{t('customers.sales_payments.project')}</Table.Th>
              <Table.Th align="right">{t('customers.sales_payments.invoice_total')}</Table.Th>
              <Table.Th align="right">{t('customers.sales_payments.payment')}</Table.Th>
              <Table.Th>{t('customers.sales_payments.method')}</Table.Th>
              <Table.Th>{t('customers.sales_payments.bank')}</Table.Th>
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
                <Table.Td>{payment.apartment_number}</Table.Td>
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
              <span className="text-sm font-medium text-blue-900">{t('customers.sales_payments.filtered_results')}</span>
            </div>
            <div className="text-sm text-blue-900">
              <span className="font-semibold">{filteredPayments.length}</span> {t('customers.sales_payments.payments_totaling')}{' '}
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

export default SalesPaymentsManagement
