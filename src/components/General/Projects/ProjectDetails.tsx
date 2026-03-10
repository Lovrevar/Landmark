import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { ProjectMilestone } from '../../../lib/supabase'
import {
  Building2,
  Calendar,
  DollarSign,
  Users,
  Home,
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Target,
  CheckCircle,
  Circle,
  AlertTriangle
} from 'lucide-react'
import { LoadingSpinner, PageHeader, StatGrid, StatCard, Badge, Button, FormField, Input, EmptyState } from '../../ui'
import { format, differenceInDays } from 'date-fns'
import { fetchProjectDetails } from './Services/projectDetailsService'
import {
  addMilestone as svcAddMilestone,
  updateMilestone as svcUpdateMilestone,
  deleteMilestone as svcDeleteMilestone,
  toggleMilestoneCompletion as svcToggleMilestone
} from './Services/milestoneService'
import type { ProjectWithDetails } from './types'

const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<ProjectWithDetails | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'subcontractors' | 'apartments' | 'milestones'>('overview')
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null)
  const [newMilestone, setNewMilestone] = useState({ name: '', due_date: '', completed: false })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadProject()
  }, [id])

  const loadProject = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await fetchProjectDetails(id)
      setProject(data)
    } catch (error) {
      console.error('Error fetching project details:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMilestone = async () => {
    if (!newMilestone.name.trim() || !id) { alert('Please enter milestone name'); return }
    try {
      await svcAddMilestone(id, { name: newMilestone.name, due_date: newMilestone.due_date || null, completed: newMilestone.completed })
      resetMilestoneForm()
      loadProject()
    } catch (error) {
      console.error('Error adding milestone:', error)
      alert('Error adding milestone. Please try again.')
    }
  }

  const handleUpdateMilestone = async () => {
    if (!editingMilestone || !newMilestone.name.trim()) return
    try {
      await svcUpdateMilestone(editingMilestone.id, { name: newMilestone.name, due_date: newMilestone.due_date || null, completed: newMilestone.completed })
      resetMilestoneForm()
      loadProject()
    } catch (error) {
      console.error('Error updating milestone:', error)
      alert('Error updating milestone.')
    }
  }

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!confirm('Are you sure you want to delete this milestone?')) return
    try {
      await svcDeleteMilestone(milestoneId)
      loadProject()
    } catch (error) {
      console.error('Error deleting milestone:', error)
      alert('Error deleting milestone.')
    }
  }

  const handleToggleMilestone = async (milestoneId: string, completed: boolean) => {
    try {
      await svcToggleMilestone(milestoneId, completed)
      loadProject()
    } catch (error) {
      console.error('Error updating milestone:', error)
    }
  }

  const resetMilestoneForm = () => {
    setNewMilestone({ name: '', due_date: '', completed: false })
    setEditingMilestone(null)
    setShowMilestoneForm(false)
  }

  const handleEditMilestone = (milestone: ProjectMilestone) => {
    setEditingMilestone(milestone)
    setNewMilestone({ name: milestone.name, due_date: milestone.due_date || '', completed: milestone.completed })
    setShowMilestoneForm(true)
  }

  const getMilestoneStatus = (milestone: ProjectMilestone) => {
    if (milestone.completed) return { status: 'Completed', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' }
    if (milestone.due_date && new Date(milestone.due_date) < new Date()) {
      return { status: 'Overdue', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' }
    }
    return { status: 'In Progress', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' }
  }

  if (loading) return <LoadingSpinner message="Loading project details..." />
  if (!project) return <div className="text-center py-12">Project not found</div>

  const milestoneStats = {
    total: project.milestones.length,
    completed: project.milestones.filter(m => m.completed).length,
    overdue: project.milestones.filter(m => !m.completed && m.due_date && new Date(m.due_date) < new Date()).length
  }
  const milestoneProgress = milestoneStats.total > 0 ? (milestoneStats.completed / milestoneStats.total) * 100 : 0

  return (
    <div>
      <div className="mb-6">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/')} className="mb-4">
          Back to Dashboard
        </Button>
        <PageHeader title={project.name} description={project.location} />
        <div className="flex items-center space-x-4 mt-3">
          <Badge variant={
            project.status === 'Completed' ? 'green'
              : project.status === 'In Progress' ? 'blue'
              : project.status === 'On Hold' ? 'red' : 'gray'
          }>
            {project.status}
          </Badge>
          <span className="text-sm text-gray-500">Budget: €{project.budget.toLocaleString('hr-HR')}</span>
          <span className="text-sm text-gray-500">Investor: {project.investors}</span>
        </div>
      </div>

      <StatGrid columns={3} className="mb-6">
        <StatCard label="Revenue" value={`€${(project.total_revenue / 1000000).toFixed(1)}M`} subtitle="From sales" icon={DollarSign} color="green" />
        <StatCard label="Subcontractors" value={project.subcontractors.length} subtitle="Active contracts" icon={Users} color="orange" />
        <StatCard label="Milestones" value={`${milestoneStats.completed}/${milestoneStats.total}`} subtitle={`${milestoneProgress.toFixed(0)}% complete`} icon={Target} />
      </StatGrid>

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
                activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {activeTab === 'overview' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Project Overview</h2>
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
                    <span className="font-medium">€{project.budget.toLocaleString('hr-HR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Spent:</span>
                    <span className="font-medium">€{project.total_spent.toLocaleString('hr-HR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Revenue:</span>
                    <span className="font-medium text-green-600">€{project.total_revenue.toLocaleString('hr-HR')}</span>
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
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${milestoneProgress}%` }}></div>
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

        {activeTab === 'milestones' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Project Milestones</h2>
              <Button icon={Plus} onClick={() => setShowMilestoneForm(true)}>Add Milestone</Button>
            </div>

            <StatGrid columns={3} className="mb-6">
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
            </StatGrid>

            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Overall Milestone Progress</span>
                <span className="text-sm font-medium text-gray-900">{milestoneProgress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-blue-600 h-3 rounded-full transition-all duration-300" style={{ width: `${milestoneProgress}%` }}></div>
              </div>
            </div>

            {showMilestoneForm && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {editingMilestone ? 'Edit Milestone' : 'Add New Milestone'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Milestone Name" required className="md:col-span-2">
                    <Input
                      type="text"
                      value={newMilestone.name}
                      onChange={(e) => setNewMilestone({ ...newMilestone, name: e.target.value })}
                      placeholder="e.g., Contracts Signed, Foundation Complete, Building No.1 Finished"
                      required
                    />
                  </FormField>
                  <FormField label="Target Due Date">
                    <Input
                      type="date"
                      value={newMilestone.due_date}
                      onChange={(e) => setNewMilestone({ ...newMilestone, due_date: e.target.value })}
                    />
                  </FormField>
                  <div className="md:col-span-2 flex items-center">
                    <input
                      type="checkbox"
                      id="completed"
                      checked={newMilestone.completed}
                      onChange={(e) => setNewMilestone({ ...newMilestone, completed: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="completed" className="ml-2 text-sm text-gray-700">Mark as completed</label>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <Button variant="secondary" onClick={resetMilestoneForm}>Cancel</Button>
                  <Button onClick={editingMilestone ? handleUpdateMilestone : handleAddMilestone}>
                    {editingMilestone ? 'Update' : 'Add'} Milestone
                  </Button>
                </div>
              </div>
            )}

            {project.milestones.length === 0 ? (
              <EmptyState
                icon={Target}
                title="No Milestones Yet"
                description="Start tracking your project progress by adding milestones"
                action={<Button onClick={() => setShowMilestoneForm(true)}>Add First Milestone</Button>}
              />
            ) : (
              <div className="space-y-4">
                {project.milestones.map((milestone, index) => {
                  const status = getMilestoneStatus(milestone)
                  const isOverdue = milestone.due_date && new Date(milestone.due_date) < new Date() && !milestone.completed
                  return (
                    <div key={milestone.id} className={`p-6 rounded-lg border-2 transition-all duration-200 ${status.bg} ${status.border}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                            milestone.completed ? 'bg-green-600' : isOverdue ? 'bg-red-600' : 'bg-blue-600'
                          }`}>
                            {milestone.completed ? <CheckCircle className="w-6 h-6" /> : <span>{index + 1}</span>}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900">{milestone.name}</h3>
                              <Badge variant={milestone.completed ? 'green' : isOverdue ? 'red' : 'blue'} size="sm">
                                {status.status}
                              </Badge>
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
                          <Button size="icon-sm" variant="ghost" icon={milestone.completed ? Circle : CheckCircle}
                            onClick={() => handleToggleMilestone(milestone.id, milestone.completed)}
                            title={milestone.completed ? 'Mark as incomplete' : 'Mark as complete'}
                            className={milestone.completed ? 'text-gray-600 hover:bg-gray-200' : 'text-green-600 hover:bg-green-200'}
                          />
                          <Button size="icon-sm" variant="ghost" icon={Edit2}
                            onClick={() => handleEditMilestone(milestone)}
                            title="Edit milestone" className="text-blue-600 hover:bg-blue-200"
                          />
                          <Button size="icon-sm" variant="ghost" icon={Trash2}
                            onClick={() => handleDeleteMilestone(milestone.id)}
                            title="Delete milestone" className="text-red-600 hover:bg-red-200"
                          />
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
              <EmptyState icon={Users} title="No subcontractors assigned" description="No subcontractors have been assigned to this project" />
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
                            <span className="text-sm text-gray-600">Contact: {sub.contact}</span>
                            <span className="text-sm text-gray-600">Cost: €{sub.cost.toLocaleString('hr-HR')}</span>
                            <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                              Due: {format(new Date(sub.deadline), 'MMM dd, yyyy')}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center space-x-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${sub.progress === 100 ? 'bg-green-600' : 'bg-blue-600'}`}
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

        {activeTab === 'apartments' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Apartments</h2>
            {project.apartments.length === 0 ? (
              <EmptyState icon={Home} title="No apartments defined" description="No apartments have been defined for this project" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {project.apartments.map((apartment) => (
                  <div key={apartment.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">Unit {apartment.number}</h3>
                        <p className="text-sm text-gray-600">Floor {apartment.floor}</p>
                      </div>
                      <Badge variant={
                        apartment.status === 'Sold' ? 'green' : apartment.status === 'Reserved' ? 'yellow' : 'blue'
                      } size="sm">
                        {apartment.status}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Size:</span>
                        <span className="text-sm font-medium">{apartment.size_m2} m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Price:</span>
                        <span className="text-sm font-medium">€{apartment.price.toLocaleString('hr-HR')}</span>
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
