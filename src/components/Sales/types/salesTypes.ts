import { Project, Building, Apartment, Garage, Repository, Customer } from '../../../lib/supabase'

export type ViewMode = 'projects' | 'buildings' | 'units'
export type UnitType = 'apartment' | 'garage' | 'repository'
export type FilterStatus = 'all' | 'available' | 'reserved' | 'sold'
export type CustomerMode = 'existing' | 'new'

export interface ProjectWithBuildings extends Project {
  buildings?: Building[]
  building_count?: number
}

export interface BuildingWithUnits extends Building {
  apartments?: Apartment[]
  garages?: Garage[]
  repositories?: Repository[]
}

export interface UnitForSale {
  unit: any
  type: UnitType
}

export interface SaleFormData {
  customer_id: string
  buyer_name: string
  buyer_email: string
  buyer_phone: string
  buyer_address: string
  sale_price: number
  payment_method: string
  down_payment: number
  monthly_payment: number
  sale_date: string
  contract_signed: boolean
  notes: string
}

export interface BuildingFormData {
  name: string
  description: string
  total_floors: number
}

export interface UnitFormData {
  building_id: string
  number: string
  floor: number
  size_m2: number
  price: number
}

export interface BulkCreateData {
  start_floor: number
  end_floor: number
  units_per_floor: number
  starting_number: number
  base_size_m2: number
  base_price: number
}
