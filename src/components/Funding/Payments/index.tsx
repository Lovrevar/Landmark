import React, { useState, useEffect } from 'react'
import { Calendar, Download, Filter, TrendingUp, TrendingDown, Scale, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LoadingSpinner, PageHeader, StatGrid, StatCard, SearchInput, Select, Button, FormField, Input, Badge, EmptyState, ErrorState, Alert, Table } from '../../ui'
import { usePaymentsData } from './hooks/usePaymentsData'
import { paymentTotalsByDirection, DIRECTION_AMOUNT_CLASS, formatSignedEuro } from '../../Cashflow/services/paymentTotals'
import type { BankPaymentWithDetails } from './services/bankPaymentsService'
import { exportFundingPaymentsExcel } from './services/fundingPaymentsExport'
import type { PaymentDirection } from '../../Cashflow/services/invoiceHelpers'
import { getCreditTypeLabelKey } from '../Investors/utils/creditCalculations'
import { useAsyncExport } from '../../../hooks/useAsyncExport'
import { formatEuro, formatDate, NO_VALUE } from '../../../utils/formatters'

// A drawdown is money in (green), a repayment or credit fee money out (red). The amount classes
// and the signed-net formatter are shared with the Cashflow payments screen.
const DIRECTION_BADGE: Record<PaymentDirection, 'green' | 'red'> = { IN: 'green', OUT: 'red' }

