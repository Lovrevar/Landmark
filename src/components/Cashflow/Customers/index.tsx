import React from 'react'
import { useTranslation } from 'react-i18next'
import { Users, DollarSign, TrendingUp, TrendingDown, FileText, Eye, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { useAccountingCustomers } from './hooks/useAccountingCustomers'
import { PageHeader, StatGrid, LoadingSpinner, SearchInput, StatCard, EmptyState, Button, Badge, Modal } from '../../ui'

const AccountingCustomers: React.FC = () => {
  const { t } = useTranslation()
  const {
    loading,
    searchTerm,
    setSearchTerm,
    showDetailsModal,
    selectedCustomer,
    isIncomeInvoice,
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

      <StatGrid columns={4}>
        <StatCard label={t('accounting_customers.stats.total_invoices')} value={totalStats.total_invoices} icon={FileText} />
        <StatCard label={t('accounting_customers.stats.property_value')} value={`€${totalStats.total_property_value.toLocaleString('hr-HR')}`} icon={DollarSign} color="gray" />
        <StatCard label={t('accounting_customers.stats.paid')} value={`€${totalStats.total_paid.toLocaleString('hr-HR')}`} icon={TrendingUp} color="green" />
        <StatCard label={t('accounting_customers.stats.debt')} value={`€${totalStats.total_debt.toLocaleString('hr-HR')}`} icon={TrendingDown} color="red" />
      </StatGrid>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm('')}
            placeholder={t('accounting_customers.search_placeholder')}
          />
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <LoadingSpinner size="sm" message={t('common.loading')} />
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{customer.full_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 dark:text-gray-400">{customer.email || '-'}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{customer.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{customer.total_invoices}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-blue-600">{customer.total_apartments}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">€{customer.property_price.toLocaleString('hr-HR')}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-green-600">€{customer.total_paid.toLocaleString('hr-HR')}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-red-600">€{(customer.property_price - customer.total_paid).toLocaleString('hr-HR')}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button variant="ghost" size="sm" icon={Eye} onClick={() => handleOpenDetails(customer)} className="text-blue-600 hover:text-blue-900">
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
                  {selectedCustomer.invoices.map((invoice) => (
                    <div key={invoice.id} className={`border-2 rounded-lg p-4 ${
                      isIncomeInvoice(invoice.invoice_type) ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                    }`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            {isIncomeInvoice(invoice.invoice_type) ? (
                              <ArrowUpCircle className="w-5 h-5 text-green-600" />
                            ) : (
                              <ArrowDownCircle className="w-5 h-5 text-red-600" />
                            )}
                            <p className="font-medium text-gray-900 dark:text-white">{invoice.invoice_number}</p>
                            <Badge variant={isIncomeInvoice(invoice.invoice_type) ? 'green' : 'red'} size="sm">
                              {isIncomeInvoice(invoice.invoice_type) ? t('accounting_customers.modal.invoice_income') : t('accounting_customers.modal.invoice_expense')}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {t('accounting_customers.modal.invoice_company')} {invoice.company?.name || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(invoice.issue_date).toLocaleDateString('hr-HR')}</p>
                        </div>
                        <Badge
                          variant={invoice.status === 'PAID' ? 'green' : invoice.status === 'PARTIALLY_PAID' ? 'yellow' : 'gray'}
                          size="sm"
                        >
                          {invoice.status === 'PAID' ? t('accounting_customers.modal.status_paid') : invoice.status === 'PARTIALLY_PAID' ? t('accounting_customers.modal.status_partial') : t('accounting_customers.modal.status_unpaid')}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{t('accounting_customers.modal.total')}</p>
                          <p className="font-semibold text-gray-900 dark:text-white">€{invoice.total_amount.toLocaleString('hr-HR')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{t('accounting_customers.modal.paid')}</p>
                          <p className="font-semibold text-green-600">€{invoice.paid_amount.toLocaleString('hr-HR')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{t('accounting_customers.modal.remaining')}</p>
                          <p className="font-semibold text-red-600">€{invoice.remaining_amount.toLocaleString('hr-HR')}</p>
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
