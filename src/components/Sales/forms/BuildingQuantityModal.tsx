import React, { useState } from 'react'
import { X } from 'lucide-react'

interface BuildingQuantityModalProps {
  visible: boolean
  onClose: () => void
  onSubmit: (quantity: number) => void
}

export const BuildingQuantityModal: React.FC<BuildingQuantityModalProps> = ({
  visible,
  onClose,
  onSubmit
}) => {
  const [quantity, setQuantity] = useState(1)

  if (!visible) return null

  const handleSubmit = () => {
    if (quantity < 1 || quantity > 20) {
      alert('Please enter a valid quantity (1-20)')
      return
    }
    onSubmit(quantity)
    setQuantity(1)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">Create Multiple Buildings</h3>
            <button
              onClick={() => {
                onClose()
                setQuantity(1)
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Buildings (1-20)
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-2">
              Buildings will be named "Building 1", "Building 2", etc.
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => {
                onClose()
                setQuantity(1)
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Create {quantity} Building{quantity !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
