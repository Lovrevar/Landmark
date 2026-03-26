import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, FormField, Input, Select, Button, Alert, Form, ConfirmDialog } from '../../../ui'
import { useProjectForm } from '../hooks/useProjectForm'

interface ProjectFormModalProps {
  projectId?: string | null
  onClose: () => void
  onSuccess: () => void
}

const ProjectFormModal: React.FC<ProjectFormModalProps> = ({ projectId, onClose, onSuccess }) => {
  const { t } = useTranslation()
  const { form, setForm, loading, error, setError, handleSubmit, handleDelete, confirmDelete, cancelDelete, showDeleteConfirm, deleting } = useProjectForm(
    projectId,
    onSuccess,
    onSuccess
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleLocalSubmit = (e?: React.FormEvent) => {
    const errors: Record<string, string> = {}
    if (!form.name?.trim()) errors.name = t('general_projects.form_error_name')
    if (!form.location?.trim()) errors.location = t('general_projects.form_error_location')
    if (!form.start_date) errors.start_date = t('general_projects.form_error_start_date')
    if (!form.budget) errors.budget = t('general_projects.form_error_budget')
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    if (e) handleSubmit(e)
  }

  return (
    <>
    <Modal show={true} onClose={onClose} size="lg">
      <Modal.Header
        title={projectId ? t('general_projects.edit_project') : t('general_projects.new_project')}
        onClose={onClose}
      />
      <Modal.Body>
        <Form onSubmit={(e) => handleLocalSubmit(e)}>
          {error && (
            <Alert variant="error" className="mb-4" onDismiss={() => setError('')}>
              {error}
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label={t('general_projects.form.name')} required className="md:col-span-2" error={fieldErrors.name}>
              <Input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('general_projects.form_name_placeholder')}
              />
            </FormField>

            <FormField label={t('general_projects.form_location')} required className="md:col-span-2" error={fieldErrors.location}>
              <Input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder={t('general_projects.form_location_placeholder')}
              />
            </FormField>

            <FormField label={t('general_projects.form.start_date')} required error={fieldErrors.start_date}>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </FormField>

            <FormField label={t('general_projects.form_end_date_optional')}>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </FormField>

            <FormField label={t('general_projects.form_budget_eur')} required error={fieldErrors.budget}>
              <Input
                type="number"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </FormField>

            <FormField label={t('general_projects.form.status')}>
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="Planning">{t('status.planning')}</option>
                <option value="In Progress">{t('status.in_progress')}</option>
                <option value="Completed">{t('status.completed')}</option>
                <option value="On Hold">{t('status.on_hold')}</option>
              </Select>
            </FormField>


          </div>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-between items-center w-full">
          {projectId && (
            <Button variant="danger" onClick={handleDelete} disabled={loading}>
              {t('general_projects.delete_project')}
            </Button>
          )}
          <div className={`flex space-x-3 ${!projectId ? 'ml-auto' : ''}`}>
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => handleLocalSubmit()} disabled={loading} loading={loading}>
              {projectId ? t('general_projects.update_project') : t('general_projects.create_project')}
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>

    <ConfirmDialog
      show={showDeleteConfirm}
      title={t('confirm.delete_title')}
      message={t('general_projects.confirm_delete_project')}
      confirmLabel={t('common.yes_delete')}
      cancelLabel={t('common.cancel')}
      variant="danger"
      onConfirm={confirmDelete}
      onCancel={cancelDelete}
      loading={deleting}
    />
    </>
  )
}

export default ProjectFormModal
