import type { BuildingWithUnits, FilterStatus, UnitType } from './types'

type UnitWithStatus = { id: string; status: string }

const STATUS_BY_FILTER: Record<Exclude<FilterStatus, 'all'>, string> = {
  available: 'Available',
  reserved: 'Reserved',
  sold: 'Sold'
}

/** The units of one type (apartments, garages or storage units) in a building. */
export const getUnitsOfType = (building: BuildingWithUnits, unitType: UnitType) => {
  if (unitType === 'apartment') return building.apartments
  if (unitType === 'garage') return building.garages
  return building.repositories
}

/** The units the grid shows for a status filter. */
export const filterUnitsByStatus = <T extends UnitWithStatus>(units: T[], filterStatus: FilterStatus): T[] => {
  if (filterStatus === 'all') return units
  const status = STATUS_BY_FILTER[filterStatus]
  return units.filter(unit => unit.status === status)
}

/**
 * The ids "Select all" picks: the units visible under the filter, minus Sold ones.
 * Sold units are never repriced in bulk — bulkUpdateUnitPrice enforces the same rule.
 */
export const getSelectableUnitIds = (units: UnitWithStatus[], filterStatus: FilterStatus): string[] =>
  filterUnitsByStatus(units, filterStatus)
    .filter(unit => unit.status !== 'Sold')
    .map(unit => unit.id)
