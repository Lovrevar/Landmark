import { supabase } from '../../../lib/supabase'
import type { Project, Building, Apartment, Garage, Repository, Customer } from '../types/salesTypes'

export const fetchProjects = async () => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('name')

  if (error) throw error
  return data as Project[]
}

export const fetchBuildings = async () => {
  const { data, error } = await supabase
    .from('buildings')
    .select('*')
    .order('name')

  if (error) throw error
  return data as Building[]
}

export const fetchApartments = async () => {
  const { data, error } = await supabase
    .from('apartments')
    .select('*')
    .order('number')

  if (error) throw error
  return data as Apartment[]
}

export const fetchGarages = async () => {
  const { data, error } = await supabase
    .from('garages')
    .select('*')
    .order('number')

  if (error) throw error
  return data as Garage[]
}

export const fetchRepositories = async () => {
  const { data, error } = await supabase
    .from('repositories')
    .select('*')
    .order('number')

  if (error) throw error
  return data as Repository[]
}

export const fetchCustomers = async () => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name')

  if (error) throw error
  return data as Customer[]
}

export const fetchSales = async () => {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      *,
      customers(name, surname, email, phone)
    `)

  if (error) throw error
  return data
}

export const createBuilding = async (projectId: string, buildingData: { name: string, description: string, total_floors: number }) => {
  const { error } = await supabase
    .from('buildings')
    .insert({
      project_id: projectId,
      name: buildingData.name,
      description: buildingData.description,
      total_floors: buildingData.total_floors
    })

  if (error) throw error
}

export const createBuildings = async (projectId: string, buildings: Array<{ name: string, description: string, total_floors: number }>) => {
  const buildingsToCreate = buildings.map(b => ({
    project_id: projectId,
    ...b
  }))

  const { error } = await supabase
    .from('buildings')
    .insert(buildingsToCreate)

  if (error) throw error
}

export const deleteBuilding = async (buildingId: string) => {
  const { error } = await supabase
    .from('buildings')
    .delete()
    .eq('id', buildingId)

  if (error) throw error
}

export const createUnit = async (tableName: string, unitData: any) => {
  const { error } = await supabase
    .from(tableName)
    .insert(unitData)

  if (error) throw error
}

export const bulkCreateUnits = async (tableName: string, units: any[]) => {
  const { error } = await supabase
    .from(tableName)
    .insert(units)

  if (error) throw error
}

export const deleteUnit = async (tableName: string, unitId: string) => {
  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq('id', unitId)

  if (error) throw error
}

export const updateUnitStatus = async (tableName: string, unitId: string, status: string) => {
  const { error } = await supabase
    .from(tableName)
    .update({ status })
    .eq('id', unitId)

  if (error) throw error
}

export const linkGarage = async (apartmentId: string, garageId: string) => {
  const { error } = await supabase
    .from('apartments')
    .update({ garage_id: garageId })
    .eq('id', apartmentId)

  if (error) throw error
}

export const linkRepository = async (apartmentId: string, repositoryId: string) => {
  const { error } = await supabase
    .from('apartments')
    .update({ repository_id: repositoryId })
    .eq('id', apartmentId)

  if (error) throw error
}

export const unlinkGarage = async (apartmentId: string) => {
  const { error } = await supabase
    .from('apartments')
    .update({ garage_id: null })
    .eq('id', apartmentId)

  if (error) throw error
}

export const unlinkRepository = async (apartmentId: string) => {
  const { error } = await supabase
    .from('apartments')
    .update({ repository_id: null })
    .eq('id', apartmentId)

  if (error) throw error
}

export const createCustomer = async (customerData: { name: string, surname: string, email: string, phone: string, address: string }) => {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      ...customerData,
      status: 'buyer'
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export const createSale = async (saleData: any) => {
  const { data, error } = await supabase
    .from('sales')
    .insert(saleData)
    .select()
    .single()

  if (error) throw error
  return data
}

export const updateUnitBuyer = async (tableName: string, unitId: string, buyerName: string) => {
  const { error } = await supabase
    .from(tableName)
    .update({
      status: 'Sold',
      buyer_name: buyerName
    })
    .eq('id', unitId)

  if (error) throw error
}
