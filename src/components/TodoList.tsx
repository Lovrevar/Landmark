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
  const [newTodo, setNewTodo] = useState({
    title: '',
    description: '',
    due_date: ''
  })
  const [loading, setLoading] = useState(true)

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

      // Fetch assigned tasks from projects
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          projects!inner(name)
        `)
        .eq('assigned_to', user.username)
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
    if (!user || !newTodo.title.trim()) return

    try {
      const { error } = await supabase
        .from('todos')
        .insert({
          user_id: user.id,
          title: newTodo.title,
          description: newTodo.description,
          due_date: newTodo.due_date || null
        })

      if (error) throw error

      setNewTodo({ title: '', description: '', due_date: '' })
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

  const updateTaskProgress = async (taskId: string, newProgress: number) => {
    try {
      const task = assignedTasks.find(t => t.id === taskId)
      if (!task) return

      // Determine new status based on progress and permissions
      let newStatus = task.status
      
      if (task.created_by === 'director' && task.created_by !== user?.username && user?.role !== 'Supervision') {
        // For director-created tasks, only director can mark as completed
        // Exception: Supervisors can complete subcontractor-related tasks
        if (newProgress === 100) {
          newStatus = 'In Progress' // Keep as In Progress, director must approve
        } else if (newProgress > 0) {
          newStatus = 'In Progress'
        } else {
          newStatus = 'Pending'
        }
      } else if (task.created_by === 'director' && user?.role === 'Supervision') {
        // Supervisors can complete any director-created task (subcontractor oversight)
        if (newProgress === 100) {
          newStatus = 'Completed'
        } else if (newProgress > 0) {
          newStatus = 'In Progress'
        } else {
          newStatus = 'Pending'
        }
      } else {
        // For own tasks, can set any status
        if (newProgress === 100) {
          newStatus = 'Completed'
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
    setNewTodo({ title: '', description: '', due_date: '' })
    setSelectedTask(null)
    setTaskComments([])
    setNewComment('')
    setShowForm(false)
  }

  const getTaskCardColor = (task: TaskWithProject) => {
    const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'Completed'
    const isCompleted = task.status === 'Completed'
    const isInProgress = task.status === 'In Progress'
    
    if (isOverdue) return 'border-l-4 border-l-red-500 bg-red-50 border-red-200'
    if (isCompleted) return 'border-l-4 border-l-green-500 bg-green-50'
    if (isInProgress) return 'border-l-4 border-l-green-500 bg-green-50'
    return 'border-l-4 border-l-gray-300 bg-white'
  }

  const canEditTask = (task: TaskWithProject) => {
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

      {/* Add Todo/Task Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingTask ? 'Edit Task' : 'Add New Item'}
          </h3>
          
          {/* Personal Todo Form */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-800 mb-3">Personal Todo</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Task title"
                value={newTodo.title}
                onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <textarea
                placeholder="Description (optional)"
                value={newTodo.description}
                onChange={(e) => setNewTodo({ ...newTodo, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <input
                type="date"
                value={newTodo.due_date}
                onChange={(e) => setNewTodo({ ...newTodo, due_date: e.target.value })}
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                Add Todo
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
                        <span className="ml-1">• Awaiting Director Approval</span>
                      )}
                    </span>
                    <span className="text-sm text-gray-500">
                      Due: {format(new Date(selectedTask.deadline), 'MMM dd, yyyy')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
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
                {/* Progress Update Slider */}
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
                  {selectedTask.created_by === 'director' && selectedTask.created_by !== user?.username && (
                    <p className="text-xs text-orange-600 mt-1">
                      Note: Only the Director can mark director-created tasks as "Completed"
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Comments Section */}
            <div className="flex-1 overflow-y-auto max-h-96 p-6">
              <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                Progress Updates
              </h4>
              
              <div className="space-y-4 mb-4">
                {taskComments.length === 0 ? (
                  <p className="text-gray-500 text-sm">No progress updates yet. Add the first update!</p>
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
                    placeholder="Add a progress update..."
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

      {/* Project Tasks */}
      {assignedTasks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Project Tasks</h2>
          <div className="space-y-3">
            {assignedTasks.map((task) => {
              const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'Completed'
              const canEdit = canEditTask(task)
              
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
                            <span className="text-xs text-red-600 font-medium">Director Task</span>
                          </div>
                        )}
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          task.status === 'Completed' ? 'bg-green-100 text-green-800' :
                          task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                          isOverdue ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {isOverdue && task.status !== 'Completed' ? 'Overdue' : task.status}
                          {task.created_by === 'director' && task.progress === 100 && task.status !== 'Completed' && (
                            <span className="ml-1 text-orange-600">
                              {user?.role === 'Supervision' ? '• Ready for Completion' : '• Awaiting Approval'}
                            </span>
                          )}
                        </span>
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
                                task.status === 'Completed' ? 'bg-green-600' : 'bg-blue-600'
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
                            <>
                            <button
                              onClick={() => handleEditTask(task)}
                              className="px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md text-xs font-medium transition-colors duration-200"
                            >
                              ✏️ Edit
                            </button>
                            </>
                          )}
                          {/* Progress slider for all users on their assigned tasks */}
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
                            <span className="text-xs text-gray-600 w-8">{task.progress || 0}%</span>
                          </div>
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