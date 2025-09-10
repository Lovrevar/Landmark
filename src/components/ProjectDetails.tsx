import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase, Project, Task, Subcontractor, Invoice, Apartment, ProjectPhase } from '../lib/supabase'
import { 
  ArrowLeft, 
  Building2, 
  Calendar, 
  DollarSign, 
  Users, 
  Home, 
  AlertTriangle,
  TrendingUp,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Download,
  Bell
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'

interface SubcontractorWithProjectName extends Subcontractor {
  project_name: string
}

interface ProjectWithDetails extends Project {
  tasks: Task[]
  subcontractors: SubcontractorWithProjectName[]
  invoices: Invoice[]
  apartments: Apartment[]
  completion_percentage: number
  total_spent: number
  total_revenue: number
  overdue_tasks: number
  pending_invoices: number
}

const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [project, setProject] = useState<ProjectWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [generatingReport, setGeneratingReport] = useState(false)

  useEffect(() => {
    if (id) {
      fetchProjectDetails(id)
    }
  }, [id, location.key])

  const fetchProjectDetails = async (projectId: string) => {
    try {
      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (projectError) throw projectError

      // Fetch project phases for this project
      const { data: phasesData, error: phasesError } = await supabase
        .from('project_phases')
        .select('id')
        .eq('project_id', projectId)

      if (phasesError) throw phasesError

      const phaseIds = (phasesData || []).map(phase => phase.id)

      // Fetch related data
      const [tasksResult, subcontractorsResult, invoicesResult, apartmentsResult] = await Promise.all([
        supabase.from('tasks').select('*').eq('project_id', projectId).order('deadline'),
        phaseIds.length > 0 
          ? supabase.from('subcontractors')
              .select(`
                *,
                project_phases!inner(
                  projects!inner(name)
                )
              `)
              .in('phase_id', phaseIds)
              .order('deadline')
          : { data: [], error: null },
        supabase.from('invoices').select('*').eq('project_id', projectId).order('due_date'),
        supabase.from('apartments').select('*').eq('project_id', projectId).order('floor', { ascending: true })
      ])

      const tasks = tasksResult.data || []
      const subcontractorsWithProjectName = (subcontractorsResult.data || []).map(sub => ({
        ...sub,
        project_name: sub.project_phases?.projects?.name || projectData.name
      }))
      const invoices = invoicesResult.data || []
      const apartments = apartmentsResult.data || []

      // Calculate metrics
      const completion_percentage = tasks.length > 0 
        ? Math.round(tasks.reduce((sum, task) => sum + (task.progress || 0), 0) / tasks.length)
        : 0

      const total_spent = invoices.filter(inv => inv.paid).reduce((sum, inv) => sum + inv.amount, 0)
      const total_revenue = apartments.filter(apt => apt.status === 'Sold').reduce((sum, apt) => sum + apt.price, 0)
      const overdue_tasks = tasks.filter(task => 
        new Date(task.deadline) < new Date() && task.status !== 'Completed'
      ).length
      const pending_invoices = invoices.filter(inv => !inv.paid).length

      setProject({
        ...projectData,
        tasks,
        subcontractors: subcontractorsWithProjectName,
        invoices,
        apartments,
        completion_percentage,
        total_spent,
        total_revenue,
        overdue_tasks,
        pending_invoices
      })
    } catch (error) {
      console.error('Error fetching project details:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTaskStatusColor = (task: Task) => {
    const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'Completed'
    if (isOverdue) return 'border-l-4 border-l-red-500 bg-red-50'
    if (task.status === 'Completed') return 'border-l-4 border-l-green-500 bg-green-50'
    if (task.status === 'In Progress') return 'border-l-4 border-l-blue-500 bg-blue-50'
    return 'border-l-4 border-l-gray-300 bg-gray-50'
  }

  const getRiskLevel = () => {
    if (!project) return 'low'
    const budgetUsed = (project.total_spent / project.budget) * 100
    const timeUsed = project.end_date 
      ? ((new Date().getTime() - new Date(project.start_date).getTime()) / 
         (new Date(project.end_date).getTime() - new Date(project.start_date).getTime())) * 100
      : 0

    if (budgetUsed > 90 || timeUsed > 90 || project.overdue_tasks > 3) return 'high'
    if (budgetUsed > 70 || timeUsed > 70 || project.overdue_tasks > 1) return 'medium'
    return 'low'
  }

  const handleGenerateReport = async () => {
    if (!project) return
    
    setGeneratingReport(true)
    try {
      const { generateProjectDetailReport } = await import('../utils/reportGenerator')
      await generateProjectDetailReport(project)
    } catch (error) {
      console.error('Error generating report:', error)
    } finally {
      setGeneratingReport(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading project details...</div>
  }

  if (!project) {
    return <div className="text-center py-12">Project not found</div>
  }

  const riskLevel = getRiskLevel()
  const profitability = project.total_revenue - project.total_spent
  const remainingBudget = project.budget - project.total_spent

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-600 mt-1">{project.location}</p>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              project.status === 'Completed' ? 'bg-green-100 text-green-800' :
              project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
              project.status === 'On Hold' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {project.status}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              riskLevel === 'high' ? 'bg-red-100 text-red-800' :
              riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}>
              {riskLevel.toUpperCase()} RISK
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: Building2 },
            { id: 'timeline', name: 'Timeline & Progress', icon: Clock },
            { id: 'financial', name: 'Financial', icon: DollarSign },
            { id: 'subcontractors', name: 'Subcontractors', icon: Users },
            { id: 'sales', name: 'Sales', icon: Home },
            { id: 'risks', name: 'Risks & Issues', icon: AlertTriangle }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Completion</p>
                  <p className="text-2xl font-bold text-gray-900">{project.completion_percentage}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Budget Used</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {((project.total_spent / project.budget) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Overdue Tasks</p>
                  <p className="text-2xl font-bold text-gray-900">{project.overdue_tasks}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Home className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Units Sold</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {project.apartments.filter(apt => apt.status === 'Sold').length}/{project.apartments.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Project Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Information</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-medium">{project.location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Investor:</span>
                  <span className="font-medium">{project.investor || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Start Date:</span>
                  <span className="font-medium">{format(new Date(project.start_date), 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">End Date:</span>
                  <span className="font-medium">
                    {project.end_date ? format(new Date(project.end_date), 'MMM dd, yyyy') : 'TBD'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Days Remaining:</span>
                  <span className="font-medium">
                    {project.end_date ? differenceInDays(new Date(project.end_date), new Date()) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Budget:</span>
                  <span className="font-medium">${project.budget.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Spent:</span>
                  <span className="font-medium">${project.total_spent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Remaining Budget:</span>
                  <span className={`font-medium ${remainingBudget < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${remainingBudget.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sales Revenue:</span>
                  <span className="font-medium">${project.total_revenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-3">
                  <span className="text-gray-600">Expected Profit:</span>
                  <span className={`font-bold ${profitability >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${profitability.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="space-y-6">
          {/* Progress Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Progress</h3>
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Project Completion</span>
                <span className="text-sm font-medium">{project.completion_percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${project.completion_percentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Tasks I Created */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Tasks I Created</h3>
            </div>
            <div className="p-6 space-y-3">
              {project.tasks.filter(task => task.created_by === 'director').map((task) => {
                const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'Completed'
                const needsApproval = task.progress === 100 && task.status !== 'Completed'
                
                return (
                  <div
                    key={task.id}
                    className={`p-4 rounded-lg border transition-all duration-200 ${getTaskStatusColor(task)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="font-medium text-gray-900">{task.name}</h4>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            task.status === 'Completed' ? 'bg-green-100 text-green-800' :
                            task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                            isOverdue ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {isOverdue && task.status !== 'Completed' ? 'Overdue' : task.status}
                          </span>
                          {needsApproval && (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                              Needs Approval
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2">
                          Assigned to: <span className="font-medium">{task.assigned_to}</span>
                        </p>
                        
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
                                  task.status === 'Completed' ? 'bg-green-600' : 'bg-blue-600'
                                }`}
                                style={{ width: `${task.progress || 0}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium">{task.progress || 0}%</span>
                          </div>
                        </div>
                      </div>
                      
                      {needsApproval && (
                        <button
                          onClick={async () => {
                            const { error } = await supabase
                              .from('tasks')
                              .update({ status: 'Completed' })
                              .eq('id', task.id)
                            
                            if (!error) {
                              fetchProjectDetails(project.id)
                            }
                          }}
                          className="px-3 py-1 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors duration-200"
                        >
                          Approve Completion
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              
              {project.tasks.filter(task => task.created_by === 'director').length === 0 && (
                <p className="text-gray-500 text-center py-8">No tasks created yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'financial' && (
        <div className="space-y-6">
          {/* Financial Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Breakdown</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Budget</span>
                  <span className="font-bold text-lg">${project.budget.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Amount Spent</span>
                  <span className="font-medium">${project.total_spent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Remaining Budget</span>
                  <span className={`font-medium ${remainingBudget < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${remainingBudget.toLocaleString()}
                  </span>
                </div>
                <div className="pt-3 border-t">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">Budget Utilization</span>
                    <span className="text-sm font-medium">
                      {((project.total_spent / project.budget) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        (project.total_spent / project.budget) > 0.9 ? 'bg-red-600' :
                        (project.total_spent / project.budget) > 0.7 ? 'bg-yellow-600' :
                        'bg-green-600'
                      }`}
                      style={{ width: `${Math.min(100, (project.total_spent / project.budget) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue & Profitability</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Sales Revenue</span>
                  <span className="font-medium">${project.total_revenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Costs</span>
                  <span className="font-medium">${project.total_spent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="text-gray-600">Expected Profit</span>
                  <span className={`font-bold text-lg ${profitability >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${profitability.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Profit Margin</span>
                  <span className={`font-medium ${profitability >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {project.total_revenue > 0 ? ((profitability / project.total_revenue) * 100).toFixed(1) : '0'}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Invoices */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Invoices & Payments</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {project.invoices.map((invoice) => {
                    const daysOverdue = !invoice.paid ? differenceInDays(new Date(), new Date(invoice.due_date)) : 0
                    return (
                      <tr key={invoice.id}>
                        <td className="px-6 py-4 text-sm font-medium">${invoice.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm">{format(new Date(invoice.due_date), 'MMM dd, yyyy')}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            invoice.paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {invoice.paid ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {daysOverdue > 0 ? (
                            <span className="text-red-600 font-medium">{daysOverdue} days</span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'subcontractors' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Subcontractors & Work Packages</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contractor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deadline</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {project.subcontractors.map((sub) => {
                  const isOverdue = new Date(sub.deadline) < new Date() && sub.progress < 100
                  return (
                    <tr key={sub.id}>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{sub.name}</div>
                          <div className="text-sm text-gray-500">{sub.contact}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        {sub.job_description}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className={`h-2 rounded-full ${sub.progress === 100 ? 'bg-green-600' : 'bg-blue-600'}`}
                              style={{ width: `${sub.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{sub.progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}>
                          {format(new Date(sub.deadline), 'MMM dd, yyyy')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">${sub.cost.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          sub.progress === 100 ? 'bg-green-100 text-green-800' :
                          isOverdue ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {sub.progress === 100 ? 'Completed' : isOverdue ? 'Overdue' : 'In Progress'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'sales' && (
        <div className="space-y-6">
          {/* Sales Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Home className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Total Units</p>
                  <p className="text-2xl font-bold text-gray-900">{project.apartments.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Units Sold</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {project.apartments.filter(apt => apt.status === 'Sold').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Sales Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">${project.total_revenue.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Apartments Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Apartment Sales Status</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Floor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size (m²)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Buyer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {project.apartments.map((apartment) => (
                    <tr key={apartment.id}>
                      <td className="px-6 py-4 font-medium">{apartment.number}</td>
                      <td className="px-6 py-4 text-sm">{apartment.floor}</td>
                      <td className="px-6 py-4 text-sm">{apartment.size_m2}</td>
                      <td className="px-6 py-4 text-sm font-medium">${apartment.price.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          apartment.status === 'Sold' ? 'bg-green-100 text-green-800' :
                          apartment.status === 'Reserved' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {apartment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">{apartment.buyer_name || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'risks' && (
        <div className="space-y-6">
          {/* Risk Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Overdue Tasks</p>
                  <p className="text-2xl font-bold text-gray-900">{project.overdue_tasks}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Pending Invoices</p>
                  <p className="text-2xl font-bold text-gray-900">{project.pending_invoices}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg ${
                  remainingBudget < 0 ? 'bg-red-100' : 'bg-green-100'
                }`}>
                  <DollarSign className={`w-6 h-6 ${
                    remainingBudget < 0 ? 'text-red-600' : 'text-green-600'
                  }`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Budget Status</p>
                  <p className={`text-2xl font-bold ${
                    remainingBudget < 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {remainingBudget < 0 ? 'Over' : 'Under'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Critical Alerts */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Bell className="w-5 h-5 mr-2 text-orange-600" />
              Critical Alerts
            </h3>
            <div className="space-y-3">
              {project.overdue_tasks > 0 && (
                <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600 mr-3" />
                  <span className="text-red-800">
                    {project.overdue_tasks} task(s) are overdue and require immediate attention
                  </span>
                </div>
              )}
              
              {remainingBudget < 0 && (
                <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600 mr-3" />
                  <span className="text-red-800">
                    Project is over budget by ${Math.abs(remainingBudget).toLocaleString()}
                  </span>
                </div>
              )}
              
              {project.pending_invoices > 0 && (
                <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-600 mr-3" />
                  <span className="text-yellow-800">
                    {project.pending_invoices} invoice(s) pending payment
                  </span>
                </div>
              )}

              {project.overdue_tasks === 0 && remainingBudget >= 0 && project.pending_invoices === 0 && (
                <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                  <span className="text-green-800">No critical issues detected</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Actions */}
      <div className="mt-8 flex justify-end space-x-3">
        <button 
          onClick={handleGenerateReport}
          disabled={generatingReport}
          className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors duration-200"
        >
          <Download className="w-4 h-4 mr-2" />
          {generatingReport ? 'Generating...' : 'Export PDF'}
        </button>
        <button 
          onClick={handleGenerateReport}
          disabled={generatingReport}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-200"
        >
          <FileText className="w-4 h-4 mr-2" />
          {generatingReport ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Generating...
            </>
          ) : (
            'Generate Report'
          )}
        </button>
      </div>
    </div>
  )
}

export default ProjectDetails