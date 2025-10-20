import { Customer, Apartment } from '../../../lib/supabase'

export type CustomerCategory = 'interested' | 'reserved' | 'contract' | 'sold'

export interface CustomerWithApartments extends Customer {
  apartments?: Apartment[]
  apartment_count?: number
}

export interface CustomerCounts {
  interested: number
  reserved: number
  contract: number
  sold: number
}
