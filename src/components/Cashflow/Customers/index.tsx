import React from 'react'
import { useTranslation } from 'react-i18next'
import { Users, DollarSign, TrendingUp, TrendingDown, FileText, Eye } from 'lucide-react'
import { format } from 'date-fns'
import { useAccountingCustomers } from './hooks/useAccountingCustomers'
import { Alert, PageHeader, StatGrid, LoadingSpinner, SearchInput, StatCard, EmptyState, ErrorState, Button, Badge, Modal } from '../../ui'
import { toErrorMessage } from '../../../lib/errorMessage'
import { parseLocalDate } from '../../../utils/dateOnly'
import { formatEuro } from '../../../utils/formatters'
import { getInvoiceStatusVariant, getInvoiceStatusLabel } from '../services/invoiceHelpers'

const AccountingCustomers: React.FC = () => {
  const { t } = useTranslation()
  const {
    customers,
    loading,
    error,
    partial,
    refetch,
    dismissError,
    searchTerm,
    setSearchTerm,
    showDetailsModal,
    selectedCustomer,
    handleOpenDetails,
    handleCloseDetails,
    filteredCustomers,
    totalStats
  } = useAccountingCustomers()

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('accounting_customers.title')}
        description={t('accounting_customers.description')}
      />

      {error && (
        <Alert variant="error" title={t('common.load_error_title')} onDismiss={dismissError}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="flex-1">
              {partial
                ? t('accounting_customers.load_error_partial')
                : toErrorMessage(error, t('common.load_error_description'))}
            </span>
            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          </div>
        </Alert>
      )}

      {/* Totals summed over a partial list would read as the whole book, so they stay hidden
          until every customer's figures are in. */}
      {!error && (
        <StatGrid columns={4}>
          <StatCard label={t('accounting_customers.stats.total_invoices')} value={totalStats.total_invoices} icon={FileText} />
          <StatCard label={t('accounting_customers.stats.property_value')} value={`€${totalStats.total_property_value.toLocaleString('hr-HR')}`} icon={DollarSign} color="gray" />
          <StatCard label={t('accounting_customers.stats.paid')} value={`€${totalStats.total_paid.toLocaleString('hr-HR')}`} icon={TrendingUp} color="green" />
          <StatCard label={t('accounting_customers.stats.debt')} value={`€${totalStats.total_debt.toLocaleString('hr-HR')}`} icon={TrendingDown} color="red" />
        </StatGrid>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm('')}
            placeholder={t('accounting_customers.search_placeholder')}
          />
        </div>

        <div className="overflow-x-auto responsive-table">
          {loading ? (
            <LoadingSpinner size="sm" message={t('common.loading')} />
          ) : error && customers.length === 0 ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : filteredCustomers.length === 0 ? (
            <EmptyState icon={Users} title={t('accounting_customers.empty')} />
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('accounting_customers.table.customer')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('accounting_customers.table.contact')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('accounting_customers.table.invoices')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('accounting_customers.table.apartments')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('accounting_customers.table.property_price')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('accounting_customers.table.paid')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('accounting_customers.table.debt')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('accounting_customers.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td data-label={t('accounting_customers.table.customer')} className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{customer.full_name}</div>
                    </td>
                    <td data-label={t('accounting_customers.table.contact')} className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 dark:text-gray-400">{customer.email || '-'}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{customer.phone || '-'}</div>
                    </td>
                    <td data-label={t('accounting_customers.table.invoices')} className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{customer.total_invoices}</span>
                    </td>
                    <td data-label={t('accounting_customers.table.apartments')} className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-blue-600">{customer.total_apartments}</span>
                    </td>
                    <td data-label={t('accounting_customers.table.property_price')} className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">€{customer.property_price.toLocaleString('hr-HR')}</span>
                    </td>
                    <td data-label={t('accounting_customers.table.paid')} className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-green-600">€{customer.total_paid.toLocaleString('hr-HR')}</span>
                    </td>
                    <td data-label={t('accounting_customers.table.debt')} className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-red-600">€{(customer.property_price - customer.total_paid).toLocaleString('hr-HR')}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button variant="ghost-primary" size="sm" icon={Eye} onClick={() => handleOpenDetails(customer)}>
                        {t('accounting_customers.details_button')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showDetailsModal && selectedCustomer && (
        <Modal show={showDetailsModal} onClose={handleCloseDetails} size="xl">
          <Modal.Header title={selectedCustomer.full_name} subtitle={t('accounting_customers.modal.subtitle')} onClose={handleCloseDetails} />
          <Modal.Body>
            <StatGrid columns={5}>
              <StatCard label={t('accounting_customers.modal.stats.total_invoices')} value={selectedCustomer.total_invoices} color="blue" size="sm" />
              <StatCard label={t('accounting_customers.modal.stats.apartments')} value={selectedCustomer.total_apartments} color="blue" size="sm" />
              <StatCard label={t('accounting_customers.modal.stats.property_price')} value={`€${selectedCustomer.property_price.toLocaleString('hr-HR')}`} color="gray" size="sm" />
              <StatCard label={t('accounting_customers.modal.stats.paid')} value={`€${selectedCustomer.total_paid.toLocaleString('hr-HR')}`} color="green" size="sm" />
              <StatCard label={t('accounting_customers.modal.stats.debt')} value={`€${(selectedCustomer.property_price - selectedCustomer.total_paid).toLocaleString('hr-HR')}`} color="red" size="sm" />
            </StatGrid>

            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('accounting_customers.modal.contact_heading')}</h3>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t('accounting_customers.modal.email')}</span>
                  <span className="text-gray-900 dark:text-white font-medium">{selectedCustomer.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t('accounting_customers.modal.phone')}</span>
                  <span className="text-gray-900 dark:text-white font-medium">{selectedCustomer.phone || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('accounting_customers.modal.invoices_heading')}</h3>
              {selectedCustomer.invoices.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">{t('accounting_customers.modal.no_invoices')}</p>
              ) : (
                <div className="space-y-3">
                  {/* A customer invoice can only ever be OUTGOING_SALES — the DB's
                      `check_invoice_entity_type` allows no other type to carry a `customer_id`,
                      and the query filters on it. The green border, the up arrow and the PRIHOD
                      badge were therefore constants stating the obvious, and their red/RASHOD
                      halves were unreachable. Gone; the status badge carries the news instead. */}
                  {selectedCustomer.invoices.map((invoice) => (
                    <div key={invoice.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{invoice.invoice_number}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {t('accounting_customers.modal.invoice_company')} {invoice.company?.name || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {format(parseLocalDate(invoice.issue_date), 'dd.MM.yyyy')}
                          </p>
                        </div>
                        {/* The shared renderer: the local switch here had UNPAID gray, where it is
                            red on every other screen, and labelled an unknown status "Neplaćeno". */}
                        <Badge variant={getInvoiceStatusVariant(invoice.status)} size="sm">
                          {getInvoiceStatusLabel(invoice.status, t)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{t('accounting_customers.modal.total')}</p>
                          <p className="font-semibold text-gray-900 dark:text-white">{formatEuro(invoice.total_amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{t('accounting_customers.modal.paid')}</p>
                          {/* Colour only where there is something to colour: €0 paid is not good
                              news in green, and €0 left to pay is not a warning in red. */}
                          <p className={`font-semibold ${invoice.paid_amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                            {formatEuro(invoice.paid_amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{t('accounting_customers.modal.remaining')}</p>
                          <p className={`font-semibold ${invoice.remaining_amount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                            {formatEuro(invoice.remaining_amount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseDetails}>{t('accounting_customers.modal.close')}</Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  )
}

export default AccountingCustomers
