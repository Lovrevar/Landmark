import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, Project, Subcontractor, SubcontractorComment } from '../lib/supabase'
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
  X
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'

interface ProjectWithSubcontractors extends Project {
  subcontractors: Subcontractor[]
  completion_percentage: number
  total_subcontractor_cost: number
  overdue_subcontractors: number
}

interface ProjectPhase {
  name: string
  description: string
  icon: React.ComponentType<any>
  color: string
  bgColor: string
  subcontractorTypes: string[]
}

const SiteManagement: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectWithSubcontractors[]>([])
  const [selectedProject, setSelectedProject] = useState<ProjectWithSubcontractors | null>(null)
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<Subcontractor | null>(null)
  const [subcontractorComments, setSubcontractorComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentType, setCommentType] = useState<'completed' | 'issue' | 'general'>('general')
  const [loading, setLoading] = useState(true)

  const projectPhases: ProjectPhase[] = [
    {
      name: 'Foundation Phase',
      description: 'Site preparation, excavation, and foundation work',
      icon: Building2,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 border-yellow-200',
      subcontractorTypes: ['excavation', 'foundation', 'concrete', 'site preparation']
    },
    {
      name: 'Structural Phase', 
      description: 'Steel work, concrete structure, and load-bearing elements',
      icon: Building2,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 border-orange-200',
      subcontractorTypes: ['steel', 'structural', 'concrete', 'framing']
    },
    {
      name: 'Systems Installation',
      description: 'Electrical, plumbing, HVAC, and mechanical systems',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 border-blue-200',
      subcontractorTypes: ['electrical', 'plumbing', 'hvac', 'mechanical']
    },
    {
      name: 'Finishing Phase',
      description: 'Interior work, flooring, painting, and final touches',
      icon: CheckCircle,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 border-purple-200',
      subcontractorTypes: ['interior', 'flooring', 'painting', 'finishing']
    }
  ]

  const getPhaseAllocation = (phaseIndex: number) => {
    const allocations = [0.25, 0.35, 0.25, 0.15] // Foundation, Structural, Systems, Finishing
    return allocations[phaseIndex] || 0
  }

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

      // Fetch all subcontractors
      const { data: subcontractorsData, error: subError } = await supabase
        .from('subcontractors')
        .select('*')

      if (subError) throw subError

      // Enhance projects with subcontractor data
      const projectsWithSubcontractors = (projectsData || []).map(project => {
        const projectSubcontractors = subcontractorsData || []
        
        const completion_percentage = projectSubcontractors.length > 0
          ? Math.round(projectSubcontractors.reduce((sum, sub) => sum + sub.progress, 0) / projectSubcontractors.length)
          : 0

        const total_subcontractor_cost = projectSubcontractors.reduce((sum, sub) => sum + sub.cost, 0)
        
        const overdue_subcontractors = projectSubcontractors.filter(sub => 
          new Date(sub.deadline) < new Date() && sub.progress < 100
        ).length

        return {
          ...project,
          subcontractors: projectSubcontractors,
          completion_percentage,
          total_subcontractor_cost,
          overdue_subcontractors
        }
      })

      setProjects(projectsWithSubcontractors)
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSubcontractorsForPhase = (phase: ProjectPhase, subcontractors: Subcontractor[]) => {
    return subcontractors.filter(sub => 
      phase.subcontractorTypes.some(type => 
        sub.job_description.toLowerCase().includes(type) || 
        sub.name.toLowerCase().includes(type)
      )
    )
  }

  const getPhaseProgress = (phase: ProjectPhase, subcontractors: Subcontractor[]) => {
    const phaseSubcontractors = getSubcontractorsForPhase(phase, subcontractors)
    if (phaseSubcontractors.length === 0) return 0
    return Math.round(phaseSubcontractors.reduce((sum, sub) => sum + sub.progress, 0) / phaseSubcontractors.length)
  }

  const getPhaseStatus = (progress: number) => {
    if (progress === 100) return { status: 'Completed', color: 'text-green-600', bg: 'bg-green-100' }
    if (progress > 0) return { status: 'In Progress', color: 'text-blue-600', bg: 'bg-blue-100' }
    return { status: 'Not Started', color: 'text-gray-600', bg: 'bg-gray-100' }
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
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return

      const { error } = await supabase
        .from('subcontractor_comments')
        .insert({
          subcontractor_id: selectedSubcontractor.id,
          user_id: userData.user.id,
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
            </div>
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                selectedProject.status === 'Completed' ? 'bg-green-100 text-green-800' :
                selectedProject.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {selectedProject.status}
              </span>
              <span className="text-sm text-gray-600">
                Overall: {selectedProject.completion_percentage}% Complete
              </span>
            </div>
          </div>
        </div>

        {/* Project Phases */}
        <div className="space-y-6">
          {projectPhases.map((phase, index) => {
            const phaseSubcontractors = getSubcontractorsForPhase(phase, selectedProject.subcontractors)
            const phaseProgress = getPhaseProgress(phase, selectedProject.subcontractors)
            const phaseStatus = getPhaseStatus(phaseProgress)

            return (
              <div key={phase.name} className={`bg-white rounded-xl shadow-sm border-2 ${phase.bgColor}`}>
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-lg ${phase.bgColor}`}>
                        <phase.icon className={`w-6 h-6 ${phase.color}`} />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">{phase.name}</h3>
                        <p className="text-gray-600">{phase.description}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Budget: ${(selectedProject.budget * getPhaseAllocation(index)).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${phaseStatus.bg} ${phaseStatus.color}`}>
                        {phaseStatus.status}
                      </span>
                      <p className="text-sm text-gray-600 mt-1">{phaseProgress}% Complete</p>
                    </div>
                  </div>
                  
                  {/* Phase Progress Bar */}
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all duration-300 ${
                          phaseProgress === 100 ? 'bg-green-600' : 'bg-blue-600'
                        }`}
                        style={{ width: `${phaseProgress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Subcontractors in this Phase */}
                <div className="p-6">
                  {phaseSubcontractors.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">No subcontractors assigned to this phase yet</p>
                      <button className="mt-2 px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
                        Assign Subcontractor
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
                    <p className="text-gray-600">Subcontractors</p>
                    <p className="font-medium text-gray-900">{project.subcontractors.length}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Budget</p>
                    <p className="font-medium text-gray-900">${(project.budget / 1000000).toFixed(1)}M</p>
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