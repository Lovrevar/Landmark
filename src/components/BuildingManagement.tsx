import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, Building, Apartment, Garage, Repository } from '../lib/supabase'
import {
  Building2,
  Plus,
  Home,
  Car,
  Package,
  Edit2,
  Trash2,
  X,
  ArrowLeft,
  Link as LinkIcon,
  Unlink
} from 'lucide-react'

interface ApartmentWithLinks extends Apartment {
  garage?: Garage | null
  repository?: Repository | null
}

interface BuildingWithUnits extends Building {
  apartments: ApartmentWithLinks[]
  garages: Garage[]
  repositories: Garage[]
}

const BuildingManagement: React.FC = () => {
  const { projectId, buildingId } = useParams<{ projectId: string; buildingId?: string }>()
  const navigate = useNavigate()
  const [buildings, setBuildings] = useState<BuildingWithUnits[]>([])
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingWithUnits | null>(null)
  const [showBuildingForm, setShowBuildingForm] = useState(false)
  const [showApartmentForm, setShowApartmentForm] = useState(false)
  const [showGarageForm, setShowGarageForm] = useState(false)
  const [showRepositoryForm, setShowRepositoryForm] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkingApartment, setLinkingApartment] = useState<Apartment | null>(null)
  const [linkType, setLinkType] = useState<'garage' | 'repository'>('garage')
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null)
  const [editingApartment, setEditingApartment] = useState<Apartment | null>(null)
  const [editingGarage, setEditingGarage] = useState<Garage | null>(null)
  const [editingRepository, setEditingRepository] = useState<Repository | null>(null)
  const [activeTab, setActiveTab] = useState<'apartments' | 'garages' | 'repositories'>('apartments')
  const [loading, setLoading] = useState(true)

  const [newBuilding, setNewBuilding] = useState({
    name: '',
    description: '',
    total_floors: 1
  })

  const [newApartment, setNewApartment] = useState({
    number: '',
    floor: 1,
    size_m2: 0,
    price: 0,
    status: 'Available' as const
  })

  const [newGarage, setNewGarage] = useState({
    number: '',
    floor: 0,
    size_m2: 0,
    price: 0,
    status: 'Available' as const
  })

  const [newRepository, setNewRepository] = useState({
    number: '',
    floor: 0,
    size_m2: 0,
    price: 0,
    status: 'Available' as const
  })

  useEffect(() => {
    if (projectId) {
      fetchBuildings()
    }
  }, [projectId])

  useEffect(() => {
    if (buildingId && buildings.length > 0) {
      const building = buildings.find(b => b.id === buildingId)
      if (building) {
        setSelectedBuilding(building)
      }
    }
  }, [buildingId, buildings])

  const fetchBuildings = async () => {
    if (!projectId) return

    setLoading(true)
    try {
      const { data: buildingsData, error: buildingsError } = await supabase
        .from('buildings')
        .select('*')
        .eq('project_id', projectId)
        .order('name', { ascending: true })

      if (buildingsError) throw buildingsError

      const buildingsWithUnits = await Promise.all(
        (buildingsData || []).map(async (building) => {
          const [apartmentsRes, garagesRes, repositoriesRes] = await Promise.all([
            supabase
              .from('apartments')
              .select('*')
              .eq('building_id', building.id)
              .order('floor', { ascending: true })
              .order('number', { ascending: true }),
            supabase
              .from('garages')
              .select('*')
              .eq('building_id', building.id)
              .order('number', { ascending: true }),
            supabase
              .from('repositories')
              .select('*')
              .eq('building_id', building.id)
              .order('number', { ascending: true })
          ])

          if (apartmentsRes.error) throw apartmentsRes.error
          if (garagesRes.error) throw garagesRes.error
          if (repositoriesRes.error) throw repositoriesRes.error

          // Enrich apartments with linked garages and repositories
          const apartmentsWithLinks = await Promise.all(
            (apartmentsRes.data || []).map(async (apt) => {
              let garage = null
              let repository = null

              if (apt.garage_id) {
                const { data } = await supabase
                  .from('garages')
                  .select('*')
                  .eq('id', apt.garage_id)
                  .single()
                garage = data
              }

              if (apt.repository_id) {
                const { data } = await supabase
                  .from('repositories')
                  .select('*')
                  .eq('id', apt.repository_id)
                  .single()
                repository = data
              }

              return {
                ...apt,
                garage,
                repository
              }
            })
          )

          return {
            ...building,
            apartments: apartmentsWithLinks,
            garages: garagesRes.data || [],
            repositories: repositoriesRes.data || []
          }
        })
      )

      setBuildings(buildingsWithUnits)
    } catch (error) {
      console.error('Error fetching buildings:', error)
      alert('Failed to fetch buildings')
    } finally {
      setLoading(false)
    }
  }

  const addBuilding = async () => {
    if (!projectId || !newBuilding.name.trim()) {
      alert('Building name is required')
      return
    }

    try {
      const { error } = await supabase
        .from('buildings')
        .insert({
          project_id: projectId,
          ...newBuilding
        })

      if (error) throw error

      resetBuildingForm()
      await fetchBuildings()
    } catch (error) {
      console.error('Error adding building:', error)
      alert('Failed to add building')
    }
  }

  const updateBuilding = async () => {
    if (!editingBuilding || !newBuilding.name.trim()) return

    try {
      const { error } = await supabase
        .from('buildings')
        .update(newBuilding)
        .eq('id', editingBuilding.id)

      if (error) throw error

      resetBuildingForm()
      await fetchBuildings()
    } catch (error) {
      console.error('Error updating building:', error)
      alert('Failed to update building')
    }
  }

  const deleteBuilding = async (buildingId: string) => {
    if (!confirm('Delete this building? All apartments, garages, and repositories will be deleted.')) return

    try {
      const { error } = await supabase
        .from('buildings')
        .delete()
        .eq('id', buildingId)

      if (error) throw error

      if (selectedBuilding?.id === buildingId) {
        setSelectedBuilding(null)
      }
      await fetchBuildings()
    } catch (error) {
      console.error('Error deleting building:', error)
      alert('Failed to delete building')
    }
  }

  const addApartment = async () => {
    if (!selectedBuilding || !newApartment.number.trim()) {
      alert('Apartment number is required')
      return
    }

    try {
      const { error } = await supabase
        .from('apartments')
        .insert({
          project_id: projectId,
          building_id: selectedBuilding.id,
          ...newApartment
        })

      if (error) throw error

      resetApartmentForm()
      await fetchBuildings()
    } catch (error) {
      console.error('Error adding apartment:', error)
      alert('Failed to add apartment')
    }
  }

  const updateApartment = async () => {
    if (!editingApartment || !newApartment.number.trim()) return

    try {
      const { error } = await supabase
        .from('apartments')
        .update(newApartment)
        .eq('id', editingApartment.id)

      if (error) throw error

      resetApartmentForm()
      await fetchBuildings()
    } catch (error) {
      console.error('Error updating apartment:', error)
      alert('Failed to update apartment')
    }
  }

  const deleteApartment = async (apartmentId: string) => {
    if (!confirm('Delete this apartment?')) return

    try {
      const { error } = await supabase
        .from('apartments')
        .delete()
        .eq('id', apartmentId)

      if (error) throw error

      await fetchBuildings()
    } catch (error) {
      console.error('Error deleting apartment:', error)
      alert('Failed to delete apartment')
    }
  }

  const addGarage = async () => {
    if (!selectedBuilding || !newGarage.number.trim()) {
      alert('Garage number is required')
      return
    }

    try {
      const { error } = await supabase
        .from('garages')
        .insert({
          building_id: selectedBuilding.id,
          ...newGarage
        })

      if (error) throw error

      resetGarageForm()
      await fetchBuildings()
    } catch (error) {
      console.error('Error adding garage:', error)
      alert('Failed to add garage')
    }
  }

  const updateGarage = async () => {
    if (!editingGarage || !newGarage.number.trim()) return

    try {
      const { error } = await supabase
        .from('garages')
        .update(newGarage)
        .eq('id', editingGarage.id)

      if (error) throw error

      resetGarageForm()
      await fetchBuildings()
    } catch (error) {
      console.error('Error updating garage:', error)
      alert('Failed to update garage')
    }
  }

  const deleteGarage = async (garageId: string) => {
    if (!confirm('Delete this garage?')) return

    try {
      const { error } = await supabase
        .from('garages')
        .delete()
        .eq('id', garageId)

      if (error) throw error

      await fetchBuildings()
    } catch (error) {
      console.error('Error deleting garage:', error)
      alert('Failed to delete garage')
    }
  }

  const addRepository = async () => {
    if (!selectedBuilding || !newRepository.number.trim()) {
      alert('Repository number is required')
      return
    }

    try {
      const { error } = await supabase
        .from('repositories')
        .insert({
          building_id: selectedBuilding.id,
          ...newRepository
        })

      if (error) throw error

      resetRepositoryForm()
      await fetchBuildings()
    } catch (error) {
      console.error('Error adding repository:', error)
      alert('Failed to add repository')
    }
  }

  const updateRepository = async () => {
    if (!editingRepository || !newRepository.number.trim()) return

    try {
      const { error } = await supabase
        .from('repositories')
        .update(newRepository)
        .eq('id', editingRepository.id)

      if (error) throw error

      resetRepositoryForm()
      await fetchBuildings()
    } catch (error) {
      console.error('Error updating repository:', error)
      alert('Failed to update repository')
    }
  }

  const deleteRepository = async (repositoryId: string) => {
    if (!confirm('Delete this repository?')) return

    try {
      const { error } = await supabase
        .from('repositories')
        .delete()
        .eq('id', repositoryId)

      if (error) throw error

      await fetchBuildings()
    } catch (error) {
      console.error('Error deleting repository:', error)
      alert('Failed to delete repository')
    }
  }

  const linkToApartment = async (apartmentId: string, linkId: string, type: 'garage' | 'repository') => {
    try {
      const updateData = type === 'garage'
        ? { garage_id: linkId }
        : { repository_id: linkId }

      const { error } = await supabase
        .from('apartments')
        .update(updateData)
        .eq('id', apartmentId)

      if (error) throw error

      setShowLinkModal(false)
      setLinkingApartment(null)
      await fetchBuildings()
    } catch (error) {
      console.error('Error linking:', error)
      alert('Failed to link')
    }
  }

  const unlinkFromApartment = async (apartmentId: string, type: 'garage' | 'repository') => {
    if (!confirm(`Unlink this ${type}?`)) return

    try {
      const updateData = type === 'garage'
        ? { garage_id: null }
        : { repository_id: null }

      const { error } = await supabase
        .from('apartments')
        .update(updateData)
        .eq('id', apartmentId)

      if (error) throw error

      await fetchBuildings()
    } catch (error) {
      console.error('Error unlinking:', error)
      alert('Failed to unlink')
    }
  }

  const resetBuildingForm = () => {
    setShowBuildingForm(false)
    setEditingBuilding(null)
    setNewBuilding({
      name: '',
      description: '',
      total_floors: 1
    })
  }

  const resetApartmentForm = () => {
    setShowApartmentForm(false)
    setEditingApartment(null)
    setNewApartment({
      number: '',
      floor: 1,
      size_m2: 0,
      price: 0,
      status: 'Available'
    })
  }

  const resetGarageForm = () => {
    setShowGarageForm(false)
    setEditingGarage(null)
    setNewGarage({
      number: '',
      floor: 0,
      size_m2: 0,
      price: 0,
      status: 'Available'
    })
  }

  const resetRepositoryForm = () => {
    setShowRepositoryForm(false)
    setEditingRepository(null)
    setNewRepository({
      number: '',
      floor: 0,
      size_m2: 0,
      price: 0,
      status: 'Available'
    })
  }

  const handleEditBuilding = (building: Building) => {
    setEditingBuilding(building)
    setNewBuilding({
      name: building.name,
      description: building.description,
      total_floors: building.total_floors
    })
    setShowBuildingForm(true)
  }

  const handleEditApartment = (apartment: Apartment) => {
    setEditingApartment(apartment)
    setNewApartment({
      number: apartment.number,
      floor: apartment.floor,
      size_m2: apartment.size_m2,
      price: apartment.price,
      status: apartment.status
    })
    setShowApartmentForm(true)
  }

  const handleEditGarage = (garage: Garage) => {
    setEditingGarage(garage)
    setNewGarage({
      number: garage.number,
      floor: garage.floor,
      size_m2: garage.size_m2,
      price: garage.price,
      status: garage.status
    })
    setShowGarageForm(true)
  }

  const handleEditRepository = (repository: Repository) => {
    setEditingRepository(repository)
    setNewRepository({
      number: repository.number,
      floor: repository.floor,
      size_m2: repository.size_m2,
      price: repository.price,
      status: repository.status
    })
    setShowRepositoryForm(true)
  }

  const openLinkModal = (apartment: Apartment, type: 'garage' | 'repository') => {
    setLinkingApartment(apartment)
    setLinkType(type)
    setShowLinkModal(true)
  }

  if (loading) {
    return <div className="text-center py-12">Loading buildings...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(`/sales-projects`)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Building Management</h1>
        </div>
        <button
          onClick={() => setShowBuildingForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Building
        </button>
      </div>

      {buildings.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No buildings yet</p>
          <button
            onClick={() => setShowBuildingForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add First Building
          </button>
        </div>
      ) : !selectedBuilding ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {buildings.map((building) => (
            <div
              key={building.id}
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedBuilding(building)}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{building.name}</h3>
                  <p className="text-sm text-gray-500">{building.description}</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditBuilding(building)
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteBuilding(building.id)
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <Home className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-900">{building.apartments.length}</p>
                  <p className="text-xs text-blue-700">Apartments</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <Car className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-900">{building.garages.length}</p>
                  <p className="text-xs text-green-700">Garages</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <Package className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-orange-900">{building.repositories.length}</p>
                  <p className="text-xs text-orange-700">Repositories</p>
                </div>
              </div>

              <p className="text-sm text-gray-600">
                <span className="font-medium">{building.total_floors}</span> floors
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedBuilding.name}</h2>
                <p className="text-sm text-gray-500">{selectedBuilding.description}</p>
              </div>
              <button
                onClick={() => setSelectedBuilding(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-b border-gray-200 mb-6">
              <nav className="flex space-x-8">
                {[
                  { id: 'apartments', name: 'Apartments', icon: Home },
                  { id: 'garages', name: 'Garages', icon: Car },
                  { id: 'repositories', name: 'Repositories', icon: Package }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <tab.icon className="w-4 h-4 mr-2" />
                    {tab.name}
                  </button>
                ))}
              </nav>
            </div>

            {activeTab === 'apartments' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Apartments ({selectedBuilding.apartments.length})</h3>
                  <button
                    onClick={() => setShowApartmentForm(true)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Apartment
                  </button>
                </div>

                {selectedBuilding.apartments.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No apartments yet</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {selectedBuilding.apartments.map((apartment) => (
                      <div key={apartment.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h4 className="font-medium text-gray-900">Apartment {apartment.number}</h4>
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                apartment.status === 'Sold' ? 'bg-green-100 text-green-800' :
                                apartment.status === 'Reserved' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {apartment.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                              <div>Floor: {apartment.floor}</div>
                              <div>Size: {apartment.size_m2} m²</div>
                              <div>Price: €{apartment.price.toLocaleString()}</div>
                            </div>

                            <div className="flex items-center space-x-4">
                              {apartment.garage ? (
                                <div className="flex items-center space-x-2 px-3 py-1 bg-green-50 rounded-lg">
                                  <Car className="w-4 h-4 text-green-600" />
                                  <span className="text-sm text-green-900">Garage {apartment.garage.number}</span>
                                  <button
                                    onClick={() => unlinkFromApartment(apartment.id, 'garage')}
                                    className="ml-2 p-1 hover:bg-green-100 rounded"
                                  >
                                    <Unlink className="w-3 h-3 text-green-700" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => openLinkModal(apartment, 'garage')}
                                  className="flex items-center space-x-2 px-3 py-1 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                  <LinkIcon className="w-4 h-4 text-gray-600" />
                                  <span className="text-sm text-gray-700">Link Garage</span>
                                </button>
                              )}

                              {apartment.repository ? (
                                <div className="flex items-center space-x-2 px-3 py-1 bg-orange-50 rounded-lg">
                                  <Package className="w-4 h-4 text-orange-600" />
                                  <span className="text-sm text-orange-900">Repository {apartment.repository.number}</span>
                                  <button
                                    onClick={() => unlinkFromApartment(apartment.id, 'repository')}
                                    className="ml-2 p-1 hover:bg-orange-100 rounded"
                                  >
                                    <Unlink className="w-3 h-3 text-orange-700" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => openLinkModal(apartment, 'repository')}
                                  className="flex items-center space-x-2 px-3 py-1 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                  <LinkIcon className="w-4 h-4 text-gray-600" />
                                  <span className="text-sm text-gray-700">Link Repository</span>
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditApartment(apartment)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteApartment(apartment.id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'garages' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Garages ({selectedBuilding.garages.length})</h3>
                  <button
                    onClick={() => setShowGarageForm(true)}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Garage
                  </button>
                </div>

                {selectedBuilding.garages.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No garages yet</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedBuilding.garages.map((garage) => (
                      <div key={garage.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-gray-900">Garage {garage.number}</h4>
                            <span className={`inline-block mt-1 px-2 py-1 text-xs font-semibold rounded-full ${
                              garage.status === 'Sold' ? 'bg-green-100 text-green-800' :
                              garage.status === 'Reserved' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {garage.status}
                            </span>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditGarage(garage)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteGarage(garage.id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>Floor: {garage.floor}</div>
                          <div>Size: {garage.size_m2} m²</div>
                          <div>Price: €{garage.price.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'repositories' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Repositories ({selectedBuilding.repositories.length})</h3>
                  <button
                    onClick={() => setShowRepositoryForm(true)}
                    className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Repository
                  </button>
                </div>

                {selectedBuilding.repositories.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No repositories yet</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedBuilding.repositories.map((repository) => (
                      <div key={repository.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-gray-900">Repository {repository.number}</h4>
                            <span className={`inline-block mt-1 px-2 py-1 text-xs font-semibold rounded-full ${
                              repository.status === 'Sold' ? 'bg-green-100 text-green-800' :
                              repository.status === 'Reserved' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {repository.status}
                            </span>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditRepository(repository)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteRepository(repository.id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>Floor: {repository.floor}</div>
                          <div>Size: {repository.size_m2} m²</div>
                          <div>Price: €{repository.price.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Building Form Modal */}
      {showBuildingForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingBuilding ? 'Edit Building' : 'Add Building'}
              </h3>
              <button onClick={resetBuildingForm} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Building Name</label>
                <input
                  type="text"
                  value={newBuilding.name}
                  onChange={(e) => setNewBuilding({ ...newBuilding, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Building A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newBuilding.description}
                  onChange={(e) => setNewBuilding({ ...newBuilding, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Floors</label>
                <input
                  type="number"
                  value={newBuilding.total_floors}
                  onChange={(e) => setNewBuilding({ ...newBuilding, total_floors: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={editingBuilding ? updateBuilding : addBuilding}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingBuilding ? 'Update' : 'Add'} Building
                </button>
                <button
                  onClick={resetBuildingForm}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Apartment Form Modal */}
      {showApartmentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingApartment ? 'Edit Apartment' : 'Add Apartment'}
              </h3>
              <button onClick={resetApartmentForm} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number</label>
                <input
                  type="text"
                  value={newApartment.number}
                  onChange={(e) => setNewApartment({ ...newApartment, number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 101"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
                <input
                  type="number"
                  value={newApartment.floor}
                  onChange={(e) => setNewApartment({ ...newApartment, floor: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size (m²)</label>
                <input
                  type="number"
                  value={newApartment.size_m2}
                  onChange={(e) => setNewApartment({ ...newApartment, size_m2: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (€)</label>
                <input
                  type="number"
                  value={newApartment.price}
                  onChange={(e) => setNewApartment({ ...newApartment, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={newApartment.status}
                  onChange={(e) => setNewApartment({ ...newApartment, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Available">Available</option>
                  <option value="Reserved">Reserved</option>
                  <option value="Sold">Sold</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={editingApartment ? updateApartment : addApartment}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingApartment ? 'Update' : 'Add'} Apartment
                </button>
                <button
                  onClick={resetApartmentForm}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Garage Form Modal */}
      {showGarageForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingGarage ? 'Edit Garage' : 'Add Garage'}
              </h3>
              <button onClick={resetGarageForm} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number</label>
                <input
                  type="text"
                  value={newGarage.number}
                  onChange={(e) => setNewGarage({ ...newGarage, number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., G01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
                <input
                  type="number"
                  value={newGarage.floor}
                  onChange={(e) => setNewGarage({ ...newGarage, floor: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size (m²)</label>
                <input
                  type="number"
                  value={newGarage.size_m2}
                  onChange={(e) => setNewGarage({ ...newGarage, size_m2: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (€)</label>
                <input
                  type="number"
                  value={newGarage.price}
                  onChange={(e) => setNewGarage({ ...newGarage, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={newGarage.status}
                  onChange={(e) => setNewGarage({ ...newGarage, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="Available">Available</option>
                  <option value="Reserved">Reserved</option>
                  <option value="Sold">Sold</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={editingGarage ? updateGarage : addGarage}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  {editingGarage ? 'Update' : 'Add'} Garage
                </button>
                <button
                  onClick={resetGarageForm}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Repository Form Modal */}
      {showRepositoryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingRepository ? 'Edit Repository' : 'Add Repository'}
              </h3>
              <button onClick={resetRepositoryForm} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number</label>
                <input
                  type="text"
                  value={newRepository.number}
                  onChange={(e) => setNewRepository({ ...newRepository, number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., R01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
                <input
                  type="number"
                  value={newRepository.floor}
                  onChange={(e) => setNewRepository({ ...newRepository, floor: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Size (m²)</label>
                <input
                  type="number"
                  value={newRepository.size_m2}
                  onChange={(e) => setNewRepository({ ...newRepository, size_m2: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (€)</label>
                <input
                  type="number"
                  value={newRepository.price}
                  onChange={(e) => setNewRepository({ ...newRepository, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={newRepository.status}
                  onChange={(e) => setNewRepository({ ...newRepository, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="Available">Available</option>
                  <option value="Reserved">Reserved</option>
                  <option value="Sold">Sold</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={editingRepository ? updateRepository : addRepository}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  {editingRepository ? 'Update' : 'Add'} Repository
                </button>
                <button
                  onClick={resetRepositoryForm}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && linkingApartment && selectedBuilding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                Link {linkType === 'garage' ? 'Garage' : 'Repository'} to Apartment {linkingApartment.number}
              </h3>
              <button
                onClick={() => {
                  setShowLinkModal(false)
                  setLinkingApartment(null)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {linkType === 'garage' ? (
                selectedBuilding.garages
                  .filter(g => g.status === 'Available')
                  .map((garage) => (
                    <button
                      key={garage.id}
                      onClick={() => linkToApartment(linkingApartment.id, garage.id, 'garage')}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Garage {garage.number}</p>
                          <p className="text-sm text-gray-600">Floor {garage.floor} • {garage.size_m2}m² • €{garage.price.toLocaleString()}</p>
                        </div>
                        <Car className="w-5 h-5 text-green-600" />
                      </div>
                    </button>
                  ))
              ) : (
                selectedBuilding.repositories
                  .filter(r => r.status === 'Available')
                  .map((repository) => (
                    <button
                      key={repository.id}
                      onClick={() => linkToApartment(linkingApartment.id, repository.id, 'repository')}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Repository {repository.number}</p>
                          <p className="text-sm text-gray-600">Floor {repository.floor} • {repository.size_m2}m² • €{repository.price.toLocaleString()}</p>
                        </div>
                        <Package className="w-5 h-5 text-orange-600" />
                      </div>
                    </button>
                  ))
              )}

              {((linkType === 'garage' && selectedBuilding.garages.filter(g => g.status === 'Available').length === 0) ||
                (linkType === 'repository' && selectedBuilding.repositories.filter(r => r.status === 'Available').length === 0)) && (
                <p className="text-center py-8 text-gray-500">
                  No available {linkType === 'garage' ? 'garages' : 'repositories'} to link
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BuildingManagement
