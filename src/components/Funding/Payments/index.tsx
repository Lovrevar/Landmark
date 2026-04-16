import React, { useState, useEffect } from 'react'
import { DollarSign, Calendar, FileText, Download, Filter, TrendingUp, AlertCircle, Building2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LoadingSpinner, PageHeader, StatGrid, StatCard, SearchInput, Select, Button, FormField, Input, Badge, EmptyState, Table } from '../../ui'
import { format } from 'date-fns'
import { usePaymentsData } from './hooks/usePaymentsData'

const FundingPaymentsManagement: React.FC = () => {
  const { t } = useTranslation()
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
    return <LoadingSpinner message={t('funding.payments.loading')} />
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title={t('funding.payments.title')} description={t('funding.payments.description')} />

      <StatGrid columns={4}>
        <StatCard label={t('funding.payments.stats.total_payments_label')} value={stats.totalPayments} subtitle={t('funding.payments.stats.bank_payments_subtitle', { count: stats.bankPayments })} icon={FileText} color="blue" />
        <StatCard label={t('funding.payments.stats.total_amount_label')} value={`€${stats.totalAmount.toLocaleString('hr-HR')}`} icon={DollarSign} color="green" />
        <StatCard label={t('funding.payments.stats.this_month_label')} value={stats.paymentsThisMonth} subtitle={t('funding.payments.stats.payments_subtitle')} icon={Calendar} color="blue" />
        <StatCard label={t('funding.payments.stats.month_amount_label')} value={`€${stats.amountThisMonth.toLocaleString('hr-HR')}`} icon={TrendingUp} color="green" />
      </StatGrid>

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

          <Button variant="success" icon={Download} onClick={exportToCSV} fullWidth>
            {t('funding.payments.export_csv_button')}
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

      {filteredPayments.length === 0 ? (
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
                <Table.Td>
                  {payment.payment_date
                    ? format(new Date(payment.payment_date), 'MMM dd, yyyy')
                    : format(new Date(payment.created_at), 'MMM dd, yyyy')}
                </Table.Td>
                <Table.Td>
                  <Badge variant="blue">
                    <span className="inline-flex items-center"><Building2 className="w-3 h-3 mr-1" />{t('funding.payments.table.bank_badge')}</span>
                  </Badge>
                </Table.Td>
                <Table.Td className="font-medium">{payment.bank_name}</Table.Td>
                <Table.Td>{payment.project_name}</Table.Td>
                <Table.Td className="text-gray-500 dark:text-gray-400">
                  {payment.credit_type?.replace('_', ' ').toUpperCase()}
                </Table.Td>
                <Table.Td align="right" className="font-semibold text-green-600">
                  €{Number(payment.amount).toLocaleString('hr-HR')}
                </Table.Td>
                <Table.Td className="text-gray-500 dark:text-gray-400 max-w-xs truncate">
                  {payment.notes || '-'}
                </Table.Td>
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
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">{t('funding.payments.filtered_results_label')}</span>
            </div>
            <div className="text-sm text-blue-900 dark:text-blue-100">
              {t('funding.payments.filtered_summary', {
                count: filteredPayments.length,
                total: `€${filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0).toLocaleString('hr-HR')}`
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FundingPaymentsManagement
