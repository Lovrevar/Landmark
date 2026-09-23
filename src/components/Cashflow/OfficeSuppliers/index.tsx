import React from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Plus, Edit, Trash2, Mail, Phone, MapPin, FileText, Calendar } from 'lucide-react'
import { useOfficeSuppliers } from './hooks/useOfficeSuppliers'
import OfficeSupplierFormModal from './forms/OfficeSupplierFormModal'
import { Alert, PageHeader, StatGrid, LoadingSpinner, SearchInput, Button, StatCard, EmptyState, ErrorState, Modal, Table, Badge, ConfirmDialog } from '../../ui'
import { formatEuro, formatEuropean, formatDate } from '../../../utils/formatters'
import { toErrorMessage } from '../../../lib/errorMessage'

const OfficeSuppliers: React.FC = () => {
  const { t, i18n } = useTranslation()
  const {
    suppliers,
    loading,
    error,
    refetch,
    dismissError,
    searchTerm,
    setSearchTerm,
    showModal,
    editingSupplier,
    showInvoicesModal,
    selectedSupplier,
    supplierInvoices,
    loadingInvoices,
    formData,
    setFormData,
    filteredSuppliers,
    handleOpenModal,
    handleCloseModal,
    handleSubmit,
    handleDelete,
    confirmDelete,
    cancelDelete,
    pendingDeleteId,
    deleting,
    handleViewInvoices,
    handleCloseInvoicesModal
  } = useOfficeSuppliers()

  if (loading) {
    return <LoadingSpinner message={t('common.loading')} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('office_suppliers.title')}
        description={t('office_suppliers.description')}
        actions={
          <Button
            onClick={() => handleOpenModal()}
            icon={Plus}
          >
            {t('office_suppliers.add_button')}
          </Button>
        }
      />

      {error && suppliers.length > 0 && (
        <Alert variant="error" title={t('common.load_error_title')} onDismiss={dismissError}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="flex-1">{toErrorMessage(error, t('common.load_error_description'))}</span>
            <Button size="sm" variant="secondary" onClick={() => void refetch()}>{t('common.retry')}</Button>
          </div>
        </Alert>
      )}

      {!(error && suppliers.length === 0) && (
      <StatGrid columns={4}>
        <StatCard
          label={t('office_suppliers.stats.total')}
          value={suppliers.length}
          icon={Building2}
          color="white"
        />

        <StatCard
          label={t('office_suppliers.stats.total_invoices')}
          value={suppliers.reduce((sum, s) => sum + s.total_invoices, 0)}
          icon={FileText}
          color="gray"
        />

        <StatCard
          label={t('office_suppliers.stats.total_paid')}
          value={formatEuro(suppliers.reduce((sum, s) => sum + s.paid_amount, 0))}
          icon={Building2}
          color="green"
        />

        <StatCard
          label={t('office_suppliers.stats.remaining')}
          value={formatEuro(suppliers.reduce((sum, s) => sum + s.remaining_amount, 0))}
          icon={Building2}
          color="yellow"
        />
      </StatGrid>
      )}

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder={t('office_suppliers.search_placeholder')}
        />
      </div>

      {error && suppliers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <ErrorState onRetry={() => void refetch()} />
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <EmptyState
            icon={Building2}
            title={searchTerm ? t('office_suppliers.empty.title_search') : t('office_suppliers.empty.title_empty')}
            description={searchTerm ? t('office_suppliers.empty.description_search') : t('office_suppliers.empty.description_empty')}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer"
              onClick={() => handleViewInvoices(supplier)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{supplier.name}</h3>
                  {supplier.contact && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                      <Phone className="w-3 h-3 mr-1" />
                      {supplier.contact}
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                      <Mail className="w-3 h-3 mr-1" />
                      {supplier.email}
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                      <MapPin className="w-3 h-3 mr-1" />
                      {supplier.address}
                    </div>
                  )}
                </div>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {supplier.tax_id && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">{t('common.oib')}:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{supplier.tax_id}</span>
                  </div>
                )}
                {supplier.vat_id && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">{t('common.vat_id')}:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{supplier.vat_id}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">{t('office_suppliers.card.invoices')}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{supplier.total_invoices}</span>
                </div>
                {/* Gross, paid and remaining are all s PDV, so total − paid = remaining on screen. */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('office_suppliers.card.total')}</span>
                  <span className="font-bold text-gray-900 dark:text-white">{formatEuro(supplier.gross_amount)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-500">{t('office_suppliers.card.base')}</span>
                  <span className="text-gray-500 dark:text-gray-400">{formatEuro(supplier.total_amount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('office_suppliers.card.paid')}</span>
                  <span className="font-medium text-green-600">{formatEuro(supplier.paid_amount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('office_suppliers.card.remaining')}</span>
                  <span className="font-medium text-orange-600">{formatEuro(supplier.remaining_amount)}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenModal(supplier)
                  }}
                  icon={Edit}
                  size="sm"
                  fullWidth
                >
                  {t('office_suppliers.card.edit')}
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(supplier.id)
                  }}
                  variant="outline-danger"
                  size="icon-md"
                  icon={Trash2}
                  title={t('office_suppliers.card.delete')}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <OfficeSupplierFormModal
        showModal={showModal}
        editingSupplier={editingSupplier}
        formData={formData}
        setFormData={setFormData}
        handleCloseModal={handleCloseModal}
        handleSubmit={handleSubmit}
      />

      <Modal show={showInvoicesModal && !!selectedSupplier} onClose={handleCloseInvoicesModal} size="full">
        {selectedSupplier && (
          <>
            <Modal.Header
              title={t('office_suppliers.invoices_modal.title', { name: selectedSupplier.name })}
              subtitle={t('office_suppliers.invoices_modal.subtitle', { count: supplierInvoices.length, paid: formatEuropean(selectedSupplier.paid_amount), remaining: formatEuropean(selectedSupplier.remaining_amount) })}
              onClose={handleCloseInvoicesModal}
            />

            <Modal.Body noPadding={false}>
              {loadingInvoices ? (
                <LoadingSpinner message={t('office_suppliers.invoices_modal.loading')} />
              ) : supplierInvoices.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title={t('office_suppliers.invoices_modal.empty_title')}
                  description={t('office_suppliers.invoices_modal.empty_description')}
                />
              ) : (
                <Table>
                  <Table.Head>
                    <Table.Tr hoverable={false}>
                      <Table.Th>{t('office_suppliers.invoices_modal.table.invoice_number')}</Table.Th>
                      <Table.Th>{t('office_suppliers.invoices_modal.table.issue_date')}</Table.Th>
                      <Table.Th>{t('office_suppliers.invoices_modal.table.due_date')}</Table.Th>
                      <Table.Th>{t('office_suppliers.invoices_modal.table.description')}</Table.Th>
                      <Table.Th className="text-right">{t('office_suppliers.invoices_modal.table.base')}</Table.Th>
                      <Table.Th className="text-right">{t('office_suppliers.invoices_modal.table.total')}</Table.Th>
                      <Table.Th className="text-right">{t('office_suppliers.invoices_modal.table.paid')}</Table.Th>
                      <Table.Th className="text-right">{t('office_suppliers.invoices_modal.table.remaining')}</Table.Th>
                      <Table.Th className="text-center">{t('office_suppliers.invoices_modal.table.status')}</Table.Th>
                    </Table.Tr>
                  </Table.Head>
                  <Table.Body>
                    {supplierInvoices.map((invoice) => (
                      <Table.Tr key={invoice.id}>
                        <Table.Td label={t('office_suppliers.invoices_modal.table.invoice_number')} className="font-medium">
                          {invoice.invoice_number}
                        </Table.Td>
                        <Table.Td label={t('office_suppliers.invoices_modal.table.issue_date')} className="text-gray-600 dark:text-gray-400">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1 text-gray-400 dark:text-gray-500" />
                            {formatDate(invoice.issue_date, i18n.language)}
                          </div>
                        </Table.Td>
                        <Table.Td label={t('office_suppliers.invoices_modal.table.due_date')} className="text-gray-600 dark:text-gray-400">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1 text-gray-400 dark:text-gray-500" />
                            {formatDate(invoice.due_date, i18n.language)}
                          </div>
                        </Table.Td>
                        <Table.Td label={t('office_suppliers.invoices_modal.table.description')} className="text-gray-600 dark:text-gray-400 max-w-xs truncate">
                          {invoice.description || '-'}
                        </Table.Td>
                        <Table.Td label={t('office_suppliers.invoices_modal.table.base')} className="text-right">
                          {formatEuro(parseFloat(invoice.base_amount))}
                        </Table.Td>
                        <Table.Td label={t('office_suppliers.invoices_modal.table.total')} className="text-right font-medium">
                          {formatEuro(parseFloat(invoice.total_amount))}
                        </Table.Td>
                        <Table.Td label={t('office_suppliers.invoices_modal.table.paid')} className="text-right text-green-600 dark:text-green-400">
                          {formatEuro(parseFloat(invoice.paid_amount))}
                        </Table.Td>
                        <Table.Td label={t('office_suppliers.invoices_modal.table.remaining')} className="text-right text-orange-600 dark:text-orange-400">
                          {formatEuro(parseFloat(invoice.remaining_amount))}
                        </Table.Td>
                        <Table.Td label={t('office_suppliers.invoices_modal.table.status')} className="text-center">
                          <Badge
                            variant={
                              invoice.status === 'PAID'
                                ? 'green'
                                : invoice.status === 'PARTIALLY_PAID'
                                ? 'yellow'
                                : 'red'
                            }
                            size="sm"
                          >
                            {invoice.status === 'PAID' ? t('office_suppliers.status.paid') : invoice.status === 'PARTIALLY_PAID' ? t('office_suppliers.status.partial') : t('office_suppliers.status.unpaid')}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Modal.Body>

            <Modal.Footer sticky>
              <Button
                onClick={handleCloseInvoicesModal}
                variant="ghost"
              >
                {t('office_suppliers.invoices_modal.close')}
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>

      <ConfirmDialog
        show={!!pendingDeleteId}
        title={t('office_suppliers.confirm_delete.title')}
        message={t('office_suppliers.confirm_delete.message')}
        confirmLabel={t('office_suppliers.confirm_delete.confirm')}
        cancelLabel={t('office_suppliers.confirm_delete.cancel')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        loading={deleting}
      />
    </div>
  )
}

export default OfficeSuppliers
