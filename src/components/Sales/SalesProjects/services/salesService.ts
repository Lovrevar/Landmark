import { supabase, Apartment } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { UnitType, BulkCreateData, SaleFormData, CustomerMode, UnitForSale, SALES_PROJECT_CATEGORIES } from '../types'
import { summarizeBulkPriceUpdate, type BulkPriceUpdateResult } from '../bulkPriceResult'
import { effectivePricePerM2 } from '../../utils/priceUtils'

export interface CompleteSalePayload {
  unitForSale: UnitForSale
  saleData: SaleFormData
  customerMode: CustomerMode
  existingCustomers: Array<{ id: string; name: string; surname: string }>
}

export const completeSale = async (payload: CompleteSalePayload): Promise<void> => {
  const { unitForSale, saleData, customerMode, existingCustomers } = payload

  // Garages and storage units are sold as part of their apartment's package; UnitsGrid offers
  // "Sell" on apartments only, and the sales table has no column for any other unit.
  if (unitForSale.type !== 'apartment') {
    throw new Error('Only apartments can be sold on their own')
  }

  let newCustomer: { name: string; surname: string; email: string; phone: string; address: string } | null = null
  if (customerMode === 'new') {
    if (!saleData.buyer_name.trim() || !saleData.buyer_email.trim()) {
      throw new Error('Please fill in buyer name and email')
    }
    const [firstName, ...lastNameParts] = saleData.buyer_name.trim().split(' ')
    newCustomer = {
      name: firstName,
      surname: lastNameParts.join(' ') || firstName,
      email: saleData.buyer_email,
      phone: saleData.buyer_phone,
      address: saleData.buyer_address,
    }
  }

  const buyerDisplayName = customerMode === 'existing'
    ? saleData.buyer_name || (() => {
        const found = existingCustomers.find(c => c.id === saleData.customer_id)
        return found ? `${found.name} ${found.surname}` : ''
      })()
    : saleData.buyer_name

  // One transaction: the new customer (if any), the sale row, the apartment and its linked
  // garages/storage units marked Sold, and the customer's status. A failure leaves nothing behind.
  const { data, error } = await supabase.rpc('complete_apartment_sale', {
    p_apartment_id: unitForSale.unit.id,
    p_customer_id: customerMode === 'existing' ? saleData.customer_id : null,
    p_new_customer: newCustomer,
    p_buyer_name: buyerDisplayName,
    p_sale_price: saleData.sale_price,
    p_payment_method: saleData.payment_method,
    p_down_payment: saleData.down_payment,
    p_monthly_payment: saleData.monthly_payment,
    p_sale_date: saleData.sale_date,
    p_contract_signed: saleData.contract_signed,
    p_notes: saleData.notes,
  })
  if (error) throw error

  const result = data as { sale_id: string; customer_id: string; customer_created: boolean }

  if (result.customer_created) {
    logActivity({ action: 'customer.create', entity: 'customer', entityId: result.customer_id, metadata: { severity: 'low', entity_name: buyerDisplayName } })
  } else {
    logActivity({ action: 'customer.update', entity: 'customer', entityId: result.customer_id, metadata: { severity: 'low', changed_fields: ['status'], status: 'buyer' } })
  }
  logActivity({ action: 'sale.create', entity: 'sale', entityId: result.sale_id, metadata: { severity: 'high', entity_name: buyerDisplayName, sale_price: saleData.sale_price, unit_type: 'apartment', unit_id: unitForSale.unit.id } })
  logActivity({ action: 'apartment.update', entity: 'apartment', entityId: unitForSale.unit.id, metadata: { severity: 'low', changed_fields: ['status', 'buyer_name'], status: 'Sold' } })
}

// Sales lists Stambeno and Retail projects, separated by tabs on the screen.
// Interno projects are company-internal and never offered for sale.
export const fetchProjects = async () => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .in('category', SALES_PROJECT_CATEGORIES)
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

