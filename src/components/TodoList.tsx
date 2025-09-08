import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, Todo, Task, TaskComment } from '../lib/supabase'
import { Plus, CheckCircle2, Circle, Calendar, X, Edit2, Lock, MessageSquare, Send } from 'lucide-react'
import { format } from 'date-fns'

interface TaskWithProject extends Task {
  project_name: string
}

const TodoList: React.FC = () => {
  const { user } = useAuth()
  const [todos, setTodos] = useState<Todo[]>([])
  const [assignedTasks, setAssignedTasks] = useState<TaskWithProject[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskWithProject | null>(null)
  const [taskComments, setTaskComments] = useState<TaskComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [editingTask, setEditingTask] = useState<TaskWithProject | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editTaskData, setEditTaskData] = useState({
    name: '',
    description: '',
    deadline: '',
    progress: 0
  })
  const [newTodo, setNewTodo] = useState({
    title: '',
    description: '',
    due_date: '',
    assigned_to: ''
  })
  const [loading, setLoading] = useState(true)

  const userOptions = [
    { value: 'director', label: 'Director' },
    { value: 'accountant', label: 'Accountant' },
    { value: 'salesperson', label: 'Sales Person' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'investor', label: 'Investor' }
  ]

  const getTaskCategories = () => {
    const assignedToMeTasks = assignedTasks.filter(t => t.assigned_to === user?.username)
    const createdByMeTasks = assignedTasks.filter(t => t.created_by === user?.username)
    
    return [
      { id: 'assigned_to_me', name: 'Tasks Assigned to Me', count: assignedToMeTasks.filter(t => t.progress < 100 && t.status !== 'Completed').length },
      { id: 'pending_creator_approval', name: 'Pending Approval', count: assignedToMeTasks.filter(t => t.progress === 100 && t.status?.trim() !== 'Completed').length },
      { id: 'finished_by_me', name: 'Completed', count: assignedToMeTasks.filter(t => t.status === 'Completed').length },
      { id: 'for_approval_from_others', name: 'For Approval (Created by me)', count: createdByMeTasks.filter(t => t.progress === 100 && t.status?.trim() !== 'Completed' && t.assigned_to !== user?.username).length }
    ]
  }

  const getFilteredTasks = () => {
    const assignedToMeTasks = assignedTasks.filter(t => t.assigned_to === user?.username)
    const createdByMeTasks = assignedTasks.filter(t => t.created_by === user?.username)
    
    switch (activeCategory) {
      case 'assigned_to_me':
        return assignedToMeTasks.filter(t => t.progress < 100 && t.status !== 'Completed')
      case 'pending_creator_approval':
        return assignedToMeTasks.filter(t => t.progress === 100 && t.status !== 'Completed')
      case 'finished':
        return assignedToMeTasks.filter(t => t.status?.trim() === 'Completed')
      case 'for_approval':
        return createdByMeTasks.filter(t => t.progress === 100 && t.status?.trim() !== 'Completed' && t.assigned_to !== user?.username)
      default:
        return [...assignedToMeTasks, ...createdByMeTasks].filter((task, index, self) => 
          index === self.findIndex(t => t.id === task.id)
        )
    }
  }

  const [activeCategory, setActiveCategory] = useState('assigned_to_me')

  useEffect(() => {
    fetchData()
  }, [user])

  const fetchData = async () => {
    if (!user) return

    try {
      // Fetch personal todos
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTodos(data || [])

      // Fetch tasks assigned to user AND tasks created by user
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          projects!inner(name)
        `)
        .or(`assigned_to.eq.${user.username},created_by.eq.${user.username}`)
        .order('deadline', { ascending: true })

      if (tasksError) throw tasksError
      
      const tasksWithProject = (tasksData || []).map(task => ({
        ...task,
        project_name: task.projects.name
      }))
      
      setAssignedTasks(tasksWithProject)
    } catch (error) {
      console.error('Error fetching todos:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTaskComments = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select(`
          *,
          users!inner(username, role)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })

      if (error) throw error
      
      const commentsWithUser = (data || []).map(comment => ({
        ...comment,
        user: comment.users
      }))
      
      setTaskComments(commentsWithUser)
    } catch (error) {
      console.error('Error fetching task comments:', error)
    }
  }

  const addComment = async () => {
    if (!user || !selectedTask || !newComment.trim()) return

    try {
      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: selectedTask.id,
          user_id: user.id,
          comment: newComment.trim()
        })

      if (error) throw error

      setNewComment('')
      fetchTaskComments(selectedTask.id)
    } catch (error) {
      console.error('Error adding comment:', error)
    }
  }

  const openTaskDetails = (task: TaskWithProject) => {
    setSelectedTask(task)
    fetchTaskComments(task.id)
  }

  const addTodo = async () => {
    if (!user || !newTodo.title.trim() || !newTodo.assigned_to) {
      alert('Please fill in title and select who to assign the task to')
      return
    }

    try {
      if (newTodo.assigned_to === user.username) {
        // Create personal todo
        const { error } = await supabase
          .from('todos')
          .insert({
            user_id: user.id,
            title: newTodo.title,
            description: newTodo.description,
            due_date: newTodo.due_date || null
          })

        if (error) throw error
      } else {
        // Create task for someone else - need to find a project to assign it to
        // For now, we'll use the first available project or create without project
        const { data: projectsData } = await supabase
          .from('projects')
          .select('id')
          .limit(1)

        const projectId = projectsData?.[0]?.id
        
        if (!projectId) {
          alert('No projects available. Please create a project first to assign tasks.')
          return
        }

        const { error } = await supabase
          .from('tasks')
          .insert({
            project_id: projectId,
            name: newTodo.title,
            description: newTodo.description,
            assigned_to: newTodo.assigned_to,
            created_by: user.username,
            deadline: newTodo.due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default to 7 days from now
            status: 'Pending',
            progress: 0
          })

        if (error) throw error
      }

      setNewTodo({ title: '', description: '', due_date: '', assigned_to: '' })
      setShowForm(false)
      fetchData()
    } catch (error) {
      console.error('Error adding todo:', error)
    }
  }

  const toggleTodo = async (todoId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('todos')
        .update({ completed: !completed })
        .eq('id', todoId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error updating todo:', error)
    }
  }

  const deleteTodo = async (todoId: string) => {
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', todoId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error deleting todo:', error)
    }
  }

  const handleEditTask = (task: TaskWithProject) => {
    setEditingTask(task)
    setEditTaskData({
      name: task.name,
      description: task.description || '',
      deadline: task.deadline,
      progress: task.progress || 0
    })
    setShowEditForm(true)
  }

  const updateTask = async () => {
    if (!editingTask || !editTaskData.name.trim()) return

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          name: editTaskData.name,
          description: editTaskData.description,
          deadline: editTaskData.deadline,
          progress: editTaskData.progress
        })
        .eq('id', editingTask.id)

      if (error) throw error

      setShowEditForm(false)
      setEditingTask(null)
      setEditTaskData({ name: '', description: '', deadline: '', progress: 0 })
      fetchData()
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  const updateTaskProgress = async (taskId: string, newProgress: number) => {
    try {
      const task = assignedTasks.find(t => t.id === taskId)
      if (!task) return

      // Determine new status based on progress and creator permissions
      let newStatus = task.status
      
      // Only task creator can mark as completed
      if (canCompleteTask(task)) {
        if (newProgress === 100) {
          newStatus = 'Completed'
        } else if (newProgress > 0) {
          newStatus = 'In Progress'
        } else {
          newStatus = 'Pending'
        }
      } else {
        // Others can update progress but not mark as completed
        if (newProgress === 100) {
          newStatus = 'In Progress' // Keep as In Progress, only creator can complete
        } else if (newProgress > 0) {
          newStatus = 'In Progress'
        } else {
          newStatus = 'Pending'
        }
      }

      const { error } = await supabase
        .from('tasks')
        .update({ 
          progress: newProgress,
          status: newStatus
        })
        .eq('id', taskId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  const resetForm = () => {
    setNewTodo({ title: '', description: '', due_date: '', assigned_to: '' })
    setSelectedTask(null)
    setTaskComments([])
    setNewComment('')
    setShowForm(false)
    setShowEditForm(false)
    setEditingTask(null)
    setEditTaskData({ name: '', description: '', deadline: '', progress: 0 })
  }

  const getTaskCardColor = (task: TaskWithProject) => {
    const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'Completed'
    const isCompleted = task.status === 'Completed'
    const isPendingApproval = task.progress === 100 && task.status !== 'Completed'
    
    if (isOverdue) return 'border-l-4 border-l-red-500 bg-red-50 border-red-200'
    if (isCompleted) return 'border-l-4 border-l-green-500 bg-green-50'
    if (isPendingApproval) return 'border-l-4 border-l-purple-500 bg-purple-50 border-purple-200'
    if (task.status === 'In Progress') return 'border-l-4 border-l-blue-500 bg-blue-50'
    return 'border-l-4 border-l-gray-300 bg-white'
  }

  const canEditTask = (task: TaskWithProject) => {
    // Anyone can edit tasks they created
    return task.created_by === user?.username
  }

  const canCompleteTask = (task: TaskWithProject) => {
    // Only task creator can mark as completed
    return task.created_by === user?.username
  }

  if (loading) {
    return <div className="text-center py-12">Loading tasks...</div>
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-gray-600 mt-2">Personal todos and assigned project tasks</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </button>
      </div>

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

      {/* Add Todo/Task Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Add New Item
          </h3>
          
          {/* Personal Todo Form */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-800 mb-3">Create Task</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Task Title *</label>
                <input
                  type="text"
                  placeholder="Enter task title"
                  value={newTodo.title}
                  onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign To *</label>
                <select
                  value={newTodo.assigned_to}
                  onChange={(e) => setNewTodo({ ...newTodo, assigned_to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select assignee</option>
                  {userOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                <input
                  type="date"
                  value={newTodo.due_date}
                  onChange={(e) => setNewTodo({ ...newTodo, due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  placeholder="Task description (optional)"
                  value={newTodo.description}
                  onChange={(e) => setNewTodo({ ...newTodo, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={addTodo}
                disabled={!newTodo.title.trim() || !newTodo.assigned_to}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                {newTodo.assigned_to === user?.username ? 'Add Personal Todo' : 'Create Task'}
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedTask.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">Project: {selectedTask.project_name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Created by: {selectedTask.created_by} • Assigned to: {selectedTask.assigned_to}
                  </p>
                  <div className="flex items-center space-x-3 mt-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedTask.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      selectedTask.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                      new Date(selectedTask.deadline) < new Date() ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedTask.status}
                      {selectedTask.created_by === 'director' && selectedTask.progress === 100 && selectedTask.status !== 'Completed' && (
                        <span className="ml-1">• Only creator can complete</span>
                      )}
                    </span>
                    <span className="text-sm text-gray-500">
                      Due: {format(new Date(selectedTask.deadline), 'MMM dd, yyyy')}
                    </span>
                    {selectedTask.progress === 100 && selectedTask.status !== 'Completed' && selectedTask.assigned_to === user?.username && (
                      <span className="text-xs text-orange-600">
                        Awaiting creator approval
                      </span>
                    )}
                  </div>
                {/* Progress Update Slider - only for assigned tasks */}
                {selectedTask.assigned_to === user?.username && selectedTask.status !== 'Completed' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Update Progress: {selectedTask.progress || 0}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={selectedTask.progress || 0}
                      onChange={(e) => {
                        const newProgress = parseInt(e.target.value)
                        updateTaskProgress(selectedTask.id, newProgress)
                        setSelectedTask({ ...selectedTask, progress: newProgress })
                      }}
                      className="w-full"
                    />
                    {selectedTask.progress === 100 && (
                      <p className="text-xs text-purple-600 mt-1">
                        Task marked as complete - awaiting creator approval
                      </p>
                    )}
                  </div>
                )}
                {/* Approve button for tasks created by current user */}
                {selectedTask.progress === 100 && selectedTask.status !== 'Completed' && selectedTask.created_by === user?.username && selectedTask.assigned_to !== user?.username && (
                  <div className="mt-3">
                    <button
                      onClick={async () => {
                        const { error } = await supabase
                          .from('tasks')
                          .update({ status: 'Completed' })
                          .eq('id', selectedTask.id)
                        
                        if (!error) {
                          setSelectedTask({ ...selectedTask, status: 'Completed' })
                          fetchData()
                        }
                      }}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Approve Task Completion
                    </button>
                  </div>
                )}
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 max-h-96 overflow-y-auto">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Comments</h4>
              
              {taskComments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No comments yet. Be the first to comment!</p>
              ) : (
                <div className="space-y-4 mb-6">
                  {taskComments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{comment.user.username}</span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(comment.created_at), 'MMM dd, yyyy HH:mm')}
                        </span>
                      </div>
                      <p className="text-gray-700">{comment.comment}</p>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex space-x-3">
                <input
                  type="text"
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addComment()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={addComment}
                  disabled={!newComment.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Form Modal */}
      {showEditForm && editingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Edit Task</h3>
                <button
                  onClick={() => setShowEditForm(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Task Name</label>
                  <input
                    type="text"
                    value={editTaskData.name}
                    onChange={(e) => setEditTaskData({ ...editTaskData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={editTaskData.description}
                    onChange={(e) => setEditTaskData({ ...editTaskData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Deadline</label>
                  <input
                    type="date"
                    value={editTaskData.deadline}
                    onChange={(e) => setEditTaskData({ ...editTaskData, deadline: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Progress: {editTaskData.progress}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editTaskData.progress}
                    onChange={(e) => setEditTaskData({ ...editTaskData, progress: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowEditForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={updateTask}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Update Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Project Tasks */}
      {getFilteredTasks().length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {getTaskCategories().find(cat => cat.id === activeCategory)?.name || 'Project Tasks'}
          </h2>
          <div className="space-y-3">
            {getFilteredTasks().map((task) => {
              const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'Completed'
              const canEdit = canEditTask(task)
              const isPendingApproval = task.progress === 100 && task.status !== 'Completed'
              const isReadyForMyApproval = task.progress === 100 && task.status !== 'Completed' && task.created_by === user?.username && task.assigned_to !== user?.username
              
              return (
                <div
                  key={task.id}
                  className={`rounded-xl shadow-sm border border-gray-200 p-4 transition-all duration-200 ${getTaskCardColor(task)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-medium text-gray-900">{task.name}</h3>
                        {!canEdit && (
                          <div className="flex items-center space-x-1">
                            <Lock className="w-4 h-4 text-red-500" />
                            <span className="text-xs text-red-600 font-medium">Created by {task.created_by}</span>
                          </div>
                        )}
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          task.status === 'Completed' ? 'bg-green-100 text-green-800' :
                          task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                          isOverdue ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {isOverdue && task.status !== 'Completed' ? 'Overdue' : task.status}
                        </span>
                        {isPendingApproval && task.assigned_to === user?.username && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                            Awaiting Approval
                          </span>
                        )}
                        {isReadyForMyApproval && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                            Ready for Approval
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">
                        Project: {task.project_name}
                      </p>
                      
                      {task.description && (
                        <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                      )}
                      
                      <div className="flex items-center space-x-4 mb-3">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 text-gray-400 mr-1" />
                          <span className={`text-sm ${
                            isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'
                          }`}>
                            Due {format(new Date(task.deadline), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600">Progress</span>
                            <span className="text-sm font-medium text-gray-900">{task.progress || 0}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                task.status === 'Completed' ? 'bg-green-600' : 
                                isPendingApproval ? 'bg-purple-600' : 'bg-blue-600'
                              }`}
                              style={{ width: `${task.progress || 0}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openTaskDetails(task)}
                            className="px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md text-xs font-medium transition-colors duration-200"
                            title="View details and add comments"
                          >
                            💬 Comment
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleEditTask(task)}
                              className="px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md text-xs font-medium transition-colors duration-200"
                            >
                              ✏️ Edit
                            </button>
                          )}
                          {/* Progress slider for assigned tasks only */}
                          {task.assigned_to === user?.username && task.status !== 'Completed' && (
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-600">Progress:</span>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={task.progress || 0}
                                onChange={(e) => updateTaskProgress(task.id, parseInt(e.target.value))}
                                className="w-20"
                                title="Update progress"
                              />
                              <span className="text-xs font-medium text-gray-900 w-8">{task.progress || 0}%</span>
                            </div>
                          )}
                          {/* Approve button for tasks created by current user */}
                          {isReadyForMyApproval && (
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
                              className="px-3 py-1 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 transition-colors duration-200 flex items-center"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Approve
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Personal Todos */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Personal Todos</h2>
        {todos.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <p className="text-gray-500">No personal todos yet. Add your first todo to get started!</p>
          </div>
        ) : (
          todos.map((todo) => {
            const isDueSoon = todo.due_date && new Date(todo.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
            const isOverdue = todo.due_date && new Date(todo.due_date) < new Date()
            
            return (
              <div
                key={todo.id}
                className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 transition-all duration-200 ${
                  todo.completed ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <button
                      onClick={() => toggleTodo(todo.id, todo.completed)}
                      className="mt-1 text-gray-400 hover:text-blue-600 transition-colors duration-200"
                    >
                      {todo.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    <div className="flex-1">
                      <h3 className={`font-medium ${todo.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                        {todo.title}
                      </h3>
                      {todo.description && (
                        <p className="text-sm text-gray-600 mt-1">{todo.description}</p>
                      )}
                      {todo.due_date && (
                        <div className="flex items-center mt-2">
                          <Calendar className="w-4 h-4 text-gray-400 mr-1" />
                          <span className={`text-sm ${
                            isOverdue && !todo.completed ? 'text-red-600 font-medium' :
                            isDueSoon && !todo.completed ? 'text-orange-600 font-medium' :
                            'text-gray-500'
                          }`}>
                            Due {format(new Date(todo.due_date), 'MMM dd, yyyy')}
                            {isOverdue && !todo.completed && ' (Overdue)'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors duration-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default TodoList