import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Home, Warehouse, Package, Link as LinkIcon, Unlink, Trash2, DollarSign, CheckSquare, Square, ArrowLeft } from 'lucide-react'
import {
  BuildingWithUnits,
  UnitType,
  FilterStatus,
  OnDeleteUnitCallback,
  OnUpdateUnitStatusCallback,
  OnSellUnitCallback,
  OnLinkApartmentCallback
} from './types'
import { Apartment, Garage, Repository } from '../../../lib/supabase'
import { Button, Badge } from '../../ui'

interface UnitsGridProps {
  building: BuildingWithUnits
  activeUnitType: UnitType
  filterStatus: FilterStatus
  garages: Garage[]
  repositories: Repository[]
  onSetActiveUnitType: (type: UnitType) => void
  onSetFilterStatus: (status: FilterStatus) => void
  onDeleteUnit: OnDeleteUnitCallback
  onUpdateUnitStatus: OnUpdateUnitStatusCallback
  onSellUnit: OnSellUnitCallback
  onLinkApartment: OnLinkApartmentCallback
  onUnlinkGarage: (apartmentId: string, garageId: string) => void
  onUnlinkRepository: (apartmentId: string, repositoryId: string) => void
  onBack: () => void
  selectedUnitIds: string[]
  onToggleUnitSelection: (unitId: string) => void
  onSelectAllUnits: () => void
  onDeselectAllUnits: () => void
  onConfigurePrice: () => void
}

const getUnitStatusBadgeVariant = (status: string): 'green' | 'yellow' | 'blue' => {
  return status === 'Sold' ? 'green' : status === 'Reserved' ? 'yellow' : 'blue'
}

