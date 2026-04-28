import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'

interface ApartmentRowData {
  building_id: string
  number: string
  floor: number
  size_m2: number
  price: number
  price_per_m2: number
  entrance: string
  type: string
  rooms: string
  area_open: number
  area_open_coef: number
  datum_potpisa_predugovora: string | null
  contract_payment_type: 'credit' | 'installments' | null
  kapara_10_posto: number | null
  rata_1_ab_konstrukcija_30: number | null
  rata_2_postava_stolarije_20: number | null
  rata_3_obrtnicki_radovi_20: number | null
  rata_4_uporabna_20: number | null
  kredit_etaziranje_90: number | null
  parking_label: string | null
  parking_m2: number | null
  parking_price: number | null
  storage_label: string | null
  storage_m2: number | null
  storage_price: number | null
}

export interface ImportRowResult {
  garageCreated: boolean
  storageCreated: boolean
}

export async function importApartmentRow(row: ApartmentRowData, projectId: string): Promise<ImportRowResult> {
  const { data: existingApt } = await supabase
    .from('apartments')
    .select('id')
    .eq('project_id', projectId)
    .eq('building_id', row.building_id)
    .eq('number', row.number)
    .maybeSingle()

  const apartmentData = {
    project_id: projectId,
    building_id: row.building_id,
    number: row.number,
    floor: row.floor,
    size_m2: row.size_m2,
    price: row.price,
    price_per_m2: row.price_per_m2,
    status: 'Available',
    ulaz: row.entrance || null,
    tip_stana: row.type || null,
    sobnost: row.rooms ? parseInt(String(row.rooms)) || null : null,
    povrsina_otvoreno: row.area_open || null,
    povrsina_ot_sa_koef: row.area_open_coef || null,
    datum_potpisa_predugovora: row.datum_potpisa_predugovora,
    contract_payment_type: row.contract_payment_type,
    kapara_10_posto: row.kapara_10_posto,
    rata_1_ab_konstrukcija_30: row.rata_1_ab_konstrukcija_30,
    rata_2_postava_stolarije_20: row.rata_2_postava_stolarije_20,
    rata_3_obrtnicki_radovi_20: row.rata_3_obrtnicki_radovi_20,
    rata_4_uporabna_20: row.rata_4_uporabna_20,
    kredit_etaziranje_90: row.kredit_etaziranje_90
  }

  let apartmentId: string

  if (existingApt) {
    const { error } = await supabase.from('apartments').update(apartmentData).eq('id', existingApt.id)
    if (error) throw error
    apartmentId = existingApt.id
  } else {
    const { data: newApt, error } = await supabase.from('apartments').insert(apartmentData).select('id').single()
    if (error) throw error
    apartmentId = newApt.id
  }

  let garageCreated = false
  if (row.parking_label && row.parking_m2 && row.parking_price) {
    const { data: existingGarage } = await supabase
      .from('garages')
      .select('id')
      .eq('building_id', row.building_id)
      .eq('number', row.parking_label)
      .maybeSingle()

    let garageId: string
    if (existingGarage) {
      garageId = existingGarage.id
      await supabase.from('garages').update({ size_m2: row.parking_m2, price: row.parking_price, floor: row.floor }).eq('id', garageId)
    } else {
      const { data: newGarage, error } = await supabase
        .from('garages')
        .insert({ building_id: row.building_id, number: row.parking_label, size_m2: row.parking_m2, price: row.parking_price, floor: row.floor, status: 'Available' })
        .select('id')
        .single()
      if (error) throw error
      garageId = newGarage.id
    }

    await supabase.from('apartment_garages').upsert({ apartment_id: apartmentId, garage_id: garageId }, { onConflict: 'apartment_id,garage_id' })
    garageCreated = true
  }

  let storageCreated = false
  if (row.storage_label && row.storage_m2 && row.storage_price) {
    const { data: existingStorage } = await supabase
      .from('repositories')
      .select('id')
      .eq('building_id', row.building_id)
      .eq('number', row.storage_label)
      .maybeSingle()

    let storageId: string
    if (existingStorage) {
      storageId = existingStorage.id
      await supabase.from('repositories').update({ size_m2: row.storage_m2, price: row.storage_price, floor: row.floor }).eq('id', storageId)
    } else {
      const { data: newStorage, error } = await supabase
        .from('repositories')
        .insert({ building_id: row.building_id, number: row.storage_label, size_m2: row.storage_m2, price: row.storage_price, floor: row.floor, status: 'Available' })
        .select('id')
        .single()
      if (error) throw error
      storageId = newStorage.id
    }

    await supabase.from('apartment_repositories').upsert({ apartment_id: apartmentId, repository_id: storageId }, { onConflict: 'apartment_id,repository_id' })
    storageCreated = true
  }

  logActivity({ action: 'apartment.import_excel', entity: 'apartment', entityId: apartmentId, projectId, metadata: { severity: 'high', entity_name: row.number, garage_created: garageCreated, storage_created: storageCreated } })

  return { garageCreated, storageCreated }
}
