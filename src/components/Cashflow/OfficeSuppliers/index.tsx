import React from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Plus, Edit, Trash2, Mail, Phone, MapPin, FileText, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { useOfficeSuppliers } from './hooks/useOfficeSuppliers'
import OfficeSupplierFormModal from './forms/OfficeSupplierFormModal'
import { PageHeader, StatGrid, LoadingSpinner, SearchInput, Button, StatCard, EmptyState, Modal, Table, Badge, ConfirmDialog } from '../../ui'

const OfficeSuppliers: React.FC = () => {
  const { t } = useTranslation()
  const {
    suppliers,
    loading,
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
          value={`€${suppliers.reduce((sum, s) => sum + s.paid_amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={Building2}
          color="green"
        />

        <StatCard
          label={t('office_suppliers.stats.remaining')}
          value={`€${suppliers.reduce((sum, s) => sum + s.remaining_amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={Building2}
          color="yellow"
        />
      </StatGrid>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder={t('office_suppliers.search_placeholder')}
        />
      </div>

      {filteredSuppliers.length === 0 ? (
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
                    <span className="text-gray-600 dark:text-gray-400">OIB:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{supplier.tax_id}</span>
                  </div>
                )}
                {supplier.vat_id && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">PDV ID:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{supplier.vat_id}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">{t('office_suppliers.card.invoices')}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{supplier.total_invoices}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('office_suppliers.card.total_no_vat')}</span>
                  <span className="font-bold text-gray-900 dark:text-white">€{supplier.total_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('office_suppliers.card.paid')}</span>
                  <span className="font-medium text-green-600">€{supplier.paid_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('office_suppliers.card.remaining')}</span>
                  <span className="font-medium text-orange-600">€{supplier.remaining_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
              subtitle={t('office_suppliers.invoices_modal.subtitle', { count: supplierInvoices.length, paid: selectedSupplier.paid_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), remaining: selectedSupplier.remaining_amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}
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
                        <Table.Td className="font-medium">
                          {invoice.invoice_number}
                        </Table.Td>
                        <Table.Td className="text-gray-600 dark:text-gray-400">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1 text-gray-400 dark:text-gray-500" />
                            {format(new Date(invoice.issue_date), 'dd.MM.yyyy')}
                          </div>
                        </Table.Td>
                        <Table.Td className="text-gray-600 dark:text-gray-400">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1 text-gray-400 dark:text-gray-500" />
                            {format(new Date(invoice.due_date), 'dd.MM.yyyy')}
                          </div>
                        </Table.Td>
                        <Table.Td className="text-gray-600 dark:text-gray-400 max-w-xs truncate">
                          {invoice.description || '-'}
                        </Table.Td>
                        <Table.Td className="text-right">
                          €{parseFloat(invoice.base_amount).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Table.Td>
                        <Table.Td className="text-right font-medium">
                          €{parseFloat(invoice.total_amount).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Table.Td>
                        <Table.Td className="text-right text-green-600">
                          €{parseFloat(invoice.paid_amount).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Table.Td>
                        <Table.Td className="text-right text-orange-600">
                          €{parseFloat(invoice.remaining_amount).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Table.Td>
                        <Table.Td className="text-center">
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
