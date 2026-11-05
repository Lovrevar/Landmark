import { useCallback, useState, useEffect } from 'react'
import { Apartment, Garage, Repository, Customer } from '../../../../lib/supabase'
import { ProjectWithBuildings, BuildingWithUnits } from '../types'
import * as salesService from '../services/salesService'
import { buildSalesProjects } from '../salesProjectsRollup'

export const useSalesData = () => {
  const [projects, setProjects] = useState<ProjectWithBuildings[]>([])
  const [buildings, setBuildings] = useState<BuildingWithUnits[]>([])
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [garages, setGarages] = useState<Garage[]>([])
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  // Seven queries feed one aggregation. A failure in any of them used to leave every
  // total at 0, which reads as "nothing sold" rather than "we could not load this".
  const [error, setError] = useState<Error | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const projectsData = await salesService.fetchProjects()
      const buildingsData = await salesService.fetchBuildings()
      const apartmentsData = await salesService.fetchApartments()
      const garagesData = await salesService.fetchGarages()
      const repositoriesData = await salesService.fetchRepositories()
      const customersData = await salesService.fetchCustomers()
      const salesData = await salesService.fetchSales()

      const soldApartmentIds = apartmentsData
        .filter(apt => apt.status === 'Sold')
        .map(apt => apt.id)
      const actualPaidMap = await salesService.fetchActualTotalPaidByApartment(soldApartmentIds)

      const rollup = buildSalesProjects({
        projects: projectsData,
        buildings: buildingsData,
        apartments: apartmentsData,
        garages: garagesData,
        repositories: repositoriesData,
        sales: salesData,
        paidByApartment: actualPaidMap,
      })

      setProjects(rollup.projects)
      setBuildings(rollup.buildings)
      setApartments(rollup.apartments)
      setGarages(rollup.garages)
      setRepositories(rollup.repositories)
      setCustomers(customersData)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const dismissError = useCallback(() => setError(null), [])

  return {
    projects,
    buildings,
    apartments,
    garages,
    repositories,
    customers,
    loading,
    error,
    dismissError,
    refetch: fetchData
  }
}
