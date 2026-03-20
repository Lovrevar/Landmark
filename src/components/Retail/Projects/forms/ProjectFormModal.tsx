import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { retailProjectService } from '../services/retailProjectService'
import type { RetailLandPlot } from '../../../../types/retail'
import { Button, Modal, FormField, Input, Select, Textarea, ConfirmDialog, Form } from '../../../ui'

interface ProjectFormModalProps {
  onClose: () => void
  onSuccess: () => void
  project?: Record<string, unknown>
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  onClose,
  onSuccess,
  project
}) => {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    land_plot_id: String(project?.land_plot_id || ''),
    name: String(project?.name || ''),
    location: String(project?.location || ''),
    plot_number: String(project?.plot_number || ''),
    total_area_m2: String(project?.total_area_m2 || ''),
    purchase_price: String(project?.purchase_price || ''),
    status: String(project?.status || 'Planning'),
    start_date: String(project?.start_date || ''),
    end_date: String(project?.end_date || ''),
    notes: String(project?.notes || '')
  })
  const [landPlots, setLandPlots] = useState<RetailLandPlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loadingLandPlots, setLoadingLandPlots] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadLandPlots()
  }, [])

  const loadLandPlots = async () => {
    try {
      setLoadingLandPlots(true)
      const plots = await retailProjectService.fetchLandPlots()
      setLandPlots(plots)
    } catch (err) {
      console.error('Error loading land plots:', err)
    } finally {
      setLoadingLandPlots(false)
    }
  }

  const handleLandPlotChange = (landPlotId: string) => {
    if (landPlotId === '') {
      setFormData({
        ...formData,
        land_plot_id: '',
        location: '',
        plot_number: ''
      })
      return
    }

    const selectedPlot = landPlots.find(plot => plot.id === landPlotId)
    if (selectedPlot) {
      setFormData({
        ...formData,
        land_plot_id: landPlotId,
        location: selectedPlot.location || '',
        plot_number: selectedPlot.plot_number
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!formData.name.trim()) errors.name = t('retail_projects.project_form.errors.name')
    if (!formData.location.trim()) errors.location = t('retail_projects.project_form.errors.location')
    if (!formData.plot_number.trim()) errors.plot_number = t('retail_projects.project_form.errors.plot_number')
    if (!formData.total_area_m2) errors.total_area_m2 = t('retail_projects.project_form.errors.area')
    if (!formData.purchase_price) errors.purchase_price = t('retail_projects.project_form.errors.budget')
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setLoading(true)
    setError(null)

    try {
      const dataToSubmit = {
        ...formData,
        land_plot_id: formData.land_plot_id || null,
        total_area_m2: parseFloat(String(formData.total_area_m2)),
        purchase_price: parseFloat(String(formData.purchase_price)),
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        notes: formData.notes || null
      }

      if (project) {
        await retailProjectService.updateProject(project.id as string, { ...dataToSubmit, status: dataToSubmit.status as 'Planning' | 'In Progress' | 'Completed' | 'On Hold' })
      } else {
        const newProject = await retailProjectService.createProject({ ...dataToSubmit, status: dataToSubmit.status as 'Planning' | 'In Progress' | 'Completed' | 'On Hold' })
        await retailProjectService.createDefaultPhases(newProject.id)
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('retail_projects.project_form.save_error'))
      console.error('Error saving project:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!project) return

    setDeleting(true)
    setError(null)

    try {
      await retailProjectService.deleteProject(project.id as string)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('retail_projects.project_form.delete_error'))
      console.error('Error deleting project:', err)
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const selectedPlot = landPlots.find(plot => plot.id === formData.land_plot_id)

  return (
    <Modal show={true} onClose={onClose}>
      <Modal.Header title={project ? t('retail_projects.project_form.edit_title') : t('retail_projects.project_form.new_title')} onClose={onClose} />
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('retail_projects.project_form.name_label')} required className="md:col-span-2" error={fieldErrors.name}>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </FormField>

            <div className="md:col-span-2">
              <FormField label={t('retail_projects.project_form.land_label')}>
                {loadingLandPlots ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                    {t('retail_projects.project_form.loading_land')}
                  </div>
                ) : (
                  <>
                    <Select
                      value={formData.land_plot_id}
                      onChange={(e) => handleLandPlotChange(e.target.value)}
                    >
                      <option value="">{t('retail_projects.project_form.no_land_option')}</option>
                      {landPlots.map(plot => (
                        <option key={plot.id} value={plot.id}>
                          {plot.plot_number} - {plot.owner_first_name} {plot.owner_last_name} ({plot.purchased_area_m2} m²)
                        </option>
                      ))}
                    </Select>
                    {selectedPlot && (
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                        <div className="font-medium text-blue-900 mb-1">{t('retail_projects.project_form.land_info_title')}</div>
                        <div className="text-blue-800 space-y-1">
                          <div>{t('retail_land_plots.detail.owner')}: {selectedPlot.owner_first_name} {selectedPlot.owner_last_name}</div>
                          <div>{t('retail_land_plots.detail.total_area')}: {selectedPlot.total_area_m2} m²</div>
                          <div>{t('retail_land_plots.detail.purchased_area')}: {selectedPlot.purchased_area_m2} m²</div>
                          <div>{t('retail_land_plots.detail.price_per_m2')}: €{selectedPlot.price_per_m2.toFixed(2)}</div>
                          <div>{t('retail_land_plots.detail.total_price')}: €{selectedPlot.total_price.toFixed(2)}</div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </FormField>
            </div>

            <FormField
              label={t('retail_projects.project_form.location_label')}
              required
              helperText={formData.land_plot_id ? t('retail_projects.project_form.location_autofill') : undefined}
              className="md:col-span-2"
              error={fieldErrors.location}
            >
              <Input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                disabled={!!formData.land_plot_id}
              />
            </FormField>

            <FormField
              label={t('retail_projects.project_form.plot_number_label')}
              required
              helperText={formData.land_plot_id ? t('retail_projects.project_form.plot_autofill') : undefined}
              error={fieldErrors.plot_number}
            >
              <Input
                type="text"
                value={formData.plot_number}
                onChange={(e) => setFormData({ ...formData, plot_number: e.target.value })}
                disabled={!!formData.land_plot_id}
              />
            </FormField>

            <FormField label={t('retail_projects.project_form.status_label')}>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="Planning">{t('status.planning')}</option>
                <option value="In Progress">{t('status.in_progress')}</option>
                <option value="Completed">{t('status.completed')}</option>
                <option value="On Hold">{t('status.on_hold')}</option>
              </Select>
            </FormField>

            <FormField label={t('retail_projects.project_form.area_label')} required error={fieldErrors.total_area_m2}>
              <Input
                type="number"
                step="0.01"
                value={formData.total_area_m2}
                onChange={(e) => setFormData({ ...formData, total_area_m2: e.target.value })}
              />
            </FormField>

            <FormField
              label={t('retail_projects.project_form.budget_label')}
              required
              helperText={selectedPlot
                ? `${t('retail_land_plots.detail.total_price')}: €${selectedPlot.total_price.toLocaleString('hr-HR')}`
                : t('common.budget')
              }
              error={fieldErrors.purchase_price}
            >
              <Input
                type="number"
                step="0.01"
                value={formData.purchase_price}
                onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
              />
            </FormField>

            <FormField label={t('retail_projects.project_form.start_date')}>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </FormField>

            <FormField label={t('retail_projects.project_form.end_date')}>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </FormField>

            <FormField label={t('retail_projects.project_form.notes_label')} className="md:col-span-2">
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </FormField>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <div className="flex justify-between items-center w-full">
            <div>
              {project && (
                <Button
                  type="button"
                  variant="outline-danger"
                  icon={Trash2}
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={loading || deleting}
                >
                  {t('retail_projects.project_form.delete_btn')}
                </Button>
              )}
            </div>
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={loading || deleting}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                loading={loading}
                disabled={loading || deleting}
              >
                {project ? t('common.save_changes') : t('retail_projects.project_form.create_btn')}
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </Form>

      <ConfirmDialog
        show={showDeleteConfirm}
        title={t('retail_projects.project_form.delete_confirm_title')}
        message={
          <>
            {t('retail_projects.project_form.delete_confirm_msg', { name: String(project?.name || '') })}
          </>
        }
        confirmLabel={deleting ? t('retail_projects.project_form.deleting') : t('common.yes_delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleting}
      />
    </Modal>
  )
}
