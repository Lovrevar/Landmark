import { ComponentType } from 'react'
import { Customer } from '../../../lib/supabase'

export interface CustomerWithApartments extends Customer {
  apartments?: Array<{
    id: string
    number: string
    floor: number
    size_m2: number
    project_id: string
    project_name: string
    sale_price: number
    sale_date: string
    type?: string
    price?: number
    total_paid?: number
    /** Every garage and storage unit linked to the apartment and sold with it. */
    garages?: { id: string; number: string; price: number }[]
    repositories?: { id: string; number: string; price: number }[]
  }>
}

export type CustomerCategory = 'interested' | 'lead' | 'buyer'

/** Minimal project shape used by the customer form, filter and card. */
export interface ProjectOption {
  id: string
  name: string
}

export interface CategoryInfo {
  id: CustomerCategory
  label: string
  icon: ComponentType<{ className?: string }>
  color: string
  count: number
}

export interface CustomerCounts {
  interested: number
  lead: number
  buyer: number
}
