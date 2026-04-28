import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'

export interface AvailableUnit {
  id: string
  number: string
  floor: number
  size_m2: number
  price: number
  status: string
}

export async function fetchLinkedUnitIds(apartmentId: string): Promise<{ garageIds: string[]; storageIds: string[] }> {
  const [{ data: linkedGarageData }, { data: linkedStorageData }] = await Promise.all([
    supabase
      .from('apartment_garages')
      .select('garage_id')
      .eq('apartment_id', apartmentId),
    supabase
      .from('apartment_repositories')
      .select('repository_id')
      .eq('apartment_id', apartmentId)
  ])

  return {
    garageIds: linkedGarageData?.map(lg => lg.garage_id) || [],
    storageIds: linkedStorageData?.map(ls => ls.repository_id) || []
  }
}

export async function fetchAvailableUnits(buildingId: string): Promise<{ garages: AvailableUnit[]; storages: AvailableUnit[] }> {
  const [{ data: garagesData }, { data: storagesData }] = await Promise.all([
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

  return {
    garages: (garagesData || []) as AvailableUnit[],
    storages: (storagesData || []) as AvailableUnit[]
  }
}

export async function saveUnitLinks(
  apartmentId: string,
  garageIds: string[],
  storageIds: string[]
): Promise<void> {
  await supabase
    .from('apartment_garages')
    .delete()
    .eq('apartment_id', apartmentId)

  await supabase
    .from('apartment_repositories')
    .delete()
    .eq('apartment_id', apartmentId)

  if (garageIds.length > 0) {
    const garageLinks = garageIds.map(garageId => ({
      apartment_id: apartmentId,
      garage_id: garageId
    }))
    const { error: garageError } = await supabase
      .from('apartment_garages')
      .insert(garageLinks)
    if (garageError) throw garageError
  }

  if (storageIds.length > 0) {
    const storageLinks = storageIds.map(storageId => ({
      apartment_id: apartmentId,
      repository_id: storageId
    }))
    const { error: storageError } = await supabase
      .from('apartment_repositories')
      .insert(storageLinks)
    if (storageError) throw storageError
  }

  if (garageIds.length > 0) {
    logActivity({ action: 'apartment.link_garage', entity: 'apartment', entityId: apartmentId, metadata: { severity: 'low', count: garageIds.length } })
  }
  if (storageIds.length > 0) {
    logActivity({ action: 'apartment.link_repository', entity: 'apartment', entityId: apartmentId, metadata: { severity: 'low', count: storageIds.length } })
  }
}
