import type { Apartment, Garage, Repository, Project, Building } from '../../../lib/supabase'
import type { BuildingWithUnits, ProjectWithBuildings } from './types'

/** A `sales` row as `fetchSales` returns it, with its buyer. */
export interface SaleWithCustomer {
  apartment_id: string
  /**
   * `sales` has no `garage_id` or `repository_id` column (one sale per apartment), so the garage
   * and storage lookups below never match and a sold garage never gets `sale_info` (SALES-23).
   */
  garage_id?: string | null
  repository_id?: string | null
  sale_price: number
  payment_method: string
  down_payment: number
  total_paid: number
  remaining_amount: number
  monthly_payment: number
  sale_date: string
  contract_signed: boolean
  customers?: { name: string; surname: string; email?: string | null; phone?: string | null } | null
}

export interface SalesProjectsInput {
  projects: Project[]
  buildings: Building[]
  apartments: Apartment[]
  garages: Garage[]
  repositories: Repository[]
  sales: SaleWithCustomer[]
  /** Payments on each Sold apartment's OUTGOING_SALES invoices (`fetchActualTotalPaidByApartment`). */
  paidByApartment: Map<string, number>
}

type SaleInfo = NonNullable<Apartment['sale_info']>

export interface SalesProjectsRollup {
  projects: ProjectWithBuildings[]
  buildings: BuildingWithUnits[]
  apartments: Apartment[]
  garages: Array<Garage & { sale_info?: SaleInfo }>
  repositories: Array<Repository & { sale_info?: SaleInfo }>
}

/**
 * The Sales projects screen's units, buildings and projects: each Sold unit with its sale and
 * buyer, linked garages and storage shown as Reserved, and the sold counts and revenue per
 * building and project. Pure, so it can be tested; `useSalesData` loads the rows.
 */
export function buildSalesProjects({
  projects: projectsData,
  buildings: buildingsData,
  apartments: apartmentsData,
  garages: garagesData,
  repositories: repositoriesData,
  sales: salesData,
  paidByApartment: actualPaidMap,
}: SalesProjectsInput): SalesProjectsRollup {
  const enhancedApartments = apartmentsData.map(apartment => {
    const sale = salesData.find(s => s.apartment_id === apartment.id)
    if (sale && apartment.status === 'Sold') {
      const actualTotalPaid = actualPaidMap.get(apartment.id) || 0
      return {
        ...apartment,
        sale_info: {
          sale_price: sale.sale_price,
          payment_method: sale.payment_method,
          down_payment: sale.down_payment,
          total_paid: actualTotalPaid,
          remaining_amount: sale.remaining_amount,
          monthly_payment: sale.monthly_payment,
          sale_date: sale.sale_date,
          contract_signed: sale.contract_signed,
          buyer_name: sale.customers ? `${sale.customers.name} ${sale.customers.surname}` : apartment.buyer_name || 'Unknown',
          buyer_email: sale.customers?.email || '',
          buyer_phone: sale.customers?.phone || ''
        }
      }
    }
    return apartment
  })

  const linkedGarageIds = new Set(
    apartmentsData.flatMap(apt => (apt.linked_garages || []).map((g: { id: string }) => g.id))
  )
  const linkedRepositoryIds = new Set(
    apartmentsData.flatMap(apt => (apt.linked_repositories || []).map((r: { id: string }) => r.id))
  )

  const enhancedGarages = garagesData.map((garage): Garage & { sale_info?: SaleInfo } => {
    const isLinked = linkedGarageIds.has(garage.id)
    const sale = salesData.find(s => s.garage_id === garage.id)
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
        }
      }
    }
    if (isLinked && garage.status === 'Available') {
      return { ...garage, status: 'Reserved' as const }
    }
    return garage
  })

  const enhancedRepositories = repositoriesData.map((repository): Repository & { sale_info?: SaleInfo } => {
    const isLinked = linkedRepositoryIds.has(repository.id)
    const sale = salesData.find(s => s.repository_id === repository.id)
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
        }
      }
    }
    if (isLinked && repository.status === 'Available') {
      return { ...repository, status: 'Reserved' as const }
    }
    return repository
  })

  const buildingsWithUnits = buildingsData.map(building => {
    const buildingApartments = enhancedApartments.filter(apt => apt.building_id === building.id)
    const buildingGarages = enhancedGarages.filter(gar => gar.building_id === building.id)
    const buildingRepositories = enhancedRepositories.filter(rep => rep.building_id === building.id)

    const total_apartments = buildingApartments.length
    const total_garages = buildingGarages.length
    const total_repositories = buildingRepositories.length
    const sold_apartments = buildingApartments.filter(apt => apt.status === 'Sold').length
    const sold_garages = buildingGarages.filter(gar => gar.status === 'Sold').length
    const sold_repositories = buildingRepositories.filter(rep => rep.status === 'Sold').length

    const total_revenue =
      buildingApartments.filter(apt => apt.status === 'Sold').reduce((sum, apt) => sum + (apt.sale_info?.total_paid || 0), 0) +
      buildingGarages.filter(gar => gar.status === 'Sold').reduce((sum, gar) => sum + (gar.sale_info?.total_paid || 0), 0) +
      buildingRepositories.filter(rep => rep.status === 'Sold').reduce((sum, rep) => sum + (rep.sale_info?.total_paid || 0), 0)

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

  const projectsWithBuildings = projectsData.map(project => {
    const projectBuildings = buildingsWithUnits.filter(b => b.project_id === project.id)
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

  return {
    projects: projectsWithBuildings,
    buildings: buildingsWithUnits,
    apartments: enhancedApartments,
    garages: enhancedGarages,
    repositories: enhancedRepositories,
  }
}
