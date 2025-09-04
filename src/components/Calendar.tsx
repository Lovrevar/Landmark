import React, { useState, useEffect } from 'react'
import { supabase, Todo, Task } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Calendar as CalendarIcon, Clock } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns'

interface CalendarEvent {
  id: string
  title: string
  date: string
  type: 'todo' | 'task'
  completed?: boolean
}

const Calendar: React.FC = () => {
  const { user } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvents()
  }, [user, currentDate])

  const fetchEvents = async () => {
    if (!user) return

    setLoading(true)
    try {
      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)

      console.log('Fetching events for user:', user.username)
      console.log('Date range:', format(monthStart, 'yyyy-MM-dd'), 'to', format(monthEnd, 'yyyy-MM-dd'))

      // Fetch user todos
      const { data: todos, error: todoError } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .not('due_date', 'is', null)
        .gte('due_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('due_date', format(monthEnd, 'yyyy-MM-dd'))

      if (todoError) throw todoError

      // Fetch tasks assigned to user
      const { data: tasks, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user.username)
        .gte('deadline', format(monthStart, 'yyyy-MM-dd'))
        .lte('deadline', format(monthEnd, 'yyyy-MM-dd'))

      if (taskError) throw taskError

      console.log('Fetched todos:', todos)
      console.log('Fetched tasks:', tasks)

      const allEvents: CalendarEvent[] = [
        ...(todos || []).map(todo => ({
          id: todo.id,
          title: todo.title,
          date: todo.due_date!,
          type: 'todo' as const,
          completed: todo.completed
        })),
        ...(tasks || []).map(task => ({
          id: task.id,
          title: task.name,
          date: task.deadline,
          type: 'task' as const
        }))
      ]

      console.log('All events:', allEvents)
      setEvents(allEvents)
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDaysInMonth = () => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    return eachDayOfInterval({ start: monthStart, end: monthEnd })
  }

  const getEventsForDate = (date: Date) => {
    return events.filter(event => isSameDay(new Date(event.date), date))
  }

  const days = getDaysInMonth()

  if (loading) {
    return <div className="text-center py-12">Loading calendar...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
        <p className="text-gray-600 mt-2">Your schedule and deadlines</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Calendar Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <CalendarIcon className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
              className="px-3 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors duration-200"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors duration-200"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
              className="px-3 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors duration-200"
            >
              Next
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="p-6">
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days.map(day => {
              const dayEvents = getEventsForDate(day)
              const isSelected = selectedDate && isSameDay(day, selectedDate)
              const isCurrentDay = isToday(day)

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(isSelected ? null : day)}
                  className={`
                    min-h-24 p-2 border rounded-lg cursor-pointer transition-all duration-200
                    ${isCurrentDay ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}
                    ${isSelected ? 'ring-2 ring-blue-500' : 'border-gray-200'}
                  `}
                >
                  <div className={`text-sm font-medium mb-1 ${
                    isCurrentDay ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map(event => (
                      <div
                        key={event.id}
                        className={`text-xs px-1 py-0.5 rounded truncate ${
                          event.type === 'todo'
                            ? event.completed
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-gray-500">+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Selected Date Events */}
        {selectedDate && (
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-3">
              Events for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h3>
            <div className="space-y-2">
              {getEventsForDate(selectedDate).map(event => (
                <div
                  key={event.id}
                  className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200"
                >
                  <div className={`w-3 h-3 rounded-full ${
                    event.type === 'todo'
                      ? event.completed
                        ? 'bg-green-500'
                        : 'bg-blue-500'
                      : 'bg-orange-500'
                  }`}></div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{event.title}</p>
                    <p className="text-sm text-gray-500">
                      {event.type === 'todo' ? 'Personal Task' : 'Project Task'}
                    </p>
                  </div>
                </div>
              ))}
              {getEventsForDate(selectedDate).length === 0 && (
                <p className="text-gray-500 text-sm">No events scheduled for this day.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Calendar