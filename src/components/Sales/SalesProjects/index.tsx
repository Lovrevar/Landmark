import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Building2, FileUp } from 'lucide-react'
import { LoadingSpinner, PageHeader, Button, ConfirmDialog } from '../../ui'
import { useToast } from '../../../contexts/ToastContext'
import { Apartment, Garage, Repository } from '../../../lib/supabase'
import { useSalesData } from './hooks/useSalesData'
import * as salesService from './services/salesService'
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
} from './types'
import { ProjectsGrid } from './ProjectsGrid'
import { BuildingsGrid } from './BuildingsGrid'
import { UnitsGrid } from './UnitsGrid'
import { BuildingQuantityModal } from './modals/BuildingQuantityModal'
import { SingleBuildingModal } from './modals/SingleBuildingModal'
import { SingleUnitModal } from './modals/SingleUnitModal'
import { BulkUnitsModal } from './modals/BulkUnitsModal'
import { LinkingModal } from './modals/LinkingModal'
import { SaleFormModal } from './forms/SaleFormModal'
import { BulkPriceUpdateModal } from './modals/BulkPriceUpdateModal'
import { ExcelImportApartmentsModal } from './modals/ExcelImportApartmentsModal'
import { ExcelImportGaragesModal } from './modals/ExcelImportGaragesModal'

