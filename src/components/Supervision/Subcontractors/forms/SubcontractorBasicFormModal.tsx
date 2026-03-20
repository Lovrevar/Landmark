import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, FormField, Input, Button } from '../../../ui'
import { insertSubcontractorRecord, updateSubcontractorRecord } from '../../SiteManagement/services/siteService'
import { useToast } from '../../../../contexts/ToastContext'

interface Props {
  visible: boolean
  onClose: () => void
  editingId: string | null
  initialData: { name: string; contact: string; notes: string }
  onSaved: () => void
}

export const SubcontractorBasicFormModal: React.FC<Props> = ({
  visible,
  onClose,
  editingId,
  initialData,
  onSaved
}) => {
  const { t } = useTranslation()
  const toast = useToast()
  const [formData, setFormData] = useState(initialData)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (visible) {
      setFormData(initialData)
      setFieldErrors({})
    }
  }, [visible, initialData])

  const handleSave = async () => {
    const errors: Record<string, string> = {}
    if (!formData.name.trim()) errors.name = t('supervision.subcontractors.form.errors.name_required')
    if (!formData.contact.trim()) errors.contact = t('supervision.subcontractors.form.errors.contact_required')
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})

    try {
      const payload = {
        name: formData.name.trim(),
        contact: formData.contact.trim(),
        notes: formData.notes.trim() || null
      }

      if (editingId) {
        await updateSubcontractorRecord(editingId, payload)
      } else {
        await insertSubcontractorRecord(payload)
      }

      onClose()
      onSaved()
    } catch (error) {
      console.error('Error saving subcontractor:', error)
      toast.error(t('supervision.subcontractors.save_error'))
    }
  }

  return (
    <Modal show={visible} onClose={onClose}>
      <Modal.Header
        title={editingId ? t('supervision.subcontractors.edit') : t('supervision.subcontractors.add')}
        onClose={onClose}
      />
      <Modal.Body>
        <div className="space-y-4">
          <FormField label={t('supervision.subcontractors.form.name')} required error={fieldErrors.name}>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('supervision.subcontractors.form.name_placeholder')}
              autoFocus
            />
          </FormField>
          <FormField label={t('supervision.subcontractors.form.contact')} required error={fieldErrors.contact}>
            <Input
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              placeholder={t('supervision.subcontractors.form.contact_placeholder')}
            />
          </FormField>
          <FormField label={t('supervision.subcontractors.form.notes')}>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder={t('supervision.subcontractors.form.notes_placeholder')}
            />
          </FormField>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={handleSave}>
          {editingId ? t('supervision.subcontractors.form.update_btn') : t('supervision.subcontractors.form.add_btn')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
