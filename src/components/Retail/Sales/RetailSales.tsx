import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShoppingCart, Plus, Edit, Trash2, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { LoadingSpinner, PageHeader, StatGrid, SearchInput, Button, Modal, FormField, Input, Select, Textarea, Badge, EmptyState, StatCard, Table, Form, ConfirmDialog } from '../../ui'
import { useRetailSalesManager } from './hooks/useRetailSalesManager'
import type { SaleWithRelations, RetailSalePayload } from './services/retailSalesService'
import { useToast } from '../../../contexts/ToastContext'

const emptyForm = () => ({
  land_plot_id: '',
  customer_id: '',
  sale_area_m2: '',
  sale_price_per_m2: '',
  payment_deadline: '',
  contract_number: '',
  notes: ''
})

type FormState = ReturnType<typeof emptyForm>

const RetailSales: React.FC = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const {
    loading, landPlots, customers, filteredSales, totalStats,
    searchTerm, setSearchTerm, statusFilter, setStatusFilter,
    handleSave, handleDelete, confirmDelete, cancelDelete, pendingDeleteId, deleting, handleAddPayment
  } = useRetailSalesManager()

  const [showFormModal, setShowFormModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedSale, setSelectedSale] = useState<SaleWithRelations | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormState>(emptyForm())
  const [paymentAmount, setPaymentAmount] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [paymentFieldErrors, setPaymentFieldErrors] = useState<Record<string, string>>({})

  const openFormModal = (sale?: SaleWithRelations) => {
    if (sale) {
      setEditingId(sale.id)
      setFormData({
        land_plot_id: sale.land_plot_id,
        customer_id: sale.customer_id,
        sale_area_m2: sale.sale_area_m2.toString(),
        sale_price_per_m2: sale.sale_price_per_m2.toString(),
        payment_deadline: sale.payment_deadline,
        contract_number: sale.contract_number || '',
        notes: sale.notes || ''
      })
    } else {
      setEditingId(null)
      setFormData(emptyForm())
    }
    document.body.style.overflow = 'hidden'
    setShowFormModal(true)
  }

  const closeFormModal = () => {
    document.body.style.overflow = 'unset'
    setShowFormModal(false)
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!formData.land_plot_id) errors.land_plot_id = t('retail_sales.errors.select_plot')
    if (!formData.customer_id) errors.customer_id = t('retail_sales.errors.select_customer')
    if (!formData.sale_area_m2) errors.sale_area_m2 = t('retail_sales.errors.enter_area')
    if (!formData.sale_price_per_m2) errors.sale_price_per_m2 = t('retail_sales.errors.enter_price')
    if (!formData.payment_deadline) errors.payment_deadline = t('retail_sales.errors.enter_deadline')
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    try {
      const payload: RetailSalePayload = {
        land_plot_id: formData.land_plot_id,
        customer_id: formData.customer_id,
        sale_area_m2: parseFloat(formData.sale_area_m2),
        sale_price_per_m2: parseFloat(formData.sale_price_per_m2),
        payment_deadline: formData.payment_deadline,
        contract_number: formData.contract_number || null,
        notes: formData.notes || null
      }
      await handleSave(payload, editingId ?? undefined)
      closeFormModal()
    } catch (error) {
      console.error('Error saving sale:', error)
      toast.error(t('retail_sales.errors.save_error'))
    }
  }

  const openPaymentModal = (sale: SaleWithRelations) => {
    setSelectedSale(sale)
    setPaymentAmount('')
    document.body.style.overflow = 'hidden'
    setShowPaymentModal(true)
  }

  const closePaymentModal = () => {
    document.body.style.overflow = 'unset'
    setShowPaymentModal(false)
    setSelectedSale(null)
    setPaymentAmount('')
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSale) return
    const pErrors: Record<string, string> = {}
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) pErrors.paymentAmount = t('retail_sales.errors.enter_payment_amount')
    setPaymentFieldErrors(pErrors)
    if (Object.keys(pErrors).length > 0) return
    try {
      await handleAddPayment(selectedSale, parseFloat(paymentAmount))
      closePaymentModal()
    } catch (error) {
      console.error('Error adding payment:', error)
      toast.error(t('retail_sales.errors.payment_error'))
    }
  }

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormData(prev => ({ ...prev, [key]: e.target.value }))

  if (loading) return <LoadingSpinner message={t('common.loading')} />

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('retail_sales.title')}
        description={t('retail_sales.description')}
        actions={<Button icon={Plus} onClick={() => openFormModal()}>{t('retail_sales.new_sale')}</Button>}
      />

      <StatGrid columns={4}>
        <StatCard label={t('retail_sales.stats.total_sales')} value={totalStats.total_sales} icon={ShoppingCart} color="blue" />
        <StatCard label={t('retail_sales.stats.total_revenue')} value={'€' + totalStats.total_revenue.toLocaleString('hr-HR')} icon={DollarSign} color="green" />
        <StatCard label={t('common.paid')} value={'€' + totalStats.total_paid.toLocaleString('hr-HR')} icon={DollarSign} color="green" />
        <StatCard label={t('retail_sales.stats.to_collect')} value={'€' + totalStats.total_remaining.toLocaleString('hr-HR')} icon={DollarSign} />
      </StatGrid>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row gap-4">
          <SearchInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm('')}
            placeholder={t('retail_sales.search_placeholder')}
            className="flex-1"
          />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">{t('retail_sales.filter.all_statuses')}</option>
            <option value="pending">{t('common.pending')}</option>
            <option value="partial">{t('common.partial')}</option>
            <option value="paid">{t('common.paid')}</option>
            <option value="overdue">{t('status.overdue')}</option>
          </Select>
        </div>
      </div>

      {filteredSales.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={searchTerm || statusFilter !== 'all' ? t('common.no_results') : t('retail_sales.no_sales')}
          description={searchTerm || statusFilter !== 'all' ? t('retail_sales.no_results_hint') : t('retail_sales.no_sales_hint')}
        />
      ) : (
        <Table>
          <Table.Head>
            <Table.Tr>
              <Table.Th>{t('common.customer')}</Table.Th>
              <Table.Th>{t('common.parcel')}</Table.Th>
              <Table.Th>{t('retail_sales.table.area')}</Table.Th>
              <Table.Th>{t('common.total')}</Table.Th>
              <Table.Th>{t('common.paid')}</Table.Th>
              <Table.Th>{t('retail_sales.table.deadline')}</Table.Th>
              <Table.Th>{t('common.status')}</Table.Th>
              <Table.Th className="text-right">{t('common.actions')}</Table.Th>
            </Table.Tr>
          </Table.Head>
          <Table.Body>
            {filteredSales.map((sale) => (
              <Table.Tr key={sale.id}>
                <Table.Td><div className="text-sm font-medium text-gray-900 dark:text-white">{sale.customer?.name || 'N/A'}</div></Table.Td>
                <Table.Td><div className="text-sm text-gray-900 dark:text-white">{sale.land_plot?.plot_number || 'N/A'}</div></Table.Td>
                <Table.Td>
                  <div className="text-sm text-gray-900 dark:text-white">{sale.sale_area_m2.toLocaleString()} m²</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">€{sale.sale_price_per_m2}/m²</div>
                </Table.Td>
                <Table.Td><div className="text-sm font-semibold text-gray-900 dark:text-white">€{sale.total_sale_price.toLocaleString('hr-HR')}</div></Table.Td>
                <Table.Td>
                  <div className="text-sm text-green-600">€{sale.paid_amount.toLocaleString()}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{t('common.remaining')}: €{sale.remaining_amount.toLocaleString('hr-HR')}</div>
                </Table.Td>
                <Table.Td><div className="text-sm text-gray-900 dark:text-white">{format(new Date(sale.payment_deadline), 'dd.MM.yyyy')}</div></Table.Td>
                <Table.Td>
                  <Badge variant={
                    sale.payment_status === 'paid' ? 'green'
                      : sale.payment_status === 'partial' ? 'yellow'
                      : sale.payment_status === 'overdue' ? 'red'
                      : 'gray'
                  }>
                    {sale.payment_status === 'paid' ? t('common.paid') :
                     sale.payment_status === 'partial' ? t('common.partial') :
                     sale.payment_status === 'overdue' ? t('status.overdue') : t('common.pending')}
                  </Badge>
                </Table.Td>
                <Table.Td className="text-right">
                  <div className="flex items-center justify-end space-x-2">
                    {sale.payment_status !== 'paid' && (
                      <Button icon={DollarSign} variant="ghost" size="icon-sm" onClick={() => openPaymentModal(sale)} title={t('retail_sales.add_payment')} />
                    )}
                    <Button icon={Edit} variant="ghost" size="icon-sm" onClick={() => openFormModal(sale)} title={t('common.edit')} />
                    <Button icon={Trash2} variant="outline-danger" size="icon-sm" onClick={() => handleDelete(sale.id)} title={t('common.delete')} />
                  </div>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Body>
        </Table>
      )}

      <Modal show={showFormModal} onClose={closeFormModal}>
        <Modal.Header title={editingId ? t('retail_sales.edit_sale') : t('retail_sales.new_sale')} onClose={closeFormModal} />
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <FormField label={t('common.parcel')} required error={fieldErrors.land_plot_id}>
              <Select value={formData.land_plot_id} onChange={set('land_plot_id')}>
                <option value="">{t('retail_sales.form.select_plot')}</option>
                {landPlots.map((plot) => (
                  <option key={plot.id} value={plot.id}>{plot.plot_number} - {plot.owner_first_name} {plot.owner_last_name}</option>
                ))}
              </Select>
            </FormField>

            <FormField label={t('common.customer')} required error={fieldErrors.customer_id}>
              <Select value={formData.customer_id} onChange={set('customer_id')}>
                <option value="">{t('retail_sales.form.select_customer')}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </Select>
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('retail_sales.form.area')} required error={fieldErrors.sale_area_m2}>
                <Input type="number" step="0.01" value={formData.sale_area_m2} onChange={set('sale_area_m2')} />
              </FormField>
              <FormField label={t('retail_sales.form.price_per_m2')} required error={fieldErrors.sale_price_per_m2}>
                <Input type="number" step="0.01" value={formData.sale_price_per_m2} onChange={set('sale_price_per_m2')} />
              </FormField>
            </div>

            <FormField label={t('retail_sales.form.payment_deadline')} required error={fieldErrors.payment_deadline}>
              <Input type="date" value={formData.payment_deadline} onChange={set('payment_deadline')} />
            </FormField>

            <FormField label={t('retail_sales.form.contract_number')}>
              <Input type="text" value={formData.contract_number} onChange={set('contract_number')} />
            </FormField>

            <FormField label={t('common.notes')}>
              <Textarea rows={3} value={formData.notes} onChange={set('notes')} />
            </FormField>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={closeFormModal}>{t('common.cancel')}</Button>
            <Button type="submit">{editingId ? t('common.save') : t('common.add')}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showPaymentModal && !!selectedSale} onClose={closePaymentModal} size="sm">
        <Modal.Header title={t('retail_sales.add_payment')} onClose={closePaymentModal} />
        <Form onSubmit={handlePaymentSubmit}>
          <Modal.Body>
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('common.customer')}</p>
              <p className="text-lg font-semibold">{selectedSale?.customer?.name}</p>
            </div>
            <div className="mb-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">{t('common.total')}:</span>
                <span className="font-semibold">€{selectedSale?.total_sale_price.toLocaleString('hr-HR')}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">{t('common.paid')}:</span>
                <span className="font-semibold text-green-600">€{selectedSale?.paid_amount.toLocaleString('hr-HR')}</span>
              </div>
              <div className="flex justify-between border-t dark:border-gray-600 pt-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">{t('common.remaining')}:</span>
                <span className="font-bold text-orange-600">€{selectedSale?.remaining_amount.toLocaleString('hr-HR')}</span>
              </div>
            </div>
            <FormField label={t('retail_sales.form.payment_amount')} required error={paymentFieldErrors.paymentAmount}>
              <Input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                max={selectedSale?.remaining_amount}
              />
            </FormField>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={closePaymentModal}>{t('common.cancel')}</Button>
            <Button variant="success" type="submit">{t('retail_sales.add_payment')}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ConfirmDialog
        show={!!pendingDeleteId}
        title={t('common.confirm_delete')}
        message={t('retail_sales.confirm_delete_message')}
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

export default RetailSales
