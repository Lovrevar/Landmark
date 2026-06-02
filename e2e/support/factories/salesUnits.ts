import type { SupabaseClient } from '@supabase/supabase-js'

export interface SeededSaleData {
  projectId: string
  projectName: string
  buildingName: string
  apartmentId: string
  apartmentNumber: string
  price: number
  garageId?: string
  garageNumber?: string
}

/**
 * Seeds a project → building → available apartment (optionally with a linked
 * garage) so the complete-sale UI flow has something to sell.
 *
 * The project name carries the namespace; because buildings/apartments/garages
 * and sales all have FK ON DELETE CASCADE up to projects, deleting the
 * namespaced project tears the whole tree down — so registering `projects.name`
 * in cleanup.ts is sufficient teardown. (The buyer customer is namespaced too
 * and cleaned via the already-registered `customers.name`.)
 */
export async function createSellableApartment(
  admin: SupabaseClient,
  opts: { ns: string; price?: number; withLinkedGarage?: boolean },
): Promise<SeededSaleData> {
  const { ns, price = 120000, withLinkedGarage = false } = opts

  const { data: project, error: pErr } = await admin
    .from('projects')
    .insert({ name: `${ns}-proj`, location: 'E2E', start_date: '2026-01-01', budget: 0, status: 'Planning' })
    .select('id')
    .single()
  if (pErr) throw pErr

  const { data: building, error: bErr } = await admin
    .from('buildings')
    .insert({ project_id: project.id, name: `${ns}-bldg`, total_floors: 1 })
    .select('id')
    .single()
  if (bErr) throw bErr

  const { data: apartment, error: aErr } = await admin
    .from('apartments')
    .insert({
      project_id: project.id,
      building_id: building.id,
      number: `${ns}-A1`,
      floor: 1,
      size_m2: 50,
      price,
      status: 'Available',
    })
    .select('id, number')
    .single()
  if (aErr) throw aErr

  let garageId: string | undefined
  let garageNumber: string | undefined
  if (withLinkedGarage) {
    const { data: garage, error: gErr } = await admin
      .from('garages')
      .insert({ building_id: building.id, number: `${ns}-G1`, floor: 0, size_m2: 12, price: 15000, status: 'Available' })
      .select('id, number')
      .single()
    if (gErr) throw gErr

    const { error: linkErr } = await admin
      .from('apartment_garages')
      .insert({ apartment_id: apartment.id, garage_id: garage.id })
    if (linkErr) throw linkErr

    garageId = garage.id
    garageNumber = garage.number
  }

  return {
    projectId: project.id,
    projectName: `${ns}-proj`,
    buildingName: `${ns}-bldg`,
    apartmentId: apartment.id,
    apartmentNumber: apartment.number,
    price,
    garageId,
    garageNumber,
  }
}
