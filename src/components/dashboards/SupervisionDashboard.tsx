import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, Subcontractor, Task, Project, Invoice } from '../../lib/supabase'
import { 
  Users, 
  Clock, 
  DollarSign, 
  AlertTriangle, 
  Building2, 
  Calendar,
  TrendingUp,
  CheckCircle,
  XCircle,
  Plus,
  Eye,
  Wrench,
  HardHat
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'

interface FetchedSubcontractor extends Subcontractor {
  project_phases: {
    project_id: string
  }
}

interface ProjectWithDetails extends Project {
  subcontractors: FetchedSubcontractor[]
  tasks: Task[]
  invoices: Invoice[]
  total_spent: number
  subcontractor_costs: number
  overdue_subcontractors: number
  completion_percentage: number
}

const SupervisionDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectWithDetails[]>([])
  const [subcontractors, setSubcontractors] = useState<FetchedSubcontractor[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedProject, setSelectedProject] = useState<ProjectWithDetails | null>(null)
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalSubcontractors: 0,
    onTimeProjects: 0,
    overdueProjects: 0,
    totalCosts: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch projects with related data
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('start_date', { ascending: false })

      if (projectsError) throw projectsError

      // Fetch all subcontractors
      const { data: allSubcontractorsData, error: subError } = await supabase
        .from('subcontractors')
        .select(`
          *,
          project_phases!inner(project_id)
        `)
        .order('deadline', { ascending: true })

      if (subError) throw subError

      // Fetch supervision tasks
      const { data: tasksData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', 'supervisor')
        .order('deadline', { ascending: true })

      if (taskError) throw taskError

      // Fetch invoices for cost tracking
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')

      if (invoicesError) throw invoicesError

      // Enhance projects with detailed information
      const projectsWithDetails = await Promise.all(
        (projectsData || []).map(async (project) => {
          // Filter subcontractors for this specific project
          const projectSubcontractors = (allSubcontractorsData || []).filter(sub => 
            sub.project_phases.project_id === project.id
          )
          const projectTasks = (tasksData || []).filter(task => task.project_id === project.id)
          const projectInvoices = (invoicesData || []).filter(inv => inv.project_id === project.id)

          // Calculate metrics
          const total_spent = projectInvoices.filter(inv => inv.paid).reduce((sum, inv) => sum + inv.amount, 0)
          const subcontractor_costs = projectSubcontractors.reduce((sum, sub) => sum + sub.cost, 0)
          const overdue_subcontractors = projectSubcontractors.filter(sub => 
            new Date(sub.deadline) < new Date() && sub.progress < 100
          ).length
          const completion_percentage = projectTasks.length > 0 
            ? Math.round(projectTasks.reduce((sum, task) => sum + (task.progress || 0), 0) / projectTasks.length)
            : 0

          return {
            ...project,
            subcontractors: projectSubcontractors,
            tasks: projectTasks,
            invoices: projectInvoices,
            total_spent,
            subcontractor_costs,
            overdue_subcontractors,
            completion_percentage
          }
        })
      )

      setProjects(projectsWithDetails)
      setSubcontractors(allSubcontractorsData || [])
      setTasks(tasksData || [])

      // Calculate overall stats
      const totalProjects = projectsWithDetails.length
      const activeProjects = projectsWithDetails.filter(p => p.status === 'In Progress').length
      const totalSubcontractors = allSubcontractorsData?.length || 0
      const onTimeProjects = projectsWithDetails.filter(p => 
        p.end_date ? new Date(p.end_date) >= new Date() : true
      ).length
      const overdueProjects = projectsWithDetails.filter(p => 
        p.end_date ? new Date(p.end_date) < new Date() && p.status !== 'Completed' : false
      ).length
      const totalCosts = allSubcontractorsData?.reduce((sum, sub) => sum + sub.cost, 0) || 0

      setStats({ 
        totalProjects, 
        activeProjects, 
        totalSubcontractors, 
        onTimeProjects, 
        overdueProjects, 
        totalCosts 
      })
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateProgress = async (subcontractorId: string, newProgress: number) => {
    const { error } = await supabase
      .from('subcontractors')
      .update({ progress: newProgress })
      .eq('id', subcontractorId)

    if (!error) {
      fetchData()
    }
  }

  const getProjectPhase = (completion: number) => {
    if (completion >= 90) return { phase: 'Finishing', color: 'text-purple-600' }
    if (completion >= 70) return { phase: 'Installations', color: 'text-blue-600' }
    if (completion >= 40) return { phase: 'Structural', color: 'text-orange-600' }
    if (completion >= 10) return { phase: 'Foundation', color: 'text-yellow-600' }
    return { phase: 'Planning', color: 'text-gray-600' }
  }

  const getBudgetStatus = (spent: number, budget: number) => {
    const percentage = (spent / budget) * 100
    if (percentage > 90) return { status: 'Critical', color: 'text-red-600', bg: 'bg-red-50' }
    if (percentage > 75) return { status: 'Warning', color: 'text-orange-600', bg: 'bg-orange-50' }
    return { status: 'Good', color: 'text-green-600', bg: 'bg-green-50' }
  }

  if (loading) {
    return <div className="text-center py-12">Loading supervision dashboard...</div>
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Projects</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Subcontractors</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalSubcontractors}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">On Time</p>
              <p className="text-2xl font-bold text-gray-900">{stats.onTimeProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">At Risk</p>
              <p className="text-2xl font-bold text-gray-900">{stats.overdueProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Costs</p>
              <p className="text-2xl font-bold text-gray-900">
                ${stats.totalCosts.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* My Supervision Tasks */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <HardHat className="w-5 h-5 mr-2 text-blue-600" />
            My Supervision Tasks
          </h2>
        </div>
        <div className="p-6">
          {tasks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No supervision tasks assigned</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'Completed'
                const taskColor = isOverdue ? 'border-l-4 border-l-red-500 bg-red-50' :
                                task.status === 'Completed' ? 'border-l-4 border-l-green-500 bg-green-50' :
                                task.status === 'In Progress' ? 'border-l-4 border-l-green-500 bg-green-50' :
                                'border-l-4 border-l-gray-300 bg-gray-50'

                return (
                  <div key={task.id} className={`p-4 rounded-lg border transition-all duration-200 ${taskColor}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-medium text-gray-900">{task.name}</h3>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            task.status === 'Completed' ? 'bg-green-100 text-green-800' :
                            task.status === 'In Progress' ? 'bg-green-100 text-green-800' :
                            isOverdue ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {isOverdue && task.status !== 'Completed' ? 'Overdue' : task.status}
                          </span>
                        </div>
                        
                        {task.description && (
                          <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                        )}
                        
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 text-gray-400 mr-1" />
                            <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                              Due {format(new Date(task.deadline), 'MMM dd, yyyy')}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">Progress:</span>
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  task.status === 'Completed' ? 'bg-green-600' : 'bg-green-600'
                                }`}
                                style={{ width: `${task.progress || 0}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium">{task.progress || 0}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Projects Overview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-blue-600" />
            Projects Under Supervision
          </h2>
        </div>
        <div className="p-6">
          {projects.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No projects available</p>
          ) : (
            <div className="space-y-6">
              {projects.map((project) => {
                const phaseInfo = getProjectPhase(project.completion_percentage)
                const budgetStatus = getBudgetStatus(project.total_spent, project.budget)
                const daysRemaining = project.end_date ? differenceInDays(new Date(project.end_date), new Date()) : null
                const isProjectOverdue = daysRemaining !== null && daysRemaining < 0 && project.status !== 'Completed'

                return (
                  <div key={project.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all duration-200">
                    {/* Project Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900">{project.name}</h3>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                            project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                            project.status === 'On Hold' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {project.status}
                          </span>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${phaseInfo.color} bg-gray-100`}>
                            {phaseInfo.phase} Phase
                          </span>
                          {project.overdue_subcontractors > 0 && (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                              {project.overdue_subcontractors} Overdue
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 mb-2">{project.location}</p>
                        <p className="text-sm text-gray-500">Investor: {project.investor || 'N/A'}</p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedProject(project)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md text-sm font-medium transition-colors duration-200"
                        >
                          <Eye className="w-4 h-4 mr-1 inline" />
                          View Details
                        </button>
                        <button
                          onClick={() => navigate(`/projects/${project.id}`)}
                          className="px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded-md text-sm font-medium transition-colors duration-200"
                        >
                          <Wrench className="w-4 h-4 mr-1 inline" />
                          Manage
                        </button>
                      </div>
                    </div>

                    {/* Project Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">Timeline</span>
                          <Calendar className="w-4 h-4 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          {format(new Date(project.start_date), 'MMM dd, yyyy')}
                        </p>
                        <p className="text-sm text-gray-600">
                          to {project.end_date ? format(new Date(project.end_date), 'MMM dd, yyyy') : 'TBD'}
                        </p>
                        {daysRemaining !== null && (
                          <p className={`text-xs font-medium mt-1 ${
                            isProjectOverdue ? 'text-red-600' : daysRemaining < 30 ? 'text-orange-600' : 'text-green-600'
                          }`}>
                            {daysRemaining >= 0 ? `${daysRemaining} days left` : `${Math.abs(daysRemaining)} days overdue`}
                          </p>
                        )}
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">Budget Status</span>
                          <DollarSign className="w-4 h-4 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          ${project.budget.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">
                          ${project.total_spent.toLocaleString()} spent
                        </p>
                        <p className={`text-xs font-medium mt-1 ${budgetStatus.color}`}>
                          {((project.total_spent / project.budget) * 100).toFixed(1)}% used
                        </p>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">Subcontractors</span>
                          <Users className="w-4 h-4 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          {project.subcontractors.length} active
                        </p>
                        <p className="text-sm text-gray-600">
                          ${project.subcontractor_costs.toLocaleString()} total
                        </p>
                        {project.overdue_subcontractors > 0 && (
                          <p className="text-xs font-medium text-red-600 mt-1">
                            {project.overdue_subcontractors} overdue
                          </p>
                        )}
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">Completion</span>
                          <TrendingUp className="w-4 h-4 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">{project.completion_percentage}%</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${project.completion_percentage}%` }}
                          ></div>
                        </div>
                        <p className={`text-xs font-medium mt-1 ${phaseInfo.color}`}>
                          {phaseInfo.phase}
                        </p>
                      </div>
                    </div>

                    {/* Quick Subcontractor Overview */}
                    <div className="border-t pt-4">
                      <h4 className="font-medium text-gray-900 mb-3">Active Subcontractors</h4>
                      {project.subcontractors.length === 0 ? (
                        <p className="text-gray-500 text-sm">No subcontractors assigned yet</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {project.subcontractors.slice(0, 6).map((sub) => {
                            const isSubOverdue = new Date(sub.deadline) < new Date() && sub.progress < 100
                            return (
                              <div key={sub.id} className={`p-3 rounded-lg border ${
                                isSubOverdue ? 'border-red-200 bg-red-50' :
                                sub.progress === 100 ? 'border-green-200 bg-green-50' :
                                'border-gray-200 bg-gray-50'
                              }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-900 truncate">
                                    {sub.name}
                                  </span>
                                  <span className={`text-xs font-semibold ${
                                    isSubOverdue ? 'text-red-600' :
                                    sub.progress === 100 ? 'text-green-600' :
                                    'text-blue-600'
                                  }`}>
                                    {sub.progress}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                                  <div 
                                    className={`h-1.5 rounded-full ${
                                      isSubOverdue ? 'bg-red-500' :
                                      sub.progress === 100 ? 'bg-green-500' :
                                      'bg-blue-500'
                                    }`}
                                    style={{ width: `${sub.progress}%` }}
                                  ></div>
                                </div>
                                <p className="text-xs text-gray-600 truncate">{sub.job_description}</p>
                                <p className={`text-xs font-medium mt-1 ${
                                  isSubOverdue ? 'text-red-600' : 'text-gray-500'
                                }`}>
                                  Due: {format(new Date(sub.deadline), 'MMM dd')}
                                </p>
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
          )}
        </div>
      </div>

      {/* Project Details Modal */}
      {selectedProject && (
        (() => {
          const daysRemaining = selectedProject.end_date ? differenceInDays(new Date(selectedProject.end_date), new Date()) : null
          const isProjectOverdue = daysRemaining !== null && daysRemaining < 0 && selectedProject.status !== 'Completed'
          const phaseInfo = getProjectPhase(selectedProject.completion_percentage)
          const budgetStatus = getBudgetStatus(selectedProject.total_spent, selectedProject.budget)
          
          return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900">{selectedProject.name}</h3>
                  <p className="text-gray-600 mt-1">{selectedProject.location}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedProject.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      selectedProject.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedProject.status}
                    </span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${phaseInfo.color} bg-gray-100`}>
                      {phaseInfo.phase} Phase
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Project Information Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Timeline Information */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Project Timeline
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-blue-700">Start Date</p>
                      <p className="font-medium text-blue-900">{format(new Date(selectedProject.start_date), 'MMM dd, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-blue-700">Target Completion</p>
                      <p className="font-medium text-blue-900">
                        {selectedProject.end_date ? format(new Date(selectedProject.end_date), 'MMM dd, yyyy') : 'TBD'}
                      </p>
                    </div>
                    {daysRemaining !== null && (
                      <div>
                        <p className="text-sm text-blue-700">Days Remaining</p>
                        <p className={`font-medium ${
                          daysRemaining < 0 ? 'text-red-600' : daysRemaining < 30 ? 'text-orange-600' : 'text-blue-900'
                        }`}>
                          {daysRemaining >= 0 ? `${daysRemaining} days` : `${Math.abs(daysRemaining)} days overdue`}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-blue-700">Current Phase</p>
                      <p className={`font-medium ${phaseInfo.color}`}>{phaseInfo.phase}</p>
                    </div>
                  </div>
                </div>

                {/* Budget Information */}
                <div className={`p-4 rounded-lg ${budgetStatus.bg}`}>
                  <h4 className={`font-semibold mb-3 flex items-center ${budgetStatus.color}`}>
                    <DollarSign className="w-4 h-4 mr-2" />
                    Budget Overview
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <p className={`text-sm ${budgetStatus.color}`}>Total Budget</p>
                      <p className={`font-medium ${budgetStatus.color}`}>${selectedProject.budget.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className={`text-sm ${budgetStatus.color}`}>Amount Spent</p>
                      <p className={`font-medium ${budgetStatus.color}`}>${selectedProject.total_spent.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className={`text-sm ${budgetStatus.color}`}>Remaining</p>
                      <p className={`font-medium ${budgetStatus.color}`}>
                        ${(selectedProject.budget - selectedProject.total_spent).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className={`text-sm ${budgetStatus.color}`}>Subcontractor Costs</p>
                      <p className={`font-medium ${budgetStatus.color}`}>${selectedProject.subcontractor_costs.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Progress Information */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-3 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Progress Status
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-green-700">Overall Completion</p>
                      <p className="font-medium text-green-900">{selectedProject.completion_percentage}%</p>
                      <div className="w-full bg-green-200 rounded-full h-2 mt-1">
                        <div 
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${selectedProject.completion_percentage}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-green-700">Active Tasks</p>
                      <p className="font-medium text-green-900">{selectedProject.tasks.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-green-700">Subcontractors</p>
                      <p className="font-medium text-green-900">{selectedProject.subcontractors.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phase Budget Breakdown */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-4">Budget Allocation by Construction Phase</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    { phase: 'Foundation', budget: selectedProject.budget * 0.25, color: 'bg-yellow-100 text-yellow-800' },
                    { phase: 'Structural', budget: selectedProject.budget * 0.35, color: 'bg-orange-100 text-orange-800' },
                    { phase: 'Installations', budget: selectedProject.budget * 0.25, color: 'bg-blue-100 text-blue-800' },
                    { phase: 'Finishing', budget: selectedProject.budget * 0.15, color: 'bg-purple-100 text-purple-800' }
                  ].map((phaseData) => (
                    <div key={phaseData.phase} className="bg-white border border-gray-200 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">{phaseData.phase}</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${phaseData.color}`}>
                          {((phaseData.budget / selectedProject.budget) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">${phaseData.budget.toLocaleString()}</p>
                      <p className="text-xs text-gray-600 mt-1">Allocated budget</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subcontractors Detail */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-4">Subcontractor Work Packages</h4>
                <div className="space-y-3">
                  {selectedProject.subcontractors.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">No subcontractors assigned yet</p>
                      <button className="mt-2 px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
                        Add Subcontractor
                      </button>
                    </div>
                  ) : (
                    selectedProject.subcontractors.map((sub) => {
                      const isSubOverdue = new Date(sub.deadline) < new Date() && sub.progress < 100
                      const daysUntilDeadline = differenceInDays(new Date(sub.deadline), new Date())
                      
                      return (
                        <div key={sub.id} className={`p-4 rounded-lg border ${
                          isSubOverdue ? 'border-red-200 bg-red-50' :
                          sub.progress === 100 ? 'border-green-200 bg-green-50' :
                          'border-gray-200 bg-gray-50'
                        }`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h5 className="font-medium text-gray-900">{sub.name}</h5>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  sub.progress === 100 ? 'bg-green-100 text-green-800' :
                                  isSubOverdue ? 'bg-red-100 text-red-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {sub.progress === 100 ? 'Completed' : isSubOverdue ? 'Overdue' : 'In Progress'}
                                </span>
                              </div>
                              
                              <p className="text-sm text-gray-600 mb-2">{sub.job_description}</p>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                <div>
                                  <p className="text-xs text-gray-500">Deadline</p>
                                  <p className={`text-sm font-medium ${isSubOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                                    {format(new Date(sub.deadline), 'MMM dd, yyyy')}
                                    {daysUntilDeadline >= 0 ? ` (${daysUntilDeadline}d)` : ` (${Math.abs(daysUntilDeadline)}d overdue)`}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Contract Value</p>
                                  <p className="text-sm font-medium text-gray-900">${sub.cost.toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Contact</p>
                                  <p className="text-sm font-medium text-gray-900">{sub.contact}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-3">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-600">Progress</span>
                                    <span className="text-xs font-medium">{sub.progress}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                      className={`h-2 rounded-full ${
                                        sub.progress === 100 ? 'bg-green-600' : 'bg-blue-600'
                                      }`}
                                      style={{ width: `${sub.progress}%` }}
                                    ></div>
                                  </div>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={sub.progress}
                                  onChange={(e) => updateProgress(sub.id, parseInt(e.target.value))}
                                  className="w-24"
                                  title="Update progress"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Hiring Recommendations */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-4">Phase-Based Hiring Guide</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      phase: 'Foundation Phase',
                      budget: selectedProject.budget * 0.25,
                      contractors: ['Excavation Company', 'Concrete Specialists', 'Foundation Engineers'],
                      timeframe: '2-3 months',
                      color: 'border-yellow-200 bg-yellow-50'
                    },
                    {
                      phase: 'Structural Phase', 
                      budget: selectedProject.budget * 0.35,
                      contractors: ['Steel Workers', 'Concrete Contractors', 'Structural Engineers'],
                      timeframe: '4-6 months',
                      color: 'border-orange-200 bg-orange-50'
                    },
                    {
                      phase: 'Installations Phase',
                      budget: selectedProject.budget * 0.25, 
                      contractors: ['Electrical Contractors', 'Plumbing Specialists', 'HVAC Systems'],
                      timeframe: '3-4 months',
                      color: 'border-blue-200 bg-blue-50'
                    },
                    {
                      phase: 'Finishing Phase',
                      budget: selectedProject.budget * 0.15,
                      contractors: ['Interior Contractors', 'Painters', 'Flooring Specialists'],
                      timeframe: '2-3 months', 
                      color: 'border-purple-200 bg-purple-50'
                    }
                  ].map((phase) => (
                    <div key={phase.phase} className={`p-4 rounded-lg border ${phase.color}`}>
                      <h5 className="font-medium text-gray-900 mb-2">{phase.phase}</h5>
                      <p className="text-sm text-gray-600 mb-2">Budget: ${phase.budget.toLocaleString()}</p>
                      <p className="text-sm text-gray-600 mb-2">Duration: {phase.timeframe}</p>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Recommended Contractors:</p>
                        <ul className="text-xs text-gray-700 space-y-1">
                          {phase.contractors.map((contractor, idx) => (
                            <li key={idx}>• {contractor}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Critical Issues */}
              {(selectedProject.overdue_subcontractors > 0 || selectedProject.pending_invoices > 0) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-3 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Critical Issues Requiring Attention
                  </h4>
                  <div className="space-y-2">
                    {selectedProject.overdue_subcontractors > 0 && (
                      <div className="flex items-center text-red-800">
                        <XCircle className="w-4 h-4 mr-2" />
                        {selectedProject.overdue_subcontractors} subcontractor(s) are behind schedule
                      </div>
                    )}
                    {selectedProject.pending_invoices > 0 && (
                      <div className="flex items-center text-red-800">
                        <Clock className="w-4 h-4 mr-2" />
                        {selectedProject.pending_invoices} invoice(s) pending payment
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => navigate(`/projects/${selectedProject.id}`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Full Project View
                </button>
                <button
                  onClick={() => navigate('/subcontractors')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  Manage Subcontractors
                </button>
              </div>
            </div>
          </div>
        </div>
          )
        })()
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/subcontractors')}
            className="flex items-center justify-center p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors duration-200"
          >
            <Users className="w-6 h-6 text-blue-600 mr-3" />
            <span className="font-medium text-blue-900">Manage Subcontractors</span>
          </button>
          
          <button
            onClick={() => navigate('/tasks')}
            className="flex items-center justify-center p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors duration-200"
          >
            <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
            <span className="font-medium text-green-900">View All Tasks</span>
          </button>
          
          <button
            className="flex items-center justify-center p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors duration-200"
          >
            <Plus className="w-6 h-6 text-orange-600 mr-3" />
            <span className="font-medium text-orange-900">Add Work Log</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default SupervisionDashboard