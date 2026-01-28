import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { ProjectPhase, Subcontractor, WirePayment } from '../lib/supabase'
import { ProjectWithPhases, PhaseFormInput, EditPhaseFormData, SubcontractorFormData, CommentWithUser } from './Site/types/siteTypes'
import { useSiteData } from './Site/hooks/useSiteData'
import { ProjectsGrid } from './Site/views/ProjectsGrid'
import { ProjectDetail } from './Site/views/ProjectDetail'
import { PhaseSetupModal } from './Site/forms/PhaseSetupModal'
import { EditPhaseModal } from './Site/forms/EditPhaseModal'
import { SubcontractorFormModal } from './Site/forms/SubcontractorFormModal'
import { EditSubcontractorModal } from './Site/forms/EditSubcontractorModal'
import { PaymentHistoryModal } from './Site/forms/PaymentHistoryModal'
import { EditPaymentModal } from './Site/forms/EditPaymentModal'
import { SubcontractorDetailsModal } from './Site/forms/SubcontractorDetailsModal'
import { InvoicesModal } from './Site/forms/InvoicesModal'
import { MilestoneList } from './Site/views/MilestoneList'
import { canManagePayments, getAccessibleProjectIds, isSupervisionRole } from '../utils/permissions'

const SiteManagement: React.FC = () => {
  const { user } = useAuth()
  const {
    projects,
    loading,
    existingSubcontractors,
    fetchProjects,
    createProjectPhases,
    updateProjectPhases,
    updatePhase,
    deletePhase,
    addSubcontractorToPhase,
    updateSubcontractor,
    deleteSubcontractor,
    addPaymentToSubcontractor,
    fetchWirePayments,
    updateWirePayment,
    deleteWirePayment,
    fetchSubcontractorComments,
    addSubcontractorComment
  } = useSiteData()

  const [selectedProject, setSelectedProject] = useState<ProjectWithPhases | null>(null)

  useEffect(() => {
    if (selectedProject) {
      const updatedProject = projects.find(p => p.id === selectedProject.id)
      if (updatedProject) {
        setSelectedProject(updatedProject)
      }
    }
  }, [projects])
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

  const handleCreatePhases = async (phases: PhaseFormInput[]) => {
    if (!selectedProject) return

    if (isPhaseSetupEditMode) {
      const success = await updateProjectPhases(selectedProject.id, phases, selectedProject.budget)
      if (success) {
        setShowPhaseSetup(false)
        setIsPhaseSetupEditMode(false)
      }
    } else {
      const success = await createProjectPhases(selectedProject.id, phases, selectedProject.budget)
      if (success) {
        setShowPhaseSetup(false)
      }
    }
  }

  const handleUpdatePhase = async (updates: EditPhaseFormData) => {
    if (!editingPhase || !selectedProject) return
    const success = await updatePhase(editingPhase, updates, selectedProject)
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

  const handleAddSubcontractor = async (data: SubcontractorFormData, useExisting: boolean) => {
    if (!selectedPhase) return
    const success = await addSubcontractorToPhase(selectedPhase, {
      useExisting,
      existing_subcontractor_id: data.existing_subcontractor_id,
      name: data.name,
      contact: data.contact,
      job_description: data.job_description,
      deadline: data.deadline,
      cost: data.cost,
      budget_realized: data.budget_realized
    })
    if (success) {
      setShowSubcontractorForm(false)
      setSelectedPhase(null)
    }
  }

  const handleUpdateSubcontractor = async (updatedSubcontractor: Subcontractor) => {
    const success = await updateSubcontractor(updatedSubcontractor)
    if (success) {
      setShowEditModal(false)
      setEditingSubcontractor(null)
    }
  }

  const handleDeleteSubcontractor = async (subcontractorId: string) => {
    await deleteSubcontractor(subcontractorId)
  }


  const openPaymentHistory = async (subcontractor: Subcontractor) => {
    setSelectedSubcontractorForPayment(subcontractor)
    const contractId = (subcontractor as any).contract_id || subcontractor.id
    const payments = await fetchWirePayments(contractId)
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
      const payments = await fetchWirePayments(selectedSubcontractorForPayment.id)
      setWirePayments(payments)

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
      const payments = await fetchWirePayments(selectedSubcontractorForPayment.id)
      setWirePayments(payments)

      const updatedProject = projects.find(p => p.id === selectedProject?.id)
      if (updatedProject) {
        const updatedSub = updatedProject.subcontractors.find(s => s.id === selectedSubcontractorForPayment.id)
        if (updatedSub) {
          setSelectedSubcontractorForPayment(updatedSub)
        }
      }
    }
  }

  const openSubcontractorDetails = async (subcontractor: Subcontractor) => {
    setSelectedSubcontractor(subcontractor)
    const comments = await fetchSubcontractorComments(subcontractor.id)
    setSubcontractorComments(comments)
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
      const comments = await fetchSubcontractorComments(selectedSubcontractor.id)
      setSubcontractorComments(comments)
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

  if (loading) {
    return <div className="text-center py-12">Loading site management...</div>
  }

  const filteredProjects = isSupervisionRole(user)
    ? projects.filter(p => getAccessibleProjectIds(user).includes(p.id))
    : projects


  const userCanManagePayments = canManagePayments(user)

  if (selectedProject) {
    return (
      <div>
        <ProjectDetail
          project={selectedProject}
          onBack={() => setSelectedProject(null)}
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
          onOpenInvoices={openInvoices}
          onEditSubcontractor={(sub) => {
            setEditingSubcontractor(sub)
            setShowEditModal(true)
          }}
          onOpenSubDetails={openSubcontractorDetails}
          onDeleteSubcontractor={handleDeleteSubcontractor}
          onManageMilestones={handleManageMilestones}
          canManagePayments={userCanManagePayments}
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
          project={selectedProject}
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
            setNewComment('')
          }}
          subcontractor={selectedSubcontractor}
          comments={subcontractorComments}
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="max-w-6xl w-full my-8">
              <div className="bg-white rounded-xl shadow-2xl">
                <MilestoneList
                  contractId={milestoneContext.subcontractor.contract_id || milestoneContext.subcontractor.id}
                  subcontractorName={milestoneContext.subcontractor.name}
                  projectName={milestoneContext.project.name}
                  phaseName={milestoneContext.phase.phase_name}
                  contractCost={milestoneContext.subcontractor.cost}
                  onClose={closeMilestoneManagement}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <ProjectsGrid
      projects={filteredProjects}
      onSelectProject={setSelectedProject}
      onRefresh={fetchProjects}
      isRefreshing={loading}
    />
  )
}

export default SiteManagement

