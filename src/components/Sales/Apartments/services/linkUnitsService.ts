import { supabase } from '../../../../lib/supabase'
import {
  linkGarageToApartment,
  linkRepositoryToApartment,
  unlinkGarageFromApartment,
  unlinkRepositoryFromApartment,
} from '../../SalesProjects/services/salesService'

export interface AvailableUnit {
  id: string
  number: string
  floor: number
  size_m2: number
  price: number
  status: string
}

export async function fetchLinkedUnitIds(apartmentId: string): Promise<{ garageIds: string[]; storageIds: string[] }> {
  const [
    { data: linkedGarageData, error: garageError },
    { data: linkedStorageData, error: storageError },
  ] = await Promise.all([
    supabase
      .from('apartment_garages')
      .select('garage_id')
      .eq('apartment_id', apartmentId),
    supabase
      .from('apartment_repositories')
      .select('repository_id')
      .eq('apartment_id', apartmentId)
  ])
  // An empty result from a failed read would make the save below unlink everything.
  if (garageError) throw garageError
  if (storageError) throw storageError

  return {
    garageIds: linkedGarageData?.map(lg => lg.garage_id) || [],
    storageIds: linkedStorageData?.map(ls => ls.repository_id) || []
  }
}

export async function fetchAvailableUnits(buildingId: string): Promise<{ garages: AvailableUnit[]; storages: AvailableUnit[] }> {
  const [{ data: garagesData, error: garagesError }, { data: storagesData, error: storagesError }] = await Promise.all([
    supabase
      .from('garages')
      .select('*')
      .eq('building_id', buildingId)
      .order('number'),
    supabase
      .from('repositories')
      .select('*')
      .eq('building_id', buildingId)
      .order('number')
  ])

  if (garagesError) throw garagesError
  if (storagesError) throw storagesError

  return {
    garages: (garagesData || []) as AvailableUnit[],
    storages: (storagesData || []) as AvailableUnit[]
  }
}

/**
 * Makes the apartment's linked garages and storage units equal to the given selection.
 *
 * Applied as a diff through the same link/unlink operations the Sales Projects screen uses, so
 * both screens behave alike: a unit linked to a sold apartment becomes Sold with the same buyer,
 * and an unlinked unit leaves the package and goes back to Available. Each step checks its error;
 * the previous delete-everything-then-insert could wipe the links on a failed read.
 */
export async function saveUnitLinks(
  apartmentId: string,
  garageIds: string[],
  storageIds: string[]
): Promise<void> {
  const current = await fetchLinkedUnitIds(apartmentId)

  const garagesToRemove = current.garageIds.filter(id => !garageIds.includes(id))
  const garagesToAdd = garageIds.filter(id => !current.garageIds.includes(id))
  const storagesToRemove = current.storageIds.filter(id => !storageIds.includes(id))
  const storagesToAdd = storageIds.filter(id => !current.storageIds.includes(id))

  for (const id of garagesToRemove) await unlinkGarageFromApartment(apartmentId, id)
  for (const id of storagesToRemove) await unlinkRepositoryFromApartment(apartmentId, id)
  for (const id of garagesToAdd) await linkGarageToApartment(apartmentId, id)
  for (const id of storagesToAdd) await linkRepositoryToApartment(apartmentId, id)
}
