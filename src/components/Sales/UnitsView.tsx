import React from 'react'
import { Home, Warehouse, Package, Link as LinkIcon, Unlink, Trash2 } from 'lucide-react'
import type { BuildingWithUnits, GarageWithSaleInfo, RepositoryWithSaleInfo, UnitType } from './types/salesTypes'

interface UnitsViewProps {
  building: BuildingWithUnits
  garages: GarageWithSaleInfo[]
  repositories: RepositoryWithSaleInfo[]
  activeUnitType: UnitType
  filterStatus: 'all' | 'available' | 'reserved' | 'sold'
  onChangeUnitType: (type: UnitType) => void
  onChangeFilterStatus: (status: 'all' | 'available' | 'reserved' | 'sold') => void
  onBack: () => void
  onDeleteUnit: (unitId: string, unitType: UnitType) => void
  onUpdateStatus: (unitId: string, unitType: UnitType, status: string) => void
  onSellUnit: (unit: any, unitType: UnitType) => void
  onShowBulkCreate: () => void
  onShowAddUnit: () => void
  onShowLinkingModal: (apartment: any) => void
  onUnlinkGarage: (apartmentId: string) => void
  onUnlinkRepository: (apartmentId: string) => void
  onWirePayment?: (apartmentId: string) => void
  onViewPayments?: (apartmentId: string) => void
}

