import React from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Plus, Edit, Trash2, Eye, Phone, Mail } from 'lucide-react'
import { LoadingSpinner, PageHeader, StatGrid, SearchInput, Button, Modal, FormField, Input, Textarea, Badge, EmptyState, StatCard, Form, ConfirmDialog } from '../../ui'
import { useRetailCustomers } from './hooks/useRetailCustomers'

const RetailCustomers: React.FC = () => {
  const { t } = useTranslation()
  const {
    loading,
    searchTerm,
    setSearchTerm,
    filteredCustomers,
    totalStats,
    showFormModal,
    showDetailsModal,
    selectedCustomer,
    editingCustomerId,
    formData,
    setFormData,
    openFormModal,
    closeFormModal,
    handleSubmit,
    fieldErrors,
    handleDelete,
    confirmDelete,
    cancelDelete,
    pendingDeleteId,
    deleting,
    handleViewDetails,
    closeDetailsModal,
  } = useRetailCustomers()

  if (loading) {
    return <LoadingSpinner message={t('common.loading')} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('retail_customers.title')}
        description={t('retail_customers.description')}
        actions={
          <Button icon={Plus} onClick={() => openFormModal()}>
            {t('retail_customers.new_customer')}
          </Button>
        }
      />

      <StatGrid columns={4}>
        <StatCard label={t('retail_customers.stats.total_customers')} value={totalStats.total_customers} icon={Users} color="blue" />
        <StatCard label={t('retail_customers.stats.total_area')} value={`${totalStats.total_area.toLocaleString()} m²`} icon={Users} color="green" />
        <StatCard label={t('retail_customers.stats.total_revenue')} value={`€${totalStats.total_revenue.toLocaleString('hr-HR')}`} icon={Users} color="green" />
        <StatCard label={t('common.remaining')} value={`€${totalStats.total_remaining.toLocaleString('hr-HR')}`} icon={Users} />
      </StatGrid>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder={t('retail_customers.search_placeholder')}
        />
      </div>

      {filteredCustomers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={searchTerm ? t('common.no_results') : t('retail_customers.no_customers')}
          description={searchTerm ? t('retail_customers.no_results_hint') : t('retail_customers.no_customers_hint')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{customer.name}</h3>
                  {customer.contact_phone && (
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <Phone className="w-3 h-3 mr-1" />
                      {customer.contact_phone}
                    </div>
                  )}
                  {customer.contact_email && (
                    <div className="flex items-center text-sm text-gray-600 mt-1">
                      <Mail className="w-3 h-3 mr-1" />
                      {customer.contact_email}
                    </div>
                  )}
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t('retail_customers.card.area')}:</span>
                  <span className="font-medium text-gray-900">{customer.total_purchased_area.toLocaleString()} m²</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="text-gray-600">{t('common.total')}:</span>
                  <span className="font-bold text-gray-900">€{customer.total_spent.toLocaleString('hr-HR')}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t('common.paid')}:</span>
                  <span className="font-medium text-green-600">€{customer.total_paid.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{t('common.remaining')}:</span>
                  <span className="font-medium text-orange-600">€{customer.total_remaining.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-3 border-t border-gray-200">
                <Button icon={Eye} size="sm" onClick={() => handleViewDetails(customer)} className="flex-1">
                  {t('common.details')}
                </Button>
                <Button icon={Edit} variant="ghost" size="icon-md" onClick={() => openFormModal(customer)} title={t('common.edit')} />
                <Button icon={Trash2} variant="outline-danger" size="icon-md" onClick={() => handleDelete(customer.id)} title={t('common.delete')} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal show={showFormModal} onClose={closeFormModal}>
        <Modal.Header title={editingCustomerId ? t('retail_customers.edit_customer') : t('retail_customers.new_customer')} onClose={closeFormModal} />
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <FormField label={t('retail_customers.form.name')} required error={fieldErrors.name}>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </FormField>
            <FormField label={t('retail_customers.form.phone')}>
              <Input value={formData.contact_phone} onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })} />
            </FormField>
            <FormField label={t('retail_customers.form.email')}>
              <Input type="email" value={formData.contact_email} onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })} />
            </FormField>
            <FormField label={t('retail_customers.form.oib')}>
              <Input value={formData.oib} onChange={(e) => setFormData({ ...formData, oib: e.target.value })} />
            </FormField>
            <FormField label={t('retail_customers.form.address')}>
              <Textarea rows={3} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </FormField>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={closeFormModal}>{t('common.cancel')}</Button>
            <Button type="submit">{editingCustomerId ? t('common.save') : t('common.add')}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showDetailsModal && !!selectedCustomer} onClose={closeDetailsModal} size="xl">
        <Modal.Header title={`${t('retail_customers.details_title')} - ${selectedCustomer?.name || ''}`} onClose={closeDetailsModal} />
        {selectedCustomer && (
          <>
            <Modal.Body>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">{t('retail_customers.form.name')}</p>
                  <p className="text-lg font-semibold">{selectedCustomer.name}</p>
                </div>
                {selectedCustomer.contact_phone && (
                  <div>
                    <p className="text-sm text-gray-600">{t('retail_customers.form.phone')}</p>
                    <p className="text-lg font-semibold">{selectedCustomer.contact_phone}</p>
                  </div>
                )}
                {selectedCustomer.contact_email && (
                  <div>
                    <p className="text-sm text-gray-600">{t('retail_customers.form.email')}</p>
                    <p className="text-lg font-semibold">{selectedCustomer.contact_email}</p>
                  </div>
                )}
                {selectedCustomer.oib && (
                  <div>
                    <p className="text-sm text-gray-600">{t('retail_customers.form.oib')}</p>
                    <p className="text-lg font-semibold">{selectedCustomer.oib}</p>
                  </div>
                )}
              </div>

              {selectedCustomer.address && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">{t('retail_customers.form.address')}</p>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">{selectedCustomer.address}</p>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold mb-3">{t('retail_customers.sales_heading', { count: selectedCustomer.sales?.length || 0 })}</h3>
                {selectedCustomer.sales && selectedCustomer.sales.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCustomer.sales.map((sale) => (
                      <div key={sale.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">
                              {sale.phase?.project?.name || 'N/A'} - {sale.phase?.phase_name || ''}
                            </p>
                            <p className="text-sm text-gray-600">{t('retail_customers.contract_label')}: {sale.contract_number}</p>
                            <p className="text-sm text-gray-600">
                              {(sale.total_surface_m2 || sale.building_surface_m2 || 0).toLocaleString()} m²
                              {sale.price_per_m2 && ` × €${sale.price_per_m2.toLocaleString()}`}
                              {' = €'}{(sale.contract_amount || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {t('common.paid')}: €{sale.paid_amount.toLocaleString()} |
                              {t('common.remaining')}: €{sale.remaining_amount.toLocaleString()}
                            </p>
                          </div>
                          <Badge variant={
                            sale.payment_status === 'paid' ? 'green'
                              : sale.payment_status === 'partial' ? 'yellow'
                              : 'gray'
                          }>
                            {sale.payment_status === 'paid' ? t('common.paid') :
                             sale.payment_status === 'partial' ? t('common.partial') :
                             t('common.pending')}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">{t('retail_customers.no_sales')}</p>
                )}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={closeDetailsModal}>{t('common.close')}</Button>
            </Modal.Footer>
          </>
        )}
      </Modal>

      <ConfirmDialog
        show={!!pendingDeleteId}
        title={t('common.confirm_delete')}
        message={t('retail_customers.confirm_delete_message')}
        confirmLabel={t('common.yes_delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        loading={deleting}
      />
    </div>
  )
}

export default RetailCustomers
