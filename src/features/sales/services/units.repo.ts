import { supabase } from './supabaseClient'
import { UnitType, NewUnitData, BulkCreateConfig } from '../types'
import { getUnitPrefix } from '../icons'

export async function listApartments() {
  return supabase
    .from('apartments')
    .select('*')
    .order('number')
}

export async function listGarages() {
  return supabase
    .from('garages')
    .select('*')
    .order('number')
}

export async function listRepositories() {
  return supabase
    .from('repositories')
    .select('*')
    .order('number')
}

const getTableName = (unitType: UnitType): string => {
  switch (unitType) {
    case 'apartment':
      return 'apartments'
    case 'garage':
      return 'garages'
    case 'repository':
      return 'repositories'
  }
}

export async function createUnit(
  unitType: UnitType,
  data: NewUnitData,
  projectId?: string
) {
  const tableName = getTableName(unitType)

  const unitData: any = {
    building_id: data.building_id,
    number: data.number,
    floor: data.floor,
    size_m2: data.size_m2,
    price: data.price,
    status: 'Available'
  }

  if (unitType === 'apartment' && projectId) {
    unitData.project_id = projectId
  }

  return supabase
    .from(tableName)
    .insert(unitData)
}

export async function bulkCreateUnits(
  unitType: UnitType,
  buildingId: string,
  projectId: string,
  config: BulkCreateConfig
) {
  const tableName = getTableName(unitType)
  const prefix = config.number_prefix || getUnitPrefix(unitType)
  const unitsToCreate = []

  for (let floor = config.floor_start; floor <= config.floor_end; floor++) {
    for (let unit = 1; unit <= config.units_per_floor; unit++) {
      const sizeVariation = (Math.random() - 0.5) * config.size_variation
      const size = Math.round(config.base_size + sizeVariation)
      const floorPremium = (floor - config.floor_start) * config.floor_increment
      const price = Math.round((size * config.base_price_per_m2) + floorPremium)

      const unitData: any = {
        building_id: buildingId,
        number: `${prefix}${floor}${unit.toString().padStart(2, '0')}`,
        floor: floor,
        size_m2: size,
        price: price,
        status: 'Available'
      }

      if (unitType === 'apartment') {
        unitData.project_id = projectId
      }

      unitsToCreate.push(unitData)
    }
  }

  return supabase
    .from(tableName)
    .insert(unitsToCreate)
}

export async function deleteUnit(unitId: string, unitType: UnitType) {
  const tableName = getTableName(unitType)

  return supabase
    .from(tableName)
    .delete()
    .eq('id', unitId)
}

export async function updateUnitStatus(
  unitId: string,
  unitType: UnitType,
  status: string
) {
  const tableName = getTableName(unitType)

  return supabase
    .from(tableName)
    .update({ status })
    .eq('id', unitId)
}

export async function updateUnitWithSale(
  unitId: string,
  unitType: UnitType,
  buyerName: string
) {
  const tableName = getTableName(unitType)

  return supabase
    .from(tableName)
    .update({
      status: 'Sold',
      buyer_name: buyerName
    })
    .eq('id', unitId)
}

export async function linkGarageToApartment(apartmentId: string, garageId: string) {
  return supabase
    .from('apartments')
    .update({ garage_id: garageId })
    .eq('id', apartmentId)
}

export async function linkRepositoryToApartment(apartmentId: string, repositoryId: string) {
  return supabase
    .from('apartments')
    .update({ repository_id: repositoryId })
    .eq('id', apartmentId)
}

export async function unlinkGarageFromApartment(apartmentId: string) {
  return supabase
    .from('apartments')
    .update({ garage_id: null })
    .eq('id', apartmentId)
}

export async function unlinkRepositoryFromApartment(apartmentId: string) {
  return supabase
    .from('apartments')
    .update({ repository_id: null })
    .eq('id', apartmentId)
}
