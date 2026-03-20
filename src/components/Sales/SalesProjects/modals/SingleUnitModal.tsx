import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { UnitFormData, UnitType } from '../types'
import { Button, Modal, FormField, Input } from '../../../ui'

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
  selectedBuilding,
  onClose,
  onSubmit,
  loading = false
}) => {
  const { t } = useTranslation()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
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


  const handleSubmit = () => {
    const errors: Record<string, string> = {}
    if (!formData.number.trim()) {
      errors.number = 'Please fill in required fields'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    onSubmit(formData)
  }

  return (
    <Modal show={true} onClose={onClose}>
      <Modal.Header
        title={t('sales_projects.single_unit_modal.title')}
        subtitle={`${t('sales_projects.building')}: ${selectedBuilding.name}`}
        onClose={onClose}
      />
      <Modal.Body>
          <div className="space-y-4">
            <FormField label={t('sales_projects.single_unit_modal.unit_number')} required error={fieldErrors.number}>
              <Input
                type="text"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                placeholder="e.g., 101, A-205"
              />
            </FormField>
            <FormField label={t('sales_projects.single_unit_modal.floor')} required>
              <Input
                type="number"
                min="0"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label={t('sales_projects.single_unit_modal.size')} required>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.size_m2}
                onChange={(e) => setFormData({ ...formData, size_m2: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
            <FormField label={t('sales_projects.single_unit_modal.price_per_m2')} required>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.price_per_m2}
                onChange={(e) => setFormData({ ...formData, price_per_m2: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
            <div className="bg-blue-50 p-3 rounded-lg">
              <label className="block text-sm font-medium text-blue-900 mb-1">{t('sales_projects.single_unit_modal.total_price')}</label>
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
          {t('common.cancel')}
        </Button>
        <Button loading={loading} onClick={handleSubmit}>
          {t('sales_projects.single_unit_modal.add_unit')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
