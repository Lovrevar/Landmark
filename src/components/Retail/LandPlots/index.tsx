import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Plus, Edit, Trash2, Eye, Calendar, Link } from 'lucide-react'
import { LoadingSpinner, PageHeader, StatGrid, SearchInput, Button, Modal, FormField, Input, Select, Textarea, Badge, EmptyState, StatCard, Table, Form, ConfirmDialog } from '../../ui'
import { useLandPlots, type LandPlotWithSales } from './hooks/useLandPlots'
import type { LandPlotWithProject, LandPlotPayload } from './services/landPlotService'
import { useToast } from '../../../contexts/ToastContext'

interface FormState {
  owner_first_name: string
  owner_last_name: string
  plot_number: string
  location: string | null
  total_area_m2: string
  purchased_area_m2: string
  price_per_m2: string
  payment_date: string | null
  payment_status: 'paid' | 'pending' | 'partial'
  notes: string | null
}

const emptyForm = (): FormState => ({
  owner_first_name: '',
  owner_last_name: '',
  plot_number: '',
  location: null,
  total_area_m2: '',
  purchased_area_m2: '',
  price_per_m2: '',
  payment_date: null,
  payment_status: 'pending',
  notes: null
})

const RetailLandPlots: React.FC = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const { loading, filteredPlots, totalStats, searchTerm, setSearchTerm, handleSave, handleDelete, confirmDelete, cancelDelete, pendingDeleteId, deleting, loadPlotDetails } = useLandPlots()

  const [showFormModal, setShowFormModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedPlot, setSelectedPlot] = useState<LandPlotWithSales | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormState>(emptyForm())
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const openFormModal = (plot?: LandPlotWithProject) => {
    if (plot) {
      setEditingId(plot.id)
      setFormData({
        owner_first_name: plot.owner_first_name,
        owner_last_name: plot.owner_last_name,
        plot_number: plot.plot_number,
        location: plot.location,
        total_area_m2: plot.total_area_m2.toString(),
        purchased_area_m2: plot.purchased_area_m2.toString(),
        price_per_m2: plot.price_per_m2.toString(),
        payment_date: plot.payment_date,
        payment_status: plot.payment_status,
        notes: plot.notes
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
    if (!formData.owner_first_name.trim()) errors.owner_first_name = t('retail_land_plots.errors.first_name')
    if (!formData.owner_last_name.trim()) errors.owner_last_name = t('retail_land_plots.errors.last_name')
    if (!formData.plot_number.trim()) errors.plot_number = t('retail_land_plots.errors.plot_number')
    if (!formData.total_area_m2) errors.total_area_m2 = t('retail_land_plots.errors.total_area')
    if (!formData.purchased_area_m2) errors.purchased_area_m2 = t('retail_land_plots.errors.purchased_area')
    if (!formData.price_per_m2) errors.price_per_m2 = t('retail_land_plots.errors.price_per_m2')
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    try {
      const payload: LandPlotPayload = {
        owner_first_name: formData.owner_first_name,
        owner_last_name: formData.owner_last_name,
        plot_number: formData.plot_number,
        location: formData.location || null,
        total_area_m2: parseFloat(formData.total_area_m2),
        purchased_area_m2: parseFloat(formData.purchased_area_m2),
        price_per_m2: parseFloat(formData.price_per_m2),
        payment_date: formData.payment_date || null,
        payment_status: formData.payment_status,
        notes: formData.notes || null
      }
      await handleSave(payload, editingId ?? undefined)
      closeFormModal()
    } catch (error) {
      console.error('Error saving land plot:', error)
      toast.error(t('retail_land_plots.error_save'))
    }
  }

  const handleViewDetails = async (plot: LandPlotWithProject) => {
    try {
      const plotWithSales = await loadPlotDetails(plot)
      setSelectedPlot(plotWithSales)
      document.body.style.overflow = 'hidden'
      setShowDetailsModal(true)
    } catch (error) {
      console.error('Error loading plot details:', error)
      toast.error(t('retail_land_plots.error_load_details'))
    }
  }

  const closeDetailsModal = () => {
    document.body.style.overflow = 'unset'
    setShowDetailsModal(false)
    setSelectedPlot(null)
  }

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFormData(prev => ({ ...prev, [key]: e.target.value }))

  if (loading) return <LoadingSpinner message={t('common.loading')} />

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('retail_land_plots.title')}
        description={t('retail_land_plots.description')}
        actions={<Button icon={Plus} onClick={() => openFormModal()}>{t('retail_land_plots.new_plot')}</Button>}
      />

      <StatGrid columns={4}>
        <StatCard label={t('retail_land_plots.stats.total_plots')} value={totalStats.total_plots} icon={MapPin} color="blue" />
        <StatCard label={t('retail_land_plots.stats.total_area')} value={`${totalStats.total_area.toLocaleString()} m²`} icon={MapPin} color="green" />
        <StatCard label={t('retail_land_plots.stats.total_invested')} value={`€${totalStats.total_invested.toLocaleString()}`} icon={Calendar} />
        <StatCard label={t('common.paid')} value={`${totalStats.paid_count}/${totalStats.total_plots}`} icon={Calendar} color="green" />
      </StatGrid>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder={t('retail_land_plots.search_placeholder')}
        />
      </div>

      {filteredPlots.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={searchTerm ? t('common.no_results') : t('retail_land_plots.no_plots')}
          description={searchTerm ? t('retail_land_plots.no_results_hint') : t('retail_land_plots.no_plots_hint')}
        />
      ) : (
        <Table>
          <Table.Head>
            <Table.Tr>
              <Table.Th>{t('retail_land_plots.table.owner')}</Table.Th>
              <Table.Th>{t('retail_land_plots.table.plot')}</Table.Th>
              <Table.Th>{t('retail_land_plots.table.location')}</Table.Th>
              <Table.Th>{t('retail_land_plots.table.area')}</Table.Th>
              <Table.Th>{t('retail_land_plots.table.price_per_m2')}</Table.Th>
              <Table.Th>{t('common.total')}</Table.Th>
              <Table.Th>{t('common.status')}</Table.Th>
              <Table.Th className="text-right">{t('common.actions')}</Table.Th>
            </Table.Tr>
          </Table.Head>
          <Table.Body>
            {filteredPlots.map((plot) => (
              <Table.Tr key={plot.id}>
                <Table.Td className="font-medium text-gray-900 dark:text-white">{plot.owner_first_name} {plot.owner_last_name}</Table.Td>
                <Table.Td>{plot.plot_number}</Table.Td>
                <Table.Td>{plot.location || '-'}</Table.Td>
                <Table.Td>
                  <div>{plot.purchased_area_m2.toLocaleString()} m²</div>
                  {plot.purchased_area_m2 < plot.total_area_m2 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('retail_land_plots.table.of')} {plot.total_area_m2.toLocaleString()} m²</div>
                  )}
                </Table.Td>
                <Table.Td>€{plot.price_per_m2.toLocaleString()}</Table.Td>
                <Table.Td className="font-semibold">€{plot.total_price.toLocaleString()}</Table.Td>
                <Table.Td>
                  <div className="space-y-1">
                    <Badge variant={plot.payment_status === 'paid' ? 'green' : plot.payment_status === 'partial' ? 'yellow' : 'gray'}>
                      {plot.payment_status === 'paid' ? t('common.paid') : plot.payment_status === 'partial' ? t('common.partial') : t('common.pending')}
                    </Badge>
                    {plot.connectedProject && (
                      <Badge variant="green" className="flex items-center">
                        <Link className="w-3 h-3 mr-1" />
                        {t('retail_land_plots.in_project')}
                      </Badge>
                    )}
                  </div>
                </Table.Td>
                <Table.Td className="text-right">
                  <div className="flex items-center justify-end space-x-1">
                    <Button icon={Eye} variant="ghost" size="icon-sm" onClick={() => handleViewDetails(plot)} title={t('common.details')} />
                    <Button icon={Edit} variant="ghost" size="icon-sm" onClick={() => openFormModal(plot)} title={t('common.edit')} />
                    <Button icon={Trash2} variant="outline-danger" size="icon-sm" onClick={() => handleDelete(plot.id)} title={t('common.delete')} />
                  </div>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Body>
        </Table>
      )}

      <Modal show={showFormModal} onClose={closeFormModal}>
        <Modal.Header title={editingId ? t('retail_land_plots.edit_plot') : t('retail_land_plots.new_plot')} onClose={closeFormModal} />
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('retail_land_plots.form.owner_first_name')} required error={fieldErrors.owner_first_name}>
                <Input value={formData.owner_first_name} onChange={set('owner_first_name')} />
              </FormField>
              <FormField label={t('retail_land_plots.form.owner_last_name')} required error={fieldErrors.owner_last_name}>
                <Input value={formData.owner_last_name} onChange={set('owner_last_name')} />
              </FormField>
              <FormField label={t('retail_land_plots.form.plot_number')} required error={fieldErrors.plot_number}>
                <Input value={formData.plot_number} onChange={set('plot_number')} />
              </FormField>
              <FormField label={t('retail_land_plots.form.location')}>
                <Input value={formData.location || ''} onChange={set('location')} placeholder={t('retail_land_plots.form.location_placeholder')} />
              </FormField>
              <FormField label={t('retail_land_plots.form.total_area')} required error={fieldErrors.total_area_m2}>
                <Input type="number" step="0.01" value={formData.total_area_m2} onChange={set('total_area_m2')} />
              </FormField>
              <FormField label={t('retail_land_plots.form.purchased_area')} required error={fieldErrors.purchased_area_m2}>
                <Input type="number" step="0.01" value={formData.purchased_area_m2} onChange={set('purchased_area_m2')} />
              </FormField>
              <FormField label={t('retail_land_plots.form.price_per_m2')} required error={fieldErrors.price_per_m2}>
                <Input type="number" step="0.01" value={formData.price_per_m2} onChange={set('price_per_m2')} />
              </FormField>
              <FormField label={t('retail_land_plots.form.payment_date')}>
                <Input type="date" value={formData.payment_date || ''} onChange={set('payment_date')} />
              </FormField>
              <FormField label={t('retail_land_plots.form.payment_status')}>
                <Select value={formData.payment_status} onChange={set('payment_status')}>
                  <option value="pending">{t('common.pending')}</option>
                  <option value="partial">{t('common.partial')}</option>
                  <option value="paid">{t('common.paid')}</option>
                </Select>
              </FormField>
              <div className="col-span-2">
                <FormField label={t('common.notes')}>
                  <Textarea rows={3} value={formData.notes || ''} onChange={set('notes')} />
                </FormField>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={closeFormModal}>{t('common.cancel')}</Button>
            <Button type="submit">{editingId ? t('common.save') : t('common.add')}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showDetailsModal && !!selectedPlot} onClose={closeDetailsModal} size="xl">
        <Modal.Header title={`${t('retail_land_plots.details_title')} - ${selectedPlot?.plot_number || ''}`} onClose={closeDetailsModal} />
        {selectedPlot && (
          <>
            <Modal.Body>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('retail_land_plots.detail.owner')}</p>
                  <p className="text-lg font-semibold">{selectedPlot.owner_first_name} {selectedPlot.owner_last_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('retail_land_plots.detail.plot_number')}</p>
                  <p className="text-lg font-semibold">{selectedPlot.plot_number}</p>
                </div>
                {selectedPlot.location && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('retail_land_plots.detail.location')}</p>
                    <p className="text-lg font-semibold">{selectedPlot.location}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('retail_land_plots.detail.total_area')}</p>
                  <p className="text-lg font-semibold">{selectedPlot.total_area_m2.toLocaleString()} m²</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('retail_land_plots.detail.purchased_area')}</p>
                  <p className="text-lg font-semibold">{selectedPlot.purchased_area_m2.toLocaleString()} m²</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('retail_land_plots.detail.price_per_m2')}</p>
                  <p className="text-lg font-semibold">€{selectedPlot.price_per_m2.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('retail_land_plots.detail.total_price')}</p>
                  <p className="text-lg font-semibold text-green-600">€{selectedPlot.total_price.toLocaleString()}</p>
                </div>
              </div>

              {selectedPlot.notes && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('common.notes')}</p>
                  <p className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded">{selectedPlot.notes}</p>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold mb-3">{t('retail_land_plots.sales_heading', { count: selectedPlot.sales?.length || 0 })}</h3>
                {selectedPlot.sales && selectedPlot.sales.length > 0 ? (
                  <div className="space-y-2">
                    {selectedPlot.sales.map((sale) => (
                      <div key={sale.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{sale.customer?.name || 'N/A'}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{sale.sale_area_m2} m² x €{sale.sale_price_per_m2} = €{sale.total_sale_price.toLocaleString()}</p>
                          </div>
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
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">{t('retail_land_plots.no_sales')}</p>
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
        message={t('retail_land_plots.confirm_delete_message')}
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

export default RetailLandPlots
