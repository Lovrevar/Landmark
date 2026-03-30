import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { LoadingSpinner, PageHeader, StatGrid, StatCard, SearchInput, Select, Button, FormField, Input, Badge, EmptyState } from '../../ui'
import { FileText, Calendar, Download, TrendingUp, AlertCircle, Building2, CheckSquare, Square } from 'lucide-react'
import { format } from 'date-fns'
import { useRetailInvoices } from './hooks/useRetailInvoices'

const RetailInvoicesManagement: React.FC = () => {
  const { t } = useTranslation()
  const {
    loading,
    stats,
    filteredInvoices,
    searchTerm,
    setSearchTerm,
    filterApproved,
    setFilterApproved,
    filterType,
    setFilterType,
    dateRange,
    setDateRange,
    handleApprove,
    handleExportCSV,
  } = useRetailInvoices()

  const INVOICE_TYPE_LABELS = useMemo<Record<string, string>>(() => ({
    INCOMING_SUPPLIER: t('retail_invoices.type.incoming_supplier'),
    OUTGOING_SALES: t('retail_invoices.type.outgoing_sales'),
    OUTGOING_SUPPLIER: t('retail_invoices.type.outgoing_supplier'),
    INCOMING_INVESTMENT: t('retail_invoices.type.incoming_investment'),
  }), [t])

  const INVOICE_STATUS_LABELS: Record<string, string> = {
    PAID: t('common.paid'),
    PARTIALLY_PAID: t('common.partial'),
    UNPAID: t('common.unpaid'),
  }

  if (loading) return <LoadingSpinner message={t('retail_invoices.loading')} />

  return (
    <div className="p-6">
      <PageHeader
        title={t('retail_invoices.title')}
        description={t('retail_invoices.description')}
      />

      <StatGrid columns={4} className="mb-8">
        <StatCard label={t('common.total_invoices')} value={stats.totalInvoices} icon={FileText} color="blue" />
        <StatCard label={t('common.total_amount')} value={`€${stats.totalAmount.toLocaleString('hr-HR')}`} icon={FileText} color="green" />
        <StatCard label={t('common.this_month')} value={stats.invoicesThisMonth} subtitle={t('retail_invoices.invoices_subtitle')} icon={Calendar} />
        <StatCard label={t('common.month_amount')} value={`€${stats.amountThisMonth.toLocaleString('hr-HR')}`} icon={TrendingUp} color="teal" />
      </StatGrid>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <SearchInput
              placeholder={t('retail_invoices.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
            />
          </div>

          <Select value={filterType} onChange={(e) => setFilterType(e.target.value as 'all' | 'incoming' | 'outgoing')}>
            <option value="all">{t('retail_invoices.filter.all_types')}</option>
            <option value="incoming">{t('retail_invoices.filter.incoming')}</option>
            <option value="outgoing">{t('retail_invoices.filter.outgoing')}</option>
          </Select>

          <Select value={filterApproved} onChange={(e) => setFilterApproved(e.target.value as 'all' | 'approved' | 'not_approved')}>
            <option value="all">{t('common.all')}</option>
            <option value="approved">{t('retail_invoices.filter.approved')}</option>
            <option value="not_approved">{t('retail_invoices.filter.not_approved')}</option>
          </Select>

          <Button variant="success" icon={Download} onClick={handleExportCSV} fullWidth>
            {t('common.export_csv')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <FormField label={t('retail_invoices.date_from')}>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </FormField>
          <FormField label={t('retail_invoices.date_to')}>
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
          title={t('retail_invoices.no_invoices')}
          description={t('retail_invoices.no_invoices_desc')}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <table className="w-full min-w-[1200px] bg-white dark:bg-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">{t('retail_invoices.table.approve')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('retail_invoices.table.invoice_number')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('retail_invoices.table.type')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.date')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('retail_invoices.table.due_date')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.project')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('retail_invoices.table.supplier_customer')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.company')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.amount')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${invoice.approved ? 'bg-green-50/30 dark:bg-green-900/10' : ''}`}
                >
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleApprove(invoice.id, invoice.approved)}
                      title={invoice.approved ? t('retail_invoices.approve_title_cancel') : t('retail_invoices.approve_title')}
                      className={`p-1 rounded transition-colors ${
                        invoice.approved
                          ? 'text-green-600 hover:text-green-800'
                          : 'text-gray-400 dark:text-gray-500 hover:text-blue-600'
                      }`}
                    >
                      {invoice.approved ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{invoice.invoice_number}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={invoice.invoice_type.startsWith('INCOMING') ? 'blue' : 'gray'} size="sm">
                      {INVOICE_TYPE_LABELS[invoice.invoice_type] || invoice.invoice_type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 whitespace-nowrap">{format(new Date(invoice.issue_date), 'dd.MM.yyyy')}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 whitespace-nowrap">{format(new Date(invoice.due_date), 'dd.MM.yyyy')}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 whitespace-nowrap">{invoice.project_name}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                    {invoice.supplier_name || invoice.customer_name || '-'}
                  </td>
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
                      {INVOICE_STATUS_LABELS[invoice.status] || invoice.status}
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

export default RetailInvoicesManagement
