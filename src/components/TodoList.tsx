import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase, Todo } from '../lib/supabase'
import { Plus, CheckCircle2, Circle, Calendar, X } from 'lucide-react'
import { format } from 'date-fns'

const TodoList: React.FC = () => {
  const { user } = useAuth()
  const [todos, setTodos] = useState<Todo[]>([])
  const [showForm, setShowForm] = useState(false)
  const [newTodo, setNewTodo] = useState({
    title: '',
    description: '',
    due_date: ''
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTodos()
  }, [user])

  const fetchTodos = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTodos(data || [])
    } catch (error) {
      console.error('Error fetching todos:', error)
    } finally {
      setLoading(false)
    }
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
      fetchTodos()
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
      fetchTodos()
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
      fetchTodos()
    } catch (error) {
      console.error('Error deleting todo:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading tasks...</div>
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-gray-600 mt-2">Personal task management</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </button>
      </div>

      {/* Add Todo Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Task</h3>
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
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={addTodo}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Add Task
            </button>
          </div>
        </div>
      )}

      {/* Todos List */}
      <div className="space-y-3">
        {todos.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <p className="text-gray-500">No tasks yet. Add your first task to get started!</p>
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