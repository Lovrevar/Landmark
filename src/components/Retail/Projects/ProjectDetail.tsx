import React, { useState, useEffect } from 'react'
import { ArrowLeft, MapPin, RefreshCw, Link, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Badge, LoadingSpinner, EmptyState, ConfirmDialog } from '../../ui'
import { formatCurrency, getStatusBadgeVariant } from '../utils'
import { PhaseCard } from './PhaseCard'
import { ProjectStatistics } from './ProjectStatistics'
import { MilestoneList } from './MilestoneList'
import { ContractFormModal } from './modals/ContractFormModal'
import { DevelopmentFormModal } from './forms/DevelopmentFormModal'
import { SalesFormModal } from './forms/SalesFormModal'
import { EditPhaseModal } from './modals/EditPhaseModal'
import { RetailPaymentHistoryModal } from './modals/RetailPaymentHistoryModal'
import { RetailInvoicesModal } from './modals/RetailInvoicesModal'
import { retailProjectService } from './services/retailProjectService'
import { useProjectDetail } from './hooks/useProjectDetail'
import { useToast } from '../../../contexts/ToastContext'
import type { RetailProjectWithPhases, RetailProjectPhase, RetailContract } from '../../../types/retail'

interface ProjectDetailProps {
  project: RetailProjectWithPhases
  onBack: () => void
  onRefresh: () => void
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({ project: initialProject, onBack, onRefresh }) => {
  const { t } = useTranslation()
  const toast = useToast()
  const { project: hookProject, contractsMap: phaseContracts, loading, refetch: loadProjectDetails } = useProjectDetail(initialProject.id)
  const project = hookProject ?? initialProject
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
  const [pendingDeletePhase, setPendingDeletePhase] = useState<RetailProjectPhase | null>(null)
  const [deletingPhase, setDeletingPhase] = useState(false)
  const [pendingDeleteContractId, setPendingDeleteContractId] = useState<string | null>(null)
  const [deletingContract, setDeletingContract] = useState(false)

  useEffect(() => {
    loadProjectDetails()
  }, [initialProject.id])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadProjectDetails()
    setRefreshing(false)
    onRefresh()
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

  const handleDeletePhase = (phase: RetailProjectPhase) => {
    setPendingDeletePhase(phase)
  }

  const confirmDeletePhase = async () => {
    if (!pendingDeletePhase) return
    setDeletingPhase(true)
    try {
      await retailProjectService.deletePhase(pendingDeletePhase.id)
      await handleRefresh()
    } catch (error) {
      console.error('Error deleting phase:', error)
      toast.error(t('retail_projects.error_delete_phase'))
    } finally {
      setDeletingPhase(false)
      setPendingDeletePhase(null)
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

  const handleDeleteContract = (contractId: string) => {
    setPendingDeleteContractId(contractId)
  }

  const confirmDeleteContract = async () => {
    if (!pendingDeleteContractId) return
    setDeletingContract(true)
    try {
      await retailProjectService.deleteContract(pendingDeleteContractId)
      await handleRefresh()
    } catch (error) {
      console.error('Error deleting contract:', error)
      toast.error(t('retail_projects.error_delete_contract'))
    } finally {
      setDeletingContract(false)
      setPendingDeleteContractId(null)
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

  useEffect(() => {
    if (!showMilestoneManagement || !milestoneContext) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        closeMilestoneManagement()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showMilestoneManagement, milestoneContext])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" icon={ArrowLeft} onClick={onBack}>
          {t('retail_projects.back_to_projects')}
        </Button>
        <Button icon={RefreshCw} loading={refreshing} onClick={handleRefresh}>
          {t('retail_projects.detail.refresh')}
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{project.name}</h1>
            <div className="flex items-center text-gray-600 dark:text-gray-400 mb-4">
              <MapPin className="w-5 h-5 mr-2" />
              {project.location} - {t('retail_projects.plot_number')}: {project.plot_number}
            </div>
          </div>
          <Badge variant={getStatusBadgeVariant(project.status)} size="md">
            {project.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
            <div className="text-sm text-blue-600 mb-1">{t('retail_projects.area')}</div>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{project.total_area_m2.toLocaleString()} m²</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="text-sm text-green-600 mb-1">{t('retail_projects.project_budget')}</div>
            <div className="text-2xl font-bold text-green-900 dark:text-green-300">{formatCurrency(project.purchase_price)}</div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
            <div className="text-sm text-orange-600 mb-1">{t('retail_projects.price_per_m2')}</div>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-400">{formatCurrency(project.price_per_m2)}</div>
          </div>
          <div className="bg-amber-50 dark:bg-yellow-900/20 rounded-lg p-4">
            <div className="text-sm text-amber-600 mb-1">{t('retail_projects.phase_count')}</div>
            <div className="text-2xl font-bold text-amber-900 dark:text-yellow-300">{project.phases.length}</div>
          </div>
        </div>

        {project.land_plot && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-4">
              <Link className="w-5 h-5 mr-2 text-emerald-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('retail_projects.linked_land')}</h3>
            </div>
            <div className="bg-emerald-50 dark:bg-green-900/20 rounded-lg p-4 border border-emerald-200 dark:border-green-800">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center text-sm text-emerald-700 mb-1">
                    <User className="w-4 h-4 mr-1" />
                    {t('retail_projects.owner')}
                  </div>
                  <div className="text-base font-semibold text-emerald-900 dark:text-green-200">
                    {project.land_plot.owner_first_name} {project.land_plot.owner_last_name}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-emerald-700 dark:text-green-400 mb-1">{t('retail_projects.plot_number')}</div>
                  <div className="text-base font-semibold text-emerald-900 dark:text-green-200">{project.land_plot.plot_number}</div>
                </div>
                <div>
                  <div className="text-sm text-emerald-700 dark:text-green-400 mb-1">{t('retail_projects.total_land_area')}</div>
                  <div className="text-base font-semibold text-emerald-900 dark:text-green-200">{project.land_plot.total_area_m2.toLocaleString()} m²</div>
                </div>
                <div>
                  <div className="text-sm text-emerald-700 dark:text-green-400 mb-1">{t('retail_projects.purchased_area')}</div>
                  <div className="text-base font-semibold text-emerald-900 dark:text-green-200">{project.land_plot.purchased_area_m2.toLocaleString()} m²</div>
                </div>
                <div>
                  <div className="text-sm text-emerald-700 dark:text-green-400 mb-1">{t('retail_projects.price_per_m2')}</div>
                  <div className="text-base font-semibold text-emerald-900 dark:text-green-200">{formatCurrency(project.land_plot.price_per_m2)}</div>
                </div>
                <div>
                  <div className="text-sm text-emerald-700 dark:text-green-400 mb-1">{t('retail_projects.total_land_price')}</div>
                  <div className="text-base font-semibold text-emerald-900 dark:text-green-200">{formatCurrency(project.land_plot.total_price)}</div>
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
        <LoadingSpinner message={t('retail_projects.loading_details')} />
      ) : (
        <div className="space-y-6">
          {project.phases.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12">
              <EmptyState
                title={t('retail_projects.no_phases')}
                description={t('retail_projects.phases_auto_created')}
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('common.notes')}</h3>
          <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{project.notes}</p>
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

      <ConfirmDialog
        show={!!pendingDeletePhase}
        title={t('confirm.delete_title')}
        message={pendingDeletePhase ? t('retail_projects.confirm_delete_phase', { name: pendingDeletePhase.phase_name }) : ''}
        confirmLabel={t('common.yes_delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDeletePhase}
        onCancel={() => setPendingDeletePhase(null)}
        loading={deletingPhase}
      />

      <ConfirmDialog
        show={!!pendingDeleteContractId}
        title={t('confirm.delete_title')}
        message={t('confirm.delete_contract')}
        confirmLabel={t('common.yes_delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={confirmDeleteContract}
        onCancel={() => setPendingDeleteContractId(null)}
        loading={deletingContract}
      />
    </div>
  )
}
