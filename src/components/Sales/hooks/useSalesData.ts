import { useState, useEffect } from 'react'
import * as salesService from '../services/salesService'
import type {
  ProjectWithBuildings,
  BuildingWithUnits,
  ApartmentWithSaleInfo,
  GarageWithSaleInfo,
  RepositoryWithSaleInfo,
  Customer,
  UnitType,
  BuildingFormData,
  BulkCreateParams,
  SaleFormData,
  CustomerMode
} from '../types/salesTypes'

export const useSalesData = (
  selectedProject: ProjectWithBuildings | null,
  selectedBuilding: BuildingWithUnits | null,
  setSelectedProject: (project: ProjectWithBuildings | null) => void,
  setSelectedBuilding: (building: BuildingWithUnits | null) => void
) => {
  const [projects, setProjects] = useState<ProjectWithBuildings[]>([])
  const [buildings, setBuildings] = useState<BuildingWithUnits[]>([])
  const [apartments, setApartments] = useState<ApartmentWithSaleInfo[]>([])
  const [garages, setGarages] = useState<GarageWithSaleInfo[]>([])
  const [repositories, setRepositories] = useState<RepositoryWithSaleInfo[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [projectsData, buildingsData, apartmentsData, garagesData, repositoriesData, customersData, salesData] = await Promise.all([
        salesService.fetchProjects(),
        salesService.fetchBuildings(),
        salesService.fetchApartments(),
        salesService.fetchGarages(),
        salesService.fetchRepositories(),
        salesService.fetchCustomers(),
        salesService.fetchSales()
      ])

      const enhancedApartments = (apartmentsData || []).map(apartment => {
        const sale = (salesData || []).find(s => s.apartment_id === apartment.id)
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

      const enhancedGarages = (garagesData || []).map(garage => {
        const sale = (salesData || []).find(s => s.garage_id === garage.id)
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

      const enhancedRepositories = (repositoriesData || []).map(repository => {
        const sale = (salesData || []).find(s => s.repository_id === repository.id)
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

      const buildingsWithUnits = (buildingsData || []).map(building => {
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

      const projectsWithBuildings = (projectsData || []).map(project => {
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
      setCustomers(customersData || [])

      if (selectedProject) {
        const updatedProject = projectsWithBuildings.find(p => p.id === selectedProject.id)
        if (updatedProject) {
          setSelectedProject(updatedProject)
        }
      }

      if (selectedBuilding) {
        const updatedBuilding = buildingsWithUnits.find(b => b.id === selectedBuilding.id)
        if (updatedBuilding) {
          setSelectedBuilding(updatedBuilding)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const createBuildingAction = async (projectId: string, buildingData: BuildingFormData) => {
    if (!buildingData.name.trim()) {
      alert('Please fill in required fields')
      return
    }

    try {
      await salesService.createBuilding(projectId, buildingData)
      await fetchData()
    } catch (error) {
      console.error('Error creating building:', error)
      alert('Error creating building. Please try again.')
    }
  }

  const createBuildingsAction = async (projectId: string, quantity: number) => {
    if (quantity < 1 || quantity > 20) {
      alert('Please enter a valid quantity (1-20)')
      return
    }

    try {
      const buildingsToCreate = []
      for (let i = 1; i <= quantity; i++) {
        buildingsToCreate.push({
          name: `Building ${i}`,
          description: `Building ${i}`,
          total_floors: 10
        })
      }

      await salesService.createBuildings(projectId, buildingsToCreate)
      await fetchData()
    } catch (error) {
      console.error('Error creating buildings:', error)
      alert('Error creating buildings. Please try again.')
    }
  }

  const deleteBuildingAction = async (buildingId: string) => {
    if (!confirm('Are you sure you want to delete this building? All units inside will also be deleted.')) return

    try {
      await salesService.deleteBuilding(buildingId)
      await fetchData()
    } catch (error) {
      console.error('Error deleting building:', error)
      alert('Error deleting building.')
    }
  }

  const createUnitAction = async (unitType: UnitType, buildingId: string, projectId: string, unitData: { number: string, floor: number, size_m2: number, price: number }) => {
    if (!unitData.number.trim()) {
      alert('Please fill in required fields')
      return
    }

    try {
      let tableName = ''
      if (unitType === 'apartment') tableName = 'apartments'
      else if (unitType === 'garage') tableName = 'garages'
      else if (unitType === 'repository') tableName = 'repositories'

      const unitDataToInsert: any = {
        building_id: buildingId,
        number: unitData.number,
        floor: unitData.floor,
        size_m2: unitData.size_m2,
        price: unitData.price,
        status: 'Available'
      }

      if (unitType === 'apartment') {
        unitDataToInsert.project_id = projectId
      }

      await salesService.createUnit(tableName, unitDataToInsert)
      await fetchData()
    } catch (error) {
      console.error('Error creating unit:', error)
      alert('Error creating unit. Please try again.')
    }
  }

  const bulkCreateUnitsAction = async (unitType: UnitType, buildingId: string, projectId: string, bulkParams: BulkCreateParams) => {
    try {
      const unitsToCreate = []

      let tableName = ''
      if (unitType === 'apartment') tableName = 'apartments'
      else if (unitType === 'garage') tableName = 'garages'
      else if (unitType === 'repository') tableName = 'repositories'

      const prefix = bulkParams.number_prefix || (
        unitType === 'apartment' ? 'A' :
        unitType === 'garage' ? 'G' : 'R'
      )

      for (let floor = bulkParams.floor_start; floor <= bulkParams.floor_end; floor++) {
        for (let unit = 1; unit <= bulkParams.units_per_floor; unit++) {
          const sizeVariation = (Math.random() - 0.5) * bulkParams.size_variation
          const size = Math.round(bulkParams.base_size + sizeVariation)
          const floorPremium = (floor - bulkParams.floor_start) * bulkParams.floor_increment
          const price = Math.round((size * bulkParams.base_price_per_m2) + floorPremium)

          const unitData: any = {
            building_id: buildingId,
            number: `${prefix}${floor}${unit.toString().padStart(2, '0')}`,
            floor: floor,
            size_m2: size,
            price: price,
            status: 'Available'
          }

          if (unitType === 'apartment') {
            unitData.project_id = projectId
          }

          unitsToCreate.push(unitData)
        }
      }

      await salesService.bulkCreateUnits(tableName, unitsToCreate)
      await fetchData()
    } catch (error) {
      console.error('Error bulk creating units:', error)
      alert('Error creating units. Please try again.')
    }
  }

  const deleteUnitAction = async (unitId: string, unitType: UnitType) => {
    if (!confirm(`Are you sure you want to delete this ${unitType}?`)) return

    try {
      let tableName = ''
      if (unitType === 'apartment') tableName = 'apartments'
      else if (unitType === 'garage') tableName = 'garages'
      else if (unitType === 'repository') tableName = 'repositories'

      await salesService.deleteUnit(tableName, unitId)
      await fetchData()
    } catch (error) {
      console.error('Error deleting unit:', error)
      alert('Error deleting unit.')
    }
  }

  const updateUnitStatusAction = async (unitId: string, unitType: UnitType, newStatus: string) => {
    try {
      let tableName = ''
      if (unitType === 'apartment') tableName = 'apartments'
      else if (unitType === 'garage') tableName = 'garages'
      else if (unitType === 'repository') tableName = 'repositories'

      await salesService.updateUnitStatus(tableName, unitId, newStatus)
      await fetchData()
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Error updating status.')
    }
  }

  const linkGarageAction = async (apartmentId: string, garageId: string) => {
    try {
      await salesService.linkGarage(apartmentId, garageId)
      await fetchData()
    } catch (error) {
      console.error('Error linking garage:', error)
      alert('Error linking garage.')
    }
  }

  const linkRepositoryAction = async (apartmentId: string, repositoryId: string) => {
    try {
      await salesService.linkRepository(apartmentId, repositoryId)
      await fetchData()
    } catch (error) {
      console.error('Error linking repository:', error)
      alert('Error linking repository.')
    }
  }

  const unlinkGarageAction = async (apartmentId: string) => {
    try {
      await salesService.unlinkGarage(apartmentId)
      await fetchData()
    } catch (error) {
      console.error('Error unlinking garage:', error)
      alert('Error unlinking garage.')
    }
  }

  const unlinkRepositoryAction = async (apartmentId: string) => {
    try {
      await salesService.unlinkRepository(apartmentId)
      await fetchData()
    } catch (error) {
      console.error('Error unlinking repository:', error)
      alert('Error unlinking repository.')
    }
  }

  const completeSaleAction = async (
    unitId: string,
    unitType: UnitType,
    saleData: SaleFormData,
    customerMode: CustomerMode
  ) => {
    try {
      let customerId = saleData.customer_id

      if (customerMode === 'new') {
        if (!saleData.buyer_name.trim() || !saleData.buyer_email.trim()) {
          alert('Please fill in buyer name and email')
          return
        }

        const [firstName, ...lastNameParts] = saleData.buyer_name.trim().split(' ')
        const lastName = lastNameParts.join(' ') || firstName

        const newCustomer = await salesService.createCustomer({
          name: firstName,
          surname: lastName,
          email: saleData.buyer_email,
          phone: saleData.buyer_phone || '',
          address: saleData.buyer_address || ''
        })

        customerId = newCustomer.id
      }

      const remaining_amount = saleData.sale_price - saleData.down_payment

      const unitIdField = unitType === 'apartment' ? 'apartment_id'
                        : unitType === 'garage' ? 'garage_id'
                        : 'repository_id'

      await salesService.createSale({
        [unitIdField]: unitId,
        customer_id: customerId,
        sale_price: saleData.sale_price,
        payment_method: saleData.payment_method,
        down_payment: saleData.down_payment,
        total_paid: saleData.down_payment,
        remaining_amount: remaining_amount,
        monthly_payment: saleData.monthly_payment,
        sale_date: saleData.sale_date,
        contract_signed: saleData.contract_signed,
        notes: saleData.notes
      })

      let tableName = ''
      if (unitType === 'apartment') tableName = 'apartments'
      else if (unitType === 'garage') tableName = 'garages'
      else if (unitType === 'repository') tableName = 'repositories'

      await salesService.updateUnitBuyer(tableName, unitId, saleData.buyer_name)

      alert('Sale completed successfully!')
      await fetchData()
    } catch (error) {
      console.error('Error completing sale:', error)
      alert('Error completing sale. Please try again.')
    }
  }

  return {
    projects,
    buildings,
    apartments,
    garages,
    repositories,
    customers,
    loading,
    fetchData,
    createBuilding: createBuildingAction,
    createBuildings: createBuildingsAction,
    deleteBuilding: deleteBuildingAction,
    createUnit: createUnitAction,
    bulkCreateUnits: bulkCreateUnitsAction,
    deleteUnit: deleteUnitAction,
    updateUnitStatus: updateUnitStatusAction,
    linkGarage: linkGarageAction,
    linkRepository: linkRepositoryAction,
    unlinkGarage: unlinkGarageAction,
    unlinkRepository: unlinkRepositoryAction,
    completeSale: completeSaleAction
  }
}
