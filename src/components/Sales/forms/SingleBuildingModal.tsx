import React, { useState, useEffect } from 'react'
import { BuildingFormData } from '../types/salesTypes'
import { Button, Modal, FormField, Input, Textarea } from '../../ui'

interface SingleBuildingModalProps {
  visible: boolean
  project: { name: string }
  onClose: () => void
  onSubmit: (data: BuildingFormData) => void
  loading?: boolean
}

export const SingleBuildingModal: React.FC<SingleBuildingModalProps> = ({
  visible,
  project,
  onClose,
  onSubmit,
  loading = false
}) => {
  const [formData, setFormData] = useState<BuildingFormData>({
    name: '',
    description: '',
    total_floors: 10
  })

  useEffect(() => {
    if (!visible) {
      setFormData({ name: '', description: '', total_floors: 10 })
    }
  }, [visible])

  if (!visible) return null

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      alert('Please fill in required fields')
      return
    }
    onSubmit(formData)
  }

  return (
    <Modal show={true} onClose={onClose}>
      <Modal.Header
        title="Add New Building"
        subtitle={`Project: ${project.name}`}
        onClose={onClose}
      />
      <Modal.Body>
          <div className="space-y-4">
            <FormField label="Building Name" required>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Building A, Tower 1"
              />
            </FormField>
            <FormField label="Description">
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </FormField>
            <FormField label="Total Floors" required>
              <Input
                type="number"
                min="1"
                value={formData.total_floors}
                onChange={(e) => setFormData({ ...formData, total_floors: parseInt(e.target.value) || 1 })}
              />
            </FormField>
          </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={loading} onClick={handleSubmit}>
          Add Building
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
