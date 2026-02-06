import React, { useState, useEffect } from 'react'
import { ApartmentWithDetails } from '../types/apartmentTypes'
import { Modal, FormField, Input, Select, Button } from '../../ui'

interface EditApartmentModalProps {
  visible: boolean
  onClose: () => void
  apartment: ApartmentWithDetails | null
  onSubmit: (id: string, updates: Partial<ApartmentWithDetails>) => void
}

export const EditApartmentModal: React.FC<EditApartmentModalProps> = ({
  visible,
  onClose,
  apartment,
  onSubmit
}) => {
  const [formData, setFormData] = useState({
    number: '',
    floor: 1,
    size_m2: 80,
    price: 150000,
    status: 'Available'
  })

  useEffect(() => {
    if (apartment) {
      setFormData({
        number: apartment.number,
        floor: apartment.floor,
        size_m2: apartment.size_m2,
        price: apartment.price,
        status: apartment.status
      })
    }
  }, [apartment])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!apartment) return
    onSubmit(apartment.id, formData)
  }

  if (!visible || !apartment) return null

  return (
    <Modal show={visible} onClose={onClose} size="lg">
      <Modal.Header title="Edit Apartment" onClose={onClose} />

      <form onSubmit={handleSubmit}>
        <Modal.Body>
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Project:</strong> {apartment.project_name}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Building:</strong> {apartment.building_name}
              </p>
            </div>

            <FormField label="Apartment Number" required>
              <Input
                type="text"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                required
              />
            </FormField>

            <div className="grid grid-cols-3 gap-4">
              <FormField label="Floor" required>
                <Input
                  type="number"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) })}
                  required
                />
              </FormField>

              <FormField label="Size (m2)" required>
                <Input
                  type="number"
                  value={formData.size_m2}
                  onChange={(e) => setFormData({ ...formData, size_m2: parseFloat(e.target.value) })}
                  required
                  step="0.1"
                />
              </FormField>

              <FormField label="Price (EUR)" required>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                  required
                  step="0.01"
                />
              </FormField>
            </div>

            <FormField label="Status" required>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                required
              >
                <option value="Available">Available</option>
                <option value="Reserved">Reserved</option>
                <option value="Sold">Sold</option>
              </Select>
            </FormField>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">Save Changes</Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
