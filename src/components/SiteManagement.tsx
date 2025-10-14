import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, Project, Subcontractor, SubcontractorComment, ProjectPhase, Contract, WirePayment } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { 
  Building2, 
  ArrowRight, 
  Users, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowLeft,
  MessageSquare,
  Send,
  X,
  Plus,
  Edit2,
  Trash2,
  Settings,
  Target,
  PieChart
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'

interface ProjectWithPhases extends Project {
  phases: ProjectPhase[]
  subcontractors: Subcontractor[]
  completion_percentage: number
  total_subcontractor_cost: number
  overdue_subcontractors: number
  has_phases: boolean
  total_budget_allocated: number
  total_paid_out: number
}

interface SubcontractorWithPhase extends Subcontractor {
  phase_name?: string
}

const SiteManagement: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectWithPhases[]>([])
  const [selectedProject, setSelectedProject] = useState<ProjectWithPhases | null>(null)
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<Subcontractor | null>(null)
  const [subcontractorComments, setSubcontractorComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentType, setCommentType] = useState<'completed' | 'issue' | 'general'>('general')
  const [showPhaseSetup, setShowPhaseSetup] = useState(false)
  const [showSubcontractorForm, setShowSubcontractorForm] = useState(false)
  const [selectedPhase, setSelectedPhase] = useState<ProjectPhase | null>(null)
  const [phaseCount, setPhaseCount] = useState(4)
  const [phases, setPhases] = useState<Array<{
    phase_name: string
    budget_allocated: number
    start_date: string
    end_date: string
  }>>([])
  const [newSubcontractor, setNewSubcontractor] = useState({
    existing_subcontractor_id: '',
    name: '',
    contact: '',
    job_description: '',
    deadline: '',
    cost: 0,
    budget_realized: 0,
    phase_id: ''
  })
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [selectedSubcontractorForPayment, setSelectedSubcontractorForPayment] = useState<Subcontractor | null>(null)
  const [loading, setLoading] = useState(true)
  const [existingSubcontractors, setExistingSubcontractors] = useState<Subcontractor[]>([])
  const [useExistingSubcontractor, setUseExistingSubcontractor] = useState(false)
  const [editingSubcontractor, setEditingSubcontractor] = useState<Subcontractor | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [wirePayments, setWirePayments] = useState<WirePayment[]>([])
  const [showPaymentHistory, setShowPaymentHistory] = useState(false)
  const [editingPayment, setEditingPayment] = useState<WirePayment | null>(null)
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false)
  const [showEditPhaseModal, setShowEditPhaseModal] = useState(false)
  const [editingPhase, setEditingPhase] = useState<ProjectPhase | null>(null)
  const [editPhaseForm, setEditPhaseForm] = useState({
    phase_name: '',
    budget_allocated: 0,
    start_date: '',
    end_date: '',
    status: 'planning' as 'planning' | 'active' | 'completed' | 'on_hold'
  })

  useEffect(() => {
    const initializeData = async () => {
      await recalculateAllPhaseBudgets()
      await fetchProjects()
    }
    initializeData()
  }, [])

  const recalculateAllPhaseBudgets = async () => {
    try {
      // Get all phases
      const { data: phases, error: phasesError } = await supabase
        .from('project_phases')
        .select('id')

      if (phasesError) throw phasesError

      // For each phase, recalculate budget_used
      for (const phase of phases || []) {
        const { data: phaseSubcontractors, error: subError } = await supabase
          .from('subcontractors')
          .select('cost')
          .eq('phase_id', phase.id)

        if (subError) {
          console.error(`Error fetching subcontractors for phase ${phase.id}:`, subError)
          continue
        }

        const budgetUsed = (phaseSubcontractors || []).reduce((sum, sub) => sum + sub.cost, 0)

        await supabase
          .from('project_phases')
          .update({ budget_used: budgetUsed })
          .eq('id', phase.id)
      }
    } catch (error) {
      console.error('Error recalculating phase budgets:', error)
    }
  }

  const fetchProjects = async () => {
    setLoading(true)
    try {
      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('start_date', { ascending: false })

      if (projectsError) throw projectsError

      // Fetch project phases
      const { data: phasesData, error: phasesError } = await supabase
        .from('project_phases')
        .select('*')
        .order('project_id', { ascending: true })
        .order('phase_number', { ascending: true })

      if (phasesError) throw phasesError

      // Fetch subcontractors with phase info
      /*const { data: subcontractorsData, error: subError } = await supabase
        .from('subcontractors')
        .select(`
          *,
          project_phases(phase_name)
        `)

      if (subError) throw subError*/
      // Fetch subcontractors with phase info
const { data: subcontractorsWithPhaseData, error: subError } = await supabase
  .from('subcontractors')
  .select(`
    *,
    project_phases(phase_name)
  `)

if (subError) throw subError

// ...

// Fetch existing subcontractors (for dropdown form)
const { data: allSubcontractorsData, error: subError2 } = await supabase
  .from('subcontractors')
  .select('*')
  .order('name')

if (subError2) throw subError2
setExistingSubcontractors(allSubcontractorsData || [])

      // Enhance projects with phase and subcontractor data
      const projectsWithPhases = (projectsData || []).map(project => {
        const projectPhases = (phasesData || []).filter(phase => phase.project_id === project.id)
        const projectSubcontractors = (subcontractorsWithPhaseData || []).filter(sub => {
          // Only include subcontractors assigned to phases of this project
          return projectPhases.some(phase => phase.id === sub.phase_id)
        })

        const total_budget_realized = projectSubcontractors.reduce((sum, sub) => sum + sub.budget_realized, 0)
        const total_subcontractor_cost = projectSubcontractors.reduce((sum, sub) => sum + sub.cost, 0)
        const completion_percentage = total_subcontractor_cost > 0
          ? Math.round((total_budget_realized / total_subcontractor_cost) * 100)
          : 0

        const overdue_subcontractors = projectSubcontractors.filter(sub =>
          new Date(sub.deadline) < new Date() && sub.budget_realized < sub.cost
        ).length

        const has_phases = projectPhases.length > 0
        const total_budget_allocated = projectPhases.reduce((sum, phase) => sum + phase.budget_allocated, 0)
        const total_paid_out = projectSubcontractors.reduce((sum, sub) => sum + (sub.budget_realized || 0), 0)

        return {
          ...project,
          phases: projectPhases,
          subcontractors: projectSubcontractors,
          completion_percentage,
          total_subcontractor_cost,
          overdue_subcontractors,
          has_phases,
          total_budget_allocated,
          total_paid_out
        }
      })

      setProjects(projectsWithPhases)

      // Update selectedProject if it exists to show refreshed data
      if (selectedProject) {
        const updatedSelectedProject = projectsWithPhases.find(p => p.id === selectedProject.id)
        if (updatedSelectedProject) {
          setSelectedProject(updatedSelectedProject)
        }
      }

     /* // Fetch existing subcontractors
      const { data: subcontractorsData, error: subError } = await supabase
        .from('subcontractors')
        .select('*')
        .order('name')*/

      if (subError) throw subError
      setExistingSubcontractors(subcontractorsWithPhaseData || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const initializePhases = () => {
    const defaultPhases = [
      { phase_name: 'Foundation Phase', budget_allocated: 0, start_date: '', end_date: '' },
      { phase_name: 'Structural Phase', budget_allocated: 0, start_date: '', end_date: '' },
      { phase_name: 'Systems Installation', budget_allocated: 0, start_date: '', end_date: '' },
      { phase_name: 'Finishing Phase', budget_allocated: 0, start_date: '', end_date: '' }
    ]
    setPhases(defaultPhases.slice(0, phaseCount))
  }

  const updatePhaseCount = (count: number) => {
    setPhaseCount(count)
    const newPhases = []
    for (let i = 0; i < count; i++) {
      if (phases[i]) {
        newPhases.push(phases[i])
      } else {
        newPhases.push({
          phase_name: `Phase ${i + 1}`,
          budget_allocated: 0,
          start_date: '',
          end_date: ''
        })
      }
    }
    setPhases(newPhases)
  }

  const createProjectPhases = async () => {
    if (!selectedProject) return

    const totalAllocated = phases.reduce((sum, phase) => sum + phase.budget_allocated, 0)
    const budgetDifference = totalAllocated - selectedProject.budget

    if (budgetDifference !== 0) {
      const message = budgetDifference > 0
        ? `Total allocated budget (€${totalAllocated.toLocaleString()}) exceeds project budget by $${Math.abs(budgetDifference).toLocaleString()}. Do you want to proceed?`
        : `Total allocated budget (€${totalAllocated.toLocaleString()}) is less than project budget by $${Math.abs(budgetDifference).toLocaleString()}. Do you want to proceed?`

      if (!confirm(message)) {
        return
      }
    }

    try {
      const phasesToInsert = phases.map((phase, index) => ({
        project_id: selectedProject.id,
        phase_number: index + 1,
        phase_name: phase.phase_name,
        budget_allocated: phase.budget_allocated,
        budget_used: 0,
        start_date: phase.start_date || null,
        end_date: phase.end_date || null,
        status: 'planning'
      }))

      const { error } = await supabase
        .from('project_phases')
        .insert(phasesToInsert)

      if (error) throw error

      setShowPhaseSetup(false)
      setPhases([])
      await fetchProjects()
    } catch (error) {
      console.error('Error creating phases:', error)
      alert('Error creating project phases.')
    }
  }

  const openEditPhaseModal = (phase: ProjectPhase) => {
    setEditingPhase(phase)
    setEditPhaseForm({
      phase_name: phase.phase_name,
      budget_allocated: phase.budget_allocated,
      start_date: phase.start_date || '',
      end_date: phase.end_date || '',
      status: phase.status
    })
    setShowEditPhaseModal(true)
  }

  const updatePhase = async () => {
    if (!editingPhase || !selectedProject) return

    if (!editPhaseForm.phase_name.trim()) {
      alert('Phase name is required')
      return
    }

    try {
      const budgetDifference = editPhaseForm.budget_allocated - editingPhase.budget_allocated

      if (editPhaseForm.budget_allocated < editingPhase.budget_used) {
        if (!confirm(
          `Warning: New budget ($${editPhaseForm.budget_allocated.toLocaleString()}) is less than already allocated amount ($${editingPhase.budget_used.toLocaleString()}).\n\n` +
          `This means you're reducing the budget below what's already committed to subcontractors.\n\n` +
          `Do you want to proceed anyway?`
        )) {
          return
        }
      }

      const otherPhasesTotalBudget = selectedProject.phases
        .filter(p => p.id !== editingPhase.id)
        .reduce((sum, p) => sum + p.budget_allocated, 0)

      const newTotalAllocated = otherPhasesTotalBudget + editPhaseForm.budget_allocated
      const projectBudgetDiff = newTotalAllocated - selectedProject.budget

      if (projectBudgetDiff !== 0) {
        const message = projectBudgetDiff > 0
          ? `Total allocated budget across all phases (€${newTotalAllocated.toLocaleString()}) will exceed project budget by €${Math.abs(projectBudgetDiff).toLocaleString()}. Do you want to proceed?`
          : `Total allocated budget across all phases (€${newTotalAllocated.toLocaleString()}) will be less than project budget by €${Math.abs(projectBudgetDiff).toLocaleString()}. Do you want to proceed?`

        if (!confirm(message)) {
          return
        }
      }

      const { error } = await supabase
        .from('project_phases')
        .update({
          phase_name: editPhaseForm.phase_name,
          budget_allocated: editPhaseForm.budget_allocated,
          start_date: editPhaseForm.start_date || null,
          end_date: editPhaseForm.end_date || null,
          status: editPhaseForm.status
        })
        .eq('id', editingPhase.id)

      if (error) throw error

      setShowEditPhaseModal(false)
      setEditingPhase(null)
      await fetchProjects()
    } catch (error) {
      console.error('Error updating phase:', error)
      alert('Error updating phase. Please try again.')
    }
  }

  const deletePhase = async (phase: ProjectPhase) => {
    if (!selectedProject) return

    if (phase.budget_used > 0) {
      alert('Cannot delete phase with active subcontractor assignments. Please remove or reassign all subcontractors first.')
      return
    }

    if (!confirm(`Are you sure you want to delete phase "${phase.phase_name}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('project_phases')
        .delete()
        .eq('id', phase.id)

      if (error) throw error

      const remainingPhases = selectedProject.phases
        .filter(p => p.id !== phase.id)
        .sort((a, b) => a.phase_number - b.phase_number)

      for (let i = 0; i < remainingPhases.length; i++) {
        await supabase
          .from('project_phases')
          .update({ phase_number: i + 1 })
          .eq('id', remainingPhases[i].id)
      }

      await fetchProjects()
    } catch (error) {
      console.error('Error deleting phase:', error)
      alert('Error deleting phase. Please try again.')
    }
  }

  const addSubcontractorToPhase = async () => {
    try {
      if (useExistingSubcontractor) {
        // Link existing subcontractor to phase
        if (!selectedPhase || !newSubcontractor.existing_subcontractor_id) {
          alert('Please select a subcontractor')
          return
        }

        if (newSubcontractor.cost > selectedPhase.budget_allocated - selectedPhase.budget_used) {
          alert('Contract cost exceeds available phase budget')
          return
        }

        // Update existing subcontractor with phase assignment
        const { error: updateError } = await supabase
          .from('subcontractors')
          .update({ 
            phase_id: selectedPhase.id,
            cost: newSubcontractor.cost,
            deadline: newSubcontractor.deadline,
            job_description: newSubcontractor.job_description
          })
          .eq('id', newSubcontractor.existing_subcontractor_id)

        if (updateError) throw updateError

        // Update phase budget
        const { error: phaseError } = await supabase
          .from('project_phases')
          .update({ 
            budget_used: selectedPhase.budget_used + newSubcontractor.cost 
          })
          .eq('id', selectedPhase.id)

        if (phaseError) throw phaseError
      } else {
        // Create new subcontractor
        if (!selectedPhase || !newSubcontractor.name.trim() || !newSubcontractor.contact.trim()) {
          alert('Please fill in required fields')
          return
        }

        if (newSubcontractor.cost > selectedPhase.budget_allocated - selectedPhase.budget_used) {
          alert('Contract cost exceeds available phase budget')
          return
        }

        // Insert new subcontractor
        const { error: insertError } = await supabase
          .from('subcontractors')
          .insert({
            name: newSubcontractor.name,
            contact: newSubcontractor.contact,
            job_description: newSubcontractor.job_description,
            deadline: newSubcontractor.deadline,
            cost: newSubcontractor.cost,
            budget_realized: newSubcontractor.budget_realized,
            phase_id: selectedPhase.id
          })

        if (insertError) throw insertError

        // Update phase budget
        const { error: phaseError } = await supabase
          .from('project_phases')
          .update({ 
            budget_used: selectedPhase.budget_used + newSubcontractor.cost 
          })
          .eq('id', selectedPhase.id)

        if (phaseError) throw phaseError
      }

      resetSubcontractorForm()
      await fetchProjects()
    } catch (error) {
      console.error('Error adding subcontractor:', error)
      alert('Error adding subcontractor to phase.')
    }
  }

  const resetSubcontractorForm = () => {
    setNewSubcontractor({
      existing_subcontractor_id: '',
      name: '',
      contact: '',
      job_description: '',
      deadline: '',
      cost: 0,
      budget_realized: 0,
      phase_id: ''
    })
    setSelectedPhase(null)
    setShowSubcontractorForm(false)
    setUseExistingSubcontractor(false)
  }

  const addPaymentToSubcontractor = async () => {
    if (!selectedSubcontractorForPayment || paymentAmount <= 0) {
      alert('Please enter a valid payment amount')
      return
    }

    if (!user?.id) {
      alert('You must be logged in to record payments')
      return
    }

    try {
      // Ensure budget_realized exists and is a number
      const currentBudgetRealized = selectedSubcontractorForPayment.budget_realized || 0

      let contractId = selectedSubcontractorForPayment.contract_id

      // If no contract exists, create one automatically
      if (!contractId && selectedSubcontractorForPayment.phase_id) {
        // Get phase and project information
        const { data: phaseData, error: phaseError } = await supabase
          .from('project_phases')
          .select('project_id, phase_name')
          .eq('id', selectedSubcontractorForPayment.phase_id)
          .single()

        if (phaseError) throw phaseError

        // Count existing contracts to generate contract number
        const { count } = await supabase
          .from('contracts')
          .select('*', { count: 'exact', head: true })

        const contractNumber = `CNT-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(5, '0')}`

        // Create contract
        const { data: newContract, error: contractError } = await supabase
          .from('contracts')
          .insert({
            contract_number: contractNumber,
            project_id: phaseData.project_id,
            phase_id: selectedSubcontractorForPayment.phase_id,
            subcontractor_id: selectedSubcontractorForPayment.id,
            job_description: selectedSubcontractorForPayment.job_description || 'Construction work',
            contract_amount: selectedSubcontractorForPayment.cost,
            budget_realized: currentBudgetRealized,
            end_date: selectedSubcontractorForPayment.deadline,
            status: 'active'
          })
          .select()
          .single()

        if (contractError) {
          console.error('Contract creation error:', contractError)
          throw new Error(`Failed to create contract: ${contractError.message}`)
        }

        contractId = newContract.id

        // Update subcontractor with contract_id
        await supabase
          .from('subcontractors')
          .update({ contract_id: contractId })
          .eq('id', selectedSubcontractorForPayment.id)
      }

      // Create wire payment record
      const { data: paymentData, error: paymentError } = await supabase
        .from('wire_payments')
        .insert({
          subcontractor_id: selectedSubcontractorForPayment.id,
          contract_id: contractId,
          amount: paymentAmount,
          payment_date: paymentDate || null,
          notes: paymentNotes || null,
          created_by: user.id
        })
        .select()

      if (paymentError) {
        console.error('Payment insert error:', paymentError)
        throw new Error(`Failed to create payment record: ${paymentError.message}`)
      }

      // Update subcontractor's budget_realized
      const newRealizedAmount = currentBudgetRealized + paymentAmount

      const { error: updateError } = await supabase
        .from('subcontractors')
        .update({ budget_realized: newRealizedAmount })
        .eq('id', selectedSubcontractorForPayment.id)

      if (updateError) {
        console.error('Budget update error:', updateError)
        throw new Error(`Failed to update budget: ${updateError.message}`)
      }

      // Update contract's budget_realized
      if (contractId) {
        const { error: contractUpdateError } = await supabase
          .from('contracts')
          .update({ budget_realized: newRealizedAmount })
          .eq('id', contractId)

        if (contractUpdateError) {
          console.error('Contract update error:', contractUpdateError)
        }
      }

      setShowPaymentModal(false)
      setPaymentAmount(0)
      setPaymentDate('')
      setPaymentNotes('')
      setSelectedSubcontractorForPayment(null)

      await fetchProjects()
    } catch (error: any) {
      console.error('Error adding payment:', error)
      alert(error.message || 'Error recording payment. Please check the console for details.')
    }
  }

  const fetchWirePayments = async (subcontractorId: string) => {
    try {
      const { data, error } = await supabase
        .from('wire_payments')
        .select('*')
        .eq('subcontractor_id', subcontractorId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setWirePayments(data || [])
    } catch (error) {
      console.error('Error fetching wire payments:', error)
    }
  }

  const openPaymentHistory = async (subcontractor: Subcontractor) => {
    setSelectedSubcontractorForPayment(subcontractor)
    await fetchWirePayments(subcontractor.id)
    setShowPaymentHistory(true)
  }

  const openEditPayment = (payment: WirePayment) => {
    setEditingPayment(payment)
    setShowEditPaymentModal(true)
  }

  const updateWirePayment = async () => {
    if (!editingPayment || editingPayment.amount <= 0) {
      alert('Please enter a valid payment amount')
      return
    }

    if (!selectedSubcontractorForPayment) {
      alert('No subcontractor selected')
      return
    }

    try {
      const oldAmount = wirePayments.find(p => p.id === editingPayment.id)?.amount || 0
      const amountDifference = editingPayment.amount - oldAmount
      const currentBudgetRealized = selectedSubcontractorForPayment.budget_realized || 0

      // Update wire payment record
      const { error: paymentError } = await supabase
        .from('wire_payments')
        .update({
          amount: editingPayment.amount,
          payment_date: editingPayment.payment_date || null,
          notes: editingPayment.notes || null
        })
        .eq('id', editingPayment.id)

      if (paymentError) {
        console.error('Payment update error:', paymentError)
        throw new Error(`Failed to update payment: ${paymentError.message}`)
      }

      // Update subcontractor's budget_realized
      const newRealizedAmount = currentBudgetRealized + amountDifference

      const { error: updateError } = await supabase
        .from('subcontractors')
        .update({ budget_realized: newRealizedAmount })
        .eq('id', selectedSubcontractorForPayment.id)

      if (updateError) {
        console.error('Budget update error:', updateError)
        throw new Error(`Failed to update budget: ${updateError.message}`)
      }

      // If there's a contract, update its budget_realized too
      if (selectedSubcontractorForPayment.contract_id) {
        const { error: contractUpdateError } = await supabase
          .from('contracts')
          .update({ budget_realized: newRealizedAmount })
          .eq('id', selectedSubcontractorForPayment.contract_id)

        if (contractUpdateError) {
          console.error('Contract update error:', contractUpdateError)
        }
      }

      setShowEditPaymentModal(false)
      setEditingPayment(null)
      await fetchProjects()
      await fetchWirePayments(selectedSubcontractorForPayment.id)
    } catch (error: any) {
      console.error('Error updating payment:', error)
      alert(error.message || 'Error updating payment. Please check the console for details.')
    }
  }

  const deleteWirePayment = async (paymentId: string, amount: number) => {
    if (!confirm('Are you sure you want to delete this payment? This will adjust the total paid amount.')) return

    if (!selectedSubcontractorForPayment) {
      alert('No subcontractor selected')
      return
    }

    try {
      const currentBudgetRealized = selectedSubcontractorForPayment.budget_realized || 0

      // Delete wire payment record
      const { error: deleteError } = await supabase
        .from('wire_payments')
        .delete()
        .eq('id', paymentId)

      if (deleteError) {
        console.error('Payment delete error:', deleteError)
        throw new Error(`Failed to delete payment: ${deleteError.message}`)
      }

      // Update subcontractor's budget_realized
      const newRealizedAmount = Math.max(0, currentBudgetRealized - amount)

      const { error: updateError } = await supabase
        .from('subcontractors')
        .update({ budget_realized: newRealizedAmount })
        .eq('id', selectedSubcontractorForPayment.id)

      if (updateError) {
        console.error('Budget update error:', updateError)
        throw new Error(`Failed to update budget: ${updateError.message}`)
      }

      // If there's a contract, update its budget_realized too
      if (selectedSubcontractorForPayment.contract_id) {
        const { error: contractUpdateError } = await supabase
          .from('contracts')
          .update({ budget_realized: newRealizedAmount })
          .eq('id', selectedSubcontractorForPayment.contract_id)

        if (contractUpdateError) {
          console.error('Contract update error:', contractUpdateError)
        }
      }

      await fetchProjects()
      await fetchWirePayments(selectedSubcontractorForPayment.id)
      alert('Payment deleted successfully!')
    } catch (error: any) {
      console.error('Error deleting payment:', error)
      alert(error.message || 'Error deleting payment. Please check the console for details.')
    }
  }

  const fetchSubcontractorComments = async (subcontractorId: string) => {
    try {
      const { data, error } = await supabase
        .from('subcontractor_comments')
        .select(`
          *,
          users!inner(username, role)
        `)
        .eq('subcontractor_id', subcontractorId)
        .order('created_at', { ascending: true })

      if (error) throw error
      
      const commentsWithUser = (data || []).map(comment => ({
        ...comment,
        user: comment.users
      }))
      
      setSubcontractorComments(commentsWithUser)
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  const addSubcontractorComment = async () => {
    if (!selectedSubcontractor || !newComment.trim()) return

    try {
      const { error } = await supabase
        .from('subcontractor_comments')
        .insert({
          subcontractor_id: selectedSubcontractor.id,
          user_id: user?.id,
          comment: newComment.trim(),
          comment_type: commentType
        })

      if (error) throw error

      setNewComment('')
      await fetchSubcontractorComments(selectedSubcontractor.id)
    } catch (error) {
      console.error('Error adding comment:', error)
    }
  }

  const openSubcontractorDetails = (subcontractor: Subcontractor) => {
    setSelectedSubcontractor(subcontractor)
    fetchSubcontractorComments(subcontractor.id)
  }

  const openEditSubcontractor = (subcontractor: Subcontractor) => {
    setEditingSubcontractor(subcontractor)
    setShowEditModal(true)
  }

  const updateSubcontractor = async () => {
    if (!editingSubcontractor) return

    try {
      // Update the subcontractor
      const { error } = await supabase
        .from('subcontractors')
        .update({
          name: editingSubcontractor.name,
          contact: editingSubcontractor.contact,
          job_description: editingSubcontractor.job_description,
          deadline: editingSubcontractor.deadline,
          cost: editingSubcontractor.cost,
          progress: editingSubcontractor.progress || 0
        })
        .eq('id', editingSubcontractor.id)

      if (error) throw error

      // If the subcontractor has a phase, recalculate the phase's budget_used
      if (editingSubcontractor.phase_id) {
        // Get all subcontractors for this phase
        const { data: phaseSubcontractors, error: subError } = await supabase
          .from('subcontractors')
          .select('cost')
          .eq('phase_id', editingSubcontractor.phase_id)

        if (subError) throw subError

        // Calculate new budget_used
        const newBudgetUsed = (phaseSubcontractors || []).reduce((sum, sub) => sum + sub.cost, 0)

        // Update the phase's budget_used
        const { error: updateError } = await supabase
          .from('project_phases')
          .update({ budget_used: newBudgetUsed })
          .eq('id', editingSubcontractor.phase_id)

        if (updateError) throw updateError
      }

      setShowEditModal(false)
      setEditingSubcontractor(null)
      await fetchProjects()
    } catch (error) {
      console.error('Error updating subcontractor:', error)
      alert('Error updating subcontractor.')
    }
  }

  const deleteSubcontractor = async (subcontractorId: string) => {
    if (!confirm('Are you sure you want to delete this subcontractor?')) return

    try {
      // First, get the subcontractor to find its cost and phase
      const { data: subcontractor, error: fetchError } = await supabase
        .from('subcontractors')
        .select('cost, phase_id')
        .eq('id', subcontractorId)
        .single()

      if (fetchError) throw fetchError

      // Delete the subcontractor
      const { error: deleteError } = await supabase
        .from('subcontractors')
        .delete()
        .eq('id', subcontractorId)

      if (deleteError) throw deleteError

      // If the subcontractor was assigned to a phase, recalculate the phase's budget_used
      if (subcontractor.phase_id) {
        // Get all remaining subcontractors for this phase
        const { data: remainingSubcontractors, error: subError } = await supabase
          .from('subcontractors')
          .select('cost')
          .eq('phase_id', subcontractor.phase_id)

        if (subError) throw subError

        // Calculate new budget_used
        const newBudgetUsed = (remainingSubcontractors || []).reduce((sum, sub) => sum + sub.cost, 0)

        // Update the phase's budget_used
        const { error: updateError } = await supabase
          .from('project_phases')
          .update({ budget_used: newBudgetUsed })
          .eq('id', subcontractor.phase_id)

        if (updateError) throw updateError
      }

      await fetchProjects()
    } catch (error) {
      console.error('Error deleting subcontractor:', error)
      alert('Error deleting subcontractor.')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading site management...</div>
  }

  if (selectedProject) {
    return (
      <div>
        {/* Project Header */}
        <div className="mb-6">
          <button
            onClick={() => setSelectedProject(null)}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{selectedProject.name}</h1>
              <p className="text-gray-600 mt-1">{selectedProject.location}</p>
              <p className="text-sm text-gray-500 mt-1">
                Budget: €{selectedProject.budget.toLocaleString()}
                {selectedProject.has_phases && (
                  <>
                    <span className="ml-2">
                      • Allocated: €{selectedProject.total_budget_allocated.toLocaleString()}
                    </span>
                    <span className="ml-2 text-teal-600 font-medium">
                      • Paid out: €{selectedProject.total_paid_out.toLocaleString()}
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                selectedProject.status === 'Completed' ? 'bg-green-100 text-green-800' :
                selectedProject.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {selectedProject.status}
              </span>
              {!selectedProject.has_phases && (
                <button
                  onClick={() => {
                    setShowPhaseSetup(true)
                    initializePhases()
                  }}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Setup Phases
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Phase Setup Modal */}
        {showPhaseSetup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Setup Project Phases</h3>
                    <p className="text-gray-600 mt-1">
                      Distribute €{selectedProject.budget.toLocaleString()} budget across construction phases
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPhaseSetup(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Phases
                  </label>
                  <select
                    value={phaseCount}
                    onChange={(e) => updatePhaseCount(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {[1, 2, 3, 4, 5, 6].map(count => (
                      <option key={count} value={count}>{count} Phase</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4">
                  {phases.map((phase, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Phase {index + 1}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Phase Name</label>
                          <input
                            type="text"
                            value={phase.phase_name}
                            onChange={(e) => {
                              const newPhases = [...phases]
                              newPhases[index].phase_name = e.target.value
                              setPhases(newPhases)
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={`Phase ${index + 1} name`}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Budget Allocated ($)</label>
                          <input
                            type="number"
                            value={phase.budget_allocated}
                            onChange={(e) => {
                              const newPhases = [...phases]
                              newPhases[index].budget_allocated = parseFloat(e.target.value) || 0
                              setPhases(newPhases)
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                          <input
                            type="date"
                            value={phase.start_date}
                            onChange={(e) => {
                              const newPhases = [...phases]
                              newPhases[index].start_date = e.target.value
                              setPhases(newPhases)
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                          <input
                            type="date"
                            value={phase.end_date}
                            onChange={(e) => {
                              const newPhases = [...phases]
                              newPhases[index].end_date = e.target.value
                              setPhases(newPhases)
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Budget Summary */}
                <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Budget Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Project Budget</p>
                      <p className="text-lg font-bold text-gray-900">${selectedProject.budget.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Allocated</p>
                      <p className={`text-lg font-bold ${
                        phases.reduce((sum, p) => sum + p.budget_allocated, 0) === selectedProject.budget
                          ? 'text-green-600'
                          : phases.reduce((sum, p) => sum + p.budget_allocated, 0) > selectedProject.budget
                          ? 'text-orange-600'
                          : 'text-blue-600'
                      }`}>
                        ${phases.reduce((sum, p) => sum + p.budget_allocated, 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Difference</p>
                      <p className={`text-lg font-bold ${
                        selectedProject.budget - phases.reduce((sum, p) => sum + p.budget_allocated, 0) === 0
                          ? 'text-green-600'
                          : selectedProject.budget - phases.reduce((sum, p) => sum + p.budget_allocated, 0) < 0
                          ? 'text-orange-600'
                          : 'text-blue-600'
                      }`}>
                        {selectedProject.budget - phases.reduce((sum, p) => sum + p.budget_allocated, 0) === 0
                          ? 'Matched'
                          : selectedProject.budget - phases.reduce((sum, p) => sum + p.budget_allocated, 0) > 0
                          ? `€${(selectedProject.budget - phases.reduce((sum, p) => sum + p.budget_allocated, 0)).toLocaleString()} under`
                          : `€${Math.abs(selectedProject.budget - phases.reduce((sum, p) => sum + p.budget_allocated, 0)).toLocaleString()} over`
                        }
                      </p>
                    </div>
                  </div>
                  {phases.reduce((sum, p) => sum + p.budget_allocated, 0) !== selectedProject.budget && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <span className="font-medium">Note:</span> Phase budgets don't match the project budget. You can proceed with this allocation, but be aware of the difference when managing costs.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowPhaseSetup(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createProjectPhases}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    Create Phases
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Project Phases or Legacy View */}
        {selectedProject.has_phases ? (
          <div className="space-y-6">
            {selectedProject.phases.map((phase, index) => {
              const phaseSubcontractors = selectedProject.subcontractors.filter(sub => sub.phase_id === phase.id)
              const totalBudgetRealized = phaseSubcontractors.reduce((sum, sub) => sum + sub.budget_realized, 0)
              const totalContractCost = phaseSubcontractors.reduce((sum, sub) => sum + sub.cost, 0)
              const costVariance = totalBudgetRealized - totalContractCost
              const budgetUtilization = phase.budget_allocated > 0 ? (totalBudgetRealized / phase.budget_allocated) * 100 : 0

              return (
                <div key={phase.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-blue-100 rounded-lg">
                          <Building2 className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900">{phase.phase_name}</h3>
                          <p className="text-gray-600">Phase {phase.phase_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">${phase.budget_allocated.toLocaleString()}</p>
                          <p className="text-sm text-gray-600">Allocated Budget</p>
                        </div>
                        <button
                          onClick={() => openEditPhaseModal(phase)}
                          className="p-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg transition-colors duration-200"
                          title="Edit phase"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deletePhase(phase)}
                          className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors duration-200"
                          title="Delete phase"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPhase(phase)
                            setNewSubcontractor({ ...newSubcontractor, phase_id: phase.id })
                            setShowSubcontractorForm(true)
                          }}
                          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Subcontractor
                        </button>
                        <button
                          onClick={() => deletePhase(phase.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors duration-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Phase Metrics */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-700">Contract Cost</p>
                        <p className="text-lg font-bold text-gray-900">${totalContractCost.toLocaleString()}</p>
                      </div>
                      <div className="bg-teal-50 p-3 rounded-lg">
                        <p className="text-sm text-teal-700">Paid Out</p>
                        <p className="text-lg font-bold text-teal-900">${totalBudgetRealized.toLocaleString()}</p>
                      </div>
                      <div className="bg-orange-50 p-3 rounded-lg">
                        <p className="text-sm text-orange-700">Unpaid Contracts</p>
                        <p className="text-lg font-bold text-orange-900">
                          €{(totalContractCost - totalBudgetRealized).toLocaleString()}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg ${
                        (phase.budget_allocated - totalContractCost) < 0 ? 'bg-red-50' : 'bg-green-50'
                      }`}>
                        <p className={`text-sm ${
                          (phase.budget_allocated - totalContractCost) < 0 ? 'text-red-700' : 'text-green-700'
                        }`}>Available Budget</p>
                        <p className={`text-lg font-bold ${
                          (phase.budget_allocated - totalContractCost) < 0 ? 'text-red-900' : 'text-green-900'
                        }`}>
                          €{(phase.budget_allocated - totalContractCost).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Budget Utilization Bar */}
                    <div className="mt-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-600">Budget Utilization (Realized vs Allocated)</span>
                        <span className="text-sm font-medium">{budgetUtilization.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all duration-300 ${
                            budgetUtilization > 100 ? 'bg-red-600' :
                            budgetUtilization > 80 ? 'bg-orange-600' :
                            'bg-teal-600'
                          }`}
                          style={{ width: `${Math.min(100, budgetUtilization)}%` }}
                        ></div>
                      </div>
                      {budgetUtilization > 100 && (
                        <p className="text-xs text-red-600 mt-1">
                          Over budget by €{(totalBudgetRealized - phase.budget_allocated).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Subcontractors in this Phase */}
                  <div className="p-6">
                    {phaseSubcontractors.length === 0 ? (
                      <div className="text-center py-8">
                        <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500">No subcontractors assigned to this phase yet</p>
                        <button 
                          onClick={() => {
                            setSelectedPhase(phase)
                            setNewSubcontractor({ ...newSubcontractor, phase_id: phase.id })
                            setShowSubcontractorForm(true)
                          }}
                          className="mt-2 px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                        >
                          Add First Subcontractor
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {phaseSubcontractors.map((subcontractor) => {
                          const isOverdue = new Date(subcontractor.deadline) < new Date() && subcontractor.budget_realized < subcontractor.cost
                          const daysUntilDeadline = differenceInDays(new Date(subcontractor.deadline), new Date())
                          const subVariance = subcontractor.budget_realized - subcontractor.cost
                          const isPaid = subcontractor.budget_realized >= subcontractor.cost
                          const remainingToPay = Math.max(0, subcontractor.cost - subcontractor.budget_realized)

                          return (
                            <div key={subcontractor.id} className={`p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
                              subVariance > 0 ? 'border-red-200 bg-red-50' :
                              isPaid && subVariance === 0 ? 'border-green-200 bg-green-50' :
                              subcontractor.budget_realized > 0 ? 'border-blue-200 bg-blue-50' :
                              'border-gray-200 bg-gray-50'
                            }`}>
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900 mb-1">{subcontractor.name}</h4>
                                  <p className="text-sm text-gray-600 mb-2">{subcontractor.contact}</p>
                                  <p className="text-xs text-gray-500 line-clamp-2">{subcontractor.job_description}</p>
                                </div>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                                  subVariance > 0 ? 'bg-red-100 text-red-800' :
                                  isPaid && subVariance === 0 ? 'bg-green-100 text-green-800' :
                                  subcontractor.budget_realized > 0 ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {subVariance > 0 ? 'Over Budget' :
                                   isPaid && subVariance === 0 ? 'Paid' :
                                   subcontractor.budget_realized > 0 ? 'Partial' : 'Unpaid'}
                                </span>
                              </div>

                              {/* Details */}
                              <div className="space-y-2 text-xs mb-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-600">Deadline:</span>
                                  <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                                    {format(new Date(subcontractor.deadline), 'MMM dd, yyyy')}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-600">Contract:</span>
                                  <span className="font-medium text-gray-900">${subcontractor.cost.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-600">Paid:</span>
                                  <span className="font-medium text-teal-600">${subcontractor.budget_realized.toLocaleString()}</span>
                                </div>
                                {remainingToPay > 0 && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-600">Remaining:</span>
                                    <span className="font-medium text-orange-600">${remainingToPay.toLocaleString()}</span>
                                  </div>
                                )}
                                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                                  <span className="text-gray-600 font-medium">Gain/Loss:</span>
                                  <span className={`font-bold ${
                                    subVariance > 0 ? 'text-red-600' :
                                    subVariance < 0 ? 'text-green-600' :
                                    'text-gray-900'
                                  }`}>
                                    {subVariance > 0 ? '-' : subVariance < 0 ? '+' : ''}${Math.abs(subVariance).toLocaleString()}
                                  </span>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    onClick={() => {
                                      setSelectedSubcontractorForPayment(subcontractor)
                                      setShowPaymentModal(true)
                                    }}
                                    className="px-3 py-2 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 transition-colors duration-200 flex items-center justify-center"
                                  >
                                    <DollarSign className="w-3 h-3 mr-1" />
                                    Wire
                                  </button>
                                  <button
                                    onClick={() => openPaymentHistory(subcontractor)}
                                    className="px-3 py-2 bg-teal-600 text-white rounded-md text-xs font-medium hover:bg-teal-700 transition-colors duration-200 flex items-center justify-center"
                                  >
                                    Payments
                                  </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <button
                                    onClick={() => openEditSubcontractor(subcontractor)}
                                    className="px-2 py-1 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors duration-200"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => openSubcontractorDetails(subcontractor)}
                                    className="px-2 py-1 bg-gray-600 text-white rounded-md text-xs font-medium hover:bg-gray-700 transition-colors duration-200"
                                  >
                                    Details
                                  </button>
                                  <button
                                    onClick={() => deleteSubcontractor(subcontractor.id)}
                                    className="px-2 py-1 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700 transition-colors duration-200"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Legacy view for projects without phases */
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Project Phases Not Set Up</h3>
              <p className="text-gray-600 mb-4">
                Set up construction phases to better organize subcontractors and budget allocation.
              </p>
              <button
                onClick={() => {
                  setShowPhaseSetup(true)
                  initializePhases()
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                Setup Project Phases
              </button>
            </div>
          </div>
        )}

        {/* Subcontractor Form Modal */}
        {showSubcontractorForm && selectedPhase && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Add Subcontractor</h3>
                    <p className="text-gray-600 mt-1">
                      {selectedPhase.phase_name} • Available Budget: €{(selectedPhase.budget_allocated - selectedPhase.budget_used).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={resetSubcontractorForm}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                {/* Subcontractor Selection Type */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Subcontractor Selection
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={!useExistingSubcontractor}
                        onChange={() => setUseExistingSubcontractor(false)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Create New Subcontractor</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={useExistingSubcontractor}
                        onChange={() => setUseExistingSubcontractor(true)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Select Existing Subcontractor</span>
                    </label>
                  </div>
                </div>

                {useExistingSubcontractor ? (
                  /* Existing Subcontractor Selection */
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Subcontractor *
                      </label>
                      <select
                        value={newSubcontractor.existing_subcontractor_id}
                        onChange={(e) => {
                          const selectedSub = existingSubcontractors.find(sub => sub.id === e.target.value)
                          setNewSubcontractor({ 
                            ...newSubcontractor, 
                            existing_subcontractor_id: e.target.value,
                            name: selectedSub?.name || '',
                            contact: selectedSub?.contact || '',
                            job_description: selectedSub?.job_description || ''
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        <option value="">Choose existing subcontractor</option>
                        {existingSubcontractors.filter(sub => !sub.phase_id).map(subcontractor => (
                          <option key={subcontractor.id} value={subcontractor.id}>
                            {subcontractor.name} - {subcontractor.contact}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Contract Cost (€) *
                        </label>
                        <input
                          type="number"
                          value={newSubcontractor.cost}
                          onChange={(e) => setNewSubcontractor({ ...newSubcontractor, cost: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Deadline *
                        </label>
                        <input
                          type="date"
                          value={newSubcontractor.deadline}
                          onChange={(e) => setNewSubcontractor({ ...newSubcontractor, deadline: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Job Description for this Phase
                      </label>
                      <textarea
                        value={newSubcontractor.job_description}
                        onChange={(e) => setNewSubcontractor({ ...newSubcontractor, job_description: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Describe the work for this specific phase..."
                      />
                    </div>
                  </div>
                ) : (
                  /* New Subcontractor Form */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Company Name *</label>
                      <input
                        type="text"
                        value={newSubcontractor.name}
                        onChange={(e) => setNewSubcontractor({ ...newSubcontractor, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter company name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Contact Information *</label>
                      <input
                        type="text"
                        value={newSubcontractor.contact}
                        onChange={(e) => setNewSubcontractor({ ...newSubcontractor, contact: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Email or phone"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Contract Cost (€) *</label>
                      <input
                        type="number"
                        value={newSubcontractor.cost}
                        onChange={(e) => setNewSubcontractor({ ...newSubcontractor, cost: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                        max={selectedPhase.budget_allocated - selectedPhase.budget_used}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Max: €{(selectedPhase.budget_allocated - selectedPhase.budget_used).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Deadline</label>
                      <input
                        type="date"
                        value={newSubcontractor.deadline}
                        onChange={(e) => setNewSubcontractor({ ...newSubcontractor, deadline: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Budget Realized (€)</label>
                      <input
                        type="number"
                        min="0"
                        value={newSubcontractor.budget_realized}
                        onChange={(e) => setNewSubcontractor({ ...newSubcontractor, budget_realized: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Actual amount paid to subcontractor
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Job Description</label>
                      <textarea
                        value={newSubcontractor.job_description}
                        onChange={(e) => setNewSubcontractor({ ...newSubcontractor, job_description: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Describe the work package and responsibilities..."
                      />
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={resetSubcontractorForm}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addSubcontractorToPhase}
                    disabled={newSubcontractor.cost > (selectedPhase.budget_allocated - selectedPhase.budget_used)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    Add Subcontractor
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Phase Modal */}
        {showEditPhaseModal && editingPhase && selectedProject && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Edit Phase</h3>
                    <p className="text-gray-600 mt-1">
                      Phase {editingPhase.phase_number} • Budget Used: €{editingPhase.budget_used.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowEditPhaseModal(false)
                      setEditingPhase(null)
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phase Name *</label>
                    <input
                      type="text"
                      value={editPhaseForm.phase_name}
                      onChange={(e) => setEditPhaseForm({ ...editPhaseForm, phase_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter phase name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Budget Allocated (€) *</label>
                    <input
                      type="number"
                      value={editPhaseForm.budget_allocated}
                      onChange={(e) => setEditPhaseForm({ ...editPhaseForm, budget_allocated: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                      required
                    />
                    {editPhaseForm.budget_allocated < editingPhase.budget_used && (
                      <p className="text-xs text-red-600 mt-1">
                        Warning: Budget is less than already allocated amount (€{editingPhase.budget_used.toLocaleString()})
                      </p>
                    )}
                    {editPhaseForm.budget_allocated >= editingPhase.budget_used && (
                      <p className="text-xs text-gray-500 mt-1">
                        Available after update: €{(editPhaseForm.budget_allocated - editingPhase.budget_used).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                      <input
                        type="date"
                        value={editPhaseForm.start_date}
                        onChange={(e) => setEditPhaseForm({ ...editPhaseForm, start_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                      <input
                        type="date"
                        value={editPhaseForm.end_date}
                        onChange={(e) => setEditPhaseForm({ ...editPhaseForm, end_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={editPhaseForm.status}
                      onChange={(e) => setEditPhaseForm({ ...editPhaseForm, status: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="planning">Planning</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="on_hold">On Hold</option>
                    </select>
                  </div>

                  {(() => {
                    const otherPhasesTotalBudget = selectedProject.phases
                      .filter(p => p.id !== editingPhase.id)
                      .reduce((sum, p) => sum + p.budget_allocated, 0)
                    const newTotalAllocated = otherPhasesTotalBudget + editPhaseForm.budget_allocated
                    const projectBudgetDiff = newTotalAllocated - selectedProject.budget

                    return projectBudgetDiff !== 0 && (
                      <div className={`p-4 rounded-lg border ${
                        projectBudgetDiff > 0 ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'
                      }`}>
                        <p className={`text-sm ${projectBudgetDiff > 0 ? 'text-orange-800' : 'text-blue-800'}`}>
                          <span className="font-medium">Note:</span> After this update, total phase budgets
                          ({' €' + newTotalAllocated.toLocaleString()}) will be {' '}
                          {projectBudgetDiff > 0
                            ? `€${Math.abs(projectBudgetDiff).toLocaleString()} over`
                            : `€${Math.abs(projectBudgetDiff).toLocaleString()} under`
                          } the project budget.
                        </p>
                      </div>
                    )
                  })()}
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowEditPhaseModal(false)
                      setEditingPhase(null)
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={updatePhase}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    Update Phase
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Subcontractor Details Modal */}
        {selectedSubcontractor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{selectedSubcontractor.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{selectedSubcontractor.contact}</p>
                    <div className="flex items-center space-x-3 mt-2">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedSubcontractor.budget_realized > selectedSubcontractor.cost ? 'bg-red-100 text-red-800' :
                        selectedSubcontractor.budget_realized === selectedSubcontractor.cost ? 'bg-green-100 text-green-800' :
                        selectedSubcontractor.budget_realized > 0 ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedSubcontractor.budget_realized > selectedSubcontractor.cost ? 'Over Budget' :
                         selectedSubcontractor.budget_realized === selectedSubcontractor.cost ? 'Fully Paid' :
                         selectedSubcontractor.budget_realized > 0 ? 'Partial Payment' : 'Unpaid'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedSubcontractor(null)
                      setSubcontractorComments([])
                      setNewComment('')
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="mt-4">
                  <p className="text-gray-700">{selectedSubcontractor.job_description}</p>
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Contract Amount</p>
                      <p className="text-lg font-bold text-gray-900">${selectedSubcontractor.cost.toLocaleString()}</p>
                    </div>
                    <div className="bg-teal-50 p-3 rounded-lg">
                      <p className="text-xs text-teal-700 mb-1">Paid Amount</p>
                      <p className="text-lg font-bold text-teal-900">${selectedSubcontractor.budget_realized.toLocaleString()}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${
                      selectedSubcontractor.budget_realized > selectedSubcontractor.cost ? 'bg-red-50' :
                      selectedSubcontractor.budget_realized < selectedSubcontractor.cost ? 'bg-green-50' :
                      'bg-gray-50'
                    }`}>
                      <p className={`text-xs mb-1 ${
                        selectedSubcontractor.budget_realized > selectedSubcontractor.cost ? 'text-red-700' :
                        selectedSubcontractor.budget_realized < selectedSubcontractor.cost ? 'text-green-700' :
                        'text-gray-600'
                      }`}>Gain/Loss</p>
                      <p className={`text-lg font-bold ${
                        selectedSubcontractor.budget_realized > selectedSubcontractor.cost ? 'text-red-900' :
                        selectedSubcontractor.budget_realized < selectedSubcontractor.cost ? 'text-green-900' :
                        'text-gray-900'
                      }`}>
                        {selectedSubcontractor.budget_realized > selectedSubcontractor.cost ? '-' :
                         selectedSubcontractor.budget_realized < selectedSubcontractor.cost ? '+' : ''}
                        ${Math.abs(selectedSubcontractor.budget_realized - selectedSubcontractor.cost).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Comments Section */}
              <div className="flex-1 overflow-y-auto max-h-96 p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Supervision Comments
                </h4>
                
                <div className="space-y-4 mb-4">
                  {subcontractorComments.length === 0 ? (
                    <p className="text-gray-500 text-sm">No supervision comments yet. Add the first comment!</p>
                  ) : (
                    subcontractorComments.map((comment) => (
                      <div key={comment.id} className={`p-4 rounded-lg border ${
                        comment.comment_type === 'issue' ? 'bg-red-50 border-red-200' :
                        comment.comment_type === 'completed' ? 'bg-green-50 border-green-200' :
                        'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">{comment.user?.username}</span>
                            <span className="text-xs text-gray-500">({comment.user?.role})</span>
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              comment.comment_type === 'issue' ? 'bg-red-100 text-red-800' :
                              comment.comment_type === 'completed' ? 'bg-green-100 text-green-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {comment.comment_type === 'completed' ? 'Work Done' :
                               comment.comment_type === 'issue' ? 'Issue' : 'Note'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {format(new Date(comment.created_at), 'MMM dd, yyyy HH:mm')}
                          </span>
                        </div>
                        <p className="text-gray-700">{comment.comment}</p>
                      </div>
                    ))
                  )}
                </div>
                
                {/* Add Comment */}
                <div className="border-t pt-4">
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Comment Type
                    </label>
                    <select
                      value={commentType}
                      onChange={(e) => setCommentType(e.target.value as 'completed' | 'issue' | 'general')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="general">General Note</option>
                      <option value="completed">Work Completed</option>
                      <option value="issue">Issue/Problem</option>
                    </select>
                  </div>
                  <div className="flex space-x-3">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add supervision notes..."
                      rows={3}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                    <button
                      onClick={addSubcontractorComment}
                      disabled={!newComment.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedSubcontractorForPayment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Wire Payment</h3>
                    <p className="text-sm text-gray-600 mt-1">{selectedSubcontractorForPayment.name}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowPaymentModal(false)
                      setPaymentAmount(0)
                      setSelectedSubcontractorForPayment(null)
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">Contract Amount:</span>
                    <span className="text-sm font-medium text-gray-900">${selectedSubcontractorForPayment.cost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">Already Paid:</span>
                    <span className="text-sm font-medium text-teal-600">${selectedSubcontractorForPayment.budget_realized.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Remaining:</span>
                    <span className="text-sm font-bold text-orange-600">
                      ${Math.max(0, selectedSubcontractorForPayment.cost - selectedSubcontractorForPayment.budget_realized).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Amount ($) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter payment amount"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    You can pay any amount, including more than the contract value
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty if date is not yet known
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Add any notes about this payment"
                  />
                </div>

                {paymentAmount > 0 && (
                  <div className={`p-3 rounded-lg mb-4 ${
                    (selectedSubcontractorForPayment.budget_realized + paymentAmount) > selectedSubcontractorForPayment.cost
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-blue-50 border border-blue-200'
                  }`}>
                    <p className={`text-sm ${
                      (selectedSubcontractorForPayment.budget_realized + paymentAmount) > selectedSubcontractorForPayment.cost
                        ? 'text-red-700'
                        : 'text-blue-700'
                    }`}>
                      <span className="font-medium">New Total Paid:</span> ${(selectedSubcontractorForPayment.budget_realized + paymentAmount).toLocaleString()}
                    </p>
                    {(selectedSubcontractorForPayment.budget_realized + paymentAmount) > selectedSubcontractorForPayment.cost && (
                      <p className="text-sm text-red-700 mt-1">
                        <span className="font-medium">Loss:</span> ${((selectedSubcontractorForPayment.budget_realized + paymentAmount) - selectedSubcontractorForPayment.cost).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowPaymentModal(false)
                      setPaymentAmount(0)
                      setPaymentDate('')
                      setPaymentNotes('')
                      setSelectedSubcontractorForPayment(null)
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addPaymentToSubcontractor}
                    disabled={paymentAmount <= 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    Record Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Subcontractor Modal */}
        {showEditModal && editingSubcontractor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900">Edit Subcontractor</h3>
                  <button
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingSubcontractor(null)
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={editingSubcontractor.name}
                    onChange={(e) => setEditingSubcontractor({ ...editingSubcontractor, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact *</label>
                  <input
                    type="text"
                    value={editingSubcontractor.contact}
                    onChange={(e) => setEditingSubcontractor({ ...editingSubcontractor, contact: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Phone or email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Job Description *</label>
                  <textarea
                    value={editingSubcontractor.job_description}
                    onChange={(e) => setEditingSubcontractor({ ...editingSubcontractor, job_description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contract Cost ($) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingSubcontractor.cost}
                      onChange={(e) => setEditingSubcontractor({ ...editingSubcontractor, cost: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Deadline *</label>
                    <input
                      type="date"
                      value={editingSubcontractor.deadline}
                      onChange={(e) => setEditingSubcontractor({ ...editingSubcontractor, deadline: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Work Progress: {editingSubcontractor.progress || 0}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editingSubcontractor.progress || 0}
                    onChange={(e) => setEditingSubcontractor({ ...editingSubcontractor, progress: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Not Started</span>
                    <span>In Progress</span>
                    <span>Completed</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Progress indicates work completion status, independent of payment
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700"><strong>Payment Info (Read-only)</strong></p>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Paid:</span>
                      <span className="font-medium text-gray-900">${editingSubcontractor.budget_realized.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Remaining:</span>
                      <span className="font-medium text-orange-600">
                        ${Math.max(0, editingSubcontractor.cost - editingSubcontractor.budget_realized).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingSubcontractor(null)
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={updateSubcontractor}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment History Modal */}
        {showPaymentHistory && selectedSubcontractorForPayment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Payment History</h3>
                    <p className="text-sm text-gray-600 mt-1">{selectedSubcontractorForPayment.name}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowPaymentHistory(false)
                      setSelectedSubcontractorForPayment(null)
                      setWirePayments([])
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-gray-600">Contract Amount</p>
                      <p className="text-lg font-bold text-gray-900">${selectedSubcontractorForPayment.cost.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Paid</p>
                      <p className="text-lg font-bold text-teal-600">${selectedSubcontractorForPayment.budget_realized.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Remaining</p>
                      <p className="text-lg font-bold text-orange-600">
                        ${Math.max(0, selectedSubcontractorForPayment.cost - selectedSubcontractorForPayment.budget_realized).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <h4 className="font-semibold text-gray-900 mb-3">All Payments ({wirePayments.length})</h4>

                {wirePayments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No payments recorded yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {wirePayments.map((payment) => (
                      <div key={payment.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <span className="text-lg font-bold text-gray-900">${payment.amount.toLocaleString()}</span>
                              {payment.payment_date && (
                                <span className="text-sm text-gray-600">
                                  {format(new Date(payment.payment_date), 'MMM dd, yyyy')}
                                </span>
                              )}
                              {!payment.payment_date && (
                                <span className="text-sm text-gray-400 italic">Date not set</span>
                              )}
                            </div>
                            {payment.notes && (
                              <p className="text-sm text-gray-600 mb-2">{payment.notes}</p>
                            )}
                            <p className="text-xs text-gray-400">
                              Created {format(new Date(payment.created_at), 'MMM dd, yyyy HH:mm')}
                            </p>
                          </div>
                          <div className="flex space-x-2 ml-4">
                            <button
                              onClick={() => openEditPayment(payment)}
                              className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteWirePayment(payment.id, payment.amount)}
                              className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit Payment Modal */}
        {showEditPaymentModal && editingPayment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900">Edit Payment</h3>
                  <button
                    onClick={() => {
                      setShowEditPaymentModal(false)
                      setEditingPayment(null)
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Amount (€) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingPayment.amount}
                    onChange={(e) => setEditingPayment({ ...editingPayment, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={editingPayment.payment_date || ''}
                    onChange={(e) => setEditingPayment({ ...editingPayment, payment_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={editingPayment.notes || ''}
                    onChange={(e) => setEditingPayment({ ...editingPayment, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add any notes about this payment"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowEditPaymentModal(false)
                      setEditingPayment(null)
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={updateWirePayment}
                    disabled={editingPayment.amount <= 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Project Summary */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{selectedProject.subcontractors.length}</div>
              <div className="text-sm text-gray-600">Total Subcontractors</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {selectedProject.subcontractors.filter(s => s.budget_realized >= s.cost).length}
              </div>
              <div className="text-sm text-gray-600">Fully Paid</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">${selectedProject.total_subcontractor_cost.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Contract Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-teal-600">
                €{selectedProject.subcontractors.reduce((sum, s) => sum + s.budget_realized, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Paid</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Site Management</h1>
        <p className="text-gray-600 mt-2">Manage construction phases and subcontractors by project</p>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          const daysRemaining = project.end_date ? differenceInDays(new Date(project.end_date), new Date()) : null
          const isProjectOverdue = daysRemaining !== null && daysRemaining < 0 && project.status !== 'Completed'

          return (
            <div
              key={project.id}
              onClick={() => setSelectedProject(project)}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{project.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{project.location}</p>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {project.status}
                    </span>
                    {project.has_phases ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                        {project.phases.length} Phases
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                        No Phases
                      </span>
                    )}
                    {project.overdue_subcontractors > 0 && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        {project.overdue_subcontractors} Overdue
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>

              {/* Project Stats */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Overall Progress</span>
                    <span className="text-sm font-medium text-gray-900">{project.completion_percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${project.completion_percentage}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Budget</p>
                    <p className="font-medium text-gray-900">${(project.budget / 1000000).toFixed(1)}M</p>
                    {project.has_phases && (
                      <>
                        <p className="text-xs text-gray-500">
                          €{(project.total_budget_allocated / 1000000).toFixed(1)}M allocated
                        </p>
                        <p className="text-xs text-teal-600 font-medium">
                          €{(project.total_paid_out / 1000000).toFixed(1)}M paid out
                        </p>
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-600">Subcontractors</p>
                    <p className="font-medium text-gray-900">{project.subcontractors.length}</p>
                    <p className="text-xs text-gray-500">
                      €{(project.total_subcontractor_cost / 1000000).toFixed(1)}M costs
                    </p>
                  </div>
                </div>

                {daysRemaining !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Timeline</span>
                    <span className={`font-medium ${
                      isProjectOverdue ? 'text-red-600' : daysRemaining < 30 ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {daysRemaining >= 0 ? `${daysRemaining} days left` : `${Math.abs(daysRemaining)} days overdue`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Projects Found</h3>
          <p className="text-gray-600">No construction projects available for site management.</p>
        </div>
      )}
    </div>
  )
}

export default SiteManagement