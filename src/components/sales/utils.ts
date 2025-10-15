import { Apartment, Garage, Repository, Sale } from '../../lib/supabase'
import {
  EnhancedApartment,
  EnhancedGarage,
  EnhancedRepository,
  BuildingWithUnits,
  ProjectWithBuildings,
  BulkCreateConfig,
  SaleInfo
} from './types'

export const enrichUnitsWithSales = (
  apartments: Apartment[],
  garages: Garage[],
  repositories: Repository[],
  sales: (Sale & { customers?: { name: string; surname: string; email: string; phone: string } })[]
): {
  apartmentsE: EnhancedApartment[]
  garagesE: EnhancedGarage[]
  repositoriesE: EnhancedRepository[]
} => {
  const apartmentsE = apartments.map(apartment => {
    const sale = sales.find(s => s.apartment_id === apartment.id)
    if (sale && apartment.status === 'Sold') {
      return {
        ...apartment,
        sale_info: {
          sale_price: sale.sale_price,
          payment_method: sale.payment_method,
          down_payment: sale.down_payment,
          total_paid: sale.total_paid,
          remaining_amount: sale.remaining_amount,
          monthly_payment: sale.monthly_payment,
          sale_date: sale.sale_date,
          contract_signed: sale.contract_signed,
          buyer_name: sale.customers ? `${sale.customers.name} ${sale.customers.surname}` : apartment.buyer_name || 'Unknown',
          buyer_email: sale.customers?.email || '',
          buyer_phone: sale.customers?.phone || ''
        } as SaleInfo
      }
    }
    return apartment
  })

  const garagesE = garages.map(garage => {
    const sale = sales.find(s => s.garage_id === garage.id)
    if (sale && garage.status === 'Sold') {
      return {
        ...garage,
        sale_info: {
          sale_price: sale.sale_price,
          payment_method: sale.payment_method,
          down_payment: sale.down_payment,
          total_paid: sale.total_paid,
          remaining_amount: sale.remaining_amount,
          monthly_payment: sale.monthly_payment,
          sale_date: sale.sale_date,
          contract_signed: sale.contract_signed,
          buyer_name: sale.customers ? `${sale.customers.name} ${sale.customers.surname}` : garage.buyer_name || 'Unknown',
          buyer_email: sale.customers?.email || '',
          buyer_phone: sale.customers?.phone || ''
        } as SaleInfo
      }
    }
    return garage
  })

  const repositoriesE = repositories.map(repository => {
    const sale = sales.find(s => s.repository_id === repository.id)
    if (sale && repository.status === 'Sold') {
      return {
        ...repository,
        sale_info: {
          sale_price: sale.sale_price,
          payment_method: sale.payment_method,
          down_payment: sale.down_payment,
          total_paid: sale.total_paid,
          remaining_amount: sale.remaining_amount,
          monthly_payment: sale.monthly_payment,
          sale_date: sale.sale_date,
          contract_signed: sale.contract_signed,
          buyer_name: sale.customers ? `${sale.customers.name} ${sale.customers.surname}` : repository.buyer_name || 'Unknown',
          buyer_email: sale.customers?.email || '',
          buyer_phone: sale.customers?.phone || ''
        } as SaleInfo
      }
    }
    return repository
  })

  return { apartmentsE, garagesE, repositoriesE }
}

export const buildAggregates = (
  projects: any[],
  buildings: any[],
  apartments: EnhancedApartment[],
  garages: EnhancedGarage[],
  repositories: EnhancedRepository[]
): { buildingsAgg: BuildingWithUnits[]; projectsAgg: ProjectWithBuildings[] } => {
  const buildingsAgg: BuildingWithUnits[] = buildings.map(building => {
    const buildingApartments = apartments.filter(apt => apt.building_id === building.id)
    const buildingGarages = garages.filter(gar => gar.building_id === building.id)
    const buildingRepositories = repositories.filter(rep => rep.building_id === building.id)

    const total_apartments = buildingApartments.length
    const total_garages = buildingGarages.length
    const total_repositories = buildingRepositories.length
    const sold_apartments = buildingApartments.filter(apt => apt.status === 'Sold').length
    const sold_garages = buildingGarages.filter(gar => gar.status === 'Sold').length
    const sold_repositories = buildingRepositories.filter(rep => rep.status === 'Sold').length

    const total_revenue =
      buildingApartments.filter(apt => apt.status === 'Sold').reduce((sum, apt) => sum + apt.price, 0) +
      buildingGarages.filter(gar => gar.status === 'Sold').reduce((sum, gar) => sum + gar.price, 0) +
      buildingRepositories.filter(rep => rep.status === 'Sold').reduce((sum, rep) => sum + rep.price, 0)

    return {
      ...building,
      apartments: buildingApartments,
      garages: buildingGarages,
      repositories: buildingRepositories,
      total_apartments,
      total_garages,
      total_repositories,
      sold_apartments,
      sold_garages,
      sold_repositories,
      total_revenue
    }
  })

  const projectsAgg: ProjectWithBuildings[] = projects.map(project => {
    const projectBuildings = buildingsAgg.filter(b => b.project_id === project.id)
    const total_buildings = projectBuildings.length
    const total_units = projectBuildings.reduce((sum, b) =>
      sum + b.total_apartments + b.total_garages + b.total_repositories, 0)
    const sold_units = projectBuildings.reduce((sum, b) =>
      sum + b.sold_apartments + b.sold_garages + b.sold_repositories, 0)
    const total_revenue = projectBuildings.reduce((sum, b) => sum + b.total_revenue, 0)

    return {
      ...project,
      buildings: projectBuildings,
      total_buildings,
      total_units,
      sold_units,
      total_revenue
    }
  })

  return { buildingsAgg, projectsAgg }
}

export const calculateBulkPreview = (config: BulkCreateConfig) => {
  const floors = config.floor_end - config.floor_start + 1
  const totalUnits = floors * config.units_per_floor
  const avgSize = config.base_size
  const avgPrice = (avgSize * config.base_price_per_m2) +
    ((config.floor_start + config.floor_end) / 2 - config.floor_start) * config.floor_increment
  const totalValue = totalUnits * avgPrice

  return { totalUnits, avgSize, avgPrice, totalValue }
}
