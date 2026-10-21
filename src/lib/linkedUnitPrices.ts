import { supabase } from './supabase'
import { fetchAllRows } from './fetchAllRows'
import { linkedPricesByApartment, type LinkedPrices } from '../utils/salesFigures'

type GarageLink = { apartment_id: string; garages: { price: number | null } | null }
type StorageLink = { apartment_id: string; repositories: { price: number | null } | null }

/**
 * The list prices of the garages and storage units linked to each apartment, which a sale's
 * package value adds to its sale price (`contractedSales`, Step 7 item 2). The links live in
 * `apartment_garages` and `apartment_repositories`; `apartments` has no garage or storage column
 * (GEN-26). Throws on a failed read: a package without its garages must not pass for the whole one.
 */
export async function fetchLinkedPrices(): Promise<LinkedPrices> {
  const [garageLinks, storageLinks] = await Promise.all([
    fetchAllRows<GarageLink>((from, to) =>
      supabase.from('apartment_garages').select('apartment_id, garages(price)').order('id').range(from, to).returns<GarageLink[]>()),
    fetchAllRows<StorageLink>((from, to) =>
      supabase.from('apartment_repositories').select('apartment_id, repositories(price)').order('id').range(from, to).returns<StorageLink[]>()),
  ])
  return linkedPricesByApartment([
    ...garageLinks.map(link => ({ apartment_id: link.apartment_id, price: link.garages?.price })),
    ...storageLinks.map(link => ({ apartment_id: link.apartment_id, price: link.repositories?.price })),
  ])
}
