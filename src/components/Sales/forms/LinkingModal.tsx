import React, { useState } from 'react'
import { X } from 'lucide-react'

interface LinkingModalProps {
  visible: boolean
  apartment: any
  building: any
  onClose: () => void
  onLinkGarage: (apartmentId: string, garageId: string) => void
  onLinkRepository: (apartmentId: string, repositoryId: string) => void
}

export const LinkingModal: React.FC<LinkingModalProps> = ({
  visible,
  apartment,
  building,
  onClose,
  onLinkGarage,
  onLinkRepository
}) => {
  const [linkType, setLinkType] = useState<'garage' | 'repository'>('garage')
  const [selectedId, setSelectedId] = useState('')

  if (!visible || !apartment) return null

  const handleSubmit = () => {
    if (!selectedId) return

    if (linkType === 'garage') {
      onLinkGarage(apartment.id, selectedId)
    } else {
      onLinkRepository(apartment.id, selectedId)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Link Unit</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Link Type</label>
            <select
              value={linkType}
              onChange={(e) => setLinkType(e.target.value as 'garage' | 'repository')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="garage">Garage</option>
              <option value="repository">Repository</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select {linkType}</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select {linkType}</option>
              {/* Options would be populated from building data */}
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Link
          </button>
        </div>
      </div>
    </div>
  )
}
