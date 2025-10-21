import { supabase } from '../../../lib/supabase'
import { UnitType, BulkCreateData } from '../types/salesTypes'

export const fetchProjects = async () => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('name')

  if (error) throw error
  return data || []
}

export const fetchBuildings = async () => {
  const { data, error } = await supabase
    .from('buildings')
    .select('*')
    .order('name')

  if (error) throw error
  return data || []
}

export const fetchApartments = async () => {
  const { data, error } = await supabase
    .from('apartments')
    .select('*')
    .order('number')

  if (error) throw error
  return data || []
}

export const fetchGarages = async () => {
  const { data, error } = await supabase
    .from('garages')
    .select('*')
    .order('number')

  if (error) throw error
  return data || []
}

export const fetchRepositories = async () => {
  const { data, error } = await supabase
    .from('repositories')
    .select('*')
    .order('number')

  if (error) throw error
  return data || []
}

export const fetchCustomers = async () => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name')

  if (error) throw error
  return data || []
}

export const fetchSales = async () => {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      *,
      customers(name, surname, email, phone)
    `)

  if (error) throw error
  return data || []
}

export const createBulkBuildings = async (projectId: string, quantity: number) => {
  const buildingsToCreate = []
  for (let i = 1; i <= quantity; i++) {
    buildingsToCreate.push({
      project_id: projectId,
      name: `Building ${i}`,
      description: `Building ${i}`,
      total_floors: 10
    })
  }

  const { error } = await supabase
    .from('buildings')
    .insert(buildingsToCreate)

  if (error) throw error
}

export const createBuilding = async (projectId: string, name: string, description: string, totalFloors: number) => {
  const { error } = await supabase
    .from('buildings')
    .insert({
      project_id: projectId,
      name,
      description,
      total_floors: totalFloors
    })

  if (error) throw error
}

export const deleteBuilding = async (buildingId: string) => {
  const { error } = await supabase
    .from('buildings')
    .delete()
    .eq('id', buildingId)

  if (error) throw error
}

export const createUnit = async (
  unitType: UnitType,
  buildingId: string,
  projectId: string,
  number: string,
  floor: number,
  sizeM2: number,
  pricePerM2: number
) => {
  let tableName = ''
  if (unitType === 'apartment') tableName = 'apartments'
  else if (unitType === 'garage') tableName = 'garages'
  else if (unitType === 'repository') tableName = 'repositories'

  const totalPrice = sizeM2 * pricePerM2

  const unitData: any = {
    building_id: buildingId,
    number,
    floor,
    size_m2: sizeM2,
    price: totalPrice,
    price_per_m2: pricePerM2,
    status: 'Available'
  }

  if (unitType === 'apartment') {
    unitData.project_id = projectId
  }

  const { error } = await supabase
    .from(tableName)
    .insert(unitData)

  if (error) throw error
}

export const bulkCreateUnits = async (
  unitType: UnitType,
  buildingId: string,
  projectId: string,
  bulkData: BulkCreateData
) => {
  let tableName = ''
  if (unitType === 'apartment') tableName = 'apartments'
  else if (unitType === 'garage') tableName = 'garages'
  else if (unitType === 'repository') tableName = 'repositories'

  const prefix = bulkData.number_prefix || (
    unitType === 'apartment' ? 'A' :
    unitType === 'garage' ? 'G' : 'R'
  )

  const unitsToCreate = []

  for (let floor = bulkData.floor_start; floor <= bulkData.floor_end; floor++) {
    for (let unit = 1; unit <= bulkData.units_per_floor; unit++) {
      const sizeVariation = (Math.random() - 0.5) * bulkData.size_variation
      const size = Math.round(bulkData.base_size + sizeVariation)
      const floorPremium = (floor - bulkData.floor_start) * bulkData.floor_increment
      const pricePerM2 = bulkData.base_price_per_m2 + (floorPremium / size)
      const price = Math.round(size * pricePerM2)

      const unitData: any = {
        building_id: buildingId,
        number: `${prefix}${floor}${unit.toString().padStart(2, '0')}`,
        floor: floor,
        size_m2: size,
        price: price,
        price_per_m2: Math.round(pricePerM2 * 100) / 100,
        status: 'Available'
      }

      if (unitType === 'apartment') {
        unitData.project_id = projectId
      }

      unitsToCreate.push(unitData)
    }
  }

  const { error } = await supabase
    .from(tableName)
    .insert(unitsToCreate)

  if (error) throw error
}

export const deleteUnit = async (unitId: string, unitType: UnitType) => {
  let tableName = ''
  if (unitType === 'apartment') tableName = 'apartments'
  else if (unitType === 'garage') tableName = 'garages'
  else if (unitType === 'repository') tableName = 'repositories'

  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq('id', unitId)

  if (error) throw error
}

export const updateUnitStatus = async (unitId: string, unitType: UnitType, newStatus: string) => {
  let tableName = ''
  if (unitType === 'apartment') tableName = 'apartments'
  else if (unitType === 'garage') tableName = 'garages'
  else if (unitType === 'repository') tableName = 'repositories'

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
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
  address: string
) => {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      name: firstName,
      surname: lastName,
      email,
      phone: phone || '',
      address: address || '',
      status: 'buyer'
    })
    .select()
    .single()

  if (error) throw error
  return data
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
  const remaining_amount = salePrice - downPayment
  const unitIdField = unitType === 'apartment' ? 'apartment_id'
                    : unitType === 'garage' ? 'garage_id'
                    : 'repository_id'

  const { data, error } = await supabase
    .from('sales')
    .insert({
      [unitIdField]: unitId,
      customer_id: customerId,
      sale_price: salePrice,
      payment_method: paymentMethod,
      down_payment: downPayment,
      total_paid: downPayment,
      remaining_amount: remaining_amount,
      monthly_payment: monthlyPayment,
      sale_date: saleDate,
      contract_signed: contractSigned,
      notes: notes
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export const updateCustomerStatus = async (customerId: string, status: string) => {
  const { error } = await supabase
    .from('customers')
    .update({ status })
    .eq('id', customerId)

  if (error) throw error
}

export const updateUnitAfterSale = async (
  unitId: string,
  unitType: UnitType,
  buyerName: string
) => {
  let tableName = ''
  if (unitType === 'apartment') tableName = 'apartments'
  else if (unitType === 'garage') tableName = 'garages'
  else if (unitType === 'repository') tableName = 'repositories'

  const { error } = await supabase
    .from(tableName)
    .update({
      status: 'Sold',
      buyer_name: buyerName
    })
    .eq('id', unitId)

  if (error) throw error
}

export const bulkUpdateUnitPrice = async (
  unitIds: string[],
  unitType: UnitType,
  adjustmentType: 'increase' | 'decrease',
  adjustmentValue: number
) => {
  let tableName = ''
  if (unitType === 'apartment') tableName = 'apartments'
  else if (unitType === 'garage') tableName = 'garages'
  else if (unitType === 'repository') tableName = 'repositories'

  const { data: units, error: fetchError } = await supabase
    .from(tableName)
    .select('id, size_m2, price_per_m2')
    .in('id', unitIds)

  if (fetchError) throw fetchError
  if (!units || units.length === 0) return

  const updates = units.map((unit: any) => {
    const currentPricePerM2 = unit.price_per_m2 || 0
    const newPricePerM2 = adjustmentType === 'increase'
      ? currentPricePerM2 + adjustmentValue
      : Math.max(0, currentPricePerM2 - adjustmentValue)

    const newTotalPrice = Math.round(unit.size_m2 * newPricePerM2 * 100) / 100

    return supabase
      .from(tableName)
      .update({
        price_per_m2: Math.round(newPricePerM2 * 100) / 100,
        price: newTotalPrice
      })
      .eq('id', unit.id)
  })

  const results = await Promise.all(updates)

  const errors = results.filter(result => result.error)
  if (errors.length > 0) {
    throw new Error(`Failed to update ${errors.length} units`)
  }
}
