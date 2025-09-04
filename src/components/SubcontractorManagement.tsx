import React, { useState, useEffect } from 'react'
import { supabase, Subcontractor, Project, Task, WorkLog, SubcontractorComment } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Calendar, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Camera,
  FileText,
  MessageSquare,
  TrendingUp,
  Users,
  Building2,
  X,
  Send
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'

interface SubcontractorWithProject extends Subcontractor {
  project_name: string
  work_logs: WorkLog[]
  payment_status: 'paid' | 'partial' | 'pending'
  amount_paid: number
}

interface WorkLog {
  id: string
  subcontractor_id: string
  date: string
  workers_count: number
  work_description: string
  hours_worked: number
  notes: string
  photos: string[]
  created_by: string
  created_at: string
}

const SubcontractorManagement: React.FC = () => {
  const { user } = useAuth()
  const [subcontractors, setSubcontractors] = useState<SubcontractorWithProject[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<SubcontractorWithProject | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingSubcontractor, setEditingSubcontractor] = useState<Subcontractor | null>(null)
  const [newSubcontractor, setNewSubcontractor] = useState({
    name: '',
    contact: '',
    job_description: '',
    progress: 0,
    deadline: '',
    cost: 0
  })
  const [subcontractorComments, setSubcontractorComments] = useState<SubcontractorComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentType, setCommentType] = useState<'completed' | 'issue' | 'general'>('general')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('name', { ascending: true })

      if (projectsError) throw projectsError

      // Fetch subcontractors
      const { data: subcontractorsData, error: subError } = await supabase
        .from('subcontractors')
        .select('*')
        .order('deadline', { ascending: true })

      if (subError) throw subError

      // Fetch tasks for supervision
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', 'supervisor')
        .order('deadline', { ascending: true })

      if (tasksError) throw tasksError

      // For now, we'll simulate work logs and payment status
      // In a real app, these would come from separate tables
      const subcontractorsWithDetails = (subcontractorsData || []).map(sub => ({
        ...sub,
        project_name: 'Sunset Towers', // Simplified for demo
        work_logs: [],
        payment_status: sub.progress > 80 ? 'paid' : sub.progress > 40 ? 'partial' : 'pending' as const,
        amount_paid: Math.round(sub.cost * (sub.progress / 100))
      }))

      setProjects(projectsData || [])
      setSubcontractors(subcontractorsWithDetails)
      setTasks(tasksData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateSubcontractorProgress = async (subcontractorId: string, newProgress: number) => {
    try {
      const { error } = await supabase
        .from('subcontractors')
        .update({ progress: newProgress })
        .eq('id', subcontractorId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error updating progress:', error)
    }
  }

  const fetchSubcontractorComments = async (subcontractorId: string) => {
    try {
      const { data, error } = await supabase
        .from('subcontractor_comments')
        .select('*')
        .eq('subcontractor_id', subcontractorId)
          users!inner(username, role)

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
    if (!user || !selectedSubcontractor || !newComment.trim()) return

    try {
      const { error } = await supabase
        .from('subcontractor_comments')
        .insert({
          subcontractor_id: selectedSubcontractor.id,
          user_id: user.id,
          comment: newComment.trim(),
          comment_type: commentType
        })

      if (error) throw error
      
      setNewComment('')
      fetchSubcontractorComments(selectedSubcontractor.id)
    } catch (error) {
      console.error('Error adding comment:', error)
      alert('Error adding comment. Please try again.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newSubcontractor.name.trim() || !newSubcontractor.contact.trim()) {
      alert('Please fill in all required fields')
      return
    }

    try {
      if (editingSubcontractor) {
        const { error } = await supabase
          .from('subcontractors')
          .update(newSubcontractor)
          .eq('id', editingSubcontractor.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('subcontractors')
          .insert(newSubcontractor)

        if (error) throw error
      }

      resetForm()
      fetchData()
    } catch (error) {
      console.error('Error saving subcontractor:', error)
    }
  }

  const resetForm = () => {
    setNewSubcontractor({
      name: '',
      contact: '',
      job_description: '',
      progress: 0,
      deadline: '',
      cost: 0
    })
    setEditingSubcontractor(null)
    setShowForm(false)
  }

  const handleEdit = (subcontractor: Subcontractor) => {
    setEditingSubcontractor(subcontractor)
    setNewSubcontractor({
      name: subcontractor.name,
      contact: subcontractor.contact,
      job_description: subcontractor.job_description,
      progress: subcontractor.progress,
      deadline: subcontractor.deadline,
      cost: subcontractor.cost
    })
    setShowForm(true)
  }

  const handleDelete = async (subcontractorId: string) => {
    if (!confirm('Are you sure you want to delete this subcontractor?')) return

    try {
      const { error } = await supabase
        .from('subcontractors')
        .delete()
        .eq('id', subcontractorId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error deleting subcontractor:', error)
    }
  }

  const getStatusColor = (subcontractor: SubcontractorWithProject) => {
    const isOverdue = new Date(subcontractor.deadline) < new Date() && subcontractor.progress < 100
    const isCompleted = subcontractor.progress === 100
    
    if (isOverdue) return 'border-l-4 border-l-red-500 bg-red-50'
    if (isCompleted) return 'border-l-4 border-l-green-500 bg-green-50'
    if (subcontractor.progress > 0) return 'border-l-4 border-l-blue-500 bg-blue-50'
    return 'border-l-4 border-l-gray-300 bg-gray-50'
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800'
      case 'partial': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-red-100 text-red-800'
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading supervision dashboard...</div>
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Construction Supervision</h1>
          <p className="text-gray-600 mt-2">Manage subcontractors and track on-site progress</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Subcontractor
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Subcontractors</p>
              <p className="text-2xl font-bold text-gray-900">{subcontractors.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Completed Work</p>
              <p className="text-2xl font-bold text-gray-900">
                {subcontractors.filter(s => s.progress === 100).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-gray-900">
                {subcontractors.filter(s => 
                  new Date(s.deadline) < new Date() && s.progress < 100
                ).length}
              </p>
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
                ${subcontractors.reduce((sum, s) => sum + s.cost, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* My Supervision Tasks */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-blue-600" />
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
                                task.status === 'In Progress' ? 'border-l-4 border-l-blue-500 bg-blue-50' :
                                'border-l-4 border-l-gray-300 bg-gray-50'

                return (
                  <div key={task.id} className={`p-4 rounded-lg border transition-all duration-200 ${taskColor}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-medium text-gray-900">{task.name}</h3>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            task.status === 'Completed' ? 'bg-green-100 text-green-800' :
                            task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
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
                                  task.status === 'Completed' ? 'bg-green-600' : 'bg-blue-600'
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

      {/* Work Log Form */}
      {showWorkLogForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Daily Work Log</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subcontractor *
              </label>
              <select
                value={newWorkLog.subcontractor_id}
                onChange={(e) => setNewWorkLog({ ...newWorkLog, subcontractor_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select subcontractor</option>
                {subcontractors.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date *
              </label>
              <input
                type="date"
                value={newWorkLog.date}
                onChange={(e) => setNewWorkLog({ ...newWorkLog, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Workers Count
              </label>
              <input
                type="number"
                min="1"
                value={newWorkLog.workers_count}
                onChange={(e) => setNewWorkLog({ ...newWorkLog, workers_count: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hours Worked
              </label>
              <input
                type="number"
                min="1"
                max="24"
                value={newWorkLog.hours_worked}
                onChange={(e) => setNewWorkLog({ ...newWorkLog, hours_worked: parseInt(e.target.value) || 8 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Work Description *
              </label>
              <textarea
                value={newWorkLog.work_description}
                onChange={(e) => setNewWorkLog({ ...newWorkLog, work_description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe the work completed today..."
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes & Issues
              </label>
              <textarea
                value={newWorkLog.notes}
                onChange={(e) => setNewWorkLog({ ...newWorkLog, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Any issues, delays, or special notes..."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={() => setShowWorkLogForm(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={addWorkLog}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              Add Work Log
            </button>
          </div>
        </div>
      )}

      {/* Subcontractor Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingSubcontractor ? 'Edit Subcontractor' : 'Add New Subcontractor'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name *
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Information *
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deadline
                </label>
                <input
                  type="date"
                  value={newSubcontractor.deadline}
                  onChange={(e) => setNewSubcontractor({ ...newSubcontractor, deadline: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contract Cost ($)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newSubcontractor.cost}
                  onChange={(e) => setNewSubcontractor({ ...newSubcontractor, cost: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job Description
                </label>
                <textarea
                  value={newSubcontractor.job_description}
                  onChange={(e) => setNewSubcontractor({ ...newSubcontractor, job_description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe the work package and responsibilities..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Progress (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newSubcontractor.progress}
                  onChange={(e) => setNewSubcontractor({ ...newSubcontractor, progress: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                {editingSubcontractor ? 'Update' : 'Add'} Subcontractor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subcontractors Overview */}
      <div className="space-y-4">
        {subcontractors.map((subcontractor) => {
          const isOverdue = new Date(subcontractor.deadline) < new Date() && subcontractor.progress < 100
          const daysUntilDeadline = differenceInDays(new Date(subcontractor.deadline), new Date())
          
          return (
            <div
              key={subcontractor.id}
              className={`rounded-xl shadow-sm border border-gray-200 p-6 transition-all duration-200 ${getStatusColor(subcontractor)}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{subcontractor.name}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      subcontractor.progress === 100 ? 'bg-green-100 text-green-800' :
                      isOverdue ? 'bg-red-100 text-red-800' :
                      subcontractor.progress > 0 ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {subcontractor.progress === 100 ? 'Completed' :
                       isOverdue ? 'Overdue' :
                       subcontractor.progress > 0 ? 'In Progress' : 'Not Started'}
                    </span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(subcontractor.payment_status)}`}>
                      Payment: {subcontractor.payment_status}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 mb-3">{subcontractor.job_description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      <div>
                        <p className="text-sm text-gray-600">Deadline</p>
                        <p className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                          {format(new Date(subcontractor.deadline), 'MMM dd, yyyy')}
                          {daysUntilDeadline >= 0 ? ` (${daysUntilDeadline} days)` : ` (${Math.abs(daysUntilDeadline)} days overdue)`}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <DollarSign className="w-4 h-4 text-gray-400 mr-2" />
                      <div>
                        <p className="text-sm text-gray-600">Contract Value</p>
                        <p className="text-sm font-medium text-gray-900">${subcontractor.cost.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <TrendingUp className="w-4 h-4 text-gray-400 mr-2" />
                      <div>
                        <p className="text-sm text-gray-600">Amount Paid</p>
                        <p className="text-sm font-medium text-gray-900">${subcontractor.amount_paid.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedSubcontractor(subcontractor)}
                    className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md text-sm font-medium transition-colors duration-200"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handleEdit(subcontractor)}
                    className="px-3 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors duration-200"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(subcontractor.id)}
                    className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-md text-sm font-medium transition-colors duration-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress Section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Work Progress</span>
                  <span className="text-sm font-bold text-gray-900">{subcontractor.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-300 ${
                      subcontractor.progress === 100 ? 'bg-green-600' : 'bg-blue-600'
                    }`}
                    style={{ width: `${subcontractor.progress}%` }}
                  ></div>
                </div>
                
                {/* Progress Update Slider */}
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600">Update:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={subcontractor.progress}
                    onChange={(e) => updateSubcontractorProgress(subcontractor.id, parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium text-gray-900 w-12">{subcontractor.progress}%</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Subcontractor Details Modal */}
      {selectedSubcontractor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedSubcontractor.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{selectedSubcontractor.contact}</p>
                  <p className="text-sm text-gray-500 mt-1">Project: {selectedSubcontractor.project_name}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedSubcontractor(null)
                    setSubcontractorComments([])
                    setNewComment('')
                    setCommentType('general')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => fetchSubcontractorComments(selectedSubcontractor.id)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Load Comments
                </button>
              </div>
            </div>
            
            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Work Package Details */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Work Package Details</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Job Description</p>
                      <p className="text-sm font-medium text-gray-900">{selectedSubcontractor.job_description}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Contract Value</p>
                      <p className="text-sm font-medium text-gray-900">${selectedSubcontractor.cost.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Amount Paid</p>
                      <p className="text-sm font-medium text-gray-900">${selectedSubcontractor.amount_paid.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Remaining Payment</p>
                      <p className="text-sm font-medium text-gray-900">
                        ${(selectedSubcontractor.cost - selectedSubcontractor.amount_paid).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Timeline & Status */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Timeline & Status</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Deadline</p>
                      <p className="text-sm font-medium text-gray-900">
                        {format(new Date(selectedSubcontractor.deadline), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Days Until Deadline</p>
                      <p className={`text-sm font-medium ${
                        differenceInDays(new Date(selectedSubcontractor.deadline), new Date()) < 0 ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {differenceInDays(new Date(selectedSubcontractor.deadline), new Date())} days
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Current Progress</p>
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              selectedSubcontractor.progress === 100 ? 'bg-green-600' : 'bg-blue-600'
                            }`}
                            style={{ width: `${selectedSubcontractor.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{selectedSubcontractor.progress}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Work Logs Section */}
              <div className="mt-6 border-t pt-6 mb-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Recent Work Logs
                </h4>
                
                {selectedSubcontractor.work_logs.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No work logs recorded yet</p>
                    <button
                      onClick={() => {
                        setNewWorkLog({ ...newWorkLog, subcontractor_id: selectedSubcontractor.id })
                        setSelectedSubcontractor(null)
                        setShowWorkLogForm(true)
                      }}
                      className="mt-2 px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                    >
                      Add First Log
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedSubcontractor.work_logs.slice(0, 3).map((log, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">
                            {format(new Date(log.date), 'MMM dd, yyyy')}
                          </span>
                          <span className="text-sm text-gray-500">
                            {log.workers_count} workers, {log.hours_worked}h
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{log.work_description}</p>
                        {log.notes && (
                          <p className="text-sm text-gray-600 mt-1 italic">{log.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments Section */}
              <div className="border-t pt-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Supervision Comments
                </h4>
                
                {/* Add Comment Form */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
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
                      placeholder="Add supervision notes about what they did or didn't do..."
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

                {/* Comments List */}
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {subcontractorComments.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">No supervision comments yet. Add the first comment!</p>
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
              </div>

              {/* Quick Actions */}
              <div className="mt-6 border-t pt-6">
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      const newProgress = prompt(`Update progress for ${selectedSubcontractor.name} (0-100):`, selectedSubcontractor.progress.toString())
                      if (newProgress !== null) {
                        const progress = Math.min(100, Math.max(0, parseInt(newProgress) || 0))
                        updateSubcontractorProgress(selectedSubcontractor.id, progress)
                        setSelectedSubcontractor({ ...selectedSubcontractor, progress })
                      }
                    }}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Update Progress
                  </button>
                  <button
                    className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Upload Photos
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Critical Alerts */}
      {subcontractors.some(s => new Date(s.deadline) < new Date() && s.progress < 100) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <h3 className="font-semibold text-red-800">Critical Alerts</h3>
          </div>
          <div className="space-y-2">
            {subcontractors
              .filter(s => new Date(s.deadline) < new Date() && s.progress < 100)
              .map(sub => (
                <div key={sub.id} className="text-sm text-red-700">
                  <strong>{sub.name}</strong> is {Math.abs(differenceInDays(new Date(sub.deadline), new Date()))} days overdue
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default SubcontractorManagement