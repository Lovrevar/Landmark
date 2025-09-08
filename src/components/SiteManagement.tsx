import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, Project, Subcontractor, SubcontractorComment, ProjectPhase } from '../lib/supabase'
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
    progress: 0,
    deadline: '',
    cost: 0,
    phase_id: ''
  })
  const [loading, setLoading] = useState(true)
  const [existingSubcontractors, setExistingSubcontractors] = useState<Subcontractor[]>([])
  const [useExistingSubcontractor, setUseExistingSubcontractor] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [])

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
      const { data: subcontractorsData, error: subError } = await supabase
        .from('subcontractors')
        .select(`
          *,
          project_phases(phase_name)
        `)

      if (subError) throw subError

      // Enhance projects with phase and subcontractor data
      const projectsWithPhases = (projectsData || []).map(project => {
        const projectPhases = (phasesData || []).filter(phase => phase.project_id === project.id)
        const projectSubcontractors = (subcontractorsData || []).filter(sub => {
          // For projects without phases, include all subcontractors
          if (projectPhases.length === 0) return true
          // For projects with phases, only include subcontractors assigned to phases of this project
          return projectPhases.some(phase => phase.id === sub.phase_id)
        })
        
        const completion_percentage = projectSubcontractors.length > 0
          ? Math.round(projectSubcontractors.reduce((sum, sub) => sum + sub.progress, 0) / projectSubcontractors.length)
          : 0

        const total_subcontractor_cost = projectSubcontractors.reduce((sum, sub) => sum + sub.cost, 0)
        
        const overdue_subcontractors = projectSubcontractors.filter(sub => 
          new Date(sub.deadline) < new Date() && sub.progress < 100
        ).length

        const has_phases = projectPhases.length > 0
        const total_budget_allocated = projectPhases.reduce((sum, phase) => sum + phase.budget_allocated, 0)

        return {
          ...project,
          phases: projectPhases,
          subcontractors: projectSubcontractors,
          completion_percentage,
          total_subcontractor_cost,
          overdue_subcontractors,
          has_phases,
          total_budget_allocated
        }
      })

      setProjects(projectsWithPhases)

      // Fetch existing subcontractors
      const { data: subcontractorsData, error: subError } = await supabase
        .from('subcontractors')
        .select('*')
        .order('name')

      if (subError) throw subError
      setExistingSubcontractors(subcontractorsData || [])
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
    if (totalAllocated !== selectedProject.budget) {
      alert(`Total allocated budget (${totalAllocated.toLocaleString()}) must equal project budget (${selectedProject.budget.toLocaleString()})`)
      return
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
      fetchProjects()
    } catch (error) {
      console.error('Error creating phases:', error)
      alert('Error creating project phases.')
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
            progress: newSubcontractor.progress,
            deadline: newSubcontractor.deadline,
            cost: newSubcontractor.cost,
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
      fetchProjects()
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
      progress: 0,
      deadline: '',
      cost: 0,
      phase_id: ''
    })
    setSelectedPhase(null)
    setShowSubcontractorForm(false)
    setUseExistingSubcontractor(false)
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
      fetchSubcontractorComments(selectedSubcontractor.id)
    } catch (error) {
      console.error('Error adding comment:', error)
    }
  }

  const openSubcontractorDetails = (subcontractor: Subcontractor) => {
    setSelectedSubcontractor(subcontractor)
    fetchSubcontractorComments(subcontractor.id)
  }

  const deletePhase = async (phaseId: string) => {
    if (!confirm('Are you sure you want to delete this phase? This will unassign all subcontractors from this phase.')) return

    try {
      const { error } = await supabase
        .from('project_phases')
        .delete()
        .eq('id', phaseId)

      if (error) throw error
      fetchProjects()
    } catch (error) {
      console.error('Error deleting phase:', error)
      alert('Error deleting phase.')
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
                Budget: ${selectedProject.budget.toLocaleString()} 
                {selectedProject.has_phases && (
                  <span className="ml-2">
                    • Allocated: ${selectedProject.total_budget_allocated.toLocaleString()}
                  </span>
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
                      Distribute ${selectedProject.budget.toLocaleString()} budget across construction phases
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
                    {[3, 4, 5, 6, 7, 8].map(count => (
                      <option key={count} value={count}>{count} Phases</option>
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
                          ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ${phases.reduce((sum, p) => sum + p.budget_allocated, 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Remaining</p>
                      <p className={`text-lg font-bold ${
                        selectedProject.budget - phases.reduce((sum, p) => sum + p.budget_allocated, 0) === 0 
                          ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        ${(selectedProject.budget - phases.reduce((sum, p) => sum + p.budget_allocated, 0)).toLocaleString()}
                      </p>
                    </div>
                  </div>
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
                    disabled={phases.reduce((sum, p) => sum + p.budget_allocated, 0) !== selectedProject.budget}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
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
              const phaseProgress = phaseSubcontractors.length > 0
                ? Math.round(phaseSubcontractors.reduce((sum, sub) => sum + sub.progress, 0) / phaseSubcontractors.length)
                : 0
              const budgetUtilization = phase.budget_allocated > 0 ? (phase.budget_used / phase.budget_allocated) * 100 : 0

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
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm text-blue-700">Budget Allocated</p>
                        <p className="text-lg font-bold text-blue-900">${phase.budget_allocated.toLocaleString()}</p>
                      </div>
                      <div className="bg-red-50 p-3 rounded-lg">
                        <p className="text-sm text-red-700">Budget Used</p>
                        <p className="text-lg font-bold text-red-900">${phase.budget_used.toLocaleString()}</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg">
                        <p className="text-sm text-green-700">Available Budget</p>
                        <p className="text-lg font-bold text-green-900">
                          ${(phase.budget_allocated - phase.budget_used).toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-purple-50 p-3 rounded-lg">
                        <p className="text-sm text-purple-700">Progress</p>
                        <p className="text-lg font-bold text-purple-900">{phaseProgress}%</p>
                      </div>
                    </div>

                    {/* Budget Utilization Bar */}
                    <div className="mt-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-600">Budget Utilization</span>
                        <span className="text-sm font-medium">{budgetUtilization.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full transition-all duration-300 ${
                            budgetUtilization > 100 ? 'bg-red-600' :
                            budgetUtilization > 80 ? 'bg-orange-600' :
                            'bg-green-600'
                          }`}
                          style={{ width: `${Math.min(100, budgetUtilization)}%` }}
                        ></div>
                      </div>
                      {budgetUtilization > 100 && (
                        <p className="text-xs text-red-600 mt-1">
                          Over budget by ${(phase.budget_used - phase.budget_allocated).toLocaleString()}
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
                          const isOverdue = new Date(subcontractor.deadline) < new Date() && subcontractor.progress < 100
                          const daysUntilDeadline = differenceInDays(new Date(subcontractor.deadline), new Date())

                          return (
                            <div key={subcontractor.id} className={`p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
                              isOverdue ? 'border-red-200 bg-red-50' :
                              subcontractor.progress === 100 ? 'border-green-200 bg-green-50' :
                              subcontractor.progress > 0 ? 'border-blue-200 bg-blue-50' :
                              'border-gray-200 bg-gray-50'
                            }`}>
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900 mb-1">{subcontractor.name}</h4>
                                  <p className="text-sm text-gray-600 mb-2">{subcontractor.contact}</p>
                                  <p className="text-xs text-gray-500 line-clamp-2">{subcontractor.job_description}</p>
                                </div>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  subcontractor.progress === 100 ? 'bg-green-100 text-green-800' :
                                  isOverdue ? 'bg-red-100 text-red-800' :
                                  subcontractor.progress > 0 ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {subcontractor.progress}%
                                </span>
                              </div>

                              {/* Progress Bar */}
                              <div className="mb-3">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                      subcontractor.progress === 100 ? 'bg-green-600' : 'bg-blue-600'
                                    }`}
                                    style={{ width: `${subcontractor.progress}%` }}
                                  ></div>
                                </div>
                              </div>

                              {/* Details */}
                              <div className="space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-600">Deadline:</span>
                                  <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                                    {format(new Date(subcontractor.deadline), 'MMM dd')}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-600">Cost:</span>
                                  <span className="font-medium text-gray-900">${subcontractor.cost.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-600">Status:</span>
                                  <span className={`font-medium ${
                                    subcontractor.progress === 100 ? 'text-green-600' :
                                    isOverdue ? 'text-red-600' :
                                    'text-blue-600'
                                  }`}>
                                    {subcontractor.progress === 100 ? 'Completed' :
                                     isOverdue ? `${Math.abs(daysUntilDeadline)}d overdue` :
                                     daysUntilDeadline >= 0 ? `${daysUntilDeadline}d left` : 'Overdue'}
                                  </span>
                                </div>
                              </div>

                              {/* Action Button */}
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <button
                                  onClick={() => openSubcontractorDetails(subcontractor)}
                                  className="w-full px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors duration-200"
                                >
                                  Manage Details
                                </button>
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
                      {selectedPhase.phase_name} • Available Budget: ${(selectedPhase.budget_allocated - selectedPhase.budget_used).toLocaleString()}
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
                          Contract Cost ($) *
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">Contract Cost ($) *</label>
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
                        Max: ${(selectedPhase.budget_allocated - selectedPhase.budget_used).toLocaleString()}
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">Initial Progress (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={newSubcontractor.progress}
                        onChange={(e) => setNewSubcontractor({ ...newSubcontractor, progress: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
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
                        selectedSubcontractor.progress === 100 ? 'bg-green-100 text-green-800' :
                        new Date(selectedSubcontractor.deadline) < new Date() && selectedSubcontractor.progress < 100 ? 'bg-red-100 text-red-800' :
                        selectedSubcontractor.progress > 0 ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedSubcontractor.progress === 100 ? 'Completed' :
                         new Date(selectedSubcontractor.deadline) < new Date() && selectedSubcontractor.progress < 100 ? 'Overdue' :
                         selectedSubcontractor.progress > 0 ? 'In Progress' : 'Not Started'}
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
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Progress</span>
                      <span className="text-sm font-medium text-gray-900">{selectedSubcontractor.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          selectedSubcontractor.progress === 100 ? 'bg-green-600' : 'bg-blue-600'
                        }`}
                        style={{ width: `${selectedSubcontractor.progress}%` }}
                      ></div>
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
                {selectedProject.subcontractors.filter(s => s.progress === 100).length}
              </div>
              <div className="text-sm text-gray-600">Completed Work</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{selectedProject.overdue_subcontractors}</div>
              <div className="text-sm text-gray-600">Overdue</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">${selectedProject.total_subcontractor_cost.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Total Costs</div>
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
                      <p className="text-xs text-gray-500">
                        ${(project.total_budget_allocated / 1000000).toFixed(1)}M allocated
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-600">Subcontractors</p>
                    <p className="font-medium text-gray-900">{project.subcontractors.length}</p>
                    <p className="text-xs text-gray-500">
                      ${(project.total_subcontractor_cost / 1000000).toFixed(1)}M costs
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