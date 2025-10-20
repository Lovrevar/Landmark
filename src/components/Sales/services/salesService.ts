import { supabase } from '../../../lib/supabase'
import { UnitType, BulkCreateData } from '../types/salesTypes'

export const deleteBuilding = async (buildingId: string) => {
  const { error } = await supabase
    .from('buildings')
    .delete()
    .eq('id', buildingId)

  if (error) throw error
}

export const createBulkBuildings = async (projectId: string, quantity: number) => {
  const buildings = Array.from({ length: quantity }, (_, i) => ({
    name: `Building ${i + 1}`,
    project_id: projectId,
    description: '',
    total_floors: 0
  }))

  const { error } = await supabase
    .from('buildings')
    .insert(buildings)

  if (error) throw error
}

export const createBuilding = async (
  projectId: string,
  name: string,
  description: string,
  totalFloors: number
) => {
  const { error } = await supabase
    .from('buildings')
    .insert({
      name,
      project_id: projectId,
      description,
      total_floors: totalFloors
    })

  if (error) throw error
}

export const createUnit = async (
  unitType: UnitType,
  buildingId: string,
  projectId: string,
  number: string,
  floor: number,
  sizeM2: number,
  price: number
) => {
  const tableName = unitType === 'apartment' ? 'apartments' :
                    unitType === 'garage' ? 'garages' : 'repositories'

  const { error } = await supabase
    .from(tableName)
    .insert({
      number,
      building_id: buildingId,
      project_id: projectId,
      floor,
      size: sizeM2,
      price,
      status: 'available'
    })

  if (error) throw error
}

export const bulkCreateUnits = async (
  unitType: UnitType,
  buildingId: string,
  projectId: string,
  data: BulkCreateData
) => {
  const units = []
  let unitNumber = data.starting_number

  for (let floor = data.start_floor; floor <= data.end_floor; floor++) {
    for (let i = 0; i < data.units_per_floor; i++) {
      units.push({
        number: unitNumber.toString(),
        building_id: buildingId,
        project_id: projectId,
        floor,
        size: data.base_size_m2,
        price: data.base_price,
        status: 'available'
      })
      unitNumber++
    }
  }

  const tableName = unitType === 'apartment' ? 'apartments' :
                    unitType === 'garage' ? 'garages' : 'repositories'

  const { error } = await supabase
    .from(tableName)
    .insert(units)

  if (error) throw error
}

export const deleteUnit = async (unitId: string, unitType: UnitType) => {
  const tableName = unitType === 'apartment' ? 'apartments' :
                    unitType === 'garage' ? 'garages' : 'repositories'

  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq('id', unitId)

  if (error) throw error
}

export const updateUnitStatus = async (unitId: string, unitType: UnitType, newStatus: string) => {
  const tableName = unitType === 'apartment' ? 'apartments' :
                    unitType === 'garage' ? 'garages' : 'repositories'

  const { error } = await supabase
    .from(tableName)
    .update({ status: newStatus })
    .eq('id', unitId)

  if (error) throw error
}

export const linkGarageToApartment = async (apartmentId: string, garageId: string) => {
  const { error } = await supabase
    .from('apartments')
    .update({ garage_id: garageId })
    .eq('id', apartmentId)

  if (error) throw error
}

export const linkRepositoryToApartment = async (apartmentId: string, repositoryId: string) => {
  const { error } = await supabase
    .from('apartments')
    .update({ repository_id: repositoryId })
    .eq('id', apartmentId)

  if (error) throw error
}

export const unlinkGarageFromApartment = async (apartmentId: string) => {
  const { error } = await supabase
    .from('apartments')
    .update({ garage_id: null })
    .eq('id', apartmentId)

  if (error) throw error
}

export const unlinkRepositoryFromApartment = async (apartmentId: string) => {
  const { error } = await supabase
    .from('apartments')
    .update({ repository_id: null })
    .eq('id', apartmentId)

  if (error) throw error
}

export const createCustomer = async (
  name: string,
  surname: string,
  email: string,
  phone: string,
  address: string
) => {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      name,
      surname,
      email,
      phone,
      address,
      category: 'interested'
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export const updateCustomerStatus = async (customerId: string, status: string) => {
  const { error } = await supabase
    .from('customers')
    .update({ category: status })
    .eq('id', customerId)

  if (error) throw error
}

export const createSale = async (
  unitId: string,
  unitType: UnitType,
  customerId: string,
  salePrice: number,
  paymentMethod: string,
  downPayment: number,
  monthlyPayment: number,
  saleDate: string,
  contractSigned: boolean,
  notes: string
) => {
  const { error } = await supabase
    .from('sales')
    .insert({
      apartment_id: unitType === 'apartment' ? unitId : null,
      garage_id: unitType === 'garage' ? unitId : null,
      repository_id: unitType === 'repository' ? unitId : null,
      customer_id: customerId,
      sale_price: salePrice,
      payment_method: paymentMethod,
      down_payment: downPayment,
      monthly_payment: monthlyPayment,
      sale_date: saleDate,
      contract_signed: contractSigned,
      notes
    })

  if (error) throw error
}

export const updateUnitAfterSale = async (unitId: string, unitType: UnitType, buyerName: string) => {
  const tableName = unitType === 'apartment' ? 'apartments' :
                    unitType === 'garage' ? 'garages' : 'repositories'

  const { error } = await supabase
    .from(tableName)
    .update({
      status: 'sold',
      owner_name: buyerName
    })
    .eq('id', unitId)

  if (error) throw error
}
