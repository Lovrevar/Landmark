import React from 'react'
import { UnitType, BuildingWithUnits, EnhancedApartment, EnhancedGarage, EnhancedRepository } from '../../types'
import { UnitTypeTabs } from '../shared/UnitTypeTabs'
import { StatusFilter } from '../shared/StatusFilter'
import { UnitCard } from '../shared/UnitCard'
import { useViewState } from '../../context/ViewStateContext'
import { useUnitFilters } from '../../hooks/useUnitFilters'

interface UnitsViewProps {
  building: BuildingWithUnits
  garages: EnhancedGarage[]
  repositories: EnhancedRepository[]
  onDeleteUnit: (unitId: string, unitType: UnitType) => void
  onUpdateStatus: (unitId: string, unitType: UnitType, status: string) => void
  onSellUnit: (unit: EnhancedApartment | EnhancedGarage | EnhancedRepository, unitType: UnitType) => void
  onOpenLinking: (apartment: EnhancedApartment) => void
  onUnlinkGarage: (apartmentId: string) => void
  onUnlinkRepository: (apartmentId: string) => void
}

export function UnitsView({
  building,
  garages,
  repositories,
  onDeleteUnit,
  onUpdateStatus,
  onSellUnit,
  onOpenLinking,
  onUnlinkGarage,
  onUnlinkRepository
}: UnitsViewProps) {
  const { activeUnitType, filterStatus, setActiveUnitType, setFilterStatus } = useViewState()
  const filteredUnits = useUnitFilters(building, activeUnitType, filterStatus)

  return (
    <div>
      <UnitTypeTabs
        activeType={activeUnitType}
        onTypeChange={setActiveUnitType}
        counts={{
          apartments: building.total_apartments,
          garages: building.total_garages,
          repositories: building.total_repositories
        }}
      />

      <StatusFilter
        activeStatus={filterStatus}
        onStatusChange={setFilterStatus}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredUnits.map((unit: any) => {
          const linkedGarage = activeUnitType === 'apartment' && unit.garage_id
            ? garages.find(g => g.id === unit.garage_id)
            : null

          const linkedRepository = activeUnitType === 'apartment' && unit.repository_id
            ? repositories.find(r => r.id === unit.repository_id)
            : null

          return (
            <UnitCard
              key={unit.id}
              unit={unit}
              unitType={activeUnitType}
              linkedGarage={linkedGarage}
              linkedRepository={linkedRepository}
              onDelete={() => onDeleteUnit(unit.id, activeUnitType)}
              onReserve={
                unit.status === 'Available'
                  ? () => onUpdateStatus(unit.id, activeUnitType, 'Reserved')
                  : undefined
              }
              onMakeAvailable={
                unit.status === 'Reserved'
                  ? () => onUpdateStatus(unit.id, activeUnitType, 'Available')
                  : undefined
              }
              onSell={() => onSellUnit(unit, activeUnitType)}
              onOpenLinking={
                activeUnitType === 'apartment'
                  ? () => onOpenLinking(unit as EnhancedApartment)
                  : undefined
              }
              onUnlinkGarage={
                linkedGarage
                  ? () => onUnlinkGarage(unit.id)
                  : undefined
              }
              onUnlinkRepository={
                linkedRepository
                  ? () => onUnlinkRepository(unit.id)
                  : undefined
              }
            />
          )
        })}
      </div>
    </div>
  )
}
