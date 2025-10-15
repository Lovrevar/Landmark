import { useCallback, useEffect, useState } from 'react'
import * as ProjectsRepo from '../services/projects.repo'
import * as BuildingsRepo from '../services/buildings.repo'
import * as UnitsRepo from '../services/units.repo'
import * as CustomersRepo from '../services/customers.repo'
import * as SalesRepo from '../services/sales.repo'
import { enrichUnitsWithSales, buildAggregates } from '../utils'
import { ProjectWithBuildings, BuildingWithUnits, EnhancedApartment, EnhancedGarage, EnhancedRepository } from '../types'
import { Customer } from '../../../lib/supabase'

interface SalesDataState {
  projects: ProjectWithBuildings[]
  buildings: BuildingWithUnits[]
  apartments: EnhancedApartment[]
  garages: EnhancedGarage[]
  repositories: EnhancedRepository[]
  customers: Customer[]
  loading: boolean
  error: unknown
}

export function useSalesData() {
  const [state, setState] = useState<SalesDataState>({
    projects: [],
    buildings: [],
    apartments: [],
    garages: [],
    repositories: [],
    customers: [],
    loading: true,
    error: null
  })

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }))
    try {
      const [
        projectsRes,
        buildingsRes,
        apartmentsRes,
        garagesRes,
        repositoriesRes,
        customersRes,
        salesRes
      ] = await Promise.all([
        ProjectsRepo.listProjects(),
        BuildingsRepo.listBuildings(),
        UnitsRepo.listApartments(),
        UnitsRepo.listGarages(),
        UnitsRepo.listRepositories(),
        CustomersRepo.listCustomers(),
        SalesRepo.listSales()
      ])

      if (projectsRes.error) throw projectsRes.error
      if (buildingsRes.error) throw buildingsRes.error
      if (apartmentsRes.error) throw apartmentsRes.error
      if (garagesRes.error) throw garagesRes.error
      if (repositoriesRes.error) throw repositoriesRes.error
      if (customersRes.error) throw customersRes.error
      if (salesRes.error) throw salesRes.error

      const { apartmentsE, garagesE, repositoriesE } = enrichUnitsWithSales(
        apartmentsRes.data || [],
        garagesRes.data || [],
        repositoriesRes.data || [],
        salesRes.data || []
      )

      const { buildingsAgg, projectsAgg } = buildAggregates(
        projectsRes.data || [],
        buildingsRes.data || [],
        apartmentsE,
        garagesE,
        repositoriesE
      )

      setState({
        projects: projectsAgg,
        buildings: buildingsAgg,
        apartments: apartmentsE,
        garages: garagesE,
        repositories: repositoriesE,
        customers: customersRes.data || [],
        loading: false,
        error: null
      })
    } catch (error) {
      console.error('Error fetching sales data:', error)
      setState(prev => ({ ...prev, loading: false, error }))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    ...state,
    refresh
  }
}
