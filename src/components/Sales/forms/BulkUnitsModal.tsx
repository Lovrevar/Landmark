import React, { useState, useEffect } from 'react'
import { BulkCreateData, UnitType, BulkPreview } from '../types/salesTypes'
import { Button, Modal, FormField, Input } from '../../ui'

interface BulkUnitsModalProps {
  visible: boolean
  unitType: UnitType
  selectedBuilding: { name: string }
  onClose: () => void
  onSubmit: (data: BulkCreateData) => void
  loading?: boolean
}

export const BulkUnitsModal: React.FC<BulkUnitsModalProps> = ({
  visible,
  unitType,
  selectedBuilding,
  onClose,
  onSubmit,
  loading = false
}) => {
  const [formData, setFormData] = useState<BulkCreateData>({
    floor_start: 1,
    floor_end: 10,
    units_per_floor: 4,
    base_size: 85,
    size_variation: 15,
    base_price_per_m2: 5000,
    floor_increment: 10000,
    number_prefix: ''
  })

  useEffect(() => {
    if (!visible) {
      setFormData({
        floor_start: 1,
        floor_end: 10,
        units_per_floor: 4,
        base_size: 85,
        size_variation: 15,
        base_price_per_m2: 5000,
        floor_increment: 10000,
        number_prefix: ''
      })
    }
  }, [visible])

  if (!visible) return null

  const getUnitLabel = () => {
    if (unitType === 'apartment') return 'Apartments'
    if (unitType === 'garage') return 'Garages'
    return 'Repositories'
  }

  const calculatePreview = (): BulkPreview => {
    const floors = formData.floor_end - formData.floor_start + 1
    const totalUnits = floors * formData.units_per_floor
    const avgSize = formData.base_size
    const avgPrice = (avgSize * formData.base_price_per_m2) +
      ((formData.floor_start + formData.floor_end) / 2 - formData.floor_start) * formData.floor_increment
    const totalValue = totalUnits * avgPrice

    return { totalUnits, avgSize, avgPrice, totalValue }
  }

  const preview = calculatePreview()
  const defaultPrefix = unitType === 'apartment' ? 'A' : unitType === 'garage' ? 'G' : 'R'

  return (
    <Modal show={true} onClose={onClose} size="lg">
      <Modal.Header
        title="Bulk Create Units"
        subtitle={`Building: ${selectedBuilding.name}`}
        onClose={onClose}
      />
      <Modal.Body>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <FormField label="Start Floor">
              <Input
                type="number"
                min="0"
                value={formData.floor_start}
                onChange={(e) => setFormData({ ...formData, floor_start: parseInt(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="End Floor">
              <Input
                type="number"
                min="0"
                value={formData.floor_end}
                onChange={(e) => setFormData({ ...formData, floor_end: parseInt(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Units per Floor">
              <Input
                type="number"
                min="1"
                value={formData.units_per_floor}
                onChange={(e) => setFormData({ ...formData, units_per_floor: parseInt(e.target.value) || 1 })}
              />
            </FormField>
            <FormField
              label="Number Prefix (optional)"
              helperText={`Default: ${defaultPrefix} (e.g., ${defaultPrefix}101, ${defaultPrefix}202)`}
            >
              <Input
                type="text"
                value={formData.number_prefix}
                onChange={(e) => setFormData({ ...formData, number_prefix: e.target.value })}
                placeholder={defaultPrefix}
              />
            </FormField>
            <FormField label="Base Size (m²)">
              <Input
                type="number"
                min="0"
                value={formData.base_size}
                onChange={(e) => setFormData({ ...formData, base_size: parseInt(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Size Variation (±m²)">
              <Input
                type="number"
                min="0"
                value={formData.size_variation}
                onChange={(e) => setFormData({ ...formData, size_variation: parseInt(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label="Base Price per m²">
              <Input
                type="number"
                min="0"
                value={formData.base_price_per_m2}
                onChange={(e) => setFormData({ ...formData, base_price_per_m2: parseInt(e.target.value) || 0 })}
              />
            </FormField>
            <FormField
              label="Floor Premium (€)"
              helperText="Additional price per floor above start floor"
            >
              <Input
                type="number"
                min="0"
                value={formData.floor_increment}
                onChange={(e) => setFormData({ ...formData, floor_increment: parseInt(e.target.value) || 0 })}
              />
            </FormField>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h4 className="font-semibold text-blue-900 mb-2">Preview</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700">Total {getUnitLabel()}:</span>
                <span className="font-medium text-blue-900 ml-2">{preview.totalUnits}</span>
              </div>
              <div>
                <span className="text-blue-700">Avg. Size:</span>
                <span className="font-medium text-blue-900 ml-2">{preview.avgSize} m²</span>
              </div>
              <div>
                <span className="text-blue-700">Avg. Price:</span>
                <span className="font-medium text-blue-900 ml-2">
                  €{Math.round(preview.avgPrice).toLocaleString('hr-HR')}
                </span>
              </div>
              <div>
                <span className="text-blue-700">Total Value:</span>
                <span className="font-medium text-blue-900 ml-2">
                  €{Math.round(preview.totalValue).toLocaleString('hr-HR')}
                </span>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-3">
              Units will be numbered: {formData.number_prefix || defaultPrefix}
              {formData.floor_start}01, {formData.number_prefix || defaultPrefix}
              {formData.floor_start}02, etc.
            </p>
          </div>

      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={loading} onClick={() => onSubmit(formData)}>
          Create {preview.totalUnits} Units
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
