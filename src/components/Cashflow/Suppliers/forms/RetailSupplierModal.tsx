import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Button, Input, Select, FormField, Alert, Form } from '../../../ui'
import {
  fetchRetailSupplierTypes,
  fetchRetailProjectsForSupplier,
  fetchRetailPhasesForProject,
  createRetailSupplierWithContract
} from '../services/supplierService'

interface RetailProject {
  id: string
  name: string
}

interface RetailPhase {
  id: string
  phase_name: string
  phase_type: string
}

interface SupplierType {
  id: string
  name: string
}

interface RetailSupplierModalProps {
  onClose: () => void
  onSuccess: () => void
}

const RetailSupplierModal: React.FC<RetailSupplierModalProps> = ({ onClose, onSuccess }) => {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    name: '',
    supplier_type_id: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    project_id: '',
    phase_id: ''
  })
  const [projects, setProjects] = useState<RetailProject[]>([])
  const [phases, setPhases] = useState<RetailPhase[]>([])
  const [supplierTypes, setSupplierTypes] = useState<SupplierType[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    loadRetailProjects()
    loadSupplierTypes()
    return () => { document.body.style.overflow = 'unset' }
  }, [])

  useEffect(() => {
    if (formData.project_id) {
      loadRetailPhases(formData.project_id)
    } else {
      setPhases([])
    }
  }, [formData.project_id])

  const loadSupplierTypes = async () => {
    try {
      const types = await fetchRetailSupplierTypes()
      setSupplierTypes(types)
      if (types.length > 0) {
        const otherType = types.find(t => t.name === 'Other')
        setFormData(prev => ({ ...prev, supplier_type_id: otherType?.id || types[0].id }))
      }
    } catch (err) {
      console.error('Error loading supplier types:', err)
    }
  }

  const loadRetailProjects = async () => {
    try {
      setLoadingProjects(true)
      setProjects(await fetchRetailProjectsForSupplier())
    } catch (err) {
      console.error('Error loading retail projects:', err)
    } finally {
      setLoadingProjects(false)
    }
  }

  const loadRetailPhases = async (projectId: string) => {
    try {
      setPhases(await fetchRetailPhasesForProject(projectId))
    } catch (err) {
      console.error('Error loading retail phases:', err)
      setPhases([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const errors: Record<string, string> = {}
    if (!formData.name.trim()) errors.name = t('suppliers.form.name_required')
    if (formData.project_id && !formData.phase_id) errors.phase_id = t('suppliers.form.phase_required_for_project')
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    try {
      setSubmitting(true)

      await createRetailSupplierWithContract(
        {
          name: formData.name,
          supplier_type_id: formData.supplier_type_id,
          contact_person: formData.contact_person || null,
          contact_phone: formData.contact_phone || null,
          contact_email: formData.contact_email || null
        },
        formData.project_id && formData.phase_id ? { phase_id: formData.phase_id } : undefined
      )

      onSuccess()
    } catch (err: unknown) {
      console.error('Error saving retail supplier:', err)
      if ((err as { code?: string })?.code === '23505') {
        setError(t('suppliers.form.duplicate_error'))
      } else {
        setError((err as { message?: string })?.message || t('suppliers.form.save_error'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal show={true} onClose={onClose} size="sm">
      <Modal.Header title={t('suppliers.add_retail')} onClose={onClose} />

      <Form onSubmit={handleSubmit} className="overflow-y-auto flex-1 flex flex-col">
        <Modal.Body>
          {error && (
            <Alert variant="error">{error}</Alert>
          )}

          <FormField label={t('suppliers.form.name')} required error={fieldErrors.name}>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="npr. Geodetski ured d.o.o."
            />
          </FormField>

          <FormField label={t('suppliers.form.type')} required>
            <Select
              value={formData.supplier_type_id}
              onChange={(e) => setFormData({ ...formData, supplier_type_id: e.target.value })}
            >
              {supplierTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </Select>
          </FormField>

          <FormField label={t('suppliers.form.contact_person_label')}>
            <Input
              type="text"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              placeholder={t('suppliers.form.contact_person_placeholder')}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('suppliers.form.phone')}>
              <Input
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="+385 99 ..."
              />
            </FormField>
            <FormField label={t('suppliers.form.email')}>
              <Input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="info@example.com"
              />
            </FormField>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('suppliers.form.link_retail_project_optional')}</h3>

            <div className="space-y-4">
              <FormField label={t('suppliers.form.retail_project_label')}>
                <Select
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value, phase_id: '' })}
                  disabled={loadingProjects}
                >
                  <option value="">{t('suppliers.form.select_retail_project')}</option>
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
                        {phase.phase_name} ({phase.phase_type})
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
            </div>
          </div>

          <Alert variant="info">
            <p>
              <strong>{t('suppliers.form.note_title')}:</strong> {t('suppliers.form.retail_note_created')}
              {formData.project_id && formData.phase_id ? (
                <span className="block mt-2">
                  {t('suppliers.form.retail_note_linked')}
                </span>
              ) : (
                <span className="block mt-2">
                  {t('suppliers.form.retail_note_link_later')}
                </span>
              )}
            </p>
          </Alert>
        </Modal.Body>

        <Modal.Footer sticky>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
          >
            {submitting ? t('suppliers.form.saving_label') : t('suppliers.form.add_retail_label')}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}

export default RetailSupplierModal
