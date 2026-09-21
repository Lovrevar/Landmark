import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LoadingSpinner, Modal, ConfirmDialog, Alert, Button } from '../../ui'
import { useAuth } from '../../../contexts/AuthContext'
import { useToast } from '../../../contexts/ToastContext'
import { toErrorMessage } from '../../../lib/errorMessage'
import { ProjectPhase, Subcontractor, WirePayment } from '../../../lib/supabase'
import { ProjectWithPhases, PhaseFormInput, EditPhaseFormData, SubcontractorFormData, CommentWithUser, SiteGrouping } from './types'
import { useSiteData } from './hooks/useSiteData'
import { useCostClassifications } from './hooks/useCostClassifications'
import { ProjectsGrid } from './ProjectsGrid'
import { ProjectDetail } from './ProjectDetail'
import { PhaseSetupModal } from './modals/PhaseSetupModal'
import { EditPhaseModal } from './modals/EditPhaseModal'
import { SubcontractorFormModal } from './forms/SubcontractorFormModal'
import { EditSubcontractorModal } from './modals/EditSubcontractorModal'
import { PaymentHistoryModal } from './modals/PaymentHistoryModal'
import { EditPaymentModal } from './modals/EditPaymentModal'
import { SubcontractorDetailsModal } from './modals/SubcontractorDetailsModal'
import { InvoicesModal } from './modals/InvoicesModal'
import { PhaseClassificationBudgetsModal } from './modals/PhaseClassificationBudgetsModal'
import { ManageCostClassificationsModal } from './modals/ManageCostClassificationsModal'
import { MilestoneList } from './MilestoneList'
import { canManagePayments, getAccessibleProjectIds, isSupervisionRole } from '../../../utils/permissions'

/** Remembers the phase-first vs classification-first choice per browser. */
const GROUPING_STORAGE_KEY = 'cognilion.site_management_grouping'

