import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { UnitType } from '../types/salesTypes'

interface UnitFormProps {
  visible: boolean
  unitType: UnitType
  onClose: () => void
  onSubmit: (data: { number: string, floor: number, size_m2: number, price: number }) => void
}

const UnitForm: React.FC<UnitFormProps> = ({ visible, unitType, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    number: '',
    floor: 1,
    size_m2: 0,
    price: 0
  })

  useEffect(() => {
    if (!visible) {
      setFormData({ number: '', floor: 1, size_m2: 0, price: 0 })
    }
  }, [visible])

  if (!visible) return null

  const getUnitLabel = (type: UnitType) => {
    if (type === 'apartment') return 'Apartments'
    if (type === 'garage') return 'Garages'
    return 'Repositories'
  }

  const handleSubmit = () => {
    onSubmit(formData)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">
              Add {getUnitLabel(unitType).slice(0, -1)}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Price (€) *</label>
              <input
                type="number"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
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
              Add {getUnitLabel(unitType).slice(0, -1)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UnitForm
