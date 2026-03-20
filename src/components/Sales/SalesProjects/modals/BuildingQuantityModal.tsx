import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal, FormField, Input } from '../../../ui'

interface BuildingQuantityModalProps {
  visible: boolean
  project: { name: string }
  onClose: () => void
  onSubmit: (quantity: number) => void
  loading?: boolean
}

export const BuildingQuantityModal: React.FC<BuildingQuantityModalProps> = ({
  visible,
  project,
  onClose,
  onSubmit,
  loading = false
}) => {
  const { t } = useTranslation()
  const [quantity, setQuantity] = useState(1)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  if (!visible) return null

  const handleSubmit = () => {
    const errors: Record<string, string> = {}
    if (quantity < 1 || quantity > 20) {
      errors.quantity = 'Please enter a valid quantity (1-20)'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    onSubmit(quantity)
    setQuantity(1)
  }

  return (
    <Modal show={true} onClose={onClose}>
      <Modal.Header
        title={t('sales_projects.building_quantity_modal.title')}
        subtitle={`${t('sales_projects.project')}: ${project.name}`}
        onClose={onClose}
      />
      <Modal.Body>
        <FormField label={t('sales_projects.building_quantity_modal.number_of_buildings')} required error={fieldErrors.quantity}>
          <Input
            type="number"
            min="1"
            max="20"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          />
        </FormField>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => {
          onClose()
          setQuantity(1)
        }}>
          {t('common.cancel')}
        </Button>
        <Button loading={loading} onClick={handleSubmit}>
          {t('sales_projects.building_quantity_modal.create_buildings', { count: quantity })}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
