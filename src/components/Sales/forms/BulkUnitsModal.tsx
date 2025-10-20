import React, { useState } from 'react'
import { X } from 'lucide-react'
import { BulkCreateData, UnitType } from '../types/salesTypes'

interface BulkUnitsModalProps {
  visible: boolean
  unitType: UnitType
  onClose: () => void
  onSubmit: (data: BulkCreateData) => void
}

export const BulkUnitsModal: React.FC<BulkUnitsModalProps> = ({
  visible,
  unitType,
  onClose,
  onSubmit
}) => {
  const [formData, setFormData] = useState<BulkCreateData>({
    start_floor: 0,
    end_floor: 0,
    units_per_floor: 1,
    starting_number: 1,
    base_size_m2: 0,
    base_price: 0
  })

  if (!visible) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Bulk Create {unitType}s</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Floor</label>
              <input
                type="number"
                value={formData.start_floor}
                onChange={(e) => setFormData({ ...formData, start_floor: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Floor</label>
              <input
                type="number"
                value={formData.end_floor}
                onChange={(e) => setFormData({ ...formData, end_floor: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Units per Floor</label>
            <input
              type="number"
              value={formData.units_per_floor}
              onChange={(e) => setFormData({ ...formData, units_per_floor: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Starting Number</label>
            <input
              type="number"
              value={formData.starting_number}
              onChange={(e) => setFormData({ ...formData, starting_number: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Base Size (m²)</label>
            <input
              type="number"
              value={formData.base_size_m2}
              onChange={(e) => setFormData({ ...formData, base_size_m2: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Base Price (€)</label>
            <input
              type="number"
              value={formData.base_price}
              onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(formData)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
