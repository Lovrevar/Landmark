import React, { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { Modal, FormField, Input, Button } from '../../../ui'

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
  const [formData, setFormData] = useState(initialData)

  useEffect(() => {
    if (visible) {
      setFormData(initialData)
    }
  }, [visible, initialData])

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.contact.trim()) {
      alert('Please fill in name and contact')
      return
    }

    try {
      const payload = {
        name: formData.name.trim(),
        contact: formData.contact.trim(),
        notes: formData.notes.trim() || null
      }

      if (editingId) {
        const { error } = await supabase.from('subcontractors').update(payload).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('subcontractors').insert(payload)
        if (error) throw error
      }

      onClose()
      onSaved()
    } catch (error) {
      console.error('Error saving subcontractor:', error)
      alert('Failed to save subcontractor')
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
          <FormField label="Name" required>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter subcontractor name"
              autoFocus
            />
          </FormField>
          <FormField label="Contact" required>
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
