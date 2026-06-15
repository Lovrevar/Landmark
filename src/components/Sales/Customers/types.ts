import { ComponentType } from 'react'
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
    type?: string
    price?: number
    total_paid?: number
    garage?: { number: string; price: number } | null
    repository?: { number: string; price: number } | null
  }>
}

export type CustomerCategory = 'interested' | 'lead' | 'buyer'

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
