import React from 'react'
import { useTranslation } from 'react-i18next'
import { DollarSign, Calendar, FileText, Download, Filter, TrendingUp, AlertCircle, Building2 } from 'lucide-react'
import { LoadingSpinner, PageHeader, StatGrid, StatCard, SearchInput, Select, Button, FormField, Input, EmptyState, Table } from '../../ui'
import { format } from 'date-fns'
import { useSupervisionPayments } from './hooks/useSupervisionPayments'

const PaymentsManagement: React.FC = () => {
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
  } = useSupervisionPayments()

  if (loading) {
    return <LoadingSpinner message={t('supervision.payments.loading')} />
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('supervision.payments.title')} description={t('supervision.payments.subtitle')} />

      <StatGrid columns={4}>
        <StatCard label={t('common.total_payments')} value={stats.totalPayments} icon={FileText} color="blue" />
        <StatCard label={t('common.total_amount')} value={`€${stats.totalAmount.toLocaleString('hr-HR')}`} icon={DollarSign} color="green" />
        <StatCard label={t('common.this_month')} value={stats.paymentsThisMonth} subtitle={t('common.payments')} icon={Calendar} />
        <StatCard label={t('common.month_amount')} value={`€${stats.amountThisMonth.toLocaleString('hr-HR')}`} icon={TrendingUp} color="teal" />
      </StatGrid>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
              placeholder={t('supervision.payments.search_placeholder')}
            />
          </div>

          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'recent' | 'large')}>
            <option value="all">{t('supervision.payments.filter.all')}</option>
            <option value="recent">{t('common.filter_recent')}</option>
            <option value="large">{t('common.filter_large')}</option>
          </Select>

          <Button variant="success" icon={Download} onClick={handleExportCSV} fullWidth>
            {t('common.export_csv')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <FormField label={t('common.start_date')}>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </FormField>
          <FormField label={t('common.end_date')}>
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
          title={t('supervision.payments.no_found')}
          description={t('common.adjust_search')}
        />
      ) : (
        <Table>
          <Table.Head>
            <Table.Tr>
              <Table.Th>{t('supervision.payments.col.date')}</Table.Th>
              <Table.Th>{t('supervision.payments.col.subcontractor')}</Table.Th>
              <Table.Th>{t('common.project')}</Table.Th>
              <Table.Th>{t('supervision.payments.col.phase')}</Table.Th>
              <Table.Th>{t('supervision.payments.col.paid_by')}</Table.Th>
              <Table.Th align="right">{t('supervision.payments.col.amount')}</Table.Th>
              <Table.Th>{t('common.notes')}</Table.Th>
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

      {filteredPayments.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Filter className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-900">{t('common.filtered_results')}</span>
            </div>
            <div className="text-sm text-blue-900">
              <span className="font-semibold">{filteredPayments.length}</span> {t('supervision.payments.payments_totaling')}{' '}
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