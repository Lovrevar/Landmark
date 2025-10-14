import React, { useState, useEffect, useMemo } from 'react'
import { Plus, DollarSign, Building2, Home } from 'lucide-react'
import { Button } from './common/Button'
import { ProjectsList } from './sales/ProjectsList'
import { ApartmentCard } from './sales/ApartmentCard'
import { ApartmentFormModal } from './sales/ApartmentFormModal'
import { useModal } from '../hooks/useModal'
import { useApartments } from '../hooks/useApartments'
import { useCustomers } from '../hooks/useCustomers'
import { useSales } from '../hooks/useSales'
import { getProjectsWithApartments, ProjectWithApartments } from '../services/projectService'
import { ApartmentWithSale, getApartmentsWithSales } from '../services/apartmentService'
import { supabase, Apartment } from '../lib/supabase'

type FilterStatus = 'all' | 'available' | 'reserved' | 'sold'

const SalesProjectsNew: React.FC = () => {
  const [projects, setProjects] = useState<ProjectWithApartments[]>([])
  const [selectedProject, setSelectedProject] = useState<ProjectWithApartments | null>(null)
  const [apartments, setApartments] = useState<ApartmentWithSale[]>([])
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [selectedApartmentIds, setSelectedApartmentIds] = useState<string[]>([])
  const [editingApartment, setEditingApartment] = useState<Apartment | null>(null)
  const [loading, setLoading] = useState(true)

  const apartmentFormModal = useModal()
  const { customers } = useCustomers()
  const { refetch: refetchSales } = useSales()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const projectsData = await getProjectsWithApartments()
      setProjects(projectsData)

      if (selectedProject) {
        const updatedProject = projectsData.find(p => p.id === selectedProject.id)
        if (updatedProject) {
          setSelectedProject(updatedProject)
          setApartments(updatedProject.apartments)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProjectSelect = (project: ProjectWithApartments) => {
    setSelectedProject(project)
    setApartments(project.apartments)
    setSelectedApartmentIds([])
  }

  const filteredApartments = useMemo(() => {
    if (filterStatus === 'all') return apartments
    return apartments.filter(apt => {
      switch (filterStatus) {
        case 'available': return apt.status === 'Available'
        case 'reserved': return apt.status === 'Reserved'
        case 'sold': return apt.status === 'Sold'
        default: return true
      }
    })
  }, [apartments, filterStatus])

  const handleApartmentSelection = (apartmentId: string, isSelected: boolean) => {
    setSelectedApartmentIds(prev =>
      isSelected ? [...prev, apartmentId] : prev.filter(id => id !== apartmentId)
    )
  }

  const handleSelectAll = (isSelected: boolean) => {
    setSelectedApartmentIds(isSelected ? filteredApartments.map(apt => apt.id) : [])
  }

  const handleAddEditApartment = async (data: any) => {
    if (!selectedProject) return

    try {
      if (editingApartment) {
        await supabase
          .from('apartments')
          .update({
            number: data.number,
            floor: data.floor,
            size_m2: data.size_m2,
            price: data.price
          })
          .eq('id', editingApartment.id)
      } else {
        await supabase
          .from('apartments')
          .insert({
            project_id: selectedProject.id,
            number: data.number,
            floor: data.floor,
            size_m2: data.size_m2,
            price: data.price,
            status: 'Available'
          })
      }
      await fetchData()
      setEditingApartment(null)
    } catch (error) {
      console.error('Error saving apartment:', error)
      alert('Error saving apartment')
    }
  }

  const handleDeleteApartment = async (apartmentId: string) => {
    if (!confirm('Are you sure you want to delete this apartment?')) return

    try {
      await supabase.from('apartments').delete().eq('id', apartmentId)
      await fetchData()
    } catch (error) {
      console.error('Error deleting apartment:', error)
      alert('Error deleting apartment')
    }
  }

  const handleStatusChange = async (apartmentId: string, newStatus: string) => {
    try {
      await supabase
        .from('apartments')
        .update({
          status: newStatus,
          buyer_name: newStatus === 'Available' ? null : undefined
        })
        .eq('id', apartmentId)
      await fetchData()
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Error updating status')
    }
  }

  const handleEditClick = (apartment: ApartmentWithSale) => {
    setEditingApartment(apartment)
    apartmentFormModal.open()
  }

  const handleAddClick = () => {
    setEditingApartment(null)
    apartmentFormModal.open()
  }

  if (loading) {
    return <div className="text-center py-12">Loading sales projects...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Projects</h1>
          <p className="text-gray-600 mt-2">Manage apartment sales and customer relationships</p>
        </div>
        {selectedProject && (
          <Button variant="primary" icon={Plus} onClick={handleAddClick}>
            Add Apartment
          </Button>
        )}
      </div>

      <ProjectsList projects={projects} onProjectSelect={handleProjectSelect} />

      {selectedProject && (
        <>
          <div className="mb-6">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">Filter by status:</span>
              <div className="flex space-x-2">
                {[
                  { value: 'all' as const, label: 'All', count: apartments.length },
                  { value: 'available' as const, label: 'Available', count: apartments.filter(apt => apt.status === 'Available').length },
                  { value: 'reserved' as const, label: 'Reserved', count: apartments.filter(apt => apt.status === 'Reserved').length },
                  { value: 'sold' as const, label: 'Sold', count: apartments.filter(apt => apt.status === 'Sold').length }
                ].map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => {
                      setFilterStatus(filter.value)
                      setSelectedApartmentIds([])
                    }}
                    className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      filterStatus === filter.value
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    {filter.label}
                    <span className="ml-2 px-2 py-0.5 bg-white rounded-full text-xs">
                      {filter.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Apartments</h2>
              {filteredApartments.length > 0 && (
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedApartmentIds.length === filteredApartments.length && filteredApartments.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Select All</span>
                </label>
              )}
            </div>

            {filteredApartments.length === 0 ? (
              <div className="text-center py-12">
                <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Apartments</h3>
                <p className="text-gray-600 mb-4">
                  {filterStatus === 'all'
                    ? "This project doesn't have any apartments yet."
                    : `No ${filterStatus} apartments found.`}
                </p>
                <Button variant="primary" onClick={handleAddClick}>
                  Create Apartments
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredApartments.map((apartment) => (
                  <ApartmentCard
                    key={apartment.id}
                    apartment={apartment}
                    isSelected={selectedApartmentIds.includes(apartment.id)}
                    onSelect={handleApartmentSelection}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteApartment}
                    onSell={(apt) => console.log('Sell', apt)}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <ApartmentFormModal
        isOpen={apartmentFormModal.isOpen}
        onClose={apartmentFormModal.close}
        onSubmit={handleAddEditApartment}
        editingApartment={editingApartment}
      />
    </div>
  )
}

export default SalesProjectsNew
