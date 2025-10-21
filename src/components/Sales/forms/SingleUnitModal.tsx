import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { UnitFormData, UnitType } from '../types/salesTypes'

interface SingleUnitModalProps {
  visible: boolean
  buildingId: string
  unitType: UnitType
  onClose: () => void
  onSubmit: (data: UnitFormData) => void
}

export const SingleUnitModal: React.FC<SingleUnitModalProps> = ({
  visible,
  buildingId,
  unitType,
  onClose,
  onSubmit
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">
              Add {getUnitLabel()}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Unit Number *</label>
              <input
                type="text"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 101, A-205"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Floor *</label>
              <input
                type="number"
                min="0"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Size (m²) *</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={formData.size_m2}
                onChange={(e) => setFormData({ ...formData, size_m2: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price per m² (€/m²) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.price_per_m2}
                onChange={(e) => setFormData({ ...formData, price_per_m2: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
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

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add {getUnitLabel()}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
