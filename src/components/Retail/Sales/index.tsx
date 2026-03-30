import React from 'react'
import { useTranslation } from 'react-i18next'
import { DollarSign, Calendar, FileText, Download, Filter, TrendingUp, AlertCircle } from 'lucide-react'
import { LoadingSpinner, PageHeader, StatGrid, StatCard, SearchInput, Select, Button, FormField, Input, EmptyState, Table } from '../../ui'
import { format } from 'date-fns'
import { useRetailSales } from './hooks/useRetailSales'

const RetailSalesPaymentsManagement: React.FC = () => {
  const { t } = useTranslation()
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
    return <LoadingSpinner message={t('common.loading')} />
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title={t('retail_sales.payments.title')} description={t('retail_sales.payments.description')} />

      <StatGrid columns={4}>
        <StatCard label={t('common.total_payments')} value={stats.totalPayments} icon={FileText} color="blue" />
        <StatCard label={t('common.total_amount')} value={`€${stats.totalAmount.toLocaleString('hr-HR')}`} icon={DollarSign} color="green" />
        <StatCard label={t('common.this_month')} value={stats.paymentsThisMonth} subtitle={t('retail_sales.payments.payments_subtitle')} icon={Calendar} color="blue" />
        <StatCard label={t('common.month_amount')} value={`€${stats.amountThisMonth.toLocaleString('hr-HR')}`} icon={TrendingUp} color="green" />
      </StatGrid>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <SearchInput
              placeholder={t('retail_sales.payments.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
            />
          </div>

          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'recent' | 'large')}>
            <option value="all">{t('retail_sales.payments.filter_all')}</option>
            <option value="recent">{t('common.filter_recent')}</option>
            <option value="large">{t('common.filter_large')}</option>
          </Select>

          <Button variant="success" icon={Download} onClick={handleExportCSV} fullWidth>
            {t('common.export_csv')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <FormField label={t('retail_sales.payments.start_date')}>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </FormField>
          <FormField label={t('retail_sales.payments.end_date')}>
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
          title={t('common.no_found')}
          description={t('common.adjust_search')}
        />
      ) : (
        <Table>
          <Table.Head>
            <Table.Tr>
              <Table.Th>{t('retail_sales.payments.table.payment_date')}</Table.Th>
              <Table.Th>{t('retail_sales.payments.table.invoice')}</Table.Th>
              <Table.Th>{t('common.customer')}</Table.Th>
              <Table.Th>{t('common.contract')}</Table.Th>
              <Table.Th>{t('common.project')}</Table.Th>
              <Table.Th align="right">{t('retail_sales.payments.table.invoice_total')}</Table.Th>
              <Table.Th align="right">{t('common.payment')}</Table.Th>
              <Table.Th>{t('retail_sales.payments.table.method')}</Table.Th>
              <Table.Th>{t('common.bank')}</Table.Th>
            </Table.Tr>
          </Table.Head>
          <Table.Body>
            {filteredPayments.map((payment) => (
              <Table.Tr key={payment.id}>
                <Table.Td>{format(new Date(payment.payment_date), 'dd.MM.yyyy')}</Table.Td>
                <Table.Td>
                  <div className="font-medium">{payment.invoice_number}</div>
                  <div className="text-xs text-gray-500">
                    {payment.issue_date ? format(new Date(payment.issue_date), 'dd.MM.yyyy') : '-'}
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
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Filter className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">{t('common.filtered_results')}</span>
            </div>
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <span className="font-semibold">{filteredPayments.length}</span> {t('retail_sales.payments.payments_totaling')}{' '}
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