const UnitsView: React.FC<UnitsViewProps> = ({
  building,
  garages,
  repositories,
  activeUnitType,
  filterStatus,
  onChangeUnitType,
  onChangeFilterStatus,
  onBack,
  onDeleteUnit,
  onUpdateStatus,
  onSellUnit,
  onShowLinkingModal,
  onUnlinkGarage,
  onUnlinkRepository,
  onWirePayment,
  onViewPayments
}) => {
  const getFilteredUnits = (unitType: UnitType) => {
    let units: any[] = []
    if (unitType === 'apartment') units = building.apartments
    else if (unitType === 'garage') units = building.garages
    else if (unitType === 'repository') units = building.repositories

    if (filterStatus === 'all') return units
    return units.filter(unit => {
      if (filterStatus === 'available') return unit.status === 'Available'
      if (filterStatus === 'reserved') return unit.status === 'Reserved'
      if (filterStatus === 'sold') return unit.status === 'Sold'
      return true
    })
  }

  const getUnitIcon = (unitType: UnitType) => {
    if (unitType === 'apartment') return Home
    if (unitType === 'garage') return Warehouse
    return Package
  }

  const getUnitLabel = (unitType: UnitType) => {
    if (unitType === 'apartment') return 'Apartments'
    if (unitType === 'garage') return 'Garages'
    return 'Repositories'
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-gray-600 hover:text-gray-900"
      >
        ← Back to Buildings
      </button>

      <div className="flex space-x-2 mb-6">
        {(['apartment', 'garage', 'repository'] as UnitType[]).map((type) => {
          const Icon = getUnitIcon(type)
          const count = type === 'apartment' ? building.total_apartments :
                       type === 'garage' ? building.total_garages :
                       building.total_repositories
          return (
            <button
              key={type}
              onClick={() => onChangeUnitType(type)}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                activeUnitType === type
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {getUnitLabel(type)}
              <span className="ml-2 px-2 py-0.5 bg-white rounded-full text-xs">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center space-x-4 mb-6">
        <span className="text-sm font-medium text-gray-700">Filter by status:</span>
        <div className="flex space-x-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'available', label: 'Available' },
            { value: 'reserved', label: 'Reserved' },
            { value: 'sold', label: 'Sold' }
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => onChangeFilterStatus(filter.value as any)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                filterStatus === filter.value
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {getFilteredUnits(activeUnitType).map((unit: any) => {
          const linkedGarage = activeUnitType === 'apartment' && unit.garage_id ?
            garages.find(g => g.id === unit.garage_id) : null
          const linkedRepository = activeUnitType === 'apartment' && unit.repository_id ?
            repositories.find(r => r.id === unit.repository_id) : null

          return (
            <div
              key={unit.id}
              className={`rounded-xl shadow-sm border p-4 transition-all duration-200 ${
                unit.status === 'Sold'
                  ? 'border-green-200 bg-green-50'
                  : unit.status === 'Reserved'
                    ? 'border-yellow-200 bg-yellow-50'
                    : 'border-gray-200 bg-white hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">Unit {unit.number}</h4>
                  <p className="text-sm text-gray-600">Floor {unit.floor}</p>
                </div>
                <div className="flex space-x-1">
                  {activeUnitType === 'apartment' && (
                    <button
                      onClick={() => onShowLinkingModal(unit)}
                      className="p-1 text-gray-400 hover:text-blue-600"
                      title="Link garage/repository"
                    >
                      <LinkIcon className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteUnit(unit.id, activeUnitType)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Size:</span>
                  <span className="text-sm font-medium">{unit.size_m2} m²</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Price:</span>
                  <span className="text-sm font-bold text-green-600">€{unit.price.toLocaleString()}</span>
                </div>

                {unit.status === 'Sold' && unit.sale_info && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Buyer:</span>
                      <span className="text-sm font-medium">{unit.sale_info.buyer_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Sale Price:</span>
                      <span className="text-sm font-bold text-green-600">€{unit.sale_info.sale_price.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Down Payment:</span>
                      <span className="text-sm font-medium">€{unit.sale_info.down_payment.toLocaleString()}</span>
                    </div>
                    {unit.sale_info.monthly_payment > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Monthly:</span>
                        <span className="text-sm font-medium">€{unit.sale_info.monthly_payment.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="mt-2">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-gray-500">Payment Progress</span>
                        <span className="text-xs font-medium">
                          €{unit.sale_info.total_paid.toLocaleString()} / €{unit.sale_info.sale_price.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-green-600 h-1.5 rounded-full"
                          style={{
                            width: `${unit.sale_info.sale_price > 0 ? (unit.sale_info.total_paid / unit.sale_info.sale_price) * 100 : 0}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </>
                )}

                {linkedGarage && (
                  <div className="flex justify-between items-center text-sm bg-orange-100 px-2 py-1 rounded">
                    <span className="text-orange-700">Garage: {linkedGarage.number}</span>
                    <button
                      onClick={() => onUnlinkGarage(unit.id)}
                      className="text-orange-600 hover:text-orange-800"
                    >
                      <Unlink className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {linkedRepository && (
                  <div className="flex justify-between items-center text-sm bg-purple-100 px-2 py-1 rounded">
                    <span className="text-purple-700">Repository: {linkedRepository.number}</span>
                    <button
                      onClick={() => onUnlinkRepository(unit.id)}
                      className="text-purple-600 hover:text-purple-800"
                    >
                      <Unlink className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    unit.status === 'Sold' ? 'bg-green-100 text-green-800' :
                    unit.status === 'Reserved' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {unit.status}
                  </span>

                  {unit.status !== 'Sold' && (
                    <div className="flex space-x-1">
                      {unit.status === 'Available' && (
                        <button
                          onClick={() => onUpdateStatus(unit.id, activeUnitType, 'Reserved')}
                          className="px-2 py-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded text-xs font-medium"
                        >
                          Reserve
                        </button>
                      )}
                      {unit.status === 'Reserved' && (
                        <button
                          onClick={() => onUpdateStatus(unit.id, activeUnitType, 'Available')}
                          className="px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-xs font-medium"
                        >
                          Available
                        </button>
                      )}
                      <button
                        onClick={() => onSellUnit(unit, activeUnitType)}
                        className="px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded text-xs font-medium"
                      >
                        Sell
                      </button>
                    </div>
                  )}
                </div>

                {unit.status === 'Sold' && activeUnitType === 'apartment' && onWirePayment && onViewPayments && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onWirePayment(unit.id)}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 text-xs font-medium"
                    >
                      Wire
                    </button>
                    <button
                      onClick={() => onViewPayments(unit.id)}
                      className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors duration-200 text-xs font-medium"
                    >
                      Payments
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default UnitsView
