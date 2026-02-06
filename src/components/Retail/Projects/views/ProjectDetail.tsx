import React, { useState, useEffect } from 'react'
import { ArrowLeft, MapPin, RefreshCw, Link, User } from 'lucide-react'
import { Button, Badge, LoadingSpinner, EmptyState } from '../../../../components/ui'
import { PhaseCard } from './PhaseCard'
import { ProjectStatistics } from './ProjectStatistics'
import { MilestoneList } from './MilestoneList'
import { ContractFormModal } from '../forms/ContractFormModal'
import { DevelopmentFormModal } from '../forms/DevelopmentFormModal'
import { SalesFormModal } from '../forms/SalesFormModal'
import { EditPhaseModal } from '../forms/EditPhaseModal'
import { RetailPaymentHistoryModal } from '../forms/RetailPaymentHistoryModal'
import { RetailInvoicesModal } from '../forms/RetailInvoicesModal'
import { retailProjectService } from '../services/retailProjectService'
import type { RetailProjectWithPhases, RetailProjectPhase, RetailContract } from '../../../../types/retail'

interface ProjectDetailProps {
  project: RetailProjectWithPhases
  onBack: () => void
  onRefresh: () => void
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({ project: initialProject, onBack, onRefresh }) => {
  const [project, setProject] = useState(initialProject)
  const [phaseContracts, setPhaseContracts] = useState<Record<string, RetailContract[]>>({})
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)
  const [selectedPhase, setSelectedPhase] = useState<RetailProjectPhase | null>(null)
  const [selectedContract, setSelectedContract] = useState<RetailContract | null>(null)
  const [showMilestoneManagement, setShowMilestoneManagement] = useState(false)
  const [milestoneContext, setMilestoneContext] = useState<{
    contract: RetailContract
    phase: RetailProjectPhase
    project: RetailProjectWithPhases
  } | null>(null)
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false)
  const [showInvoicesModal, setShowInvoicesModal] = useState(false)
  const [selectedContractForModal, setSelectedContractForModal] = useState<RetailContract | null>(null)
  const [showEditPhaseModal, setShowEditPhaseModal] = useState(false)
  const [phaseToEdit, setPhaseToEdit] = useState<RetailProjectPhase | null>(null)

  useEffect(() => {
    loadProjectDetails()
  }, [initialProject.id])

  const loadProjectDetails = async () => {
    try {
      setLoading(true)
      const data = await retailProjectService.fetchProjectById(initialProject.id)
      if (data) {
        setProject(data)

        const contractsMap: Record<string, RetailContract[]> = {}
        await Promise.all(
          data.phases.map(async (phase) => {
            const contracts = await retailProjectService.fetchContractsByPhase(phase.id)
            contractsMap[phase.id] = contracts
          })
        )
        setPhaseContracts(contractsMap)
      }
    } catch (error) {
      console.error('Error loading project details:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadProjectDetails()
    setRefreshing(false)
    onRefresh()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hr-HR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const handleEditPhase = (phase: RetailProjectPhase) => {
    setPhaseToEdit(phase)
    setShowEditPhaseModal(true)
  }

  const handleEditPhaseModalClose = () => {
    setShowEditPhaseModal(false)
    setPhaseToEdit(null)
  }

  const handleEditPhaseSuccess = async () => {
    setShowEditPhaseModal(false)
    setPhaseToEdit(null)
    await handleRefresh()
  }

  const handleDeletePhase = async (phase: RetailProjectPhase) => {
    if (confirm(`Jeste li sigurni da želite obrisati fazu "${phase.phase_name}"?`)) {
      try {
        await retailProjectService.deletePhase(phase.id)
        await handleRefresh()
      } catch (error) {
        console.error('Error deleting phase:', error)
        alert('Greška pri brisanju faze')
      }
    }
  }

  const handleAddContract = (phase: RetailProjectPhase) => {
    setSelectedPhase(phase)
    setSelectedContract(null)
    setShowContractModal(true)
  }

  const handleEditContract = (contract: RetailContract) => {
    setSelectedContract(contract)
    const phase = project.phases.find(p => p.id === contract.phase_id)
    if (phase) {
      setSelectedPhase(phase)
      setShowContractModal(true)
    }
  }

  const handleContractModalClose = () => {
    setShowContractModal(false)
    setSelectedPhase(null)
    setSelectedContract(null)
  }

  const handleContractSuccess = async () => {
    setShowContractModal(false)
    setSelectedPhase(null)
    setSelectedContract(null)
    await handleRefresh()
  }

  const handleDeleteContract = async (contractId: string) => {
    if (confirm('Jeste li sigurni da želite obrisati ovaj ugovor?')) {
      try {
        await retailProjectService.deleteContract(contractId)
        await handleRefresh()
      } catch (error) {
        console.error('Error deleting contract:', error)
        alert('Greška pri brisanju ugovora')
      }
    }
  }

  const handleViewPayments = (contract: RetailContract) => {
    setSelectedContractForModal(contract)
    setShowPaymentHistoryModal(true)
  }

  const handleViewInvoices = (contract: RetailContract) => {
    setSelectedContractForModal(contract)
    setShowInvoicesModal(true)
  }

  const handleClosePaymentHistoryModal = () => {
    setShowPaymentHistoryModal(false)
    setSelectedContractForModal(null)
  }

  const handleCloseInvoicesModal = () => {
    setShowInvoicesModal(false)
    setSelectedContractForModal(null)
  }

  const handleManageMilestones = (contract: RetailContract, phase: RetailProjectPhase, project: RetailProjectWithPhases) => {
    setMilestoneContext({ contract, phase, project })
    setShowMilestoneManagement(true)
  }

  const closeMilestoneManagement = () => {
    setShowMilestoneManagement(false)
    setMilestoneContext(null)
  }

  const getStatusBadgeVariant = (status: string): 'green' | 'blue' | 'yellow' | 'gray' => {
    switch (status) {
      case 'Completed':
        return 'green'
      case 'In Progress':
        return 'blue'
      case 'Planning':
        return 'yellow'
      default:
        return 'gray'
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" icon={ArrowLeft} onClick={onBack}>
          Nazad na projekte
        </Button>
        <Button icon={RefreshCw} loading={refreshing} onClick={handleRefresh}>
          Refresh Data
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.name}</h1>
            <div className="flex items-center text-gray-600 mb-4">
              <MapPin className="w-5 h-5 mr-2" />
              {project.location} - Čestica: {project.plot_number}
            </div>
          </div>
          <Badge variant={getStatusBadgeVariant(project.status)} size="md">
            {project.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-600 mb-1">Površina</div>
            <div className="text-2xl font-bold text-blue-900">{project.total_area_m2.toLocaleString()} m²</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600 mb-1">Budžet projekta</div>
            <div className="text-2xl font-bold text-green-900">{formatCurrency(project.purchase_price)}</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm text-orange-600 mb-1">Cijena po m²</div>
            <div className="text-2xl font-bold text-orange-900">{formatCurrency(project.price_per_m2)}</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-4">
            <div className="text-sm text-amber-600 mb-1">Broj faza</div>
            <div className="text-2xl font-bold text-amber-900">{project.phases.length}</div>
          </div>
        </div>

        {project.land_plot && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center mb-4">
              <Link className="w-5 h-5 mr-2 text-emerald-600" />
              <h3 className="text-lg font-semibold text-gray-900">Povezano zemljište</h3>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center text-sm text-emerald-700 mb-1">
                    <User className="w-4 h-4 mr-1" />
                    Vlasnik
                  </div>
                  <div className="text-base font-semibold text-emerald-900">
                    {project.land_plot.owner_first_name} {project.land_plot.owner_last_name}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-emerald-700 mb-1">Broj čestice</div>
                  <div className="text-base font-semibold text-emerald-900">{project.land_plot.plot_number}</div>
                </div>
                <div>
                  <div className="text-sm text-emerald-700 mb-1">Ukupna površina zemljišta</div>
                  <div className="text-base font-semibold text-emerald-900">{project.land_plot.total_area_m2.toLocaleString()} m²</div>
                </div>
                <div>
                  <div className="text-sm text-emerald-700 mb-1">Kupljena površina</div>
                  <div className="text-base font-semibold text-emerald-900">{project.land_plot.purchased_area_m2.toLocaleString()} m²</div>
                </div>
                <div>
                  <div className="text-sm text-emerald-700 mb-1">Cijena po m²</div>
                  <div className="text-base font-semibold text-emerald-900">{formatCurrency(project.land_plot.price_per_m2)}</div>
                </div>
                <div>
                  <div className="text-sm text-emerald-700 mb-1">Ukupna cijena zemljišta</div>
                  <div className="text-base font-semibold text-emerald-900">{formatCurrency(project.land_plot.total_price)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {!loading && (
        <ProjectStatistics
          project={project}
          allContracts={Object.values(phaseContracts).flat()}
        />
      )}

      {loading ? (
        <LoadingSpinner message="Učitavam detalje..." />
      ) : (
        <div className="space-y-6">
          {project.phases.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
              <EmptyState
                title="Nema faza u projektu"
                description="Faze će biti automatski kreirane"
              />
            </div>
          ) : (
            project.phases
              .sort((a, b) => a.phase_order - b.phase_order)
              .map((phase) => (
                <PhaseCard
                  key={phase.id}
                  phase={phase}
                  project={project}
                  phaseContracts={phaseContracts[phase.id] || []}
                  onEditPhase={handleEditPhase}
                  onDeletePhase={handleDeletePhase}
                  onAddContract={handleAddContract}
                  onEditContract={handleEditContract}
                  onDeleteContract={handleDeleteContract}
                  onViewPayments={handleViewPayments}
                  onViewInvoices={handleViewInvoices}
                  onManageMilestones={handleManageMilestones}
                />
              ))
          )}
        </div>
      )}

      {project.notes && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Napomene</h3>
          <p className="text-gray-600 whitespace-pre-wrap">{project.notes}</p>
        </div>
      )}

      {showContractModal && selectedPhase && (
        <>
          {selectedPhase.phase_type === 'development' ? (
            <DevelopmentFormModal
              phase={selectedPhase}
              contract={selectedContract || undefined}
              onClose={handleContractModalClose}
              onSuccess={handleContractSuccess}
            />
          ) : selectedPhase.phase_type === 'sales' ? (
            <SalesFormModal
              phase={selectedPhase}
              contract={selectedContract || undefined}
              onClose={handleContractModalClose}
              onSuccess={handleContractSuccess}
            />
          ) : (
            <ContractFormModal
              phase={selectedPhase}
              contract={selectedContract || undefined}
              onClose={handleContractModalClose}
              onSuccess={handleContractSuccess}
            />
          )}
        </>
      )}

      {showMilestoneManagement && milestoneContext && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="max-w-6xl w-full my-8">
            <MilestoneList
              contractId={milestoneContext.contract.id}
              supplierName={
                milestoneContext.phase.phase_type === 'sales'
                  ? (milestoneContext.contract.customer?.name || 'Unknown Customer')
                  : (milestoneContext.contract.supplier?.name || 'Unknown Supplier')
              }
              projectName={milestoneContext.project.name}
              phaseName={milestoneContext.phase.phase_name}
              contractCost={milestoneContext.contract.contract_amount}
              onClose={closeMilestoneManagement}
            />
          </div>
        </div>
      )}

      <RetailPaymentHistoryModal
        visible={showPaymentHistoryModal}
        onClose={handleClosePaymentHistoryModal}
        contract={selectedContractForModal}
      />

      <RetailInvoicesModal
        isOpen={showInvoicesModal}
        onClose={handleCloseInvoicesModal}
        contract={selectedContractForModal}
      />

      {showEditPhaseModal && phaseToEdit && (
        <EditPhaseModal
          phase={phaseToEdit}
          project={project}
          onClose={handleEditPhaseModalClose}
          onSuccess={handleEditPhaseSuccess}
        />
      )}
    </div>
  )
}
