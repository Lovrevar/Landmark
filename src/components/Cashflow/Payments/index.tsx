import React from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Columns, Check, X } from 'lucide-react'
import { Alert, LoadingSpinner, PageHeader, SearchInput, Button, Select, ConfirmDialog, Pagination, ErrorState } from '../../ui'
import { toErrorMessage } from '../../../lib/errorMessage'
import DateInput from '../../Common/DateInput'
import { usePayments } from './hooks/usePayments'
import AccountingPaymentFormModal from './forms/AccountingPaymentFormModal'
import PaymentStatsCards from './PaymentStatsCards'
import PaymentTable from './PaymentTable'
import { PaymentDetailView } from './PaymentDetailView'
import { columnLabels } from '../services/paymentHelpers'
import { paymentDirection } from '../services/invoiceHelpers'
import { paymentTotalsByDirection, formatSignedEuro } from '../services/paymentTotals'
import { formatEuro } from '../../../utils/formatters'
import type { FilterMethod, FilterInvoiceType } from './types'

const AccountingPayments: React.FC = () => {
  const { t } = useTranslation()
  const {
    payments,
    invoices,
    companies,
    companyBankAccounts,
    companyCredits,
    creditAllocations,
    handleCreditChange,
    loading,
    error,
    refetch,
    dismissError,
    searchTerm,
    setSearchTerm,
    filterMethod,
    setFilterMethod,
    filterInvoiceType,
    setFilterInvoiceType,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    showColumnMenu,
    setShowColumnMenu,
    showPaymentModal,
    editingPayment,
    viewingPayment,
    formData,
    setFormData,
    visibleColumns,
    toggleColumn,
    handleOpenModal,
    handleCloseModal,
    handleViewPayment,
    handleCloseDetailView,
    handleSubmit,
    handleDelete,
    confirmDelete,
    cancelDelete,
    pendingDeleteId,
    deleting,
    filteredPayments,
    paginatedPayments,
    currentPage,
    setCurrentPage,
    pageSize,
    totalCount,
    resetDateFilters
  } = usePayments()

  if (loading) {
    return <LoadingSpinner message={t('common.loading')} />
  }

  // Nothing came back: the zeros in the stat cards would be a claim about the money, not a
  // description of an empty table. Say the load failed instead.
  const loadFailedEmpty = !!error && payments.length === 0

  const filteredTotals = paymentTotalsByDirection(
    filteredPayments.map(p => ({ amount: p.amount, direction: paymentDirection(p.accounting_invoices?.invoice_type) }))
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('payments.title')}
        description={t('payments.subtitle')}
        actions={
          <>
            <div className="relative column-menu-container">
              <Button variant="secondary" icon={Columns} onClick={() => setShowColumnMenu(!showColumnMenu)}>
                {t('payments.columns_label')}
              </Button>
              {showColumnMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50 max-h-96 overflow-y-auto">
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('payments.show_columns')}</p>
                  </div>
                  {Object.entries(columnLabels).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => toggleColumn(key)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between"
                    >
                      <span className="text-gray-700 dark:text-gray-200">{label}</span>
                      {visibleColumns[key] && <Check className="w-4 h-4 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button variant="primary" icon={Plus} onClick={() => handleOpenModal()}>
              {t('payments.add_new')}
            </Button>
          </>
        }
      />

      {error && payments.length > 0 && (
        <Alert variant="error" title={t('common.load_error_title')} onDismiss={dismissError}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="flex-1">{toErrorMessage(error, t('payments.toast.load_error_partial'))}</span>
            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          </div>
        </Alert>
      )}

      {/* The filtered rows, not every loaded payment: the cards sit above the table and used to
          describe a different set from the one below them. */}
      {!loadFailedEmpty && <PaymentStatsCards payments={filteredPayments} />}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm('')}
            placeholder={t('payments.search_placeholder')}
          />

          <Select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value as FilterMethod)}
          >
            <option value="ALL">{t('payments.filters.all_methods')}</option>
            <option value="WIRE">{t('payments.method_wire')}</option>
            <option value="CASH">{t('payments.method_cash')}</option>
            <option value="CHECK">{t('payments.method_check')}</option>
            <option value="CARD">{t('payments.method_card')}</option>
          </Select>

          <Select
            value={filterInvoiceType}
            onChange={(e) => setFilterInvoiceType(e.target.value as FilterInvoiceType)}
          >
            <option value="ALL">{t('payments.filters.all_invoice_types')}</option>
            <option value="EXPENSE">{t('payments.filters.expense')}</option>
            <option value="INCOME">{t('payments.filters.income')}</option>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col">
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('payments.filters.date_from')}</label>
            <DateInput
              value={dateFrom}
              onChange={setDateFrom}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('payments.filters.date_to')}</label>
            <DateInput
              value={dateTo}
              onChange={setDateTo}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-end">
            {(dateFrom || dateTo) && (
              <Button variant="ghost" icon={X} onClick={resetDateFilters}>
                {t('payments.filters.reset_dates')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {loadFailedEmpty ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <ErrorState onRetry={() => void refetch()} />
        </div>
      ) : (
        <PaymentTable
          payments={paginatedPayments}
          visibleColumns={visibleColumns}
          onView={handleViewPayment}
          onEdit={handleOpenModal}
          onDelete={handleDelete}
        />
      )}

      <PaymentDetailView
        payment={viewingPayment}
        onClose={handleCloseDetailView}
      />

      {!loadFailedEmpty && (
      <Pagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={setCurrentPage}
        itemLabel={t('payments.pagination.item_label')}
        extra={
          /* Split by direction, never one sum: income and expense added together is a figure
             nobody can act on, and it was shown in green as though it were all money in. */
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-gray-600 dark:text-gray-400">{t('payments.filtered_total')}</span>
            <span className="font-semibold text-green-600 dark:text-green-400">
              {t('payments.table.income')} {formatEuro(filteredTotals.inflow)}
            </span>
            <span className="font-semibold text-red-600 dark:text-red-400">
              {t('payments.table.expense')} {formatEuro(filteredTotals.outflow)}
            </span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {t('payments.stats.net')} {formatSignedEuro(filteredTotals.net)}
            </span>
          </span>
        }
      />
      )}

      <AccountingPaymentFormModal
        showModal={showPaymentModal}
        editingPayment={editingPayment}
        formData={formData}
        setFormData={setFormData}
        invoices={invoices}
        companies={companies}
        companyBankAccounts={companyBankAccounts}
        companyCredits={companyCredits}
        creditAllocations={creditAllocations}
        onCreditChange={handleCreditChange}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        show={!!pendingDeleteId}
        title={t('confirm.delete_title')}
        message={t('confirm.delete_payment')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        loading={deleting}
      />
    </div>
  )
}

export default AccountingPayments
