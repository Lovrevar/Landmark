import React, { useState, useEffect } from 'react'
import { supabase, Task, Project } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'
import { Plus, Edit2, Trash2, Calendar, User, Building2, X, MessageSquare, Send, CheckCircle, Clock } from 'lucide-react'


const TasksManagement: React.FC = () => {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskComments, setTaskComments] = useState<any[]>([])
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [newComment, setNewComment] = useState('')
  const [newTask, setNewTask] = useState({
    project_id: '',
    name: '',
    description: '',
    assigned_to: '',
    deadline: '',
    status: 'Pending' as const,
    progress: 0
  })
  const [loading, setLoading] = useState(true)

  const userOptions = ['director', 'accountant', 'salesperson', 'supervisor', 'investor']
  const statusOptions = ['Pending', 'In Progress', 'Completed', 'Overdue']

  const getTaskCategories = () => {
    if (user?.role === 'Director') {
      return [
        { id: 'all', name: 'All Tasks', count: tasks.length },
        { id: 'for_approval', name: 'For Approval', count: tasks.filter(t => t.progress === 100 && t.status !== 'Completed').length },
        { id: 'accountant', name: 'Accountant', count: tasks.filter(t => t.assigned_to === 'accountant').length },
        { id: 'supervisor', name: 'Supervisor', count: tasks.filter(t => t.assigned_to === 'supervisor').length },
        { id: 'investor', name: 'Investor', count: tasks.filter(t => t.assigned_to === 'investor').length },
        { id: 'salesperson', name: 'Sales', count: tasks.filter(t => t.assigned_to === 'salesperson').length },
        { id: 'completed', name: 'Completed', count: tasks.filter(t => t.status === 'Completed').length }
      ]
    } else {
      // For other roles, only show tasks assigned to them
      const userTasks = tasks.filter(t => t.assigned_to === user?.username || t.created_by === user?.username)
      return [
        { id: 'my_tasks', name: 'My Tasks', count: userTasks.length },
        { id: 'completed', name: 'Completed', count: userTasks.filter(t => t.status === 'Completed').length }
      ]
    }
  }

  const getFilteredTasks = () => {
    if (user?.role !== 'Director') {
      // Non-directors see tasks they created OR tasks assigned to them
      const userTasks = tasks.filter(t => 
        t.assigned_to === user?.username || t.created_by === user?.username
      )
      if (activeCategory === 'completed') {
        return userTasks.filter(t => t.status === 'Completed')
      }
      return userTasks
    }

    // Director can see all tasks with filtering
    switch (activeCategory) {
      case 'for_approval':
        return tasks.filter(t => t.progress === 100 && t.status !== 'Completed')
      case 'accountant':
        return tasks.filter(t => t.assigned_to === 'accountant')
      case 'supervisor':
        return tasks.filter(t => t.assigned_to === 'supervisor')
      case 'investor':
        return tasks.filter(t => t.assigned_to === 'investor')
      case 'salesperson':
        return tasks.filter(t => t.assigned_to === 'salesperson')
      case 'completed':
        return tasks.filter(t => t.status === 'Completed')
      default:
        return tasks
    }
  }

  useEffect(() => {
    fetchData()
  }, [user])

  const approveTask = async (taskId: string) => {
    if (!confirm('Approve this task as completed?')) return

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'Completed' })
        .eq('id', taskId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error approving task:', error)
      alert('Error approving task.')
    }
  }

  const fetchData = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      let tasksQuery = supabase.from('tasks').select('*')
      
      // Filter tasks based on user role
      if (user.role !== 'Director') {
        // Non-directors see tasks they created OR tasks assigned to them
        tasksQuery = tasksQuery.or(`assigned_to.eq.${user.username},created_by.eq.${user.username}`)
      }
      
      const { data: tasksData, error: tasksError } = await tasksQuery
        .order('deadline', { ascending: true })

      if (tasksError) throw tasksError

      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('name', { ascending: true })

      if (projectsError) throw projectsError

      console.log('Fetched tasks:', tasksData)
      console.log('Fetched projects:', projectsData)

      setTasks(tasksData || [])
      setProjects(projectsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      alert('Error fetching data. Please check the console for details.')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setNewTask({
      project_id: '',
      name: '',
      description: '',
      assigned_to: '',
      deadline: '',
      status: 'Pending',
      progress: 0
    })
    setEditingTask(null)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user || !newTask.name.trim() || !newTask.project_id || !newTask.assigned_to || !newTask.deadline) {
      alert('Please fill in all required fields')
      return
    }

    try {
      if (editingTask) {
        // Check if user can edit this task
        if (editingTask.created_by !== user.username && user.role !== 'Director') {
          alert('You can only edit tasks you created')
          return
        }
        
        // Update existing task
        const updateData: any = {
          project_id: newTask.project_id,
          name: newTask.name,
          description: newTask.description,
          assigned_to: newTask.assigned_to,
          deadline: newTask.deadline,
          progress: newTask.progress
        }
        
        // Only allow status changes for own tasks or if user is Director
        if (editingTask.created_by === user.username || user.role === 'Director') {
          updateData.status = newTask.status
        }
        
        const { error } = await supabase
          .from('tasks')
          .update(updateData)
          .eq('id', editingTask.id)

        if (error) throw error
      } else {
        // Create new task
        const { error } = await supabase
          .from('tasks')
          .insert({
            project_id: newTask.project_id,
            name: newTask.name,
            description: newTask.description,
            assigned_to: newTask.assigned_to,
            created_by: user.username,
            deadline: newTask.deadline,
            status: newTask.status,
            progress: newTask.progress
          })

        if (error) throw error
      }

      resetForm()
      fetchData()
    } catch (error) {
      console.error('Error saving task:', error)
      alert('Error saving task. Please try again.')
    }
  }

  const fetchTaskComments = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      setTaskComments(data || [])
    } catch (error) {
      console.error('Error fetching task comments:', error)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTask) return

    try {
      const { error } = await supabase
        .from('task_comments')
        .insert([
          {
            task_id: selectedTask.id,
            user_id: user?.id,
            comment: newComment.trim()
          }
        ])

      if (error) throw error
      
      setNewComment('')
      fetchTaskComments(selectedTask.id)
    } catch (error) {
      console.error('Error adding comment:', error)
    }
  }

  // Fetch comments when a task is selected
  useEffect(() => {
    if (selectedTask) {
      fetchTaskComments(selectedTask.id)
    }
  }, [selectedTask])

  const handleEdit = (task: Task) => {
    if (!user) return
    
    // Check if user can edit this task
    if (task.created_by !== user.username && user.role !== 'Director') {
      alert('You can only edit tasks you created')
      return
    }
    
    setEditingTask(task)
    setNewTask({
      project_id: task.project_id,
      name: task.name,
      description: task.description || '',
      assigned_to: task.assigned_to,
      deadline: task.deadline,
      status: task.status,
      progress: task.progress || 0
    })
    setShowForm(true)
  }

  const handleDelete = async (taskId: string) => {
    if (!user) return
    
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    
    // Check if user can delete this task
    if (task.created_by !== user.username && user.role !== 'Director') {
      alert('You can only delete tasks you created')
      return
    }
    
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Error deleting task. Please try again.')
    }
  }

  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    return project?.name || 'Unknown Project'
  }

  const canEditTask = (task: Task) => {
    if (!user) return false
    // Anyone can edit tasks they created, Director can edit all tasks
    return task.created_by === user.username || user.role === 'Director'
  }

  const canMarkCompleted = (task: Task) => {
    if (!user) return false
    // Only the task creator can mark it as completed
    return task.created_by === user.username
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800'
      case 'In Progress': return 'bg-blue-100 text-blue-800'
      case 'Overdue': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const addComment = async () => {
    if (!newComment.trim() || !selectedTask) return

    try {
      const { error } = await supabase
        .from('task_comments')
        .insert([
          {
            task_id: selectedTask.id,
            user_id: user?.id,
            comment: newComment.trim()
          }
        ])

      if (error) throw error
      
      setNewComment('')
      fetchTaskComments(selectedTask.id)
    } catch (error) {
      console.error('Error adding comment:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading tasks...</div>
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Task Management</h1>
          <p className="text-gray-600 mt-2">Create, assign, and manage project tasks</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </button>
      </div>

      {/* Task Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingTask ? 'Edit Task' : 'Create New Task'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Name *
                </label>
                <input
                  type="text"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter task name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project *
                </label>
                <select
                  value={newTask.project_id}
                  onChange={(e) => setNewTask({ ...newTask, project_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a project</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign To *
                </label>
                <select
                  value={newTask.assigned_to}
                  onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select assignee</option>
                  {userOptions.map(user => (
                    <option key={user} value={user}>
                      {user.charAt(0).toUpperCase() + user.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deadline *
                </label>
                <input
                  type="date"
                  value={newTask.deadline}
                  onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={newTask.status}
                  onChange={(e) => setNewTask({ ...newTask, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={editingTask && editingTask.created_by !== user?.username && user?.role !== 'Director'}
                >
                  {statusOptions.map(status => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                {editingTask && editingTask.created_by !== user?.username && user?.role !== 'Director' && (
                  <p className="text-xs text-orange-600 mt-1">
                    Only the task creator can change status
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter task description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Progress (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newTask.progress}
                  onChange={(e) => setNewTask({ ...newTask, progress: parseInt(e.target.value) || 0 })}
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
                {editingTask ? 'Update Task' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Task Categories */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {getTaskCategories().map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                activeCategory === category.id
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              {category.name}
              <span className="ml-2 px-2 py-0.5 bg-white rounded-full text-xs">
                {category.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tasks Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {getTaskCategories().find(cat => cat.id === activeCategory)?.name || 'Tasks'}
          </h2>
        </div>
        <div className="p-6">
          {getFilteredTasks().length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {activeCategory === 'for_approval' ? 'No tasks awaiting approval.' : 'No tasks found in this category.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {getFilteredTasks().map((task) => {
                const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'Completed'
                const needsApproval = task.progress === 100 && task.status !== 'Completed' && !canMarkCompleted(task)
                const isForApproval = activeCategory === 'for_approval'
                
                return (
                  <div
                    key={task.id}
                    className={`p-6 rounded-xl border transition-all duration-200 ${
                      isOverdue ? 'border-red-200 bg-red-50' :
                      task.status === 'Completed' ? 'border-green-200 bg-green-50' :
                      task.status === 'In Progress' ? 'border-blue-200 bg-blue-50' :
                      'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{task.name}</h3>
                          <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                            task.status === 'Completed' ? 'bg-green-100 text-green-800' :
                            task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                            isOverdue ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {isOverdue && task.status !== 'Completed' ? 'Overdue' : task.status}
                          </span>
                          {needsApproval && (
                            <span className="px-3 py-1 text-sm font-semibold rounded-full bg-orange-100 text-orange-800">
                              Awaiting Approval
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                          <div className="flex items-center">
                            <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-600">Project:</span>
                            <span className="text-sm font-medium text-gray-900 ml-1">{getProjectName(task.project_id)}</span>
                          </div>
                          <div className="flex items-center">
                            <User className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-600">Assigned to:</span>
                            <span className="text-sm font-medium text-gray-900 ml-1">
                              {task.assigned_to.charAt(0).toUpperCase() + task.assigned_to.slice(1)}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-600">Due:</span>
                            <span className={`text-sm font-medium ml-1 ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                              {format(new Date(task.deadline), 'MMM dd, yyyy')}
                            </span>
                          </div>
                        </div>
                        
                        {task.description && (
                          <p className="text-sm text-gray-600 mb-4">{task.description}</p>
                        )}
                        
                        <div className="flex items-center space-x-4">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-600">Progress</span>
                              <span className="text-sm font-medium text-gray-900">{task.progress || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div 
                                className={`h-3 rounded-full transition-all duration-300 ${
                                  task.status === 'Completed' ? 'bg-green-600' : 'bg-blue-600'
                                }`}
                                style={{ width: `${task.progress || 0}%` }}
                              ></div>
                            </div>
                          </div>
                          
                          {canEditTask(task) && (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-600">Update:</span>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={task.progress || 0}
                                onChange={async (e) => {
                                  const newProgress = parseInt(e.target.value)
                                  let newStatus = task.status
                                  
                                  // Only task creator can mark as completed
                                  if (canMarkCompleted(task)) {
                                    if (newProgress === 100) {
                                      newStatus = 'Completed'
                                    } else if (newProgress > 0) {
                                      newStatus = 'In Progress'
                                    } else {
                                      newStatus = 'Pending'
                                    }
                                  } else {
                                    // Others can only update progress, not mark as completed
                                    if (newProgress === 100) {
                                      newStatus = 'In Progress' // Keep as In Progress, only creator can complete
                                    } else if (newProgress > 0) {
                                      newStatus = 'In Progress'
                                    } else {
                                      newStatus = 'Pending'
                                    }
                                  }
                                  
                                  try {
                                    const { error } = await supabase
                                      .from('tasks')
                                      .update({ 
                                        progress: newProgress,
                                        status: newStatus
                                      })
                                      .eq('id', task.id)
                                    
                                    if (error) throw error
                                    fetchData()
                                  } catch (error) {
                                    console.error('Error updating task:', error)
                                  }
                                }}
                                className="w-24"
                                title="Update progress"
                              />
                              <span className="text-sm font-medium text-gray-900 w-10">{task.progress || 0}%</span>
                              {!canMarkCompleted(task) && task.progress === 100 && (
                                <span className="text-xs text-orange-600 ml-2">
                                  Only creator can complete
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col space-y-2 ml-4">
                        <button
                          onClick={() => {
                            setSelectedTask(task)
                            fetchTaskComments(task.id)
                          }}
                          className="px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm font-medium transition-colors duration-200"
                        >
                          Details
                        </button>
                        {canEditTask(task) && (
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-medium transition-colors duration-200"
                          >
                            Delete
                          </button>
                        )}
                        {needsApproval && user?.role === 'Director' && (
                          <button
                            onClick={async () => {
                              // Director can approve any task at 100% progress
                              const { error } = await supabase
                                .from('tasks')
                                .update({ status: 'Completed' })
                                .eq('id', task.id)
                              
                              if (!error) {
                                fetchData()
                              }
                            }}
                            className="px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </button>
                        )}
                        {isForApproval && user?.role === 'Director' && (
                          <button
                            onClick={async () => {
                              const { error } = await supabase
                                .from('tasks')
                                .update({ status: 'Completed' })
                                .eq('id', task.id)
                              
                              if (!error) {
                                fetchData()
                              }
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve & Complete
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500 border-t pt-3">
                      Created by: {task.created_by.charAt(0).toUpperCase() + task.created_by.slice(1)} • 
                      Created: {format(new Date(task.created_at), 'MMM dd, yyyy')}
                      {task.created_by !== user?.username && (
                        <span className="ml-2 text-orange-600">• Only creator can mark as completed</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Task Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedTask.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">Project: {getProjectName(selectedTask.project_id)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Created by: {selectedTask.created_by} • Assigned to: {selectedTask.assigned_to}
                  </p>
                  <div className="flex items-center space-x-3 mt-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedTask.status)}`}>
                      {selectedTask.status}
                    </span>
                    <span className="text-sm text-gray-500">
                      Due: {format(new Date(selectedTask.deadline), 'MMM dd, yyyy')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedTask(null)
                    setTaskComments([])
                    setNewComment('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              {selectedTask.description && (
                <p className="text-gray-700 mt-3">{selectedTask.description}</p>
              )}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Progress</span>
                  <span className="text-sm font-medium text-gray-900">{selectedTask.progress || 0}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      selectedTask.status === 'Completed' ? 'bg-green-600' : 'bg-blue-600'
                    }`}
                    style={{ width: `${selectedTask.progress || 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            {/* Comments Section */}
            <div className="flex-1 overflow-y-auto max-h-96 p-6">
              <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                Task Comments
              </h4>
              
              <div className="space-y-4 mb-4">
                {taskComments.length === 0 ? (
                  <p className="text-gray-500 text-sm">No comments yet. Add the first comment!</p>
                ) : (
                  taskComments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">{comment.user?.username}</span>
                          <span className="text-xs text-gray-500">({comment.user?.role})</span>
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
                <div className="flex space-x-3">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={3}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <button
                    onClick={addComment}
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

export default TasksManagement