export const fetchApartments = async (): Promise<Apartment[]> => {
  const { data, error } = await supabase
    .from('apartments')
    .select(`
      *,
      apartment_garages(garage:garages(id, number, size_m2, price, status)),
      apartment_repositories(repository:repositories(id, number, size_m2, price, status))
    `)
    .order('number')

  if (error) throw error

  return (data || []).map((apt: Record<string, unknown> & { apartment_garages?: { garage: unknown }[]; apartment_repositories?: { repository: unknown }[] }) => ({
    ...apt,
    linked_garages: (apt.apartment_garages || []).map((ag: { garage: unknown }) => ag.garage).filter(Boolean),
    linked_repositories: (apt.apartment_repositories || []).map((ar: { repository: unknown }) => ar.repository).filter(Boolean),
    apartment_garages: undefined,
    apartment_repositories: undefined,
  })) as unknown as Apartment[]
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

export const fetchActualTotalPaidByApartment = async (apartmentIds: string[]): Promise<Map<string, number>> => {
  if (apartmentIds.length === 0) return new Map()

  const { data: invoicesData, error: invoicesError } = await supabase
    .from('accounting_invoices')
    .select('id, apartment_id')
    .in('apartment_id', apartmentIds)
    .eq('invoice_type', 'OUTGOING_SALES')
  if (invoicesError) throw invoicesError

  const paidMap = new Map<string, number>()
  if (!invoicesData || invoicesData.length === 0) return paidMap

  const invoiceIds = invoicesData.map(inv => inv.id)
  const { data: paymentsData, error: paymentsError } = await supabase
    .from('accounting_payments')
    .select('invoice_id, amount')
    .in('invoice_id', invoiceIds)
  if (paymentsError) throw paymentsError

  for (const payment of paymentsData || []) {
    const invoice = invoicesData.find(inv => inv.id === payment.invoice_id)
    if (!invoice?.apartment_id) continue
    const current = paidMap.get(invoice.apartment_id) || 0
    paidMap.set(invoice.apartment_id, current + parseFloat(payment.amount))
  }

  return paidMap
}

/** `nameFor(i)` names building i (1-based) — the caller passes the localised "Zgrada {{n}}". */
export const createBulkBuildings = async (projectId: string, quantity: number, nameFor: (i: number) => string) => {
  const buildingsToCreate = []
  for (let i = 1; i <= quantity; i++) {
    buildingsToCreate.push({
      project_id: projectId,
      name: nameFor(i),
      description: nameFor(i),
      total_floors: 10
    })
  }

  const { error } = await supabase
    .from('buildings')
    .insert(buildingsToCreate)

  if (error) throw error

  logActivity({ action: 'building.bulk_create', entity: 'building', metadata: { severity: 'medium', count: quantity } })
}

export const createBuilding = async (projectId: string, name: string, description: string, totalFloors: number) => {
  const { data: inserted, error } = await supabase
    .from('buildings')
    .insert({
      project_id: projectId,
      name,
      description,
      total_floors: totalFloors
    })
    .select('id')
    .maybeSingle()

  if (error) throw error

  logActivity({ action: 'building.create', entity: 'building', entityId: inserted?.id ?? null, projectId, metadata: { severity: 'medium', entity_name: name } })
}

export const deleteBuilding = async (buildingId: string) => {
  const { error } = await supabase
    .from('buildings')
    .delete()
    .eq('id', buildingId)

  if (error) throw error

  logActivity({ action: 'building.delete', entity: 'building', entityId: buildingId, metadata: { severity: 'high' } })
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

  const unitData: Record<string, unknown> = {
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

  const { data: inserted, error } = await supabase
    .from(tableName)
    .insert(unitData)
    .select('id')
    .maybeSingle()

  if (error) throw error

  logActivity({
    action: `${unitType}.create`,
    entity: unitType,
    entityId: inserted?.id ?? null,
    projectId: unitType === 'apartment' ? projectId : null,
    metadata: { severity: 'medium', entity_name: number, price: totalPrice }
  })
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

      const unitData: Record<string, unknown> = {
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

  logActivity({
    action: `${unitType}.bulk_create`,
    entity: unitType,
    projectId: unitType === 'apartment' ? projectId : null,
    metadata: { severity: 'high', count: unitsToCreate.length, building_id: buildingId }
  })
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

  logActivity({
    action: `${unitType}.delete`,
    entity: unitType,
    entityId: unitId,
    metadata: { severity: 'high' }
  })
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

  logActivity({
    action: `${unitType}.update`,
    entity: unitType,
    entityId: unitId,
    metadata: { severity: 'medium', changed_fields: ['status'], status: newStatus }
  })
}

export const linkGarageToApartment = async (apartmentId: string, garageId: string) => {
  const { data: apartment, error: apartmentError } = await supabase
    .from('apartments')
    .select('buyer_name, status')
    .eq('id', apartmentId)
    .single()

  if (apartmentError) throw apartmentError

  const { error: linkError } = await supabase
    .from('apartment_garages')
    .upsert({
      apartment_id: apartmentId,
      garage_id: garageId
    }, { onConflict: 'apartment_id,garage_id' })

  if (linkError) throw linkError

  if (apartment && apartment.status === 'Sold' && apartment.buyer_name) {
    const { error: updateGarageError } = await supabase
      .from('garages')
      .update({
        status: 'Sold',
        buyer_name: apartment.buyer_name
      })
      .eq('id', garageId)

    if (updateGarageError) throw updateGarageError
  }

  logActivity({
    action: 'apartment.link_garage',
    entity: 'apartment',
    entityId: apartmentId,
    metadata: { severity: 'low', garage_id: garageId, garage_marked_sold: Boolean(apartment && apartment.status === 'Sold' && apartment.buyer_name) }
  })
}

export const linkRepositoryToApartment = async (apartmentId: string, repositoryId: string) => {
  const { data: apartment, error: apartmentError } = await supabase
    .from('apartments')
    .select('buyer_name, status')
    .eq('id', apartmentId)
    .single()

  if (apartmentError) throw apartmentError

  const { error: linkError } = await supabase
    .from('apartment_repositories')
    .upsert({
      apartment_id: apartmentId,
      repository_id: repositoryId
    }, { onConflict: 'apartment_id,repository_id' })

  if (linkError) throw linkError

  if (apartment && apartment.status === 'Sold' && apartment.buyer_name) {
    const { error: updateRepositoryError } = await supabase
      .from('repositories')
      .update({
        status: 'Sold',
        buyer_name: apartment.buyer_name
      })
      .eq('id', repositoryId)

    if (updateRepositoryError) throw updateRepositoryError
  }

  logActivity({
    action: 'apartment.link_repository',
    entity: 'apartment',
    entityId: apartmentId,
    metadata: { severity: 'low', repository_id: repositoryId, repository_marked_sold: Boolean(apartment && apartment.status === 'Sold' && apartment.buyer_name) }
  })
}

export const unlinkGarageFromApartment = async (apartmentId: string, garageId: string) => {
  const { error: unlinkError } = await supabase
    .from('apartment_garages')
    .delete()
    .eq('apartment_id', apartmentId)
    .eq('garage_id', garageId)

  if (unlinkError) throw unlinkError

  const { error: updateGarageError } = await supabase
    .from('garages')
    .update({
      status: 'Available',
      buyer_name: null
    })
    .eq('id', garageId)

  if (updateGarageError) throw updateGarageError

  logActivity({
    action: 'apartment.unlink_garage',
    entity: 'apartment',
    entityId: apartmentId,
    metadata: { severity: 'low', garage_id: garageId }
  })
}

export const unlinkRepositoryFromApartment = async (apartmentId: string, repositoryId: string) => {
  const { error: unlinkError } = await supabase
    .from('apartment_repositories')
    .delete()
    .eq('apartment_id', apartmentId)
    .eq('repository_id', repositoryId)

  if (unlinkError) throw unlinkError

  const { error: updateRepositoryError } = await supabase
    .from('repositories')
    .update({
      status: 'Available',
      buyer_name: null
    })
    .eq('id', repositoryId)

  if (updateRepositoryError) throw updateRepositoryError

  logActivity({
    action: 'apartment.unlink_repository',
    entity: 'apartment',
    entityId: apartmentId,
    metadata: { severity: 'low', repository_id: repositoryId }
  })
}

/**
 * Adjusts the price per m² of every selected unit that is not sold.
 *
 * Returns a report rather than throwing on a partial failure: some rows will have been
 * written, and the caller has to refetch and say "n of m" instead of implying nothing
 * happened. A failure to even read the units still throws — there is nothing to report then.
 */
export const bulkUpdateUnitPrice = async (
  unitIds: string[],
  unitType: UnitType,
  adjustmentType: 'increase' | 'decrease',
  adjustmentValue: number
): Promise<BulkPriceUpdateResult> => {
  let tableName = ''
  if (unitType === 'apartment') tableName = 'apartments'
  else if (unitType === 'garage') tableName = 'garages'
  else if (unitType === 'repository') tableName = 'repositories'

  // Sold units keep the price they were sold at: they are skipped here, and
  // re-checked on each update in case a unit was sold in the meantime
  const { data: units, error: fetchError } = await supabase
    .from(tableName)
    .select('id, size_m2, price, price_per_m2')
    .in('id', unitIds)
    .neq('status', 'Sold')

  if (fetchError) throw fetchError
  // Every selected unit was already sold — nothing to do, and not a failure.
  if (!units || units.length === 0) return summarizeBulkPriceUpdate(unitIds.length, [])

  const updates = units.map((unit: { id: string; size_m2: number; price: number; price_per_m2: number | null }) => {
    const currentPricePerM2 = effectivePricePerM2(unit)
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
      .neq('status', 'Sold')
      .select('id')
  })

  const results = await Promise.all(updates)
  const outcome = summarizeBulkPriceUpdate(unitIds.length, results)

  if (outcome.updated > 0) {
    logActivity({ action: `${unitType}.bulk_price_update`, entity: unitType, metadata: { severity: 'high', count: outcome.updated, failed: outcome.failed, adjustment_type: adjustmentType, adjustment_value: adjustmentValue } })
  }

  return outcome
}
