import React from 'react'
import { useTranslation } from 'react-i18next'
import { LoadingSpinner, PageHeader, StatGrid, StatCard, SearchInput, Select, Button, FormField, Input, Badge, EmptyState } from '../../ui'
import { FileText, Calendar, Download, TrendingUp, AlertCircle, Building2, CheckSquare, Square } from 'lucide-react'
import { format } from 'date-fns'
import { useSupervisionInvoices } from './hooks/useSupervisionInvoices'

const InvoicesManagement: React.FC = () => {
  const { t } = useTranslation()
  const {
    loading,
    stats,
    filteredInvoices,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    filterApproved,
    setFilterApproved,
    dateRange,
    setDateRange,
    handleApprove,
    handleExportCSV,
  } = useSupervisionInvoices()

  if (loading) {
    return <LoadingSpinner message={t('supervision.invoices.loading')} />
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t('supervision.invoices.title')}
        description={t('supervision.invoices.subtitle')}
      />

      <StatGrid columns={4} className="mb-8">
        <StatCard label={t('common.total_invoices')} value={stats.totalInvoices} icon={FileText} color="blue" />
        <StatCard label={t('common.total_amount')} value={`€${stats.totalAmount.toLocaleString('hr-HR')}`} icon={FileText} color="green" />
        <StatCard label={t('common.this_month')} value={stats.invoicesThisMonth} subtitle={t('common.invoices')} icon={Calendar} />
        <StatCard label={t('common.month_amount')} value={`€${stats.amountThisMonth.toLocaleString('hr-HR')}`} icon={TrendingUp} color="teal" />
      </StatGrid>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <SearchInput
              placeholder={t('supervision.invoices.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
            />
          </div>

          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'recent' | 'large')}>
            <option value="all">{t('supervision.invoices.filter.all')}</option>
            <option value="recent">{t('common.filter_recent')}</option>
            <option value="large">{t('common.filter_large')}</option>
          </Select>

          <Select value={filterApproved} onChange={(e) => setFilterApproved(e.target.value as 'all' | 'approved' | 'not_approved')}>
            <option value="all">{t('supervision.invoices.filter.all_status')}</option>
            <option value="approved">{t('supervision.invoices.filter.approved')}</option>
            <option value="not_approved">{t('supervision.invoices.filter.not_approved')}</option>
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

      {filteredInvoices.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title={t('supervision.invoices.no_found')}
          description={t('common.adjust_search')}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <table className="w-full min-w-[1400px] bg-white dark:bg-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">{t('supervision.invoices.col.approved')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('supervision.invoices.col.invoice_num')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('supervision.invoices.col.category')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('supervision.invoices.col.date')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('supervision.invoices.col.supplier')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('supervision.invoices.col.project')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('supervision.invoices.col.phase')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('supervision.invoices.col.company')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('supervision.invoices.col.amount')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('supervision.invoices.col.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3 text-center">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      icon={invoice.approved ? CheckSquare : Square}
                      onClick={() => handleApprove(invoice.id, invoice.approved)}
                      title={invoice.approved ? t('supervision.invoices.tooltip_approved') : t('supervision.invoices.tooltip_approve')}
                      className={invoice.approved ? 'text-green-600 hover:text-green-800' : 'text-gray-400 dark:text-gray-500 hover:text-blue-600'}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{invoice.invoice_number}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={invoice.invoice_category === 'SUPERVISION' ? 'blue' : 'gray'} size="sm">
                      {invoice.invoice_category}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 whitespace-nowrap">{format(new Date(invoice.issue_date), 'dd.MM.yyyy')}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{invoice.supplier_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 whitespace-nowrap">{invoice.project_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{invoice.phase_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{invoice.company_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white text-right whitespace-nowrap">
                    €{invoice.total_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={
                      invoice.status === 'PAID' ? 'green'
                        : invoice.status === 'PARTIALLY_PAID' ? 'yellow'
                        : 'red'
                    }>
                      {invoice.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default InvoicesManagement