const FundingPaymentsManagement: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { payments, stats, loading, error, refetch } = usePaymentsData()
  const [errorDismissed, setErrorDismissed] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'recent' | 'large'>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })

  const directionLabel = (direction: PaymentDirection | null): string =>
    direction === 'IN' ? t('payments.table.income') : direction === 'OUT' ? t('payments.table.expense') : NO_VALUE

  const creditTypeLabel = (payment: BankPaymentWithDetails): string => {
    const key = getCreditTypeLabelKey(payment.credit_type, payment.credit_seniority)
    return key ? t(key) : (payment.credit_type ?? '').replace(/_/g, ' ')
  }

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
      // Magnitude, whichever way the money went (amounts are always positive).
      (filterStatus === 'large' && Number(payment.amount) > 50000)

    return matchesSearch && matchesDateRange && matchesFilter
  })

  const filteredTotals = paymentTotalsByDirection(filteredPayments)

  // Through `useAsyncExport` so a failed export toasts instead of dying inside the click handler.
  const { exporting, run: runExportExcel } = useAsyncExport(exportFundingPaymentsExcel, 'common.export_error')

  if (loading && payments.length === 0) {
    return <LoadingSpinner message={t('funding.payments.loading')} />
  }

  // Nothing loaded and the load failed: the four stat cards would report €0 disbursed.
  const failedWithNothing = !!error && payments.length === 0

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title={t('funding.payments.title')} description={t('funding.payments.description')} />

      {error && !errorDismissed && !failedWithNothing && (
        <Alert variant="error" className="mb-6" onDismiss={() => setErrorDismissed(true)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{t('common.load_error_description')}</span>
            <Button size="sm" variant="secondary" onClick={refetch} loading={loading}>{t('common.retry')}</Button>
          </div>
        </Alert>
      )}

      {/* Withheld rather than zeroed when the read failed; the filter bar below stays mounted. */}
      {!failedWithNothing && (
      <StatGrid columns={4}>
        <StatCard label={t('funding.payments.stats.inflow_label')} value={formatEuro(stats.all.inflow)} icon={TrendingUp} color="green" />
        <StatCard label={t('funding.payments.stats.outflow_label')} value={formatEuro(stats.all.outflow)} icon={TrendingDown} color="red" />
        <StatCard label={t('funding.payments.stats.net_label')} value={formatSignedEuro(stats.all.net)} icon={Scale} color="blue" />
        <StatCard label={t('funding.payments.stats.this_month_label')} value={formatSignedEuro(stats.thisMonth.net)} subtitle={t('funding.payments.stats.net_label')} icon={Calendar} color="blue" />
      </StatGrid>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
              placeholder={t('funding.payments.search_placeholder')}
            />
          </div>

          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'recent' | 'large')}>
            <option value="all">{t('funding.payments.filter_all')}</option>
            <option value="recent">{t('funding.payments.filter_recent')}</option>
            <option value="large">{t('funding.payments.filter_large')}</option>
          </Select>

          <Button
            variant="success"
            icon={Download}
            onClick={() => void runExportExcel(filteredPayments)}
            loading={exporting}
            fullWidth
          >
            {t('common.export_excel')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <FormField label={t('funding.payments.start_date_label')}>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </FormField>
          <FormField label={t('funding.payments.end_date_label')}>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </FormField>
        </div>
      </div>

      {failedWithNothing ? (
        <ErrorState onRetry={refetch} />
      ) : filteredPayments.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title={t('funding.payments.no_payments_title')}
          description={t('funding.payments.no_payments_description')}
        />
      ) : (
        <Table>
          <Table.Head>
            <Table.Tr>
              <Table.Th>{t('funding.payments.table.date_col')}</Table.Th>
              <Table.Th>{t('funding.payments.table.type_col')}</Table.Th>
              <Table.Th>{t('funding.payments.table.recipient_col')}</Table.Th>
              <Table.Th>{t('funding.payments.table.project_col')}</Table.Th>
              <Table.Th>{t('funding.payments.table.category_col')}</Table.Th>
              <Table.Th align="right">{t('funding.payments.table.amount_col')}</Table.Th>
              <Table.Th>{t('funding.payments.table.notes_col')}</Table.Th>
            </Table.Tr>
          </Table.Head>
          <Table.Body>
            {filteredPayments.map((payment) => (
              <Table.Tr key={payment.id}>
                <Table.Td label={t('funding.payments.table.date_col')}>
                  {payment.payment_date
                    ? formatDate(payment.payment_date, i18n.language)
                    : formatDate(new Date(payment.created_at), i18n.language)}
                </Table.Td>
                <Table.Td label={t('funding.payments.table.type_col')}>
                  {payment.direction ? (
                    <Badge variant={DIRECTION_BADGE[payment.direction]}>{directionLabel(payment.direction)}</Badge>
                  ) : (
                    NO_VALUE
                  )}
                </Table.Td>
                <Table.Td label={t('funding.payments.table.recipient_col')} className="font-medium">{payment.bank_name || t('funding.investments.unknown_bank')}</Table.Td>
                <Table.Td label={t('funding.payments.table.project_col')}>{payment.project_name || t('common.no_project')}</Table.Td>
                <Table.Td label={t('funding.payments.table.category_col')} className="text-gray-500 dark:text-gray-400">
                  {creditTypeLabel(payment)}
                </Table.Td>
                <Table.Td
                  label={t('funding.payments.table.amount_col')}
                  align="right"
                  className={`font-semibold ${payment.direction ? DIRECTION_AMOUNT_CLASS[payment.direction] : 'text-gray-900 dark:text-white'}`}
                >
                  {formatEuro(Number(payment.amount))}
                </Table.Td>
                <Table.Td label={t('funding.payments.table.notes_col')} className="text-gray-500 dark:text-gray-400 max-w-xs truncate">
                  {payment.notes || '-'}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Body>
        </Table>
      )}

      {filteredPayments.length > 0 && (
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center">
              <Filter className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">{t('funding.payments.filtered_results_label')}</span>
            </div>
            <div className="text-sm text-blue-900 dark:text-blue-100">
              {/* Split by direction, never one sum: adding a drawdown to its repayment doubled it. */}
              {t('funding.payments.filtered_summary', {
                count: filteredTotals.count,
                inflow: formatEuro(filteredTotals.inflow),
                outflow: formatEuro(filteredTotals.outflow),
                net: formatSignedEuro(filteredTotals.net),
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FundingPaymentsManagement
