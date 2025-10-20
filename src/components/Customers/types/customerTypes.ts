import { Customer } from '../../../lib/supabase'

export interface CustomerWithApartments extends Customer {
  apartments?: Array<{
    id: string
    number: string
    floor: number
    size_m2: number
    project_name: string
    sale_price: number
    sale_date: string
  }>
}

export type CustomerCategory = 'interested' | 'hot_lead' | 'negotiating' | 'buyer' | 'backed_out'

export interface CategoryInfo {
  id: CustomerCategory
  label: string
  icon: any
  color: string
  count: number
}

export interface CustomerCounts {
  interested: number
  hot_lead: number
  negotiating: number
  buyer: number
  backed_out: number
}
