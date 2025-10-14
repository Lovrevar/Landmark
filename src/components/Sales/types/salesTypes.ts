import { Project, Building, Apartment, Garage, Repository, Customer, Sale } from '../../../lib/supabase'

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

export interface ApartmentWithSaleInfo extends Apartment {
  sale_info?: SaleInfo
}

export interface GarageWithSaleInfo extends Garage {
  sale_info?: SaleInfo
}

export interface RepositoryWithSaleInfo extends Repository {
  sale_info?: SaleInfo
}

export interface BuildingWithUnits extends Building {
  apartments: ApartmentWithSaleInfo[]
  garages: GarageWithSaleInfo[]
  repositories: RepositoryWithSaleInfo[]
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

export type UnitType = 'apartment' | 'garage' | 'repository'
export type ViewMode = 'projects' | 'buildings' | 'units'

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

export interface BulkCreateParams {
  floor_start: number
  floor_end: number
  units_per_floor: number
  base_size: number
  size_variation: number
  base_price_per_m2: number
  floor_increment: number
  number_prefix: string
}

export interface SaleFormData {
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

export type CustomerMode = 'new' | 'existing'

export { Project, Building, Apartment, Garage, Repository, Customer, Sale }
