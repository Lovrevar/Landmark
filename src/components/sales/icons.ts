import { Home, Warehouse, Package, LucideIcon } from 'lucide-react'
import { UnitType } from './types'

export const getUnitIcon = (unitType: UnitType): LucideIcon => {
  switch (unitType) {
    case 'apartment':
      return Home
    case 'garage':
      return Warehouse
    case 'repository':
      return Package
  }
}

export const getUnitLabel = (unitType: UnitType): string => {
  switch (unitType) {
    case 'apartment':
      return 'Apartments'
    case 'garage':
      return 'Garages'
    case 'repository':
      return 'Repositories'
  }
}

export const getUnitSingularLabel = (unitType: UnitType): string => {
  return getUnitLabel(unitType).slice(0, -1)
}

export const getUnitPrefix = (unitType: UnitType): string => {
  switch (unitType) {
    case 'apartment':
      return 'A'
    case 'garage':
      return 'G'
    case 'repository':
      return 'R'
  }
}
