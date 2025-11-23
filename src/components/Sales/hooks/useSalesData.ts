import { useState, useEffect } from 'react'
import { Apartment, Garage, Repository, Customer } from '../../../lib/supabase'
import { ProjectWithBuildings, BuildingWithUnits } from '../types/salesTypes'
import * as salesService from '../services/salesService'

export const useSalesData = () => {
  const [projects, setProjects] = useState<ProjectWithBuildings[]>([])
  const [buildings, setBuildings] = useState<BuildingWithUnits[]>([])
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [garages, setGarages] = useState<Garage[]>([])
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const projectsData = await salesService.fetchProjects()
      const buildingsData = await salesService.fetchBuildings()
      const apartmentsData = await salesService.fetchApartments()
      const garagesData = await salesService.fetchGarages()
      const repositoriesData = await salesService.fetchRepositories()
      const customersData = await salesService.fetchCustomers()
      const salesData = await salesService.fetchSales()

      const enhancedApartments = apartmentsData.map(apartment => {
        const sale = salesData.find(s => s.apartment_id === apartment.id)
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
            }
          }
        }
        return apartment
      })

      const enhancedGarages = garagesData.map(garage => {
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
        return garage
      })

      const enhancedRepositories = repositoriesData.map(repository => {
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

      setProjects(projectsWithBuildings)
      setBuildings(buildingsWithUnits)
      setApartments(enhancedApartments)
      setGarages(enhancedGarages)
      setRepositories(enhancedRepositories)
      setCustomers(customersData)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return {
    projects,
    buildings,
    apartments,
    garages,
    repositories,
    customers,
    loading,
    refetch: fetchData
  }
}
