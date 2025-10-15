import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { NewBuildingData } from '../../types'

interface BuildingFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: NewBuildingData) => void
}

const initialData: NewBuildingData = {
  name: '',
  description: '',
  total_floors: 10
}

export function BuildingFormModal({ isOpen, onClose, onSubmit }: BuildingFormModalProps) {
  const [data, setData] = useState<NewBuildingData>(initialData)

  useEffect(() => {
    if (!isOpen) {
      setData(initialData)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = () => {
    if (!data.name.trim()) {
      alert('Please enter a building name')
      return
    }
    onSubmit(data)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">Add Building</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Building Name *
              </label>
              <input
                type="text"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Building A, Tower 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={data.description}
                onChange={(e) => setData({ ...data, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Floors *
              </label>
              <input
                type="number"
                min="1"
                value={data.total_floors}
                onChange={(e) => setData({ ...data, total_floors: parseInt(e.target.value) || 1 })}
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
              Add Building
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
