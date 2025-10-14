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
  const [showLinkingModal, setShowLinkingModal] = useState(false)
  const [selectedApartmentForLinking, setSelectedApartmentForLinking] = useState<Apartment | null>(null)

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

      const buildingsWithUnits = (buildingsData || []).map(building => {
        const buildingApartments = (apartmentsData || []).filter(apt => apt.building_id === building.id)
        const buildingGarages = (garagesData || []).filter(gar => gar.building_id === building.id)
        const buildingRepositories = (repositoriesData || []).filter(rep => rep.building_id === building.id)

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
      setApartments(apartmentsData || [])
      setGarages(garagesData || [])
      setRepositories(repositoriesData || [])
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
            <button
              onClick={() => {
                setNewUnit({ ...newUnit, building_id: selectedBuilding.id })
                setShowUnitForm(true)
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add {getUnitLabel(activeUnitType).slice(0, -1)}
            </button>
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
                            onClick={() => updateUnitStatus(unit.id, activeUnitType, 'Sold')}
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
    </div>
  )
}

export default SalesProjectsEnhanced
