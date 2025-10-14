import React, { useEffect } from 'react'
import { Modal } from '../common/Modal'
import { FormInput } from '../common/FormInput'
import { Button } from '../common/Button'
import { useFormState } from '../../hooks/useFormState'
import { Apartment } from '../../lib/supabase'

interface ApartmentFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: any) => Promise<void>
  editingApartment?: Apartment | null
}

export const ApartmentFormModal: React.FC<ApartmentFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingApartment
}) => {
  const { formData, updateField, resetForm, setForm } = useFormState({
    number: '',
    floor: 1,
    size_m2: 0,
    price_per_sqm: 0,
    price: 0
  })

  useEffect(() => {
    if (editingApartment) {
      setForm({
        number: editingApartment.number,
        floor: editingApartment.floor,
        size_m2: editingApartment.size_m2,
        price_per_sqm: 0,
        price: editingApartment.price
      })
    } else {
      resetForm()
    }
  }, [editingApartment, isOpen])

  const handleSizeChange = (size: number) => {
    const calculatedPrice = size * formData.price_per_sqm
    updateField('size_m2', size)
    updateField('price', calculatedPrice)
  }

  const handlePricePerSqmChange = (pricePerSqm: number) => {
    const calculatedPrice = formData.size_m2 * pricePerSqm
    updateField('price_per_sqm', pricePerSqm)
    updateField('price', calculatedPrice)
  }

  const handleSubmit = async () => {
    if (!formData.number.trim()) {
      alert('Please fill in unit number')
      return
    }
    await onSubmit(formData)
    resetForm()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingApartment ? 'Edit Apartment' : 'Add New Apartment'}
      footer={
        <div className="flex justify-end space-x-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit}>
            {editingApartment ? 'Update' : 'Add'} Apartment
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormInput
          label="Unit Number"
          type="text"
          value={formData.number}
          onChange={(val) => updateField('number', val)}
          placeholder="e.g., 101, A-205"
          required
        />
        <FormInput
          label="Floor"
          type="number"
          value={formData.floor}
          onChange={(val) => updateField('floor', val)}
          min={1}
          required
        />
        <FormInput
          label="Size (m²)"
          type="number"
          value={formData.size_m2}
          onChange={handleSizeChange}
          min={0}
          step={0.1}
          required
        />
        <FormInput
          label="Price per m² (€)"
          type="number"
          value={formData.price_per_sqm}
          onChange={handlePricePerSqmChange}
          step={0.01}
          required
        />
        <div>
          <FormInput
            label="Total Price (€)"
            type="number"
            value={formData.price}
            onChange={() => {}}
            disabled
          />
          <p className="text-xs text-gray-500 mt-1">
            Calculated: {formData.size_m2} m² × €{formData.price_per_sqm}/m² = €{formData.price.toLocaleString()}
          </p>
        </div>
      </div>
    </Modal>
  )
}