const SalesProjectsEnhanced: React.FC = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const { projects, garages, repositories, customers, loading, refetch } = useSalesData()

  const [selectedProject, setSelectedProject] = useState<ProjectWithBuildings | null>(null)
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingWithUnits | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('projects')
  const [activeUnitType, setActiveUnitType] = useState<UnitType>('apartment')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')

  React.useEffect(() => {
    if (selectedProject) {
      const updatedProject = projects.find(p => p.id === selectedProject.id)
      if (updatedProject) {
        setSelectedProject(updatedProject)
      }
    }
  }, [projects])

  React.useEffect(() => {
    if (selectedBuilding && selectedProject) {
      const updatedBuilding = selectedProject.buildings.find(b => b.id === selectedBuilding.id)
      if (updatedBuilding) {
        setSelectedBuilding(updatedBuilding)
      }
    }
  }, [selectedProject])

  const [showBuildingQuantityForm, setShowBuildingQuantityForm] = useState(false)
  const [showBuildingForm, setShowBuildingForm] = useState(false)
  const [showUnitForm, setShowUnitForm] = useState(false)
  const [showBulkUnitForm, setShowBulkUnitForm] = useState(false)
  const [showLinkingModal, setShowLinkingModal] = useState(false)
  const [showSaleForm, setShowSaleForm] = useState(false)
  const [selectedApartmentForLinking, setSelectedApartmentForLinking] = useState<Apartment | null>(null)
  const [unitForSale, setUnitForSale] = useState<UnitForSale | null>(null)
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([])
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false)
  const [showImportApartmentsModal, setShowImportApartmentsModal] = useState(false)
  const [showImportGaragesModal, setShowImportGaragesModal] = useState(false)
  const [pendingDeleteBuildingId, setPendingDeleteBuildingId] = useState<string | null>(null)
  const [deletingBuilding, setDeletingBuilding] = useState(false)
  const [pendingDeleteUnit, setPendingDeleteUnit] = useState<{ id: string; unitType: UnitType } | null>(null)
  const [deletingUnit, setDeletingUnit] = useState(false)

  const handleSelectProject = (project: ProjectWithBuildings) => {
    setSelectedProject(project)
    setViewMode('buildings')
  }

  const handleSelectBuilding = (building: BuildingWithUnits) => {
    setSelectedBuilding(building)
    setViewMode('units')
  }

  const handleDeleteBuilding = (buildingId: string) => {
    setPendingDeleteBuildingId(buildingId)
  }

  const confirmDeleteBuilding = async () => {
    if (!pendingDeleteBuildingId) return
    setDeletingBuilding(true)
    try {
      await salesService.deleteBuilding(pendingDeleteBuildingId)
      await refetch()
    } catch (error) {
      console.error('Error deleting building:', error)
      toast.error('Error deleting building.')
    } finally {
      setDeletingBuilding(false)
      setPendingDeleteBuildingId(null)
    }
  }

  const handleCreateBulkBuildings = async (quantity: number) => {
    if (!selectedProject) return

    try {
      await salesService.createBulkBuildings(selectedProject.id, quantity)
      setShowBuildingQuantityForm(false)
      await refetch()
    } catch (error) {
      console.error('Error creating buildings:', error)
      toast.error('Error creating buildings. Please try again.')
    }
  }

  const handleCreateBuilding = async (data: BuildingFormData) => {
    if (!selectedProject) return

    try {
      await salesService.createBuilding(selectedProject.id, data.name, data.description, data.total_floors)
      setShowBuildingForm(false)
      await refetch()
    } catch (error) {
      console.error('Error creating building:', error)
      toast.error('Error creating building. Please try again.')
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
        data.price_per_m2
      )
      setShowUnitForm(false)
      refetch()
    } catch (error) {
      console.error('Error creating unit:', error)
      toast.error('Error creating unit. Please try again.')
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
      toast.error('Error creating units. Please try again.')
    }
  }

  const handleDeleteUnit = (unitId: string, unitType: UnitType) => {
    setPendingDeleteUnit({ id: unitId, unitType })
  }

  const confirmDeleteUnit = async () => {
    if (!pendingDeleteUnit) return
    setDeletingUnit(true)
    try {
      await salesService.deleteUnit(pendingDeleteUnit.id, pendingDeleteUnit.unitType)
      refetch()
    } catch (error) {
      console.error('Error deleting unit:', error)
      toast.error('Error deleting unit.')
    } finally {
      setDeletingUnit(false)
      setPendingDeleteUnit(null)
    }
  }

  const handleUpdateUnitStatus = async (unitId: string, unitType: UnitType, newStatus: string) => {
    try {
      await salesService.updateUnitStatus(unitId, unitType, newStatus)
      refetch()
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Error updating status.')
    }
  }

  const handleLinkGarage = async (apartmentId: string, garageId: string) => {
    try {
      await salesService.linkGarageToApartment(apartmentId, garageId)
      refetch()
    } catch (error) {
      console.error('Error linking garage:', error)
      toast.error('Error linking garage.')
    }
  }

  const handleLinkRepository = async (apartmentId: string, repositoryId: string) => {
    try {
      await salesService.linkRepositoryToApartment(apartmentId, repositoryId)
      refetch()
    } catch (error) {
      console.error('Error linking repository:', error)
      toast.error('Error linking repository.')
    }
  }

  const handleUnlinkGarage = async (apartmentId: string, garageId: string) => {
    try {
      await salesService.unlinkGarageFromApartment(apartmentId, garageId)
      refetch()
    } catch (error) {
      console.error('Error unlinking garage:', error)
      toast.error('Error unlinking garage.')
    }
  }

  const handleUnlinkRepository = async (apartmentId: string, repositoryId: string) => {
    try {
      await salesService.unlinkRepositoryFromApartment(apartmentId, repositoryId)
      refetch()
    } catch (error) {
      console.error('Error unlinking repository:', error)
      toast.error('Error unlinking repository.')
    }
  }

  const handleSellUnit = (unit: Apartment | Garage | Repository, unitType: UnitType) => {
    setUnitForSale({ unit, type: unitType })
    setShowSaleForm(true)
  }

  const handleToggleUnitSelection = (unitId: string) => {
    setSelectedUnitIds(prev => {
      if (prev.includes(unitId)) {
        return prev.filter(id => id !== unitId)
      } else {
        return [...prev, unitId]
      }
    })
  }

  const handleSelectAllUnits = () => {
    if (!selectedBuilding) return
    let units: { id: string }[] = []
    if (activeUnitType === 'apartment') units = selectedBuilding.apartments
    else if (activeUnitType === 'garage') units = selectedBuilding.garages
    else if (activeUnitType === 'repository') units = selectedBuilding.repositories

    const allIds = units.map(u => u.id)
    setSelectedUnitIds(allIds)
  }

  const handleDeselectAllUnits = () => {
    setSelectedUnitIds([])
  }

  const handleConfigurePrice = () => {
    setShowBulkPriceModal(true)
  }

  const handleBulkPriceUpdate = async (adjustmentType: 'increase' | 'decrease', adjustmentValue: number) => {
   

    try {
      await salesService.bulkUpdateUnitPrice(selectedUnitIds, activeUnitType, adjustmentType, adjustmentValue)
      setShowBulkPriceModal(false)
      setSelectedUnitIds([])
      refetch()
    } catch (error) {
      console.error('Error updating prices:', error)
      toast.error('Error updating prices. Please try again.')
    }
  }

  const handleCompleteSale = async (saleData: SaleFormData, customerMode: CustomerMode) => {
    if (!unitForSale) return

    try {
      await salesService.completeSale({
        unitForSale,
        saleData,
        customerMode,
        existingCustomers: customers
      })
      setShowSaleForm(false)
      setUnitForSale(null)
      refetch()
    } catch (error) {
      console.error('Error completing sale:', error)
      toast.error('Error completing sale. Please try again.')
    }
  }

  const getUnitLabel = (unitType: UnitType) => {
    if (unitType === 'apartment') return t('sales_projects.units.apartments')
    if (unitType === 'garage') return t('sales_projects.units.garages')
    return t('sales_projects.units.repositories')
  }

  const getUnitLabelSingular = (unitType: UnitType) => {
    if (unitType === 'apartment') return t('common.apartment')
    if (unitType === 'garage') return t('common.garage')
    return t('common.storage')
  }

  if (loading) {
    return <LoadingSpinner message={t('common.loading')} />
  }

  return (
    <div>
      <PageHeader
        title={t('sales_projects.title')}
        description={
          viewMode === 'projects' ? t('sales_projects.select_project') :
          viewMode === 'buildings' ? `${t('sales_projects.managing_buildings')} ${selectedProject?.name}` :
          `${t('sales_projects.managing_units')} ${selectedBuilding?.name}`
        }
        className="mb-6"
        actions={
          <>
            {viewMode === 'buildings' && selectedProject && (
              <>
                <Button
                  variant="info"
                  icon={FileUp}
                  onClick={() => setShowImportApartmentsModal(true)}
                >
                  {t('sales_projects.import_excel')}
                </Button>
                <Button
                  variant="success"
                  icon={Plus}
                  onClick={() => setShowBuildingQuantityForm(true)}
                >
                  {t('sales_projects.create_buildings')}
                </Button>
                <Button
                  icon={Building2}
                  onClick={() => setShowBuildingForm(true)}
                >
                  {t('sales_projects.add_single_building')}
                </Button>
              </>
            )}
            {viewMode === 'units' && selectedBuilding && (
              <>
                {activeUnitType === 'garage' && (
                  <Button
                    variant="info"
                    icon={FileUp}
                    onClick={() => setShowImportGaragesModal(true)}
                  >
                    {t('sales_projects.import_garages_excel')}
                  </Button>
                )}
                <Button
                  variant="success"
                  icon={Building2}
                  onClick={() => setShowBulkUnitForm(true)}
                >
                  {t('sales_projects.bulk_create')} {getUnitLabel(activeUnitType)}
                </Button>
                <Button
                  icon={Plus}
                  onClick={() => setShowUnitForm(true)}
                >
                  {t('sales_projects.add_single')} {getUnitLabelSingular(activeUnitType)}
                </Button>
              </>
            )}
          </>
        }
      />

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
            setSelectedUnitIds([])
          }}
          selectedUnitIds={selectedUnitIds}
          onToggleUnitSelection={handleToggleUnitSelection}
          onSelectAllUnits={handleSelectAllUnits}
          onDeselectAllUnits={handleDeselectAllUnits}
          onConfigurePrice={handleConfigurePrice}
        />
      )}

      <BuildingQuantityModal
        visible={showBuildingQuantityForm}
        project={selectedProject || { name: '' }}
        onClose={() => setShowBuildingQuantityForm(false)}
        onSubmit={handleCreateBulkBuildings}
      />

      <SingleBuildingModal
        visible={showBuildingForm}
        project={selectedProject || { name: '' }}
        onClose={() => setShowBuildingForm(false)}
        onSubmit={handleCreateBuilding}
      />

      <SingleUnitModal
        visible={showUnitForm}
        buildingId={selectedBuilding?.id || ''}
        unitType={activeUnitType}
        selectedBuilding={selectedBuilding || { name: '' }}
        onClose={() => setShowUnitForm(false)}
        onSubmit={handleCreateUnit}
      />

      <BulkUnitsModal
        visible={showBulkUnitForm}
        unitType={activeUnitType}
        selectedBuilding={selectedBuilding || { name: '' }}
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

      <BulkPriceUpdateModal
        visible={showBulkPriceModal}
        selectedUnits={
          selectedBuilding
            ? (activeUnitType === 'apartment'
                ? selectedBuilding.apartments
                : activeUnitType === 'garage'
                ? selectedBuilding.garages
                : selectedBuilding.repositories
              ).filter(u => selectedUnitIds.includes(u.id))
            : []
        }
        unitType={activeUnitType}
        onClose={() => setShowBulkPriceModal(false)}
        onSubmit={handleBulkPriceUpdate}
      />

      <ExcelImportApartmentsModal
        visible={showImportApartmentsModal}
        selectedProject={selectedProject}
        onClose={() => setShowImportApartmentsModal(false)}
        onComplete={() => {
          setShowImportApartmentsModal(false)
          refetch()
        }}
      />

      <ExcelImportGaragesModal
        visible={showImportGaragesModal}
        selectedBuilding={selectedBuilding}
        onClose={() => setShowImportGaragesModal(false)}
        onComplete={() => {
          setShowImportGaragesModal(false)
          refetch()
        }}
      />

      <ConfirmDialog
        show={!!pendingDeleteBuildingId}
        title={t('confirm.delete_title')}
        message={t('sales_projects.confirm_delete_building')}
        confirmLabel={t('confirm.delete_confirm')}
        cancelLabel={t('confirm.cancel')}
        variant="danger"
        onConfirm={confirmDeleteBuilding}
        onCancel={() => setPendingDeleteBuildingId(null)}
        loading={deletingBuilding}
      />

      <ConfirmDialog
        show={!!pendingDeleteUnit}
        title={t('confirm.delete_title')}
        message={pendingDeleteUnit ? t('sales_projects.confirm_delete_unit') : ''}
        confirmLabel={t('confirm.delete_confirm')}
        cancelLabel={t('confirm.cancel')}
        variant="danger"
        onConfirm={confirmDeleteUnit}
        onCancel={() => setPendingDeleteUnit(null)}
        loading={deletingUnit}
      />
    </div>
  )
}

export default SalesProjectsEnhanced
