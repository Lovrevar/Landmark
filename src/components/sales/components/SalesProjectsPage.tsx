import React, { useState } from 'react'
import { Plus, Building2 } from 'lucide-react'
import { ViewStateProvider, useViewState } from '../context/ViewStateContext'
import { useSalesData } from '../hooks/useSalesData'
import { useSaleWorkflow } from '../hooks/useSaleWorkflow'
import { ProjectsView } from './views/ProjectsView'
import { BuildingsView } from './views/BuildingsView'
import { UnitsView } from './views/UnitsView'
import { BuildingQuantityModal } from './modals/BuildingQuantityModal'
import { BuildingFormModal } from './modals/BuildingFormModal'
import { UnitFormModal } from './modals/UnitFormModal'
import { BulkUnitFormModal } from './modals/BulkUnitFormModal'
import { LinkingModal } from './modals/LinkingModal'
import { SaleFormModal } from './modals/SaleFormModal'
import * as BuildingsRepo from '../services/buildings.repo'
import * as UnitsRepo from '../services/units.repo'
import { EnhancedApartment } from '../types'
import { getUnitLabel, getUnitSingularLabel } from '../icons'

function SalesProjectsContent() {
  const {
    viewMode,
    selectedProject,
    selectedBuilding,
    activeUnitType,
    navigateToBuildings,
    navigateToUnits,
    navigateToProjects,
    navigateBackToBuildings
  } = useViewState()

  const {
    projects,
    buildings,
    apartments,
    garages,
    repositories,
    customers,
    loading,
    refresh
  } = useSalesData()

  const {
    unitForSale,
    customerMode,
    saleData,
    showSaleForm,
    setCustomerMode,
    setSaleData,
    handleSellUnit,
    resetSaleForm,
    completeSale
  } = useSaleWorkflow(refresh)

  const [showBuildingQuantityForm, setShowBuildingQuantityForm] = useState(false)
  const [showBuildingForm, setShowBuildingForm] = useState(false)
  const [showUnitForm, setShowUnitForm] = useState(false)
  const [showBulkUnitForm, setShowBulkUnitForm] = useState(false)
  const [showLinkingModal, setShowLinkingModal] = useState(false)
  const [selectedApartmentForLinking, setSelectedApartmentForLinking] = useState<EnhancedApartment | null>(null)

  const handleCreateBuildings = async (quantity: number) => {
    if (!selectedProject) return
    try {
      const { error } = await BuildingsRepo.createBulkBuildings(selectedProject.id, quantity)
      if (error) throw error
      setShowBuildingQuantityForm(false)
      refresh()
    } catch (error) {
      console.error('Error creating buildings:', error)
      alert('Error creating buildings. Please try again.')
    }
  }

  const handleCreateBuilding = async (data: any) => {
    if (!selectedProject) return
    try {
      const { error } = await BuildingsRepo.createBuilding(selectedProject.id, data)
      if (error) throw error
      setShowBuildingForm(false)
      refresh()
    } catch (error) {
      console.error('Error creating building:', error)
      alert('Error creating building. Please try again.')
    }
  }

  const handleDeleteBuilding = async (buildingId: string) => {
    try {
      const { error } = await BuildingsRepo.deleteBuilding(buildingId)
      if (error) throw error
      refresh()
    } catch (error) {
      console.error('Error deleting building:', error)
      alert('Error deleting building.')
    }
  }

  const handleCreateUnit = async (data: any) => {
    if (!selectedBuilding) return
    try {
      const { error } = await UnitsRepo.createUnit(
        activeUnitType,
        data,
        selectedBuilding.project_id
      )
      if (error) throw error
      setShowUnitForm(false)
      refresh()
    } catch (error) {
      console.error('Error creating unit:', error)
      alert('Error creating unit. Please try again.')
    }
  }

  const handleBulkCreateUnits = async (config: any) => {
    if (!selectedBuilding) return
    try {
      const { error } = await UnitsRepo.bulkCreateUnits(
        activeUnitType,
        selectedBuilding.id,
        selectedBuilding.project_id,
        config
      )
      if (error) throw error
      setShowBulkUnitForm(false)
      refresh()
    } catch (error) {
      console.error('Error bulk creating units:', error)
      alert('Error creating units. Please try again.')
    }
  }

  const handleDeleteUnit = async (unitId: string, unitType: any) => {
    if (!confirm(`Are you sure you want to delete this ${unitType}?`)) return
    try {
      const { error } = await UnitsRepo.deleteUnit(unitId, unitType)
      if (error) throw error
      refresh()
    } catch (error) {
      console.error('Error deleting unit:', error)
      alert('Error deleting unit.')
    }
  }

  const handleUpdateStatus = async (unitId: string, unitType: any, newStatus: string) => {
    try {
      const { error } = await UnitsRepo.updateUnitStatus(unitId, unitType, newStatus)
      if (error) throw error
      refresh()
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Error updating status.')
    }
  }

  const handleLinkGarage = async (apartmentId: string, garageId: string) => {
    try {
      const { error } = await UnitsRepo.linkGarageToApartment(apartmentId, garageId)
      if (error) throw error
      refresh()
    } catch (error) {
      console.error('Error linking garage:', error)
      alert('Error linking garage.')
    }
  }

  const handleLinkRepository = async (apartmentId: string, repositoryId: string) => {
    try {
      const { error } = await UnitsRepo.linkRepositoryToApartment(apartmentId, repositoryId)
      if (error) throw error
      refresh()
    } catch (error) {
      console.error('Error linking repository:', error)
      alert('Error linking repository.')
    }
  }

  const handleUnlinkGarage = async (apartmentId: string) => {
    try {
      const { error } = await UnitsRepo.unlinkGarageFromApartment(apartmentId)
      if (error) throw error
      refresh()
    } catch (error) {
      console.error('Error unlinking garage:', error)
      alert('Error unlinking garage.')
    }
  }

  const handleUnlinkRepository = async (apartmentId: string) => {
    try {
      const { error } = await UnitsRepo.unlinkRepositoryFromApartment(apartmentId)
      if (error) throw error
      refresh()
    } catch (error) {
      console.error('Error unlinking repository:', error)
      alert('Error unlinking repository.')
    }
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
                onClick={() => setShowUnitForm(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Single {getUnitSingularLabel(activeUnitType)}
              </button>
            </>
          )}
        </div>
      </div>

      {viewMode === 'projects' && (
        <ProjectsView projects={projects} onSelectProject={navigateToBuildings} />
      )}

      {viewMode === 'buildings' && selectedProject && (
        <div>
          <button
            onClick={navigateToProjects}
            className="mb-4 text-gray-600 hover:text-gray-900"
          >
            ← Back to Projects
          </button>
          <BuildingsView
            buildings={selectedProject.buildings}
            onSelectBuilding={navigateToUnits}
            onDeleteBuilding={handleDeleteBuilding}
          />
        </div>
      )}

      {viewMode === 'units' && selectedBuilding && (
        <div>
          <button
            onClick={navigateBackToBuildings}
            className="mb-4 text-gray-600 hover:text-gray-900"
          >
            ← Back to Buildings
          </button>
          <UnitsView
            building={selectedBuilding}
            garages={garages}
            repositories={repositories}
            onDeleteUnit={handleDeleteUnit}
            onUpdateStatus={handleUpdateStatus}
            onSellUnit={handleSellUnit}
            onOpenLinking={(apartment) => {
              setSelectedApartmentForLinking(apartment)
              setShowLinkingModal(true)
            }}
            onUnlinkGarage={handleUnlinkGarage}
            onUnlinkRepository={handleUnlinkRepository}
          />
        </div>
      )}

      <BuildingQuantityModal
        isOpen={showBuildingQuantityForm}
        onClose={() => setShowBuildingQuantityForm(false)}
        onSubmit={handleCreateBuildings}
      />

      <BuildingFormModal
        isOpen={showBuildingForm}
        onClose={() => setShowBuildingForm(false)}
        onSubmit={handleCreateBuilding}
      />

      <UnitFormModal
        isOpen={showUnitForm}
        unitType={activeUnitType}
        buildingId={selectedBuilding?.id || ''}
        onClose={() => setShowUnitForm(false)}
        onSubmit={handleCreateUnit}
      />

      <BulkUnitFormModal
        isOpen={showBulkUnitForm}
        unitType={activeUnitType}
        onClose={() => setShowBulkUnitForm(false)}
        onSubmit={handleBulkCreateUnits}
      />

      {selectedBuilding && (
        <LinkingModal
          isOpen={showLinkingModal}
          apartment={selectedApartmentForLinking}
          availableGarages={selectedBuilding.garages.filter(g => g.status === 'Available')}
          availableRepositories={selectedBuilding.repositories.filter(r => r.status === 'Available')}
          onClose={() => {
            setShowLinkingModal(false)
            setSelectedApartmentForLinking(null)
          }}
          onLinkGarage={handleLinkGarage}
          onLinkRepository={handleLinkRepository}
        />
      )}

      <SaleFormModal
        isOpen={showSaleForm}
        unit={unitForSale}
        customers={customers}
        saleData={saleData}
        customerMode={customerMode}
        onChange={(patch) => setSaleData({ ...saleData, ...patch })}
        onChangeCustomerMode={setCustomerMode}
        onSubmit={completeSale}
        onClose={resetSaleForm}
      />
    </div>
  )
}

export default function SalesProjectsPage() {
  return (
    <ViewStateProvider>
      <SalesProjectsContent />
    </ViewStateProvider>
  )
}
