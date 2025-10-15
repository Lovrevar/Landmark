import React, { useState, useEffect } from 'react'
import { supabase, Project, Building, Apartment, Garage, Repository, Customer, Sale } from '../lib/supabase'
import {
  Building2,
  Plus,
  Home,
  DollarSign,
  Warehouse,
  Package,
  Link as LinkIcon,
  Unlink,
  Edit2,
  Trash2,
  X,
  CheckCircle,
  Filter
} from 'lucide-react'
import { format } from 'date-fns'

interface BuildingWithUnits extends Building {
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

interface ProjectWithBuildings extends Project {
  buildings: BuildingWithUnits[]
  total_buildings: number
  total_units: number
  sold_units: number
  total_revenue: number
}

type UnitType = 'apartment' | 'garage' | 'repository'
type ViewMode = 'projects' | 'buildings' | 'units'

const SalesProjectsEnhanced: React.FC = () => {
  const [projects, setProjects] = useState<ProjectWithBuildings[]>([])
  const [buildings, setBuildings] = useState<BuildingWithUnits[]>([])
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [garages, setGarages] = useState<Garage[]>([])
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  const [selectedProject, setSelectedProject] = useState<ProjectWithBuildings | null>(null)
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingWithUnits | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('projects')
  const [activeUnitType, setActiveUnitType] = useState<UnitType>('apartment')
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'reserved' | 'sold'>('all')

  const [showBuildingForm, setShowBuildingForm] = useState(false)
  const [showBuildingQuantityForm, setShowBuildingQuantityForm] = useState(false)
  const [showUnitForm, setShowUnitForm] = useState(false)
  const [showBulkUnitForm, setShowBulkUnitForm] = useState(false)
  const [showLinkingModal, setShowLinkingModal] = useState(false)
  const [showSaleForm, setShowSaleForm] = useState(false)
  const [selectedApartmentForLinking, setSelectedApartmentForLinking] = useState<Apartment | null>(null)
  const [unitForSale, setUnitForSale] = useState<{unit: Apartment | Garage | Repository, type: UnitType} | null>(null)
  const [customerMode, setCustomerMode] = useState<'new' | 'existing'>('new')

  const [buildingQuantity, setBuildingQuantity] = useState(1)
  const [newBuilding, setNewBuilding] = useState({
    name: '',
    description: '',
    total_floors: 10
  })

  const [newUnit, setNewUnit] = useState({
    building_id: '',
    number: '',
    floor: 1,
    size_m2: 0,
    price: 0
  })

  const [bulkCreate, setBulkCreate] = useState({
    floor_start: 1,
    floor_end: 10,
    units_per_floor: 4,
    base_size: 85,
    size_variation: 15,
    base_price_per_m2: 5000,
    floor_increment: 10000,
    number_prefix: ''
  })

  const [saleData, setSaleData] = useState({
    customer_id: '',
    sale_price: 0,
    payment_method: 'bank_loan' as const,
    down_payment: 0,
    monthly_payment: 0,
    sale_date: format(new Date(), 'yyyy-MM-dd'),
    contract_signed: false,
    notes: '',
    buyer_name: '',
    buyer_email: '',
    buyer_phone: '',
    buyer_address: ''
  })

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('name')

      if (projectsError) throw projectsError

      const { data: buildingsData, error: buildingsError } = await supabase
        .from('buildings')
        .select('*')
        .order('name')

      if (buildingsError) throw buildingsError

      const { data: apartmentsData, error: apartmentsError } = await supabase
        .from('apartments')
        .select('*')
        .order('number')

      if (apartmentsError) throw apartmentsError

      const { data: garagesData, error: garagesError } = await supabase
        .from('garages')
        .select('*')
        .order('number')

      if (garagesError) throw garagesError

      const { data: repositoriesData, error: repositoriesError } = await supabase
        .from('repositories')
        .select('*')
        .order('number')

      if (repositoriesError) throw repositoriesError

      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('name')

      if (customersError) throw customersError

      // Fetch sales data
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          *,
          customers(name, surname, email, phone)
        `)

      if (salesError) throw salesError

      // Enhance units with sale information
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

  const createBuildings = async () => {
    if (!selectedProject || buildingQuantity < 1 || buildingQuantity > 20) {
      alert('Please select a project and enter a valid quantity (1-20)')
      return
    }

    try {
      const buildingsToCreate = []
      for (let i = 1; i <= buildingQuantity; i++) {
        buildingsToCreate.push({
          project_id: selectedProject.id,
          name: `Building ${i}`,
          description: `Building ${i} of ${selectedProject.name}`,
          total_floors: 10
        })
      }

      const { error } = await supabase
        .from('buildings')
        .insert(buildingsToCreate)

      if (error) throw error

      setShowBuildingQuantityForm(false)
      setBuildingQuantity(1)
      fetchData()
    } catch (error) {
      console.error('Error creating buildings:', error)
      alert('Error creating buildings. Please try again.')
    }
  }

  const createBuilding = async () => {
    if (!selectedProject || !newBuilding.name.trim()) {
      alert('Please fill in required fields')
      return
    }

    try {
      const { error } = await supabase
        .from('buildings')
        .insert({
          project_id: selectedProject.id,
          name: newBuilding.name,
          description: newBuilding.description,
          total_floors: newBuilding.total_floors
        })

      if (error) throw error

      setShowBuildingForm(false)
      setNewBuilding({ name: '', description: '', total_floors: 10 })
      fetchData()
    } catch (error) {
      console.error('Error creating building:', error)
      alert('Error creating building. Please try again.')
    }
  }

  const deleteBuilding = async (buildingId: string) => {
    if (!confirm('Are you sure you want to delete this building? All units inside will also be deleted.')) return

    try {
      const { error } = await supabase
        .from('buildings')
        .delete()
        .eq('id', buildingId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error deleting building:', error)
      alert('Error deleting building.')
    }
  }

  const createUnit = async () => {
    if (!newUnit.building_id || !newUnit.number.trim()) {
      alert('Please fill in required fields')
      return
    }

    try {
      const building = buildings.find(b => b.id === newUnit.building_id)
      if (!building) return

      let tableName = ''
      if (activeUnitType === 'apartment') tableName = 'apartments'
      else if (activeUnitType === 'garage') tableName = 'garages'
      else if (activeUnitType === 'repository') tableName = 'repositories'

      const unitData: any = {
        building_id: newUnit.building_id,
        number: newUnit.number,
        floor: newUnit.floor,
        size_m2: newUnit.size_m2,
        price: newUnit.price,
        status: 'Available'
      }

      if (activeUnitType === 'apartment') {
        unitData.project_id = building.project_id
      }

      const { error } = await supabase
        .from(tableName)
        .insert(unitData)

      if (error) throw error

      setShowUnitForm(false)
      setNewUnit({ building_id: '', number: '', floor: 1, size_m2: 0, price: 0 })
      fetchData()
    } catch (error) {
      console.error('Error creating unit:', error)
      alert('Error creating unit. Please try again.')
    }
  }

  const bulkCreateUnits = async () => {
    if (!selectedBuilding) {
      alert('Please select a building')
      return
    }

    try {
      const building = selectedBuilding
      const unitsToCreate = []

      let tableName = ''
      if (activeUnitType === 'apartment') tableName = 'apartments'
      else if (activeUnitType === 'garage') tableName = 'garages'
      else if (activeUnitType === 'repository') tableName = 'repositories'

      const prefix = bulkCreate.number_prefix || (
        activeUnitType === 'apartment' ? 'A' :
        activeUnitType === 'garage' ? 'G' : 'R'
      )

      for (let floor = bulkCreate.floor_start; floor <= bulkCreate.floor_end; floor++) {
        for (let unit = 1; unit <= bulkCreate.units_per_floor; unit++) {
          const sizeVariation = (Math.random() - 0.5) * bulkCreate.size_variation
          const size = Math.round(bulkCreate.base_size + sizeVariation)
          const floorPremium = (floor - bulkCreate.floor_start) * bulkCreate.floor_increment
          const price = Math.round((size * bulkCreate.base_price_per_m2) + floorPremium)

          const unitData: any = {
            building_id: building.id,
            number: `${prefix}${floor}${unit.toString().padStart(2, '0')}`,
            floor: floor,
            size_m2: size,
            price: price,
            status: 'Available'
          }

          if (activeUnitType === 'apartment') {
            unitData.project_id = building.project_id
          }

          unitsToCreate.push(unitData)
        }
      }

      const { error } = await supabase
        .from(tableName)
        .insert(unitsToCreate)

      if (error) throw error

      setShowBulkUnitForm(false)
      setBulkCreate({
        floor_start: 1,
        floor_end: 10,
        units_per_floor: 4,
        base_size: 85,
        size_variation: 15,
        base_price_per_m2: 5000,
        floor_increment: 10000,
        number_prefix: ''
      })
      fetchData()
    } catch (error) {
      console.error('Error bulk creating units:', error)
      alert('Error creating units. Please try again.')
    }
  }

  const deleteUnit = async (unitId: string, unitType: UnitType) => {
    if (!confirm(`Are you sure you want to delete this ${unitType}?`)) return

    try {
      let tableName = ''
      if (unitType === 'apartment') tableName = 'apartments'
      else if (unitType === 'garage') tableName = 'garages'
      else if (unitType === 'repository') tableName = 'repositories'

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', unitId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error deleting unit:', error)
      alert('Error deleting unit.')
    }
  }

  const linkGarageToApartment = async (apartmentId: string, garageId: string) => {
    try {
      const { error } = await supabase
        .from('apartments')
        .update({ garage_id: garageId })
        .eq('id', apartmentId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error linking garage:', error)
      alert('Error linking garage.')
    }
  }

  const linkRepositoryToApartment = async (apartmentId: string, repositoryId: string) => {
    try {
      const { error } = await supabase
        .from('apartments')
        .update({ repository_id: repositoryId })
        .eq('id', apartmentId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error linking repository:', error)
      alert('Error linking repository.')
    }
  }

  const unlinkGarageFromApartment = async (apartmentId: string) => {
    try {
      const { error } = await supabase
        .from('apartments')
        .update({ garage_id: null })
        .eq('id', apartmentId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error unlinking garage:', error)
      alert('Error unlinking garage.')
    }
  }

  const unlinkRepositoryFromApartment = async (apartmentId: string) => {
    try {
      const { error } = await supabase
        .from('apartments')
        .update({ repository_id: null })
        .eq('id', apartmentId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error unlinking repository:', error)
      alert('Error unlinking repository.')
    }
  }

  const updateUnitStatus = async (unitId: string, unitType: UnitType, newStatus: string) => {
    try {
      let tableName = ''
      if (unitType === 'apartment') tableName = 'apartments'
      else if (unitType === 'garage') tableName = 'garages'
      else if (unitType === 'repository') tableName = 'repositories'

      const { error } = await supabase
        .from(tableName)
        .update({ status: newStatus })
        .eq('id', unitId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Error updating status.')
    }
  }

  const handleSellUnit = (unit: Apartment | Garage | Repository, unitType: UnitType) => {
    setUnitForSale({ unit, type: unitType })
    setSaleData(prev => ({
      ...prev,
      sale_price: unit.price
    }))
    setShowSaleForm(true)
  }

  const resetSaleForm = () => {
    setSaleData({
      customer_id: '',
      sale_price: 0,
      payment_method: 'bank_loan',
      down_payment: 0,
      monthly_payment: 0,
      sale_date: format(new Date(), 'yyyy-MM-dd'),
      contract_signed: false,
      notes: '',
      buyer_name: '',
      buyer_email: '',
      buyer_phone: '',
      buyer_address: ''
    })
    setCustomerMode('new')
    setUnitForSale(null)
    setShowSaleForm(false)
  }

  const completeSale = async () => {
    if (!unitForSale) return

    try {
      let customerId = saleData.customer_id

      // Create new customer if needed
      if (customerMode === 'new') {
        if (!saleData.buyer_name.trim() || !saleData.buyer_email.trim()) {
          alert('Please fill in buyer name and email')
          return
        }

        const [firstName, ...lastNameParts] = saleData.buyer_name.trim().split(' ')
        const lastName = lastNameParts.join(' ') || firstName

        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            name: firstName,
            surname: lastName,
            email: saleData.buyer_email,
            phone: saleData.buyer_phone || '',
            address: saleData.buyer_address || '',
            status: 'buyer'
          })
          .select()
          .single()

        if (customerError) throw customerError
        customerId = newCustomer.id
      }

      // Calculate remaining amount
      const remaining_amount = saleData.sale_price - saleData.down_payment

      // Determine which ID field to use based on unit type
      const unitIdField = unitForSale.type === 'apartment' ? 'apartment_id'
                        : unitForSale.type === 'garage' ? 'garage_id'
                        : 'repository_id'

      // Create sale record
      const { data: saleRecord, error: saleError } = await supabase
        .from('sales')
        .insert({
          [unitIdField]: unitForSale.unit.id,
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
        .select()
        .single()

      if (saleError) throw saleError

      // Update customer status to 'buyer' if using existing customer
      if (customerMode === 'existing' && customerId) {
        const { error: customerUpdateError } = await supabase
          .from('customers')
          .update({ status: 'buyer' })
          .eq('id', customerId)

        if (customerUpdateError) {
          console.error('Error updating customer status:', customerUpdateError)
        }
      }

      // Update unit status and buyer name
      let tableName = ''
      if (unitForSale.type === 'apartment') tableName = 'apartments'
      else if (unitForSale.type === 'garage') tableName = 'garages'
      else if (unitForSale.type === 'repository') tableName = 'repositories'

      const { error: unitError } = await supabase
        .from(tableName)
        .update({
          status: 'Sold',
          buyer_name: saleData.buyer_name
        })
        .eq('id', unitForSale.unit.id)

      if (unitError) throw unitError

      alert('Sale completed successfully!')
      resetSaleForm()
      fetchData()
    } catch (error) {
      console.error('Error completing sale:', error)
      alert('Error completing sale. Please try again.')
    }
  }

  const getFilteredUnits = (unitType: UnitType) => {
    if (!selectedBuilding) return []

    let units: any[] = []
    if (unitType === 'apartment') units = selectedBuilding.apartments
    else if (unitType === 'garage') units = selectedBuilding.garages
    else if (unitType === 'repository') units = selectedBuilding.repositories

    if (filterStatus === 'all') return units
    return units.filter(unit => {
      if (filterStatus === 'available') return unit.status === 'Available'
      if (filterStatus === 'reserved') return unit.status === 'Reserved'
      if (filterStatus === 'sold') return unit.status === 'Sold'
      return true
    })
  }

  const getUnitIcon = (unitType: UnitType) => {
    if (unitType === 'apartment') return Home
    if (unitType === 'garage') return Warehouse
    return Package
  }

  const getUnitLabel = (unitType: UnitType) => {
    if (unitType === 'apartment') return 'Apartments'
    if (unitType === 'garage') return 'Garages'
    return 'Repositories'
  }

  const calculateBulkPreview = () => {
    const floors = bulkCreate.floor_end - bulkCreate.floor_start + 1
    const totalUnits = floors * bulkCreate.units_per_floor
    const avgSize = bulkCreate.base_size
    const avgPrice = (avgSize * bulkCreate.base_price_per_m2) +
      ((bulkCreate.floor_start + bulkCreate.floor_end) / 2 - bulkCreate.floor_start) * bulkCreate.floor_increment
    const totalValue = totalUnits * avgPrice

    return { totalUnits, avgSize, avgPrice, totalValue }
  }

  if (loading) {
    return <div className="text-center py-12">Loading sales projects...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Projects</h1>
          <p className="text-gray-600 mt-2">
            {viewMode === 'projects' && 'Select a project to manage buildings and units'}
            {viewMode === 'buildings' && `Managing buildings for ${selectedProject?.name}`}
            {viewMode === 'units' && `Managing units in ${selectedBuilding?.name}`}
          </p>
        </div>
        <div className="flex space-x-3">
          {viewMode === 'buildings' && selectedProject && (
            <>
              <button
                onClick={() => setShowBuildingQuantityForm(true)}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Buildings (1-20)
              </button>
              <button
                onClick={() => setShowBuildingForm(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <Building2 className="w-4 h-4 mr-2" />
                Add Single Building
              </button>
            </>
          )}
          {viewMode === 'units' && selectedBuilding && (
            <>
              <button
                onClick={() => setShowBulkUnitForm(true)}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                <Building2 className="w-4 h-4 mr-2" />
                Bulk Create {getUnitLabel(activeUnitType)}
              </button>
              <button
                onClick={() => {
                  setNewUnit({ ...newUnit, building_id: selectedBuilding.id })
                  setShowUnitForm(true)
                }}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Single {getUnitLabel(activeUnitType).slice(0, -1)}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Projects View */}
      {viewMode === 'projects' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer"
              onClick={() => {
                setSelectedProject(project)
                setViewMode('buildings')
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{project.name}</h3>
                  <p className="text-sm text-gray-600">{project.location}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                  project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {project.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{project.total_buildings}</p>
                  <p className="text-xs text-gray-600">Buildings</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{project.total_units}</p>
                  <p className="text-xs text-gray-600">Total Units</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-600">Sales Progress</span>
                  <span className="text-sm font-medium">
                    {project.total_units > 0 ? ((project.sold_units / project.total_units) * 100).toFixed(1) : '0'}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${project.total_units > 0 ? (project.sold_units / project.total_units) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Revenue</span>
                  <span className="font-bold text-green-600">€{project.total_revenue.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Buildings View */}
      {viewMode === 'buildings' && selectedProject && (
        <div>
          <button
            onClick={() => {
              setViewMode('projects')
              setSelectedProject(null)
            }}
            className="mb-4 text-gray-600 hover:text-gray-900"
          >
            ← Back to Projects
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {selectedProject.buildings.map((building) => (
              <div
                key={building.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 cursor-pointer" onClick={() => {
                    setSelectedBuilding(building)
                    setViewMode('units')
                  }}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{building.name}</h3>
                    <p className="text-sm text-gray-600">{building.total_floors} floors</p>
                  </div>
                  <button
                    onClick={() => deleteBuilding(building.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-600">{building.total_apartments}</p>
                    <p className="text-xs text-gray-600">Apartments</p>
                    <p className="text-xs text-green-600">{building.sold_apartments} sold</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-orange-600">{building.total_garages}</p>
                    <p className="text-xs text-gray-600">Garages</p>
                    <p className="text-xs text-green-600">{building.sold_garages} sold</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-purple-600">{building.total_repositories}</p>
                    <p className="text-xs text-gray-600">Repositories</p>
                    <p className="text-xs text-green-600">{building.sold_repositories} sold</p>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Revenue</span>
                    <span className="font-bold text-green-600">€{building.total_revenue.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Units View */}
      {viewMode === 'units' && selectedBuilding && (
        <div>
          <button
            onClick={() => {
              setViewMode('buildings')
              setSelectedBuilding(null)
            }}
            className="mb-4 text-gray-600 hover:text-gray-900"
          >
            ← Back to Buildings
          </button>

          {/* Unit Type Tabs */}
          <div className="flex space-x-2 mb-6">
            {(['apartment', 'garage', 'repository'] as UnitType[]).map((type) => {
              const Icon = getUnitIcon(type)
              const count = type === 'apartment' ? selectedBuilding.total_apartments :
                           type === 'garage' ? selectedBuilding.total_garages :
                           selectedBuilding.total_repositories
              return (
                <button
                  key={type}
                  onClick={() => setActiveUnitType(type)}
                  className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    activeUnitType === type
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {getUnitLabel(type)}
                  <span className="ml-2 px-2 py-0.5 bg-white rounded-full text-xs">{count}</span>
                </button>
              )
            })}
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-4 mb-6">
            <span className="text-sm font-medium text-gray-700">Filter by status:</span>
            <div className="flex space-x-2">
              {[
                { value: 'all', label: 'All' },
                { value: 'available', label: 'Available' },
                { value: 'reserved', label: 'Reserved' },
                { value: 'sold', label: 'Sold' }
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setFilterStatus(filter.value as any)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    filterStatus === filter.value
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Units Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {getFilteredUnits(activeUnitType).map((unit: any) => {
              const linkedGarage = activeUnitType === 'apartment' && unit.garage_id ?
                garages.find(g => g.id === unit.garage_id) : null
              const linkedRepository = activeUnitType === 'apartment' && unit.repository_id ?
                repositories.find(r => r.id === unit.repository_id) : null

              return (
                <div
                  key={unit.id}
                  className={`rounded-xl shadow-sm border p-4 transition-all duration-200 ${
                    unit.status === 'Sold'
                      ? 'border-green-200 bg-green-50'
                      : unit.status === 'Reserved'
                        ? 'border-yellow-200 bg-yellow-50'
                        : 'border-gray-200 bg-white hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">Unit {unit.number}</h4>
                      <p className="text-sm text-gray-600">Floor {unit.floor}</p>
                    </div>
                    <div className="flex space-x-1">
                      {activeUnitType === 'apartment' && (
                        <button
                          onClick={() => {
                            setSelectedApartmentForLinking(unit)
                            setShowLinkingModal(true)
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Link garage/repository"
                        >
                          <LinkIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteUnit(unit.id, activeUnitType)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Size:</span>
                      <span className="text-sm font-medium">{unit.size_m2} m²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Price:</span>
                      <span className="text-sm font-bold text-green-600">€{unit.price.toLocaleString()}</span>
                    </div>

                    {unit.status === 'Sold' && (unit as any).sale_info && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Buyer:</span>
                          <span className="text-sm font-medium">{(unit as any).sale_info.buyer_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Sale Price:</span>
                          <span className="text-sm font-bold text-green-600">€{(unit as any).sale_info.sale_price.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Down Payment:</span>
                          <span className="text-sm font-medium">€{(unit as any).sale_info.down_payment.toLocaleString()}</span>
                        </div>
                        {(unit as any).sale_info.monthly_payment > 0 && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Monthly:</span>
                            <span className="text-sm font-medium">€{(unit as any).sale_info.monthly_payment.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="mt-2">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs text-gray-500">Payment Progress</span>
                            <span className="text-xs font-medium">
                              €{(unit as any).sale_info.total_paid.toLocaleString()} / €{(unit as any).sale_info.sale_price.toLocaleString()}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-green-600 h-1.5 rounded-full"
                              style={{
                                width: `${(unit as any).sale_info.sale_price > 0 ? ((unit as any).sale_info.total_paid / (unit as any).sale_info.sale_price) * 100 : 0}%`
                              }}
                            ></div>
                          </div>
                        </div>
                      </>
                    )}

                    {linkedGarage && (
                      <div className="flex justify-between items-center text-sm bg-orange-100 px-2 py-1 rounded">
                        <span className="text-orange-700">Garage: {linkedGarage.number}</span>
                        <button
                          onClick={() => unlinkGarageFromApartment(unit.id)}
                          className="text-orange-600 hover:text-orange-800"
                        >
                          <Unlink className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {linkedRepository && (
                      <div className="flex justify-between items-center text-sm bg-purple-100 px-2 py-1 rounded">
                        <span className="text-purple-700">Repository: {linkedRepository.number}</span>
                        <button
                          onClick={() => unlinkRepositoryFromApartment(unit.id)}
                          className="text-purple-600 hover:text-purple-800"
                        >
                          <Unlink className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        unit.status === 'Sold' ? 'bg-green-100 text-green-800' :
                        unit.status === 'Reserved' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {unit.status}
                      </span>

                      {unit.status !== 'Sold' && (
                        <div className="flex space-x-1">
                          {unit.status === 'Available' && (
                            <button
                              onClick={() => updateUnitStatus(unit.id, activeUnitType, 'Reserved')}
                              className="px-2 py-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded text-xs font-medium"
                            >
                              Reserve
                            </button>
                          )}
                          {unit.status === 'Reserved' && (
                            <button
                              onClick={() => updateUnitStatus(unit.id, activeUnitType, 'Available')}
                              className="px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-xs font-medium"
                            >
                              Available
                            </button>
                          )}
                          <button
                            onClick={() => handleSellUnit(unit, activeUnitType)}
                            className="px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded text-xs font-medium"
                          >
                            Sell
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Building Quantity Form Modal */}
      {showBuildingQuantityForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Create Multiple Buildings</h3>
                <button
                  onClick={() => {
                    setShowBuildingQuantityForm(false)
                    setBuildingQuantity(1)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Buildings (1-20)
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={buildingQuantity}
                  onChange={(e) => setBuildingQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Buildings will be named "Building 1", "Building 2", etc.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowBuildingQuantityForm(false)
                    setBuildingQuantity(1)
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={createBuildings}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Create {buildingQuantity} Building{buildingQuantity !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single Building Form Modal */}
      {showBuildingForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Add Building</h3>
                <button
                  onClick={() => {
                    setShowBuildingForm(false)
                    setNewBuilding({ name: '', description: '', total_floors: 10 })
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Building Name *</label>
                  <input
                    type="text"
                    value={newBuilding.name}
                    onChange={(e) => setNewBuilding({ ...newBuilding, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Building A, Tower 1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={newBuilding.description}
                    onChange={(e) => setNewBuilding({ ...newBuilding, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Floors *</label>
                  <input
                    type="number"
                    min="1"
                    value={newBuilding.total_floors}
                    onChange={(e) => setNewBuilding({ ...newBuilding, total_floors: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowBuildingForm(false)
                    setNewBuilding({ name: '', description: '', total_floors: 10 })
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={createBuilding}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Building
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unit Form Modal */}
      {showUnitForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  Add {getUnitLabel(activeUnitType).slice(0, -1)}
                </h3>
                <button
                  onClick={() => {
                    setShowUnitForm(false)
                    setNewUnit({ building_id: '', number: '', floor: 1, size_m2: 0, price: 0 })
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit Number *</label>
                  <input
                    type="text"
                    value={newUnit.number}
                    onChange={(e) => setNewUnit({ ...newUnit, number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 101, A-205"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Floor *</label>
                  <input
                    type="number"
                    min="0"
                    value={newUnit.floor}
                    onChange={(e) => setNewUnit({ ...newUnit, floor: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Size (m²) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={newUnit.size_m2}
                    onChange={(e) => setNewUnit({ ...newUnit, size_m2: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price (€) *</label>
                  <input
                    type="number"
                    min="0"
                    value={newUnit.price}
                    onChange={(e) => setNewUnit({ ...newUnit, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowUnitForm(false)
                    setNewUnit({ building_id: '', number: '', floor: 1, size_m2: 0, price: 0 })
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={createUnit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add {getUnitLabel(activeUnitType).slice(0, -1)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Unit Form Modal */}
      {showBulkUnitForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  Bulk Create {getUnitLabel(activeUnitType)}
                </h3>
                <button
                  onClick={() => {
                    setShowBulkUnitForm(false)
                    setBulkCreate({
                      floor_start: 1,
                      floor_end: 10,
                      units_per_floor: 4,
                      base_size: 85,
                      size_variation: 15,
                      base_price_per_m2: 5000,
                      floor_increment: 10000,
                      number_prefix: ''
                    })
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Floor</label>
                  <input
                    type="number"
                    min="0"
                    value={bulkCreate.floor_start}
                    onChange={(e) => setBulkCreate({ ...bulkCreate, floor_start: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Floor</label>
                  <input
                    type="number"
                    min="0"
                    value={bulkCreate.floor_end}
                    onChange={(e) => setBulkCreate({ ...bulkCreate, floor_end: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Units per Floor</label>
                  <input
                    type="number"
                    min="1"
                    value={bulkCreate.units_per_floor}
                    onChange={(e) => setBulkCreate({ ...bulkCreate, units_per_floor: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Number Prefix (optional)</label>
                  <input
                    type="text"
                    value={bulkCreate.number_prefix}
                    onChange={(e) => setBulkCreate({ ...bulkCreate, number_prefix: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={activeUnitType === 'apartment' ? 'A' : activeUnitType === 'garage' ? 'G' : 'R'}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Default: {activeUnitType === 'apartment' ? 'A' : activeUnitType === 'garage' ? 'G' : 'R'}
                    (e.g., A101, G202)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Base Size (m²)</label>
                  <input
                    type="number"
                    min="0"
                    value={bulkCreate.base_size}
                    onChange={(e) => setBulkCreate({ ...bulkCreate, base_size: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Size Variation (±m²)</label>
                  <input
                    type="number"
                    min="0"
                    value={bulkCreate.size_variation}
                    onChange={(e) => setBulkCreate({ ...bulkCreate, size_variation: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Base Price per m²</label>
                  <input
                    type="number"
                    min="0"
                    value={bulkCreate.base_price_per_m2}
                    onChange={(e) => setBulkCreate({ ...bulkCreate, base_price_per_m2: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Floor Premium (€)</label>
                  <input
                    type="number"
                    min="0"
                    value={bulkCreate.floor_increment}
                    onChange={(e) => setBulkCreate({ ...bulkCreate, floor_increment: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Additional price per floor above start floor
                  </p>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <h4 className="font-semibold text-blue-900 mb-2">Preview</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Total {getUnitLabel(activeUnitType)}:</span>
                    <span className="font-medium text-blue-900 ml-2">
                      {calculateBulkPreview().totalUnits}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700">Avg. Size:</span>
                    <span className="font-medium text-blue-900 ml-2">
                      {calculateBulkPreview().avgSize} m²
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700">Avg. Price:</span>
                    <span className="font-medium text-blue-900 ml-2">
                      €{Math.round(calculateBulkPreview().avgPrice).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700">Total Value:</span>
                    <span className="font-medium text-blue-900 ml-2">
                      €{Math.round(calculateBulkPreview().totalValue).toLocaleString()}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-blue-600 mt-3">
                  Units will be numbered: {bulkCreate.number_prefix || (activeUnitType === 'apartment' ? 'A' : activeUnitType === 'garage' ? 'G' : 'R')}
                  {bulkCreate.floor_start}01, {bulkCreate.number_prefix || (activeUnitType === 'apartment' ? 'A' : activeUnitType === 'garage' ? 'G' : 'R')}
                  {bulkCreate.floor_start}02, etc.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowBulkUnitForm(false)
                    setBulkCreate({
                      floor_start: 1,
                      floor_end: 10,
                      units_per_floor: 4,
                      base_size: 85,
                      size_variation: 15,
                      base_price_per_m2: 5000,
                      floor_increment: 10000,
                      number_prefix: ''
                    })
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={bulkCreateUnits}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  Create {calculateBulkPreview().totalUnits} {getUnitLabel(activeUnitType)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Linking Modal */}
      {showLinkingModal && selectedApartmentForLinking && selectedBuilding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  Link Units to Apartment {selectedApartmentForLinking.number}
                </h3>
                <button
                  onClick={() => {
                    setShowLinkingModal(false)
                    setSelectedApartmentForLinking(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Garages */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Warehouse className="w-5 h-5 mr-2 text-orange-600" />
                  Link Garage
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {selectedBuilding.garages.filter(g => g.status === 'Available').map((garage) => (
                    <button
                      key={garage.id}
                      onClick={() => {
                        linkGarageToApartment(selectedApartmentForLinking.id, garage.id)
                        setShowLinkingModal(false)
                        setSelectedApartmentForLinking(null)
                      }}
                      className={`p-3 border-2 rounded-lg text-left transition-colors ${
                        selectedApartmentForLinking.garage_id === garage.id
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-orange-300 bg-white'
                      }`}
                    >
                      <div className="font-medium text-gray-900">Garage {garage.number}</div>
                      <div className="text-sm text-gray-600">Floor {garage.floor} • {garage.size_m2}m²</div>
                      <div className="text-sm font-medium text-orange-600">€{garage.price.toLocaleString()}</div>
                    </button>
                  ))}
                  {selectedBuilding.garages.filter(g => g.status === 'Available').length === 0 && (
                    <p className="text-gray-500 col-span-2">No available garages</p>
                  )}
                </div>
              </div>

              {/* Repositories */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <Package className="w-5 h-5 mr-2 text-purple-600" />
                  Link Repository
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {selectedBuilding.repositories.filter(r => r.status === 'Available').map((repository) => (
                    <button
                      key={repository.id}
                      onClick={() => {
                        linkRepositoryToApartment(selectedApartmentForLinking.id, repository.id)
                        setShowLinkingModal(false)
                        setSelectedApartmentForLinking(null)
                      }}
                      className={`p-3 border-2 rounded-lg text-left transition-colors ${
                        selectedApartmentForLinking.repository_id === repository.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300 bg-white'
                      }`}
                    >
                      <div className="font-medium text-gray-900">Repository {repository.number}</div>
                      <div className="text-sm text-gray-600">Floor {repository.floor} • {repository.size_m2}m²</div>
                      <div className="text-sm font-medium text-purple-600">€{repository.price.toLocaleString()}</div>
                    </button>
                  ))}
                  {selectedBuilding.repositories.filter(r => r.status === 'Available').length === 0 && (
                    <p className="text-gray-500 col-span-2">No available repositories</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => {
                    setShowLinkingModal(false)
                    setSelectedApartmentForLinking(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sale Form Modal */}
      {showSaleForm && unitForSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  Complete Sale - Unit {unitForSale.unit.number}
                </h3>
                <button
                  onClick={resetSaleForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Customer Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Customer</label>
                <div className="flex space-x-4 mb-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="new"
                      checked={customerMode === 'new'}
                      onChange={(e) => setCustomerMode(e.target.value as 'new' | 'existing')}
                      className="mr-2"
                    />
                    Create New Customer
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="existing"
                      checked={customerMode === 'existing'}
                      onChange={(e) => setCustomerMode(e.target.value as 'new' | 'existing')}
                      className="mr-2"
                    />
                    Select Existing Customer
                  </label>
                </div>

                {customerMode === 'existing' ? (
                  <select
                    value={saleData.customer_id}
                    onChange={(e) => {
                      const customer = customers.find(c => c.id === e.target.value)
                      setSaleData({
                        ...saleData,
                        customer_id: e.target.value,
                        buyer_name: customer ? `${customer.name} ${customer.surname}` : '',
                        buyer_email: customer?.email || '',
                        buyer_phone: customer?.phone || ''
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select a customer</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} {customer.surname} - {customer.email}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                      <input
                        type="text"
                        value={saleData.buyer_name}
                        onChange={(e) => setSaleData({ ...saleData, buyer_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="John Smith"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                      <input
                        type="email"
                        value={saleData.buyer_email}
                        onChange={(e) => setSaleData({ ...saleData, buyer_email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="john@example.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={saleData.buyer_phone}
                        onChange={(e) => setSaleData({ ...saleData, buyer_phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                      <input
                        type="text"
                        value={saleData.buyer_address}
                        onChange={(e) => setSaleData({ ...saleData, buyer_address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="123 Main St, City, State"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sale Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sale Price (€) *</label>
                  <input
                    type="number"
                    min="0"
                    value={saleData.sale_price}
                    onChange={(e) => setSaleData({ ...saleData, sale_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                  <select
                    value={saleData.payment_method}
                    onChange={(e) => setSaleData({ ...saleData, payment_method: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="cash">Cash</option>
                    <option value="credit">Credit</option>
                    <option value="bank_loan">Bank Loan</option>
                    <option value="installments">Installments</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Down Payment (€)</label>
                  <input
                    type="number"
                    min="0"
                    value={saleData.down_payment}
                    onChange={(e) => setSaleData({ ...saleData, down_payment: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Payment (€)</label>
                  <input
                    type="number"
                    min="0"
                    value={saleData.monthly_payment}
                    onChange={(e) => setSaleData({ ...saleData, monthly_payment: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sale Date</label>
                  <input
                    type="date"
                    value={saleData.sale_date}
                    onChange={(e) => setSaleData({ ...saleData, sale_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="contract_signed"
                    checked={saleData.contract_signed}
                    onChange={(e) => setSaleData({ ...saleData, contract_signed: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="contract_signed" className="text-sm font-medium text-gray-700">
                    Contract Signed
                  </label>
                </div>
              </div>

              {/* Sale Summary */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">Sale Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Sale Price:</span>
                    <span className="font-medium text-gray-900 ml-2">€{saleData.sale_price.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Down Payment:</span>
                    <span className="font-medium text-gray-900 ml-2">€{saleData.down_payment.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Remaining:</span>
                    <span className="font-medium text-gray-900 ml-2">
                      €{(saleData.sale_price - saleData.down_payment).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Monthly Payment:</span>
                    <span className="font-medium text-gray-900 ml-2">€{saleData.monthly_payment.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={saleData.notes}
                  onChange={(e) => setSaleData({ ...saleData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Additional sale notes..."
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={resetSaleForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={completeSale}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  Complete Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesProjectsEnhanced
