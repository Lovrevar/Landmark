import { Project, Building, Apartment, Garage, Repository, Customer } from '../../../lib/supabase'

export interface BuildingWithUnits extends Building {
  apartments: Apartment[]
  garages: Garage[]
  repositories: Repository[]
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
export type FilterStatus = 'all' | 'available' | 'reserved' | 'sold'
export type CustomerMode = 'new' | 'existing'

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
  price_per_m2: number
}

export interface BulkCreateData {
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

export interface UnitForSale {
  unit: Apartment | Garage | Repository
  type: UnitType
}

export interface BulkPreview {
  totalUnits: number
  avgSize: number
  avgPrice: number
  totalValue: number
}

export type OnSelectProjectCallback = (project: ProjectWithBuildings) => void
export type OnSelectBuildingCallback = (building: BuildingWithUnits) => void
export type OnDeleteBuildingCallback = (buildingId: string) => void
export type OnDeleteUnitCallback = (unitId: string, unitType: UnitType) => void
export type OnUpdateUnitStatusCallback = (unitId: string, unitType: UnitType, status: string) => void
export type OnSellUnitCallback = (unit: Apartment | Garage | Repository, unitType: UnitType) => void
export type OnLinkApartmentCallback = (apartment: Apartment) => void
