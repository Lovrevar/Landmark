import React from 'react'
import { X } from 'lucide-react'
import { ApartmentWithDetails } from '../types/apartmentTypes'

interface ApartmentDetailsModalProps {
  visible: boolean
  onClose: () => void
  apartment: ApartmentWithDetails | null
}

export const ApartmentDetailsModal: React.FC<ApartmentDetailsModalProps> = ({
  visible,
  onClose,
  apartment
}) => {
  if (!visible || !apartment) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">Apartment Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Apartment Number</p>
              <p className="text-lg font-semibold text-gray-900">{apartment.number}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                apartment.status === 'Sold' ? 'bg-green-100 text-green-800' :
                apartment.status === 'Reserved' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {apartment.status}
              </span>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Location</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Project:</span>
                <span className="font-medium text-gray-900">{apartment.project_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Building:</span>
                <span className="font-medium text-gray-900">{apartment.building_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Floor:</span>
                <span className="font-medium text-gray-900">{apartment.floor}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Specifications</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Size:</span>
                <span className="font-medium text-gray-900">{apartment.size_m2} m²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Price:</span>
                <span className="font-bold text-green-600">€{apartment.price.toLocaleString('hr-HR')}</span>
              </div>
            </div>
          </div>

          {apartment.buyer_name && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Buyer Information</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Buyer:</span>
                  <span className="font-medium text-gray-900">{apartment.buyer_name}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
