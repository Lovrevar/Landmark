import React, { useState } from 'react'
import { Plus, Building2 } from 'lucide-react'
import { Apartment } from '../lib/supabase'
import { useSalesData } from './Sales/hooks/useSalesData'
import * as salesService from './Sales/services/salesService'
import {
  ViewMode,
  UnitType,
  FilterStatus,
  ProjectWithBuildings,
  BuildingWithUnits,
  UnitForSale,
  SaleFormData,
  CustomerMode,
  BuildingFormData,
  UnitFormData,
  BulkCreateData
} from './Sales/types/salesTypes'
import { ProjectsGrid } from './Sales/views/ProjectsGrid'
import { BuildingsGrid } from './Sales/views/BuildingsGrid'
import { UnitsGrid } from './Sales/views/UnitsGrid'
import { BuildingQuantityModal } from './Sales/forms/BuildingQuantityModal'
import { SingleBuildingModal } from './Sales/forms/SingleBuildingModal'
import { SingleUnitModal } from './Sales/forms/SingleUnitModal'
import { BulkUnitsModal } from './Sales/forms/BulkUnitsModal'
import { LinkingModal } from './Sales/forms/LinkingModal'
import { SaleFormModal } from './Sales/forms/SaleFormModal'

const SalesProjectsEnhanced: React.FC = () => {
  const { projects, garages, repositories, customers, loading, refetch } = useSalesData()

  const [selectedProject, setSelectedProject] = useState<ProjectWithBuildings | null>(null)
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingWithUnits | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('projects')
  const [activeUnitType, setActiveUnitType] = useState<UnitType>('apartment')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')

  const [showBuildingQuantityForm, setShowBuildingQuantityForm] = useState(false)
  const [showBuildingForm, setShowBuildingForm] = useState(false)
  const [showUnitForm, setShowUnitForm] = useState(false)
  const [showBulkUnitForm, setShowBulkUnitForm] = useState(false)
  const [showLinkingModal, setShowLinkingModal] = useState(false)
  const [showSaleForm, setShowSaleForm] = useState(false)
  const [selectedApartmentForLinking, setSelectedApartmentForLinking] = useState<Apartment | null>(null)
  const [unitForSale, setUnitForSale] = useState<UnitForSale | null>(null)

  const handleSelectProject = (project: ProjectWithBuildings) => {
    setSelectedProject(project)
    setViewMode('buildings')
  }

  const handleSelectBuilding = (building: BuildingWithUnits) => {
    setSelectedBuilding(building)
    setViewMode('units')
  }

  const handleDeleteBuilding = async (buildingId: string) => {
    if (!confirm('Are you sure you want to delete this building? All units inside will also be deleted.')) return

    try {
      await salesService.deleteBuilding(buildingId)
      refetch()
    } catch (error) {
      console.error('Error deleting building:', error)
      alert('Error deleting building.')
    }
  }

  const handleCreateBulkBuildings = async (quantity: number) => {
    if (!selectedProject) return

    try {
      await salesService.createBulkBuildings(selectedProject.id, quantity)
      setShowBuildingQuantityForm(false)
      refetch()
    } catch (error) {
      console.error('Error creating buildings:', error)
      alert('Error creating buildings. Please try again.')
    }
  }

  const handleCreateBuilding = async (data: BuildingFormData) => {
    if (!selectedProject) return

    try {
      await salesService.createBuilding(selectedProject.id, data.name, data.description, data.total_floors)
      setShowBuildingForm(false)
      refetch()
    } catch (error) {
      console.error('Error creating building:', error)
      alert('Error creating building. Please try again.')
    }
  }

  const handleCreateUnit = async (data: UnitFormData) => {
    if (!selectedBuilding) return

    try {
      await salesService.createUnit(
        activeUnitType,
        data.building_id,
        selectedBuilding.project_id,
        data.number,
        data.floor,
        data.size_m2,
        data.price
      )
      setShowUnitForm(false)
      refetch()
    } catch (error) {
      console.error('Error creating unit:', error)
      alert('Error creating unit. Please try again.')
    }
  }

  const handleBulkCreateUnits = async (data: BulkCreateData) => {
    if (!selectedBuilding) return

    try {
      await salesService.bulkCreateUnits(activeUnitType, selectedBuilding.id, selectedBuilding.project_id, data)
      setShowBulkUnitForm(false)
      refetch()
    } catch (error) {
      console.error('Error bulk creating units:', error)
      alert('Error creating units. Please try again.')
    }
  }

  const handleDeleteUnit = async (unitId: string, unitType: UnitType) => {
    if (!confirm(`Are you sure you want to delete this ${unitType}?`)) return

    try {
      await salesService.deleteUnit(unitId, unitType)
      refetch()
    } catch (error) {
      console.error('Error deleting unit:', error)
      alert('Error deleting unit.')
    }
  }

  const handleUpdateUnitStatus = async (unitId: string, unitType: UnitType, newStatus: string) => {
    try {
      await salesService.updateUnitStatus(unitId, unitType, newStatus)
      refetch()
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Error updating status.')
    }
  }

  const handleLinkGarage = async (apartmentId: string, garageId: string) => {
    try {
      await salesService.linkGarageToApartment(apartmentId, garageId)
      refetch()
    } catch (error) {
      console.error('Error linking garage:', error)
      alert('Error linking garage.')
    }
  }

  const handleLinkRepository = async (apartmentId: string, repositoryId: string) => {
    try {
      await salesService.linkRepositoryToApartment(apartmentId, repositoryId)
      refetch()
    } catch (error) {
      console.error('Error linking repository:', error)
      alert('Error linking repository.')
    }
  }

  const handleUnlinkGarage = async (apartmentId: string) => {
    try {
      await salesService.unlinkGarageFromApartment(apartmentId)
      refetch()
    } catch (error) {
      console.error('Error unlinking garage:', error)
      alert('Error unlinking garage.')
    }
  }

  const handleUnlinkRepository = async (apartmentId: string) => {
    try {
      await salesService.unlinkRepositoryFromApartment(apartmentId)
      refetch()
    } catch (error) {
      console.error('Error unlinking repository:', error)
      alert('Error unlinking repository.')
    }
  }

  const handleSellUnit = (unit: any, unitType: UnitType) => {
    setUnitForSale({ unit, type: unitType })
    setShowSaleForm(true)
  }

  const handleCompleteSale = async (saleData: SaleFormData, customerMode: CustomerMode) => {
    if (!unitForSale) return

    try {
      let customerId = saleData.customer_id

      if (customerMode === 'new') {
        if (!saleData.buyer_name.trim() || !saleData.buyer_email.trim()) {
          alert('Please fill in buyer name and email')
          return
        }

        const [firstName, ...lastNameParts] = saleData.buyer_name.trim().split(' ')
        const lastName = lastNameParts.join(' ') || firstName

        const newCustomer = await salesService.createCustomer(
          firstName,
          lastName,
          saleData.buyer_email,
          saleData.buyer_phone,
          saleData.buyer_address
        )
        customerId = newCustomer.id
      }

      await salesService.createSale(
        unitForSale.unit.id,
        unitForSale.type,
        customerId,
        saleData.sale_price,
        saleData.payment_method,
        saleData.down_payment,
        saleData.monthly_payment,
        saleData.sale_date,
        saleData.contract_signed,
        saleData.notes
      )

      if (customerMode === 'existing' && customerId) {
        await salesService.updateCustomerStatus(customerId, 'buyer')
      }

      await salesService.updateUnitAfterSale(unitForSale.unit.id, unitForSale.type, saleData.buyer_name)

      alert('Sale completed successfully!')
      setShowSaleForm(false)
      setUnitForSale(null)
      refetch()
    } catch (error) {
      console.error('Error completing sale:', error)
      alert('Error completing sale. Please try again.')
    }
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
                Add Single {getUnitLabel(activeUnitType).slice(0, -1)}
              </button>
            </>
          )}
        </div>
      </div>

      {viewMode === 'projects' && (
        <ProjectsGrid projects={projects} onSelectProject={handleSelectProject} />
      )}

      {viewMode === 'buildings' && selectedProject && (
        <BuildingsGrid
          project={selectedProject}
          onSelectBuilding={handleSelectBuilding}
          onDeleteBuilding={handleDeleteBuilding}
          onBack={() => {
            setViewMode('projects')
            setSelectedProject(null)
          }}
        />
      )}

      {viewMode === 'units' && selectedBuilding && (
        <UnitsGrid
          building={selectedBuilding}
          activeUnitType={activeUnitType}
          filterStatus={filterStatus}
          garages={garages}
          repositories={repositories}
          onSetActiveUnitType={setActiveUnitType}
          onSetFilterStatus={setFilterStatus}
          onDeleteUnit={handleDeleteUnit}
          onUpdateUnitStatus={handleUpdateUnitStatus}
          onSellUnit={handleSellUnit}
          onLinkApartment={(apartment) => {
            setSelectedApartmentForLinking(apartment)
            setShowLinkingModal(true)
          }}
          onUnlinkGarage={handleUnlinkGarage}
          onUnlinkRepository={handleUnlinkRepository}
          onBack={() => {
            setViewMode('buildings')
            setSelectedBuilding(null)
          }}
        />
      )}

      <BuildingQuantityModal
        visible={showBuildingQuantityForm}
        onClose={() => setShowBuildingQuantityForm(false)}
        onSubmit={handleCreateBulkBuildings}
      />

      <SingleBuildingModal
        visible={showBuildingForm}
        onClose={() => setShowBuildingForm(false)}
        onSubmit={handleCreateBuilding}
      />

      <SingleUnitModal
        visible={showUnitForm}
        buildingId={selectedBuilding?.id || ''}
        unitType={activeUnitType}
        onClose={() => setShowUnitForm(false)}
        onSubmit={handleCreateUnit}
      />

      <BulkUnitsModal
        visible={showBulkUnitForm}
        unitType={activeUnitType}
        onClose={() => setShowBulkUnitForm(false)}
        onSubmit={handleBulkCreateUnits}
      />

      <LinkingModal
        visible={showLinkingModal}
        apartment={selectedApartmentForLinking}
        building={selectedBuilding}
        onClose={() => {
          setShowLinkingModal(false)
          setSelectedApartmentForLinking(null)
        }}
        onLinkGarage={handleLinkGarage}
        onLinkRepository={handleLinkRepository}
      />

      <SaleFormModal
        visible={showSaleForm}
        unitForSale={unitForSale}
        customers={customers}
        onClose={() => {
          setShowSaleForm(false)
          setUnitForSale(null)
        }}
        onSubmit={handleCompleteSale}
      />
    </div>
  )
}

export default SalesProjectsEnhanced
