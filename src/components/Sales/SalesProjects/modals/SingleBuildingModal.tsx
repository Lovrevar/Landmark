import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BuildingFormData } from '../types'
import { Button, Modal, FormField, Input, Textarea } from '../../../ui'

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
  const { t } = useTranslation()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
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
    const errors: Record<string, string> = {}
    if (!formData.name.trim()) {
      errors.name = 'Please fill in required fields'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    onSubmit(formData)
  }

  return (
    <Modal show={true} onClose={onClose}>
      <Modal.Header
        title={t('sales_projects.single_building_modal.title')}
        subtitle={`${t('sales_projects.project')}: ${project.name}`}
        onClose={onClose}
      />
      <Modal.Body>
          <div className="space-y-4">
            <FormField label={t('sales_projects.single_building_modal.building_name')} required error={fieldErrors.name}>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Building A, Tower 1"
              />
            </FormField>
            <FormField label={t('sales_projects.single_building_modal.description')}>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </FormField>
            <FormField label={t('sales_projects.single_building_modal.total_floors')} required>
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
          {t('common.cancel')}
        </Button>
        <Button loading={loading} onClick={handleSubmit}>
          {t('sales_projects.single_building_modal.add_building')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
