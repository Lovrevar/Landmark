import React from 'react'
import { X, Warehouse, Package } from 'lucide-react'
import type { ApartmentWithSaleInfo, GarageWithSaleInfo, RepositoryWithSaleInfo } from '../types/salesTypes'

interface LinkingModalProps {
  visible: boolean
  apartment: ApartmentWithSaleInfo | null
  availableGarages: GarageWithSaleInfo[]
  availableRepositories: RepositoryWithSaleInfo[]
  onLinkGarage: (apartmentId: string, garageId: string) => void
  onLinkRepository: (apartmentId: string, repositoryId: string) => void
  onClose: () => void
}

const LinkingModal: React.FC<LinkingModalProps> = ({
  visible,
  apartment,
  availableGarages,
  availableRepositories,
  onLinkGarage,
  onLinkRepository,
  onClose
}) => {
  if (!visible || !apartment) return null

  const handleLinkGarage = (garageId: string) => {
    onLinkGarage(apartment.id, garageId)
    onClose()
  }

  const handleLinkRepository = (repositoryId: string) => {
    onLinkRepository(apartment.id, repositoryId)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">
              Link Units to Apartment {apartment.number}
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
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <Warehouse className="w-5 h-5 mr-2 text-orange-600" />
              Link Garage
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {availableGarages.filter(g => g.status === 'Available').map((garage) => (
                <button
                  key={garage.id}
                  onClick={() => handleLinkGarage(garage.id)}
                  className={`p-3 border-2 rounded-lg text-left transition-colors ${
                    apartment.garage_id === garage.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-orange-300 bg-white'
                  }`}
                >
                  <div className="font-medium text-gray-900">Garage {garage.number}</div>
                  <div className="text-sm text-gray-600">Floor {garage.floor} • {garage.size_m2}m²</div>
                  <div className="text-sm font-medium text-orange-600">€{garage.price.toLocaleString()}</div>
                </button>
              ))}
              {availableGarages.filter(g => g.status === 'Available').length === 0 && (
                <p className="text-gray-500 col-span-2">No available garages</p>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <Package className="w-5 h-5 mr-2 text-purple-600" />
              Link Repository
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {availableRepositories.filter(r => r.status === 'Available').map((repository) => (
                <button
                  key={repository.id}
                  onClick={() => handleLinkRepository(repository.id)}
                  className={`p-3 border-2 rounded-lg text-left transition-colors ${
                    apartment.repository_id === repository.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300 bg-white'
                  }`}
                >
                  <div className="font-medium text-gray-900">Repository {repository.number}</div>
                  <div className="text-sm text-gray-600">Floor {repository.floor} • {repository.size_m2}m²</div>
                  <div className="text-sm font-medium text-purple-600">€{repository.price.toLocaleString()}</div>
                </button>
              ))}
              {availableRepositories.filter(r => r.status === 'Available').length === 0 && (
                <p className="text-gray-500 col-span-2">No available repositories</p>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LinkingModal
