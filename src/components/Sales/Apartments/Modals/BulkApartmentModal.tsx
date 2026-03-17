import React, { useState, useEffect } from 'react'
import { BulkApartmentData } from '../types'
import { Modal, FormField, Select, Input, Button, Alert, Form } from '../../../ui'

interface BulkApartmentModalProps {
  visible: boolean
  onClose: () => void
  projects: Array<{ id: string; name: string }>
  buildings: Array<{ id: string; name: string; project_id: string }>
  onSubmit: (data: BulkApartmentData) => void
}

export const BulkApartmentModal: React.FC<BulkApartmentModalProps> = ({
  visible,
  onClose,
  projects,
  buildings,
  onSubmit
}) => {
  const [formData, setFormData] = useState<BulkApartmentData>({
    project_id: '',
    building_id: '',
    start_number: 101,
    quantity: 10,
    floor: 1,
    size_m2: 80,
    price: 150000
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const filteredBuildings = buildings.filter(b => b.project_id === formData.project_id)

  useEffect(() => {
    if (formData.project_id && filteredBuildings.length > 0) {
      setFormData(prev => ({ ...prev, building_id: filteredBuildings[0].id }))
    }
  }, [formData.project_id])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!formData.project_id) errors.project_id = 'Project is required'
    if (!formData.building_id) errors.building_id = 'Building is required'
    if (!formData.start_number) errors.start_number = 'Starting number is required'
    if (!formData.quantity) errors.quantity = 'Quantity is required'
    if (!formData.floor && formData.floor !== 0) errors.floor = 'Floor is required'
    if (!formData.size_m2) errors.size_m2 = 'Size is required'
    if (!formData.price) errors.price = 'Price is required'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    onSubmit(formData)
  }

  if (!visible) return null

  return (
    <Modal show={visible} onClose={onClose} size="lg">
      <Modal.Header title="Bulk Create Apartments" onClose={onClose} />

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Project" required error={fieldErrors.project_id}>
                <Select
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value, building_id: '' })}
                >
                  <option value="">Select Project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Building" required error={fieldErrors.building_id}>
                <Select
                  value={formData.building_id}
                  onChange={(e) => setFormData({ ...formData, building_id: e.target.value })}
                  disabled={!formData.project_id}
                >
                  <option value="">Select Building</option>
                  {filteredBuildings.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Starting Number" required error={fieldErrors.start_number}>
                <Input
                  type="number"
                  value={formData.start_number}
                  onChange={(e) => setFormData({ ...formData, start_number: parseInt(e.target.value) })}
                  min="1"
                />
              </FormField>

              <FormField label="Quantity" required error={fieldErrors.quantity}>
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                  min="1"
                  max="50"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField label="Floor" required error={fieldErrors.floor}>
                <Input
                  type="number"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) })}
                />
              </FormField>

              <FormField label="Size (m2)" required error={fieldErrors.size_m2}>
                <Input
                  type="number"
                  value={formData.size_m2}
                  onChange={(e) => setFormData({ ...formData, size_m2: parseFloat(e.target.value) })}
                  step="0.1"
                />
              </FormField>

              <FormField label="Price (EUR)" required error={fieldErrors.price}>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                  step="0.01"
                />
              </FormField>
            </div>

            <Alert variant="info">
              This will create <strong>{formData.quantity}</strong> apartments starting from{' '}
              <strong>A{formData.start_number}</strong> to{' '}
              <strong>A{formData.start_number + formData.quantity - 1}</strong>
            </Alert>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="success">Create Apartments</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
