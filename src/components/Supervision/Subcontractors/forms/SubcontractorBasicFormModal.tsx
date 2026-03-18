import React, { useState, useEffect } from 'react'
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
    if (!formData.name.trim()) errors.name = 'Naziv je obavezan'
    if (!formData.contact.trim()) errors.contact = 'Kontakt je obavezan'
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
      toast.error('Failed to save subcontractor')
    }
  }

  return (
    <Modal show={visible} onClose={onClose}>
      <Modal.Header
        title={editingId ? 'Edit Subcontractor' : 'Add Subcontractor'}
        onClose={onClose}
      />
      <Modal.Body>
        <div className="space-y-4">
          <FormField label="Name" required error={fieldErrors.name}>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter subcontractor name"
              autoFocus
            />
          </FormField>
          <FormField label="Contact" required error={fieldErrors.contact}>
            <Input
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              placeholder="Phone number or email"
            />
          </FormField>
          <FormField label="Notes">
            <Input
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional notes"
            />
          </FormField>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>
          {editingId ? 'Update' : 'Add'} Subcontractor
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
