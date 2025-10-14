import React, { useState } from 'react'
import { Building2, Plus } from 'lucide-react'
import { useSalesData } from './hooks/useSalesData'
import ProjectsView from './ProjectsView'
import BuildingsView from './BuildingsView'
import UnitsView from './UnitsView'
import BuildingForm from './forms/BuildingForm'
import BuildingQuantityForm from './forms/BuildingQuantityForm'
import UnitForm from './forms/UnitForm'
import BulkUnitForm from './forms/BulkUnitForm'
import LinkingModal from './forms/LinkingModal'
import SaleForm from './forms/SaleForm'
import { ApartmentWirePaymentModal } from './forms/ApartmentWirePaymentModal'
import { ApartmentPaymentHistoryModal } from './forms/ApartmentPaymentHistoryModal'
import { apartmentPaymentService } from './services/apartmentPaymentService'
import type { ProjectWithBuildings, BuildingWithUnits, ApartmentWithSaleInfo, UnitType, ViewMode } from './types/salesTypes'
import type { ApartmentPayment } from '../../lib/supabase'

const SalesProjectsEnhanced: React.FC = () => {
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
  const [selectedApartmentForLinking, setSelectedApartmentForLinking] = useState<ApartmentWithSaleInfo | null>(null)
  const [unitForSale, setUnitForSale] = useState<{unit: any, type: UnitType} | null>(null)

  const [showApartmentWireModal, setShowApartmentWireModal] = useState(false)
  const [showApartmentPaymentsModal, setShowApartmentPaymentsModal] = useState(false)
  const [selectedApartmentForPayment, setSelectedApartmentForPayment] = useState<any>(null)
  const [apartmentPaymentAmount, setApartmentPaymentAmount] = useState(0)
  const [apartmentPaymentDate, setApartmentPaymentDate] = useState('')
  const [apartmentPaymentNotes, setApartmentPaymentNotes] = useState('')
  const [apartmentPayments, setApartmentPayments] = useState<ApartmentPayment[]>([])

  const {
    projects,
    buildings,
    apartments,
    garages,
    repositories,
    customers,
    loading,
    createBuilding,
    createBuildings,
    deleteBuilding,
    createUnit,
    bulkCreateUnits,
    deleteUnit,
    updateUnitStatus,
    linkGarage,
    linkRepository,
    unlinkGarage,
    unlinkRepository,
    completeSale
  } = useSalesData(selectedProject, selectedBuilding, setSelectedProject, setSelectedBuilding)

  const handleSelectProject = (project: ProjectWithBuildings) => {
    setSelectedProject(project)
    setViewMode('buildings')
  }

  const handleSelectBuilding = (building: BuildingWithUnits) => {
    setSelectedBuilding(building)
    setViewMode('units')
  }

  const handleBackToProjects = () => {
    setSelectedProject(null)
    setViewMode('projects')
  }

  const handleBackToBuildings = () => {
    setSelectedBuilding(null)
    setViewMode('buildings')
  }

  const handleSellUnit = (unit: any, unitType: UnitType) => {
    setUnitForSale({ unit, type: unitType })
    setShowSaleForm(true)
  }

  const handleCompleteSale = async (saleData: any, customerMode: any) => {
    if (unitForSale) {
      await completeSale(unitForSale.unit.id, unitForSale.type, saleData, customerMode)
      setUnitForSale(null)
      setShowSaleForm(false)
    }
  }

  const handleCreateBuilding = async (buildingData: any) => {
    if (selectedProject) {
      await createBuilding(selectedProject.id, buildingData)
    }
  }

  const handleCreateBuildings = async (quantity: number) => {
    if (selectedProject) {
      await createBuildings(selectedProject.id, quantity)
    }
  }

  const handleCreateUnit = async (unitData: any) => {
    if (selectedBuilding) {
      await createUnit(activeUnitType, selectedBuilding.id, selectedBuilding.project_id, unitData)
    }
  }

  const handleBulkCreateUnits = async (bulkParams: any) => {
    if (selectedBuilding) {
      await bulkCreateUnits(activeUnitType, selectedBuilding.id, selectedBuilding.project_id, bulkParams)
    }
  }

  const getUnitLabel = (unitType: UnitType) => {
    if (unitType === 'apartment') return 'Apartments'
    if (unitType === 'garage') return 'Garages'
    return 'Repositories'
  }

  const handleApartmentWirePayment = (apartmentId: string) => {
    const apartment = selectedBuilding?.apartments.find(a => a.id === apartmentId)
    if (apartment && apartment.sale_info) {
      setSelectedApartmentForPayment(apartment)
      setApartmentPaymentAmount(0)
      setApartmentPaymentDate('')
      setApartmentPaymentNotes('')
      setShowApartmentWireModal(true)
    }
  }

  const handleViewApartmentPayments = async (apartmentId: string) => {
    const apartment = selectedBuilding?.apartments.find(a => a.id === apartmentId)
    if (apartment && apartment.sale_info) {
      setSelectedApartmentForPayment(apartment)
      const payments = await apartmentPaymentService.fetchPayments(apartmentId)
      setApartmentPayments(payments)
      setShowApartmentPaymentsModal(true)
    }
  }

  const handleSubmitApartmentPayment = async () => {
    if (!selectedApartmentForPayment || apartmentPaymentAmount <= 0) {
      alert('Please enter a valid payment amount')
      return
    }

    const success = await apartmentPaymentService.createPayment(
      selectedApartmentForPayment.id,
      apartmentPaymentAmount,
      apartmentPaymentDate || null,
      apartmentPaymentNotes || null
    )

    if (success) {
      setShowApartmentWireModal(false)
      setSelectedApartmentForPayment(null)
      if (selectedProject && selectedBuilding) {
        const updatedProject = projects.find(p => p.id === selectedProject.id)
        if (updatedProject) {
          setSelectedProject(updatedProject)
          const updatedBuilding = updatedProject.buildings.find(b => b.id === selectedBuilding.id)
          if (updatedBuilding) {
            setSelectedBuilding(updatedBuilding)
          }
        }
      }
    } else {
      alert('Failed to record payment')
    }
  }

  const handleDeleteApartmentPayment = async (paymentId: string, amount: number) => {
    if (!selectedApartmentForPayment || !confirm('Are you sure you want to delete this payment?')) {
      return
    }

    const success = await apartmentPaymentService.deletePayment(
      paymentId,
      selectedApartmentForPayment.id,
      amount
    )

    if (success) {
      const updatedPayments = await apartmentPaymentService.fetchPayments(selectedApartmentForPayment.id)
      setApartmentPayments(updatedPayments)
      if (selectedProject && selectedBuilding) {
        const updatedProject = projects.find(p => p.id === selectedProject.id)
        if (updatedProject) {
          setSelectedProject(updatedProject)
          const updatedBuilding = updatedProject.buildings.find(b => b.id === selectedBuilding.id)
          if (updatedBuilding) {
            setSelectedBuilding(updatedBuilding)
          }
        }
      }
    } else {
      alert('Failed to delete payment')
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
                Add Single {getUnitLabel(activeUnitType).slice(0, -1)}
              </button>
            </>
          )}
        </div>
      </div>

      {viewMode === 'projects' && (
        <ProjectsView
          projects={projects}
          onSelectProject={handleSelectProject}
        />
      )}

      {viewMode === 'buildings' && selectedProject && (
        <BuildingsView
          project={selectedProject}
          onBack={handleBackToProjects}
          onSelectBuilding={handleSelectBuilding}
          onDeleteBuilding={deleteBuilding}
          onShowAddBuilding={() => setShowBuildingForm(true)}
          onShowAddMultiple={() => setShowBuildingQuantityForm(true)}
        />
      )}

      {viewMode === 'units' && selectedBuilding && (
        <UnitsView
          building={selectedBuilding}
          garages={garages}
          repositories={repositories}
          activeUnitType={activeUnitType}
          filterStatus={filterStatus}
          onChangeUnitType={setActiveUnitType}
          onChangeFilterStatus={setFilterStatus}
          onBack={handleBackToBuildings}
          onDeleteUnit={deleteUnit}
          onUpdateStatus={updateUnitStatus}
          onSellUnit={handleSellUnit}
          onShowBulkCreate={() => setShowBulkUnitForm(true)}
          onShowAddUnit={() => setShowUnitForm(true)}
          onShowLinkingModal={(apt) => {
            setSelectedApartmentForLinking(apt)
            setShowLinkingModal(true)
          }}
          onUnlinkGarage={unlinkGarage}
          onUnlinkRepository={unlinkRepository}
          onWirePayment={handleApartmentWirePayment}
          onViewPayments={handleViewApartmentPayments}
        />
      )}

      <BuildingForm
        visible={showBuildingForm}
        onClose={() => setShowBuildingForm(false)}
        onSubmit={handleCreateBuilding}
      />

      <BuildingQuantityForm
        visible={showBuildingQuantityForm}
        onClose={() => setShowBuildingQuantityForm(false)}
        onSubmit={handleCreateBuildings}
      />

      <UnitForm
        visible={showUnitForm}
        unitType={activeUnitType}
        onClose={() => setShowUnitForm(false)}
        onSubmit={handleCreateUnit}
      />

      <BulkUnitForm
        visible={showBulkUnitForm}
        unitType={activeUnitType}
        onClose={() => setShowBulkUnitForm(false)}
        onSubmit={handleBulkCreateUnits}
      />

      <LinkingModal
        visible={showLinkingModal}
        apartment={selectedApartmentForLinking}
        availableGarages={selectedBuilding?.garages || []}
        availableRepositories={selectedBuilding?.repositories || []}
        onLinkGarage={linkGarage}
        onLinkRepository={linkRepository}
        onClose={() => {
          setShowLinkingModal(false)
          setSelectedApartmentForLinking(null)
        }}
      />

      <SaleForm
        visible={showSaleForm}
        unit={unitForSale?.unit || null}
        unitType={unitForSale?.type || 'apartment'}
        customers={customers}
        onClose={() => {
          setShowSaleForm(false)
          setUnitForSale(null)
        }}
        onSubmit={handleCompleteSale}
      />

      {selectedApartmentForPayment && selectedApartmentForPayment.sale_info && (
        <>
          <ApartmentWirePaymentModal
            visible={showApartmentWireModal}
            onClose={() => setShowApartmentWireModal(false)}
            apartmentNumber={selectedApartmentForPayment.number}
            salePrice={selectedApartmentForPayment.sale_info.sale_price}
            totalPaid={selectedApartmentForPayment.sale_info.total_paid}
            remaining={selectedApartmentForPayment.sale_info.remaining_amount}
            amount={apartmentPaymentAmount}
            paymentDate={apartmentPaymentDate}
            notes={apartmentPaymentNotes}
            onAmountChange={setApartmentPaymentAmount}
            onDateChange={setApartmentPaymentDate}
            onNotesChange={setApartmentPaymentNotes}
            onSubmit={handleSubmitApartmentPayment}
          />

          <ApartmentPaymentHistoryModal
            visible={showApartmentPaymentsModal}
            onClose={() => setShowApartmentPaymentsModal(false)}
            apartmentNumber={selectedApartmentForPayment.number}
            salePrice={selectedApartmentForPayment.sale_info.sale_price}
            totalPaid={selectedApartmentForPayment.sale_info.total_paid}
            remaining={selectedApartmentForPayment.sale_info.remaining_amount}
            payments={apartmentPayments}
            onDeletePayment={handleDeleteApartmentPayment}
          />
        </>
      )}
    </div>
  )
}

export default SalesProjectsEnhanced
