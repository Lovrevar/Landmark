import { Project, Building, Apartment, Garage, Repository, Customer } from '../../lib/supabase'

export type UnitType = 'apartment' | 'garage' | 'repository'
export type ViewMode = 'projects' | 'buildings' | 'units'
export type UnitStatus = 'all' | 'available' | 'reserved' | 'sold'

export interface SaleInfo {
  sale_price: number
  payment_method: string
  down_payment: number
  total_paid: number
  remaining_amount: number
  monthly_payment: number
  sale_date: string
  contract_signed: boolean
  buyer_name: string
  buyer_email: string
  buyer_phone: string
}

export interface EnhancedApartment extends Apartment {
  sale_info?: SaleInfo
}

export interface EnhancedGarage extends Garage {
  sale_info?: SaleInfo
}

export interface EnhancedRepository extends Repository {
  sale_info?: SaleInfo
}

export interface BuildingWithUnits extends Building {
  apartments: EnhancedApartment[]
  garages: EnhancedGarage[]
  repositories: EnhancedRepository[]
  total_apartments: number
  total_garages: number
  total_repositories: number
  sold_apartments: number
  sold_garages: number
  sold_repositories: number
  total_revenue: number
}

export interface ProjectWithBuildings extends Project {
  buildings: BuildingWithUnits[]
  total_buildings: number
  total_units: number
  sold_units: number
  total_revenue: number
}

export interface SaleData {
  customer_id: string
  sale_price: number
  payment_method: 'cash' | 'credit' | 'bank_loan' | 'installments'
  down_payment: number
  monthly_payment: number
  sale_date: string
  contract_signed: boolean
  notes: string
  buyer_name: string
  buyer_email: string
  buyer_phone: string
  buyer_address: string
}

export interface BulkCreateConfig {
  floor_start: number
  floor_end: number
  units_per_floor: number
  base_size: number
  size_variation: number
  base_price_per_m2: number
  floor_increment: number
  number_prefix: string
}

export interface NewUnitData {
  building_id: string
  number: string
  floor: number
  size_m2: number
  price: number
}

export interface NewBuildingData {
  name: string
  description: string
  total_floors: number
}
