import { useMemo } from 'react'
import { UnitType, UnitStatus, BuildingWithUnits, EnhancedApartment, EnhancedGarage, EnhancedRepository } from '../types'

export function useUnitFilters(
  building: BuildingWithUnits | null,
  activeType: UnitType,
  filterStatus: UnitStatus
) {
  const filteredUnits = useMemo(() => {
    if (!building) return []

    let units: (EnhancedApartment | EnhancedGarage | EnhancedRepository)[] = []

    if (activeType === 'apartment') {
      units = building.apartments
    } else if (activeType === 'garage') {
      units = building.garages
    } else if (activeType === 'repository') {
      units = building.repositories
    }

    if (filterStatus === 'all') return units

    return units.filter(unit => {
      if (filterStatus === 'available') return unit.status === 'Available'
      if (filterStatus === 'reserved') return unit.status === 'Reserved'
      if (filterStatus === 'sold') return unit.status === 'Sold'
      return true
    })
  }, [building, activeType, filterStatus])

  return filteredUnits
}