export const UnitsGrid: React.FC<UnitsGridProps> = ({
  building,
  activeUnitType,
  filterStatus,
  onSetActiveUnitType,
  onSetFilterStatus,
  onDeleteUnit,
  onUpdateUnitStatus,
  onSellUnit,
  onLinkApartment,
  onUnlinkGarage,
  onUnlinkRepository,
  onBack,
  selectedUnitIds,
  onToggleUnitSelection,
  onSelectAllUnits,
  onDeselectAllUnits,
  onConfigurePrice
}) => {
  const { t } = useTranslation()
  const getUnitIcon = (unitType: UnitType) => {
    if (unitType === 'apartment') return Home
    if (unitType === 'garage') return Warehouse
    return Package
  }

  const getUnitLabel = (unitType: UnitType) => {
    if (unitType === 'apartment') return t('sales_projects.units.apartments')
    if (unitType === 'garage') return t('sales_projects.units.garages')
    return t('sales_projects.units.repositories')
  }

  const getFilteredUnits = () => {
    let units: { id: string; status: string; [key: string]: unknown }[] = []
    if (activeUnitType === 'apartment') units = building.apartments
    else if (activeUnitType === 'garage') units = building.garages
    else if (activeUnitType === 'repository') units = building.repositories

    if (filterStatus === 'all') return units
    return units.filter(unit => {
      if (filterStatus === 'available') return unit.status === 'Available'
      if (filterStatus === 'reserved') return unit.status === 'Reserved'
      if (filterStatus === 'sold') return unit.status === 'Sold'
      return true
    })
  }

  const filteredUnits = useMemo(() => getFilteredUnits(), [activeUnitType, filterStatus, building])
  const allFilteredSelected = filteredUnits.length > 0 && filteredUnits.every(u => selectedUnitIds.includes(u.id))

  return (
    <div>
      <Button variant="ghost" icon={ArrowLeft} onClick={onBack}>
        {t('sales_projects.back_to_buildings')}
      </Button>

      {selectedUnitIds.length > 0 && (
        <div className="mb-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {selectedUnitIds.length} {t('sales_projects.units_selected')}
            </span>
            <button
              onClick={onDeselectAllUnits}
              className="text-sm text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 underline"
            >
              {t('sales_projects.deselect_all')}
            </button>
          </div>
          <button
            onClick={onConfigurePrice}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            {t('sales_projects.configure_price')}
          </button>
        </div>
      )}

      <div className="flex space-x-2 mb-6">
        {(['apartment', 'garage', 'repository'] as UnitType[]).map((type) => {
          const Icon = getUnitIcon(type)
          const count = type === 'apartment' ? building.total_apartments :
                       type === 'garage' ? building.total_garages :
                       building.total_repositories
          return (
            <button
              key={type}
              onClick={() => onSetActiveUnitType(type)}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                activeUnitType === type
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {getUnitLabel(type)}
              <span className="ml-2 px-2 py-0.5 bg-white dark:bg-gray-800 rounded-full text-xs">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('sales_projects.filter_by_status')}:</span>
          <div className="flex space-x-2">
          {[
            { value: 'all', label: t('sales_projects.filter.all') },
            { value: 'available', label: t('sales_projects.filter.available') },
            { value: 'reserved', label: t('sales_projects.filter.reserved') },
            { value: 'sold', label: t('sales_projects.filter.sold') }
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => onSetFilterStatus(filter.value as FilterStatus)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                filterStatus === filter.value
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
              }`}
            >
              {filter.label}
            </button>
          ))}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={allFilteredSelected ? onDeselectAllUnits : onSelectAllUnits}
            className="flex items-center px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg border border-blue-200 dark:border-blue-700 transition-colors duration-200"
          >
            {allFilteredSelected ? <Square className="w-4 h-4 mr-2" /> : <CheckSquare className="w-4 h-4 mr-2" />}
            {allFilteredSelected ? t('sales_projects.deselect_all') : t('sales_projects.select_all')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredUnits.map((unit: { id: string; status: string; number?: string; floor?: number; size_m2?: number; price?: number; price_per_m2?: number; linked_garages?: { id: string; number: string; price: number }[]; linked_repositories?: { id: string; number: string; price: number }[]; sale_info?: { buyer_name: string; sale_price: number; down_payment: number; total_paid: number; remaining_amount: number; monthly_payment: number } }) => {
          const linkedGarages: { id: string; number: string; price: number }[] = activeUnitType === 'apartment' ? (unit.linked_garages || []) : []
          const linkedRepositories: { id: string; number: string; price: number }[] = activeUnitType === 'apartment' ? (unit.linked_repositories || []) : []

          const isSelected = selectedUnitIds.includes(unit.id)

          const apartmentPrice = unit.price || 0
          const garagesPrice = linkedGarages.reduce((sum: number, g: { price: number }) => sum + (g?.price || 0), 0)
          const repositoriesPrice = linkedRepositories.reduce((sum: number, r: { price: number }) => sum + (r?.price || 0), 0)
          const totalPackagePrice = apartmentPrice + garagesPrice + repositoriesPrice
          const hasLinkedUnits = linkedGarages.length > 0 || linkedRepositories.length > 0

          return (
            <div
              key={unit.id}
              className={`rounded-xl shadow-sm border p-4 transition-all duration-200 ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md'
                  : unit.status === 'Sold'
                  ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                  : unit.status === 'Reserved'
                    ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onToggleUnitSelection(unit.id)}
                    className="p-1 hover:bg-white dark:hover:bg-gray-700 rounded transition-colors duration-200"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">Unit {unit.number}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Floor {unit.floor}</p>
                  </div>
                </div>
                <div className="flex space-x-1">
                  {activeUnitType === 'apartment' && (
                    <button
                      onClick={() => onLinkApartment(unit as unknown as Apartment)}
                      className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-600"
                      title="Link garage/repository"
                    >
                      <LinkIcon className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteUnit(unit.id, activeUnitType)}
                    className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{t('sales_projects.unit_detail.size')}:</span>
                  <span className="text-sm font-medium">{unit.size_m2} m²</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{t('sales_projects.unit_detail.price_per_m2')}:</span>
                  <span className="text-sm font-medium text-blue-600">
                    €{(unit.price_per_m2 && unit.price_per_m2 > 0
                      ? unit.price_per_m2
                      : (unit.size_m2 ?? 0) > 0 ? Math.round((unit.price ?? 0) / (unit.size_m2 ?? 1)) : 0
                    ).toLocaleString('hr-HR')}/m²
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{activeUnitType === 'apartment' ? t('sales_projects.unit_detail.apartment_price') : t('sales_projects.unit_detail.total_price')}:</span>
                  <span className="text-sm font-bold text-green-600">€{(unit.price ?? 0).toLocaleString('hr-HR')}</span>
                </div>

                {activeUnitType === 'apartment' && hasLinkedUnits && (
                  <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{t('sales_projects.unit_detail.total_package')}:</span>
                    <span className="text-base font-bold text-blue-700">€{totalPackagePrice.toLocaleString('hr-HR')}</span>
                  </div>
                )}

                {unit.status === 'Sold' && unit.sale_info && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{t('sales_projects.unit_detail.buyer')}:</span>
                      <span className="text-sm font-medium">{unit.sale_info.buyer_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{t('sales_projects.unit_detail.sale_price')}:</span>
                      <span className="text-sm font-bold text-green-600">€{unit.sale_info.sale_price.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{t('sales_projects.unit_detail.down_payment')}:</span>
                      <span className="text-sm font-medium">€{unit.sale_info.down_payment.toLocaleString('hr-HR')}</span>
                    </div>
                    {unit.sale_info.monthly_payment > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{t('sales_projects.unit_detail.monthly')}:</span>
                        <span className="text-sm font-medium">€{unit.sale_info.monthly_payment.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="mt-2">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{t('sales_projects.unit_detail.payment_progress')}</span>
                        <span className="text-xs font-medium">
                          €{unit.sale_info.total_paid.toLocaleString()} / €{totalPackagePrice.toLocaleString('hr-HR')}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                        <div
                          className="bg-green-600 h-1.5 rounded-full"
                          style={{
                            width: `${totalPackagePrice > 0 ? (unit.sale_info.total_paid / totalPackagePrice) * 100 : 0}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </>
                )}

                {linkedGarages.map((garage: { id: string; number: string; price: number }) => (
                  <div key={garage.id} className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-2 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">{t('common.garage')}: {garage.number}</span>
                      <button
                        onClick={() => onUnlinkGarage(unit.id, garage.id)}
                        className="text-orange-600 hover:text-orange-800"
                      >
                        <Unlink className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-orange-600 dark:text-orange-400">{t('sales_projects.unit_detail.price')}:</span>
                      <span className="text-xs font-bold text-orange-700 dark:text-orange-400">€{(garage.price || 0).toLocaleString('hr-HR')}</span>
                    </div>
                  </div>
                ))}

                {linkedRepositories.map((repository: { id: string; number: string; price: number }) => (
                  <div key={repository.id} className="bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg p-2 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{t('common.storage')}: {repository.number}</span>
                      <button
                        onClick={() => onUnlinkRepository(unit.id, repository.id)}
                        className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                      >
                        <Unlink className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600 dark:text-gray-400">{t('sales_projects.unit_detail.price')}:</span>
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-200">€{(repository.price || 0).toLocaleString('hr-HR')}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t dark:border-gray-700 pt-3">
                <div className="flex items-center justify-between">
                  <Badge variant={getUnitStatusBadgeVariant(unit.status)}>
                    {unit.status}
                  </Badge>

                  {unit.status !== 'Sold' && (
                    <div className="flex space-x-1">
                      {unit.status === 'Available' && (
                        <Button size="sm" variant="ghost" className="bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/40" onClick={() => onUpdateUnitStatus(unit.id, activeUnitType, 'Reserved')}>
                          {t('sales_projects.unit_detail.reserve')}
                        </Button>
                      )}
                      {unit.status === 'Reserved' && (
                        <Button size="sm" variant="ghost" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50" onClick={() => onUpdateUnitStatus(unit.id, activeUnitType, 'Available')}>
                          {t('sales_projects.unit_detail.available')}
                        </Button>
                      )}
                      <Button size="sm" variant="success" onClick={() => onSellUnit(unit as unknown as (Apartment | Garage | Repository), activeUnitType)}>
                        {t('sales_projects.unit_detail.sell')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
