import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, Project, Subcontractor, Invoice, Apartment, ProjectMilestone } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { 
  Building2, 
  Calendar, 
  DollarSign, 
  Users, 
  CheckSquare, 
  Home,
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  X,
  Target,
  CheckCircle,
  Circle,
  Clock,
  AlertTriangle
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'

interface ProjectWithDetails extends Project {
  subcontractors: Subcontractor[]
  invoices: Invoice[]
  apartments: Apartment[]
  milestones: ProjectMilestone[]
  total_spent: number
  total_revenue: number
  pending_invoices: number
  investors: string
}

const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [project, setProject] = useState<ProjectWithDetails | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'subcontractors' | 'apartments' | 'milestones'>('overview')
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null)
  const [newMilestone, setNewMilestone] = useState({
    name: '',
    due_date: '',
    completed: false
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      fetchProjectDetails()
    }
  }, [id])

  const fetchProjectDetails = async () => {
    if (!id) return

    setLoading(true)
    try {
      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()

      if (projectError) throw projectError

      // Fetch contracts (subcontractors) for this project
      const { data: contractsData, error: subError } = await supabase
        .from('contracts')
        .select(`
          *,
          subcontractor:subcontractors!contracts_subcontractor_id_fkey(id, name, contact, progress),
          phase:project_phases!contracts_phase_id_fkey(phase_name)
        `)
        .eq('project_id', id)
        .eq('status', 'active')
        .order('end_date', { ascending: true })

      // Map contracts to subcontractor format for backwards compatibility
      const subcontractorsData = contractsData?.map((c: any) => ({
        id: c.id,
        subcontractor_id: c.subcontractor.id,
        name: c.subcontractor.name,
        contact: c.subcontractor.contact,
        job_description: c.job_description,
        deadline: c.end_date,
        cost: parseFloat(c.contract_amount || 0),
        budget_realized: parseFloat(c.budget_realized || 0),
        progress: c.subcontractor.progress || 0,
        phase_name: c.phase?.phase_name
      })) || []

      if (subError) throw subError

      // Fetch invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .eq('project_id', id)
        .order('due_date', { ascending: true })

      if (invoicesError) throw invoicesError

      // Fetch apartments
      const { data: apartmentsData, error: apartmentsError } = await supabase
        .from('apartments')
        .select('*')
        .eq('project_id', id)
        .order('floor', { ascending: true })
        .order('number', { ascending: true })

      if (apartmentsError) throw apartmentsError

      // Fetch milestones
      const { data: milestonesData, error: milestonesError } = await supabase
        .from('project_milestones')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: true })

      if (milestonesError) throw milestonesError

      // Fetch bank credits
      const { data: bankCreditsData, error: bankCreditsError } = await supabase
        .from('bank_credits')
        .select('*, banks(name)')
        .eq('project_id', id)

      if (bankCreditsError) throw bankCreditsError

      // Fetch project investments
      const { data: investmentsData, error: investmentsError } = await supabase
        .from('project_investments')
        .select('*, investors(name)')
        .eq('project_id', id)

      if (investmentsError) throw investmentsError

      // Calculate project statistics
      const subcontractors = subcontractorsData || []
      const invoices = invoicesData || []
      const apartments = apartmentsData || []
      const milestones = milestonesData || []

      const total_spent = invoices.filter(inv => inv.paid).reduce((sum, inv) => sum + inv.amount, 0)
      const total_revenue = apartments.filter(apt => apt.status === 'Sold').reduce((sum, apt) => sum + apt.price, 0)
      const pending_invoices = invoices.filter(inv => !inv.paid).length

      // Build investors list
      const investorNames: string[] = []
      if (bankCreditsData && bankCreditsData.length > 0) {
        bankCreditsData.forEach(bc => {
          if (bc.banks?.name && !investorNames.includes(bc.banks.name)) {
            investorNames.push(bc.banks.name)
          }
        })
      }
      if (investmentsData && investmentsData.length > 0) {
        investmentsData.forEach(inv => {
          if (inv.investors?.name && !investorNames.includes(inv.investors.name)) {
            investorNames.push(inv.investors.name)
          }
        })
      }
      const investorsString = investorNames.length > 0 ? investorNames.join(', ') : 'N/A'

      setProject({
        ...projectData,
        subcontractors,
        invoices,
        apartments,
        milestones,
        total_spent,
        total_revenue,
        pending_invoices,
        investors: investorsString
      })
    } catch (error) {
      console.error('Error fetching project details:', error)
    } finally {
      setLoading(false)
    }
  }

  const addMilestone = async () => {
    if (!newMilestone.name.trim() || !id) {
      alert('Please enter milestone name')
      return
    }

    try {
      const { error } = await supabase
        .from('project_milestones')
        .insert({
          project_id: id,
          name: newMilestone.name,
          due_date: newMilestone.due_date || null,
          completed: newMilestone.completed
        })

      if (error) throw error

      resetMilestoneForm()
      fetchProjectDetails()
    } catch (error) {
      console.error('Error adding milestone:', error)
      alert('Error adding milestone. Please try again.')
    }
  }

  const updateMilestone = async () => {
    if (!editingMilestone || !newMilestone.name.trim()) return

    try {
      const { error } = await supabase
        .from('project_milestones')
        .update({
          name: newMilestone.name,
          due_date: newMilestone.due_date || null,
          completed: newMilestone.completed
        })
        .eq('id', editingMilestone.id)

      if (error) throw error

      resetMilestoneForm()
      fetchProjectDetails()
    } catch (error) {
      console.error('Error updating milestone:', error)
      alert('Error updating milestone.')
    }
  }

  const deleteMilestone = async (milestoneId: string) => {
    if (!confirm('Are you sure you want to delete this milestone?')) return

    try {
      const { error } = await supabase
        .from('project_milestones')
        .delete()
        .eq('id', milestoneId)

      if (error) throw error
      fetchProjectDetails()
    } catch (error) {
      console.error('Error deleting milestone:', error)
      alert('Error deleting milestone.')
    }
  }

  const toggleMilestoneCompletion = async (milestoneId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('project_milestones')
        .update({ completed: !completed })
        .eq('id', milestoneId)

      if (error) throw error
      fetchProjectDetails()
    } catch (error) {
      console.error('Error updating milestone:', error)
    }
  }

  const resetMilestoneForm = () => {
    setNewMilestone({
      name: '',
      due_date: '',
      completed: false
    })
    setEditingMilestone(null)
    setShowMilestoneForm(false)
  }

  const handleEditMilestone = (milestone: ProjectMilestone) => {
    setEditingMilestone(milestone)
    setNewMilestone({
      name: milestone.name,
      due_date: milestone.due_date || '',
      completed: milestone.completed
    })
    setShowMilestoneForm(true)
  }

  const getMilestoneStatus = (milestone: ProjectMilestone) => {
    if (milestone.completed) return { status: 'Completed', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' }
    if (milestone.due_date && new Date(milestone.due_date) < new Date()) {
      return { status: 'Overdue', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' }
    }
    return { status: 'In Progress', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' }
  }

  if (loading) {
    return <div className="text-center py-12">Loading project details...</div>
  }

  if (!project) {
    return <div className="text-center py-12">Project not found</div>
  }

  const milestoneStats = {
    total: project.milestones.length,
    completed: project.milestones.filter(m => m.completed).length,
    overdue: project.milestones.filter(m => 
      !m.completed && m.due_date && new Date(m.due_date) < new Date()
    ).length
  }

  const milestoneProgress = milestoneStats.total > 0 
    ? (milestoneStats.completed / milestoneStats.total) * 100 
    : 0

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors duration-200"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-600 mt-2">{project.location}</p>
            <div className="flex items-center space-x-4 mt-3">
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                project.status === 'On Hold' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {project.status}
              </span>
              <span className="text-sm text-gray-500">
                Budget: €{project.budget.toLocaleString()}
              </span>
              <span className="text-sm text-gray-500">
                Investor: {project.investors}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                €{(project.total_revenue / 1000000).toFixed(1)}M
              </p>
              <p className="text-xs text-gray-500">From sales</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Subcontractors</p>
              <p className="text-2xl font-bold text-gray-900">{project.subcontractors.length}</p>
              <p className="text-xs text-gray-500">Active contracts</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Milestones</p>
              <p className="text-2xl font-bold text-gray-900">{milestoneStats.completed}/{milestoneStats.total}</p>
              <p className="text-xs text-gray-500">{milestoneProgress.toFixed(0)}% complete</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: Building2 },
            { id: 'milestones', name: 'Milestones', icon: Target },
            { id: 'subcontractors', name: 'Subcontractors', icon: Users },
            { id: 'apartments', name: 'Apartments', icon: Home }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Project Overview</h2>
            
            {/* Project Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Project Details</h3>
                <div className="space-y-2">
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
                    <span className="text-gray-600">Budget:</span>
                    <span className="font-medium">€{project.budget.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Spent:</span>
                    <span className="font-medium">€{project.total_spent.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Revenue:</span>
                    <span className="font-medium text-green-600">€{project.total_revenue.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Progress Summary</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-600">Milestone Progress</span>
                      <span className="font-medium">{milestoneProgress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${milestoneProgress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="text-center mt-4">
                    <p className="text-2xl font-bold text-orange-600">{project.pending_invoices}</p>
                    <p className="text-xs text-gray-600">Pending Invoices</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Milestones Tab */}
        {activeTab === 'milestones' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Project Milestones</h2>
              <button
                onClick={() => setShowMilestoneForm(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Milestone
              </button>
            </div>

            {/* Milestone Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-blue-700">Total Milestones</span>
                  <Target className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-blue-900">{milestoneStats.total}</p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-green-700">Completed</span>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-900">{milestoneStats.completed}</p>
              </div>
              
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-red-700">Overdue</span>
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-2xl font-bold text-red-900">{milestoneStats.overdue}</p>
              </div>
            </div>

            {/* Overall Progress */}
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Overall Milestone Progress</span>
                <span className="text-sm font-medium text-gray-900">{milestoneProgress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${milestoneProgress}%` }}
                ></div>
              </div>
            </div>

            {/* Milestone Form */}
            {showMilestoneForm && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {editingMilestone ? 'Edit Milestone' : 'Add New Milestone'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Milestone Name *</label>
                    <input
                      type="text"
                      value={newMilestone.name}
                      onChange={(e) => setNewMilestone({ ...newMilestone, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Contracts Signed, Foundation Complete, Building No.1 Finished"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Target Due Date</label>
                    <input
                      type="date"
                      value={newMilestone.due_date}
                      onChange={(e) => setNewMilestone({ ...newMilestone, due_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center">
                    <input
                      type="checkbox"
                      id="completed"
                      checked={newMilestone.completed}
                      onChange={(e) => setNewMilestone({ ...newMilestone, completed: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="completed" className="ml-2 text-sm text-gray-700">
                      Mark as completed
                    </label>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={resetMilestoneForm}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingMilestone ? updateMilestone : addMilestone}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    {editingMilestone ? 'Update' : 'Add'} Milestone
                  </button>
                </div>
              </div>
            )}

            {/* Milestones List */}
            {project.milestones.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Milestones Yet</h3>
                <p className="text-gray-600 mb-4">Start tracking your project progress by adding milestones</p>
                <button
                  onClick={() => setShowMilestoneForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Add First Milestone
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {project.milestones.map((milestone, index) => {
                  const status = getMilestoneStatus(milestone)
                  const isOverdue = milestone.due_date && new Date(milestone.due_date) < new Date() && !milestone.completed
                  
                  return (
                    <div
                      key={milestone.id}
                      className={`p-6 rounded-lg border-2 transition-all duration-200 ${status.bg} ${status.border}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          {/* Milestone Number Circle */}
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                            milestone.completed ? 'bg-green-600' : 
                            isOverdue ? 'bg-red-600' : 'bg-blue-600'
                          }`}>
                            {milestone.completed ? (
                              <CheckCircle className="w-6 h-6" />
                            ) : (
                              <span>{index + 1}</span>
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900">{milestone.name}</h3>
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                milestone.completed ? 'bg-green-100 text-green-800' :
                                isOverdue ? 'bg-red-100 text-red-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {status.status}
                              </span>
                            </div>
                            
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              {milestone.due_date && (
                                <div className="flex items-center">
                                  <Calendar className="w-4 h-4 mr-1" />
                                  <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                    Target: {format(new Date(milestone.due_date), 'MMM dd, yyyy')}
                                    {isOverdue && ` (${Math.abs(differenceInDays(new Date(milestone.due_date), new Date()))} days overdue)`}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center">
                                <span>Created: {format(new Date(milestone.created_at), 'MMM dd')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleMilestoneCompletion(milestone.id, milestone.completed)}
                            className={`p-2 rounded-lg transition-colors duration-200 ${
                              milestone.completed 
                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
                                : 'bg-green-100 text-green-600 hover:bg-green-200'
                            }`}
                            title={milestone.completed ? 'Mark as incomplete' : 'Mark as complete'}
                          >
                            {milestone.completed ? <Circle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleEditMilestone(milestone)}
                            className="p-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg transition-colors duration-200"
                            title="Edit milestone"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteMilestone(milestone.id)}
                            className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors duration-200"
                            title="Delete milestone"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'subcontractors' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Subcontractors</h2>
            {project.subcontractors.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No subcontractors assigned to this project</p>
            ) : (
              <div className="space-y-4">
                {project.subcontractors.map((sub) => {
                  const isOverdue = new Date(sub.deadline) < new Date() && sub.progress < 100
                  return (
                    <div key={sub.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 mb-2">{sub.name}</h3>
                          <p className="text-sm text-gray-600 mb-2">{sub.job_description}</p>
                          <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-600">
                              Contact: {sub.contact}
                            </span>
                            <span className="text-sm text-gray-600">
                              Cost: €{sub.cost.toLocaleString()}
                            </span>
                            <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                              Due: {format(new Date(sub.deadline), 'MMM dd, yyyy')}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center space-x-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  sub.progress === 100 ? 'bg-green-600' : 'bg-blue-600'
                                }`}
                                style={{ width: `${sub.progress}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium">{sub.progress}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Apartments Tab */}
        {activeTab === 'apartments' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Apartments</h2>
            {project.apartments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No apartments defined for this project</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {project.apartments.map((apartment) => (
                  <div key={apartment.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">Unit {apartment.number}</h3>
                        <p className="text-sm text-gray-600">Floor {apartment.floor}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        apartment.status === 'Sold' ? 'bg-green-100 text-green-800' :
                        apartment.status === 'Reserved' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {apartment.status}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Size:</span>
                        <span className="text-sm font-medium">{apartment.size_m2} m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Price:</span>
                        <span className="text-sm font-medium">€{apartment.price.toLocaleString()}</span>
                      </div>
                      {apartment.buyer_name && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Buyer:</span>
                          <span className="text-sm font-medium">{apartment.buyer_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProjectDetails