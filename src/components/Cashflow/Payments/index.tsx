import React from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Columns, Check, X } from 'lucide-react'
import { LoadingSpinner, PageHeader, SearchInput, Button, Select, ConfirmDialog } from '../../ui'
import DateInput from '../../Common/DateInput'
import { usePayments } from './hooks/usePayments'
import AccountingPaymentFormModal from './forms/AccountingPaymentFormModal'
import PaymentStatsCards from './PaymentStatsCards'
import PaymentTable from './PaymentTable'
import { PaymentDetailView } from './PaymentDetailView'
import { columnLabels } from '../services/paymentHelpers'
import type { FilterMethod, FilterInvoiceType } from './types'

const AccountingPayments: React.FC = () => {
  const { t } = useTranslation()
  const {
    payments,
    invoices,
    companies,
    companyBankAccounts,
    companyCredits,
    loading,
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
    resetDateFilters
  } = usePayments()

  if (loading) {
    return <LoadingSpinner message={t('common.loading')} />
  }

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
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 max-h-96 overflow-y-auto">
                  <div className="px-3 py-2 border-b border-gray-200">
                    <p className="text-sm font-semibold text-gray-700">{t('payments.show_columns')}</p>
                  </div>
                  {Object.entries(columnLabels).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => toggleColumn(key)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span className="text-gray-700">{label}</span>
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

      <PaymentStatsCards payments={payments} />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
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
            <label className="text-xs text-gray-600 mb-1">{t('payments.filters.date_from')}</label>
            <DateInput
              value={dateFrom}
              onChange={setDateFrom}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">{t('payments.filters.date_to')}</label>
            <DateInput
              value={dateTo}
              onChange={setDateTo}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

      <PaymentTable
        payments={filteredPayments}
        visibleColumns={visibleColumns}
        onView={handleViewPayment}
        onEdit={handleOpenModal}
        onDelete={handleDelete}
      />

      <PaymentDetailView
        payment={viewingPayment}
        onClose={handleCloseDetailView}
      />

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">{t('payments.shown_count', { filtered: filteredPayments.length, total: payments.length })}</span>
          <div className="flex items-center space-x-6 text-sm">
            <div>
              <span className="text-gray-600">{t('payments.filtered_total')}</span>
              <span className="font-semibold text-green-600">
                €{filteredPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('hr-HR')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <AccountingPaymentFormModal
        showModal={showPaymentModal}
        editingPayment={editingPayment}
        formData={formData}
        setFormData={setFormData}
        invoices={invoices}
        companies={companies}
        companyBankAccounts={companyBankAccounts}
        companyCredits={companyCredits}
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
