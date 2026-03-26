import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Button, Input, Select, FormField, Alert, Form } from '../../../ui'
import { SupplierFormData, Project, Phase } from '../types'

interface SupplierFormModalProps {
  showModal: boolean
  editingSupplier: string | null
  formData: SupplierFormData
  setFormData: React.Dispatch<React.SetStateAction<SupplierFormData>>
  projects: Project[]
  phases: Phase[]
  loadingProjects: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  showModal,
  editingSupplier,
  formData,
  setFormData,
  projects,
  phases,
  loadingProjects,
  onClose,
  onSubmit
}) => {
  const { t } = useTranslation()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    const errors: Record<string, string> = {}
    if (!formData.name.trim()) errors.name = t('suppliers.form.name_required')
    if (!formData.contact.trim()) errors.contact = t('suppliers.form.contact_required')
    if (formData.project_id && !formData.phase_id) errors.phase_id = t('suppliers.form.phase_required')
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) { e.preventDefault(); return }
    onSubmit(e)
  }

  return (
    <Modal show={showModal} onClose={onClose} size="sm">
      <Modal.Header
        title={editingSupplier ? t('suppliers.edit') : t('suppliers.add_new')}
        onClose={onClose}
      />

      <Form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
        <Modal.Body>
          <FormField label={t('suppliers.form.name')} required error={fieldErrors.name}>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="npr. Elektro servis d.o.o."
            />
          </FormField>

          <FormField label={t('suppliers.form.contact_label')} required error={fieldErrors.contact}>
            <Input
              type="text"
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              placeholder="info@example.com ili +385 99 123 4567"
            />
          </FormField>

          {!editingSupplier && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('suppliers.form.link_project_optional')}</h3>

              <div className="space-y-4">
                <FormField label={t('suppliers.form.projects_label')}>
                  <Select
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value, phase_id: '' })}
                    disabled={loadingProjects}
                  >
                    <option value="">{t('suppliers.form.select_project')}</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </Select>
                </FormField>

                {formData.project_id && (
                  <FormField label={t('suppliers.form.phase_label')} required error={fieldErrors.phase_id}>
                    <Select
                      value={formData.phase_id}
                      onChange={(e) => setFormData({ ...formData, phase_id: e.target.value })}
                    >
                      <option value="">{t('suppliers.form.select_phase')}</option>
                      {phases.map((phase) => (
                        <option key={phase.id} value={phase.id}>
                          {phase.phase_name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                )}
              </div>
            </div>
          )}

          <Alert variant="info" title={t('suppliers.form.note_title')}>
            {t('suppliers.form.note_invoices')}
            {!editingSupplier && formData.project_id && formData.phase_id ? (
              <span className="block mt-2">
                {t('suppliers.form.note_linked')}
              </span>
            ) : !editingSupplier ? (
              <span className="block mt-2">
                {t('suppliers.form.note_use_site')}
              </span>
            ) : null}
          </Alert>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" type="button" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit">
            {editingSupplier ? t('common.save_changes') : t('suppliers.add')}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}

export default SupplierFormModal
