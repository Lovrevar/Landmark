import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { ApartmentWithDetails } from '../types/apartmentTypes'

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">Edit Apartment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Project:</strong> {apartment.project_name}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <strong>Building:</strong> {apartment.building_name}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Apartment Number</label>
            <input
              type="text"
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Floor</label>
              <input
                type="number"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Size (m²)</label>
              <input
                type="number"
                value={formData.size_m2}
                onChange={(e) => setFormData({ ...formData, size_m2: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
                step="0.1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price (€)</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
                step="0.01"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="Available">Available</option>
              <option value="Reserved">Reserved</option>
              <option value="Sold">Sold</option>
            </select>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
