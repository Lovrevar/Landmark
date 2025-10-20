import React from 'react'
import { BuildingWithUnits, UnitType, FilterStatus } from '../types/salesTypes'
import { ArrowLeft, Home, DollarSign } from 'lucide-react'

interface UnitsGridProps {
  building: BuildingWithUnits
  activeUnitType: UnitType
  filterStatus: FilterStatus
  garages: any[]
  repositories: any[]
  onSetActiveUnitType: (type: UnitType) => void
  onSetFilterStatus: (status: FilterStatus) => void
  onDeleteUnit: (unitId: string, unitType: UnitType) => void
  onUpdateUnitStatus: (unitId: string, unitType: UnitType, status: string) => void
  onSellUnit: (unit: any, unitType: UnitType) => void
  onLinkApartment: (apartment: any) => void
  onUnlinkGarage: (apartmentId: string) => void
  onUnlinkRepository: (apartmentId: string) => void
  onBack: () => void
}

export const UnitsGrid: React.FC<UnitsGridProps> = ({
  building,
  activeUnitType,
  filterStatus,
  onSetActiveUnitType,
  onSetFilterStatus,
  onSellUnit,
  onBack
}) => {
  const units = activeUnitType === 'apartment' ? (building.apartments || []) :
                activeUnitType === 'garage' ? (building.garages || []) :
                (building.repositories || [])

  const filteredUnits = filterStatus === 'all' ? units :
                       units.filter((u: any) => u.status === filterStatus)

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Buildings
      </button>

      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => onSetActiveUnitType('apartment')}
          className={`px-4 py-2 rounded-lg ${
            activeUnitType === 'apartment'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Apartments
        </button>
        <button
          onClick={() => onSetActiveUnitType('garage')}
          className={`px-4 py-2 rounded-lg ${
            activeUnitType === 'garage'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Garages
        </button>
        <button
          onClick={() => onSetActiveUnitType('repository')}
          className={`px-4 py-2 rounded-lg ${
            activeUnitType === 'repository'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Repositories
        </button>
      </div>

      <div className="flex space-x-4 mb-6">
        <select
          value={filterStatus}
          onChange={(e) => onSetFilterStatus(e.target.value as FilterStatus)}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="all">All Status</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="sold">Sold</option>
        </select>
      </div>

      {filteredUnits.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Home className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No units found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUnits.map((unit: any) => (
            <div
              key={unit.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {activeUnitType === 'apartment' ? 'Apt' : activeUnitType === 'garage' ? 'Garage' : 'Repo'} #{unit.number}
              </h3>
              <div className="space-y-2 mb-4">
                <p className="text-sm text-gray-600">Floor: {unit.floor}</p>
                <p className="text-sm text-gray-600">Size: {unit.size}m²</p>
                <div className="flex items-center text-sm font-medium text-green-600">
                  <DollarSign className="w-4 h-4 mr-1" />
                  €{unit.price?.toLocaleString()}
                </div>
                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                  unit.status === 'available' ? 'bg-green-100 text-green-800' :
                  unit.status === 'reserved' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {unit.status?.toUpperCase()}
                </span>
              </div>
              {unit.status === 'available' && (
                <button
                  onClick={() => onSellUnit(unit, activeUnitType)}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  Sell Unit
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