const SiteManagement: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const toast = useToast()
  const {
    projects,
    loading,
    refreshing,
    error,
    existingSubcontractors,
    fetchProjects,
    createProjectPhases,
    updateProjectPhases,
    updatePhase,
    deletePhase,
    addSubcontractorToPhase,
    updateSubcontractor,
    deleteSubcontractor,
    pendingDeleteSubcontractor,
    confirmDeleteSubcontractor,
    cancelDeleteSubcontractor,
    deletingSubcontractor,
    pendingConfirm,
    fetchWirePayments,
    updateWirePayment,
    deleteWirePayment,
    fetchSubcontractorComments,
    addSubcontractorComment
  } = useSiteData()

  /**
   * Which project is open lives in the URL, not in component state.
   *
   * As state it was invisible to history: the address stayed `/site-management` the whole time, so
   * the browser's Back button left the module altogether instead of returning to the project list.
   * As a route param, Back does the obvious thing, and a project's page can be linked and reloaded.
   *
   * Derived rather than copied into state, which also does what the old re-sync effect did by
   * hand: the object is looked up fresh on every render, so a refresh of the list is picked up
   * without anything having to notice.
   */
  const { projectId } = useParams<{ projectId?: string }>()
  const navigate = useNavigate()

  // Resolved against the projects this user may actually see, so a hand-typed id cannot open a
  // project the grid would not have offered.
  const accessibleProjectIds = isSupervisionRole(user) ? getAccessibleProjectIds(user) : null
  const filteredProjects = accessibleProjectIds
    ? projects.filter(p => accessibleProjectIds.includes(p.id))
    : projects
  const selectedProject = projectId
    ? filteredProjects.find(p => p.id === projectId) ?? null
    : null

  useEffect(() => {
    // An id that no longer resolves — deleted, or never this user's to see. Replace rather than
    // push, so Back does not walk straight back into the dead URL.
    if (projectId && !loading && !selectedProject) {
      navigate('/site-management', { replace: true })
    }
  }, [projectId, loading, selectedProject, navigate])

  const [showPhaseSetup, setShowPhaseSetup] = useState(false)
  const [isPhaseSetupEditMode, setIsPhaseSetupEditMode] = useState(false)
  const [showEditPhaseModal, setShowEditPhaseModal] = useState(false)
  const [editingPhase, setEditingPhase] = useState<ProjectPhase | null>(null)
  const [showSubcontractorForm, setShowSubcontractorForm] = useState(false)
  const [selectedPhase, setSelectedPhase] = useState<ProjectPhase | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSubcontractor, setEditingSubcontractor] = useState<Subcontractor | null>(null)
  const [selectedSubcontractorForPayment, setSelectedSubcontractorForPayment] = useState<Subcontractor | null>(null)
  const [showPaymentHistory, setShowPaymentHistory] = useState(false)
  const [wirePayments, setWirePayments] = useState<WirePayment[]>([])
  const [editingPayment, setEditingPayment] = useState<WirePayment | null>(null)
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false)
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<Subcontractor | null>(null)
  const [subcontractorComments, setSubcontractorComments] = useState<CommentWithUser[]>([])
  const [commentsError, setCommentsError] = useState<Error | null>(null)
  const [newComment, setNewComment] = useState('')
  const [commentType, setCommentType] = useState<'completed' | 'issue' | 'general'>('general')
  const [showMilestoneManagement, setShowMilestoneManagement] = useState(false)
  const [milestoneContext, setMilestoneContext] = useState<{
    subcontractor: Subcontractor
    phase: ProjectPhase
    project: ProjectWithPhases
  } | null>(null)
  const [showInvoicesModal, setShowInvoicesModal] = useState(false)
  const [selectedSubcontractorForInvoices, setSelectedSubcontractorForInvoices] = useState<Subcontractor | null>(null)
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set())
  // One flat set of full path keys ("phase:<id>|cls:12|type:3") rather than a Map of Maps.
  // The key encodes the dimension order, so the two views never share expansion state.
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [grouping, setGrouping] = useState<SiteGrouping>(() => {
    try {
      const stored = localStorage.getItem(GROUPING_STORAGE_KEY)
      return stored === 'byClassification' ? 'byClassification' : 'byPhase'
    } catch {
      return 'byPhase'
    }
  })
  const [budgetsModalPhase, setBudgetsModalPhase] = useState<ProjectPhase | null>(null)
  const [showManageClassifications, setShowManageClassifications] = useState(false)
  const { classifications, error: classificationsError, load: loadClassifications } = useCostClassifications()

  useEffect(() => { loadClassifications() }, [loadClassifications])

  const changeGrouping = (next: SiteGrouping) => {
    setGrouping(next)
    try {
      localStorage.setItem(GROUPING_STORAGE_KEY, next)
    } catch {
      // A viewer with site data blocked still gets a working page, just no remembered view.
    }
  }

  const toggleNode = (key: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleCreatePhases = async (phases: PhaseFormInput[]): Promise<boolean> => {
    if (!selectedProject) return false

    if (isPhaseSetupEditMode) {
      const success = await updateProjectPhases(selectedProject.id, phases)
      if (success) {
        setShowPhaseSetup(false)
        setIsPhaseSetupEditMode(false)
      }
      return success
    }

    const success = await createProjectPhases(selectedProject.id, phases)
    if (success) {
      setShowPhaseSetup(false)
    }
    return success
  }

  const handleUpdatePhase = async (updates: EditPhaseFormData) => {
    if (!editingPhase || !selectedProject) return
    const success = await updatePhase(editingPhase, updates)
    if (success) {
      setShowEditPhaseModal(false)
      setEditingPhase(null)
    }
  }

  const handleDeletePhase = async (phase: ProjectPhase) => {
    if (!selectedProject) return
    await deletePhase(phase, selectedProject)
  }

  const openEditPhaseModal = (phase: ProjectPhase) => {
    setEditingPhase(phase)
    setShowEditPhaseModal(true)
  }

  const handleAddSubcontractor = async (data: SubcontractorFormData, useExisting: boolean, pendingFiles: File[]) => {
    if (!selectedPhase) return
    await addSubcontractorToPhase(selectedPhase, {
      useExisting,
      existing_subcontractor_id: data.existing_subcontractor_id,
      name: data.name,
      contact: data.contact,
      job_description: data.job_description,
      start_date: data.start_date,
      deadline: data.deadline,
      cost: data.cost,
      base_amount: data.base_amount,
      vat_rate: data.vat_rate,
      vat_amount: data.vat_amount,
      total_amount: data.total_amount,
      contract_type_id: data.contract_type_id,
      classification_id: data.classification_id,
      has_contract: data.has_contract,
      financed_by_type: data.financed_by_type,
      financed_by_investor_id: data.financed_by_investor_id,
      financed_by_bank_id: data.financed_by_bank_id
    }, pendingFiles)
    setShowSubcontractorForm(false)
    setSelectedPhase(null)
  }

  const handleUpdateSubcontractor = async (updatedSubcontractor: Subcontractor, pendingFiles: File[]): Promise<boolean> => {
    const success = await updateSubcontractor(updatedSubcontractor, pendingFiles)
    if (success) {
      setShowEditModal(false)
      setEditingSubcontractor(null)
    }
    return success
  }

  const handleDeleteSubcontractor = async (subcontractorId: string) => {
    await deleteSubcontractor(subcontractorId)
  }


  const resolveContractId = (sub: Subcontractor) =>
    (sub as Subcontractor & { contract_id?: string }).contract_id || sub.id

  /**
   * `null` means the read failed, as opposed to `[]` meaning this contract has no wire payments.
   * The history modal is never opened on a `null`, so it cannot claim a contract was never paid.
   */
  const loadWirePayments = async (contractId: string): Promise<WirePayment[] | null> => {
    try {
      return await fetchWirePayments(contractId)
    } catch (err) {
      console.error('Error fetching wire payments:', err)
      toast.error(toErrorMessage(err, t('supervision.payment_history.load_failed')))
      return null
    }
  }

  const openPaymentHistory = async (subcontractor: Subcontractor) => {
    const payments = await loadWirePayments(resolveContractId(subcontractor))
    if (!payments) return
    setSelectedSubcontractorForPayment(subcontractor)
    setWirePayments(payments)
    setShowPaymentHistory(true)
  }

  const openInvoices = (subcontractor: Subcontractor) => {
    setSelectedSubcontractorForInvoices(subcontractor)
    setShowInvoicesModal(true)
  }

  const handleUpdatePayment = async () => {
    if (!editingPayment || !selectedSubcontractorForPayment) return
    const oldAmount = wirePayments.find(p => p.id === editingPayment.id)?.amount || 0
    const success = await updateWirePayment(
      editingPayment.id,
      editingPayment.amount,
      editingPayment.payment_date || '',
      editingPayment.notes || '',
      selectedSubcontractorForPayment,
      oldAmount
    )
    if (success) {
      setShowEditPaymentModal(false)
      setEditingPayment(null)
      const payments = await loadWirePayments(resolveContractId(selectedSubcontractorForPayment))
      if (payments) setWirePayments(payments)

      const updatedProject = projects.find(p => p.id === selectedProject?.id)
      if (updatedProject) {
        const updatedSub = updatedProject.subcontractors.find(s => s.id === selectedSubcontractorForPayment.id)
        if (updatedSub) {
          setSelectedSubcontractorForPayment(updatedSub)
        }
      }
    }
  }

  const handleDeletePayment = async (paymentId: string, amount: number) => {
    if (!selectedSubcontractorForPayment) return
    const success = await deleteWirePayment(paymentId, amount, selectedSubcontractorForPayment)
    if (success) {
      const payments = await loadWirePayments(resolveContractId(selectedSubcontractorForPayment))
      if (payments) setWirePayments(payments)

      const updatedProject = projects.find(p => p.id === selectedProject?.id)
      if (updatedProject) {
        const updatedSub = updatedProject.subcontractors.find(s => s.id === selectedSubcontractorForPayment.id)
        if (updatedSub) {
          setSelectedSubcontractorForPayment(updatedSub)
        }
      }
    }
  }

  /** Reads the comment thread, recording a failure instead of leaving the list looking empty. */
  const loadComments = async (subcontractorId: string) => {
    try {
      setSubcontractorComments(await fetchSubcontractorComments(subcontractorId))
      setCommentsError(null)
    } catch (err) {
      console.error('Error fetching comments:', err)
      setCommentsError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  const openSubcontractorDetails = async (subcontractor: Subcontractor) => {
    setSelectedSubcontractor(subcontractor)
    setSubcontractorComments([])
    setCommentsError(null)
    await loadComments(subcontractor.id)
  }

  const handleAddComment = async () => {
    if (!selectedSubcontractor || !user?.id) return
    const success = await addSubcontractorComment(
      selectedSubcontractor.id,
      user.id,
      newComment,
      commentType
    )
    if (success) {
      setNewComment('')
      await loadComments(selectedSubcontractor.id)
    }
  }

  const handleManageMilestones = (subcontractor: Subcontractor, phase: ProjectPhase, project: ProjectWithPhases) => {
    setMilestoneContext({ subcontractor, phase, project })
    setShowMilestoneManagement(true)
  }

  const closeMilestoneManagement = () => {
    setShowMilestoneManagement(false)
    setMilestoneContext(null)
  }

  if (loading && projects.length === 0) {
    return <LoadingSpinner message="Loading site management..." />
  }

  const userCanManagePayments = canManagePayments(user)

  if (selectedProject) {
    return (
      <div>
        {/* The classification tree, the badges and the per-classification budgets are all built
            from this list, so an empty one is a wrong screen, not a bare one. */}
        {classificationsError && (
          <Alert variant="error" className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{t('common.load_error_description')}</span>
              <Button size="sm" variant="secondary" onClick={loadClassifications}>{t('common.retry')}</Button>
            </div>
          </Alert>
        )}

        <ProjectDetail
          project={selectedProject}
          onBack={() => navigate('/site-management')}
          onOpenPhaseSetup={() => {
            setShowPhaseSetup(true)
            setIsPhaseSetupEditMode(false)
          }}
          onEditPhaseSetup={() => {
            setShowPhaseSetup(true)
            setIsPhaseSetupEditMode(true)
          }}
          onEditPhase={openEditPhaseModal}
          onDeletePhase={handleDeletePhase}
          onAddSubcontractor={(phase) => {
            setSelectedPhase(phase)
            setShowSubcontractorForm(true)
          }}
          onOpenPaymentHistory={userCanManagePayments ? openPaymentHistory : undefined}
          // Invoices carry paid_amount and remaining_amount, so this entry point is gated the
          // same way the payment history already is — InvoicesModal then has no way in.
          onOpenInvoices={userCanManagePayments ? openInvoices : undefined}
          onEditSubcontractor={(sub) => {
            setEditingSubcontractor(sub)
            setShowEditModal(true)
          }}
          onOpenSubDetails={openSubcontractorDetails}
          onDeleteSubcontractor={handleDeleteSubcontractor}
          onManageMilestones={handleManageMilestones}
          canManagePayments={userCanManagePayments}
          classifications={classifications}
          grouping={grouping}
          onChangeGrouping={changeGrouping}
          onEditClassificationBudgets={(phase) => setBudgetsModalPhase(phase)}
          onEditClassificationBudget={(phaseId) => {
            const phase = selectedProject?.phases.find(p => p.id === phaseId)
            if (phase) setBudgetsModalPhase(phase)
          }}
          onManageClassifications={() => setShowManageClassifications(true)}
          expandedPhases={expandedPhases}
          expandedNodes={expandedNodes}
          onTogglePhase={(phaseId) => {
            setExpandedPhases(prev => {
              const next = new Set(prev)
              if (next.has(phaseId)) {
                next.delete(phaseId)
              } else {
                next.add(phaseId)
              }
              return next
            })
          }}
          onToggleNode={toggleNode}
        />

        <PhaseClassificationBudgetsModal
        visible={budgetsModalPhase !== null}
        phase={budgetsModalPhase}
        classifications={classifications}
        projectId={selectedProject?.id ?? ''}
        projectPhaseIds={selectedProject?.phases.map(p => p.id) ?? []}
        onClose={() => setBudgetsModalPhase(null)}
      />

      <ManageCostClassificationsModal
        visible={showManageClassifications}
        onClose={() => setShowManageClassifications(false)}
        onChanged={() => { loadClassifications(); fetchProjects() }}
      />

      <PhaseSetupModal
          visible={showPhaseSetup}
          onClose={() => {
            setShowPhaseSetup(false)
            setIsPhaseSetupEditMode(false)
          }}
          project={selectedProject}
          onSubmit={handleCreatePhases}
          editMode={isPhaseSetupEditMode}
        />

        <EditPhaseModal
          visible={showEditPhaseModal}
          onClose={() => {
            setShowEditPhaseModal(false)
            setEditingPhase(null)
          }}
          phase={editingPhase}
          onSubmit={handleUpdatePhase}
        />

        <SubcontractorFormModal
          visible={showSubcontractorForm}
          onClose={() => {
            setShowSubcontractorForm(false)
            setSelectedPhase(null)
          }}
          phase={selectedPhase}
          existingSubcontractors={existingSubcontractors}
          onSubmit={handleAddSubcontractor}
          projectId={selectedProject?.id || ''}
        />

        <EditSubcontractorModal
          visible={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setEditingSubcontractor(null)
          }}
          subcontractor={editingSubcontractor}
          onChange={setEditingSubcontractor}
          onSubmit={handleUpdateSubcontractor}
          canManagePayments={userCanManagePayments}
        />

        <PaymentHistoryModal
          visible={showPaymentHistory}
          onClose={() => {
            setShowPaymentHistory(false)
            setSelectedSubcontractorForPayment(null)
            setWirePayments([])
          }}
          subcontractor={selectedSubcontractorForPayment}
          payments={wirePayments}
          onEditPayment={(payment) => {
            setEditingPayment(payment)
            setShowEditPaymentModal(true)
          }}
          onDeletePayment={handleDeletePayment}
        />

        <EditPaymentModal
          visible={showEditPaymentModal}
          onClose={() => {
            setShowEditPaymentModal(false)
            setEditingPayment(null)
          }}
          payment={editingPayment}
          onChange={setEditingPayment}
          onSubmit={handleUpdatePayment}
        />

        {selectedSubcontractorForInvoices && (
          <InvoicesModal
            isOpen={showInvoicesModal}
            onClose={() => {
              setShowInvoicesModal(false)
              setSelectedSubcontractorForInvoices(null)
            }}
            subcontractor={selectedSubcontractorForInvoices}
          />
        )}

        <SubcontractorDetailsModal
          visible={!!selectedSubcontractor}
          onClose={() => {
            setSelectedSubcontractor(null)
            setSubcontractorComments([])
            setCommentsError(null)
            setNewComment('')
          }}
          subcontractor={selectedSubcontractor}
          canManagePayments={userCanManagePayments}
          comments={subcontractorComments}
          commentsError={commentsError}
          onRetryComments={selectedSubcontractor ? () => loadComments(selectedSubcontractor.id) : undefined}
          newComment={newComment}
          commentType={commentType}
          onCommentChange={setNewComment}
          onCommentTypeChange={setCommentType}
          onAddComment={handleAddComment}
          onManageMilestones={
            selectedSubcontractor && selectedSubcontractor.phase_id
              ? () => {
                  const phase = selectedProject.phases.find(p => p.id === selectedSubcontractor.phase_id)
                  if (phase) {
                    handleManageMilestones(selectedSubcontractor, phase, selectedProject)
                    setSelectedSubcontractor(null)
                    setSubcontractorComments([])
                  }
                }
              : undefined
          }
        />

        {showMilestoneManagement && milestoneContext && (
          <Modal show={true} onClose={closeMilestoneManagement} size="full" ariaLabel={t('supervision.site_management.milestone_list.title')}>
            {/* Modal.Body is the only part of Modal that scrolls, so a long milestone table
                rendered as a direct child simply overflowed the viewport. noPadding because
                MilestoneList draws its own. */}
            <Modal.Body noPadding>
              <MilestoneList
                contractId={milestoneContext.subcontractor.contract_id || milestoneContext.subcontractor.id}
                subcontractorName={milestoneContext.subcontractor.name}
                projectName={milestoneContext.project.name}
                phaseName={milestoneContext.phase.phase_name}
                contractCost={milestoneContext.subcontractor.cost}
                canManagePayments={userCanManagePayments}
                onClose={closeMilestoneManagement}
              />
            </Modal.Body>
          </Modal>
        )}

        <ConfirmDialog
          show={!!pendingConfirm}
          title={pendingConfirm?.title ?? ''}
          message={pendingConfirm?.message ?? ''}
          confirmLabel={pendingConfirm?.confirmLabel ?? t('common.yes_confirm')}
          cancelLabel={t('common.cancel')}
          variant={pendingConfirm?.variant ?? 'primary'}
          onConfirm={() => pendingConfirm?.onConfirm()}
          onCancel={() => pendingConfirm?.onCancel()}
        />

        <ConfirmDialog
          show={!!pendingDeleteSubcontractor}
          title={t('common.confirm_delete')}
          message={t('supervision.site_management.confirm_delete_sub')}
          confirmLabel={t('common.yes_delete')}
          cancelLabel={t('common.cancel')}
          variant="danger"
          onConfirm={confirmDeleteSubcontractor}
          onCancel={cancelDeleteSubcontractor}
          loading={deletingSubcontractor}
        />
      </div>
    )
  }

  return (
    <ProjectsGrid
      projects={filteredProjects}
      canManagePayments={userCanManagePayments}
      onSelectProject={(project) => navigate(`/site-management/${project.id}`)}
      onRefresh={fetchProjects}
      isRefreshing={refreshing}
      error={error}
      emptyStateVariant={isSupervisionRole(user) ? 'no_assignments' : 'no_projects'}
    />
  )
}

export default SiteManagement

