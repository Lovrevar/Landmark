import React, { useState, useEffect } from 'react'
import { UnitFormData, UnitType } from '../types/salesTypes'
import { Button, Modal, FormField, Input } from '../../ui'

interface SingleUnitModalProps {
  visible: boolean
  buildingId: string
  unitType: UnitType
  selectedBuilding: { name: string }
  onClose: () => void
  onSubmit: (data: UnitFormData) => void
  loading?: boolean
}

export const SingleUnitModal: React.FC<SingleUnitModalProps> = ({
  visible,
  buildingId,
  unitType,
  selectedBuilding,
  onClose,
  onSubmit,
  loading = false
}) => {
  const [formData, setFormData] = useState<UnitFormData>({
    building_id: buildingId,
    number: '',
    floor: 1,
    size_m2: 0,
    price_per_m2: 0
  })

  useEffect(() => {
    if (visible) {
      setFormData({
        building_id: buildingId,
        number: '',
        floor: 1,
        size_m2: 0,
        price_per_m2: 0
      })
    }
  }, [visible, buildingId])

  if (!visible) return null

  const getUnitLabel = () => {
    if (unitType === 'apartment') return 'Apartment'
    if (unitType === 'garage') return 'Garage'
    return 'Repository'
  }

  const handleSubmit = () => {
    if (!formData.number.trim()) {
      alert('Please fill in required fields')
      return
    }
    onSubmit(formData)
  }

  return (
    <Modal show={true} onClose={onClose}>
      <Modal.Header
        title="Add Single Unit"
        subtitle={`Building: ${selectedBuilding.name}`}
        onClose={onClose}
      />
      <Modal.Body>
          <div className="space-y-4">
            <FormField label="Unit Number" required>
              <Input
                type="text"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                placeholder="e.g., 101, A-205"
              />
            </FormField>
            <FormField label="Floor" required>
              <Input
                type="number"
                min="0"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Size (m²)" required>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.size_m2}
                onChange={(e) => setFormData({ ...formData, size_m2: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Price per m² (€/m²)" required>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.price_per_m2}
                onChange={(e) => setFormData({ ...formData, price_per_m2: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
            <div className="bg-blue-50 p-3 rounded-lg">
              <label className="block text-sm font-medium text-blue-900 mb-1">Total Price</label>
              <div className="text-2xl font-bold text-blue-700">
                €{(formData.size_m2 * formData.price_per_m2).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-blue-600 mt-1">
                {formData.size_m2} m² × €{formData.price_per_m2.toLocaleString('en-US', { minimumFractionDigits: 2 })} per m²
              </p>
            </div>
          </div>

      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={loading} onClick={handleSubmit}>
          Add Unit
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
