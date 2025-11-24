import React from 'react'
import { CheckCircle, Circle, Clock, AlertTriangle, Calendar, Edit2, Trash2 } from 'lucide-react'
import { format, parseISO, isPast, isFuture } from 'date-fns'

interface Milestone {
  id: string
  name: string
  due_date: string | null
  completed: boolean
  created_at?: string
}

interface MilestoneTimelineProps {
  milestones: Milestone[]
  onEdit?: (milestone: Milestone) => void
  onDelete?: (milestoneId: string) => void
  onToggleComplete?: (milestoneId: string, completed: boolean) => void
  editable?: boolean
}

const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({
  milestones,
  onEdit,
  onDelete,
  onToggleComplete,
  editable = true
}) => {
  const sortedMilestones = [...milestones].sort((a, b) => {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })

  const getMilestoneStatus = (milestone: Milestone) => {
    if (milestone.completed) {
      return {
        icon: CheckCircle,
        color: 'text-green-600',
        bg: 'bg-green-100',
        border: 'border-green-300',
        label: 'Completed',
        lineColor: 'bg-green-300'
      }
    }

    if (milestone.due_date) {
      const dueDate = parseISO(milestone.due_date)
      if (isPast(dueDate)) {
        return {
          icon: AlertTriangle,
          color: 'text-red-600',
          bg: 'bg-red-100',
          border: 'border-red-300',
          label: 'Overdue',
          lineColor: 'bg-red-300'
        }
      }
    }

    return {
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      border: 'border-blue-300',
      label: 'In Progress',
      lineColor: 'bg-blue-300'
    }
  }

  if (milestones.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No milestones yet</p>
        <p className="text-sm text-gray-500 mt-1">Add milestones to track project progress</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        {sortedMilestones.map((milestone, index) => {
          const status = getMilestoneStatus(milestone)
          const isLast = index === sortedMilestones.length - 1

          return (
            <div key={milestone.id} className="relative pb-10">
              {!isLast && (
                <div className={`absolute left-6 top-12 bottom-0 w-0.5 ${status.lineColor}`} />
              )}

              <div className="relative flex items-start group">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full ${status.bg} ${status.border} border-2 flex items-center justify-center z-10`}>
                  <status.icon className={`w-6 h-6 ${status.color}`} />
                </div>

                <div className="ml-6 flex-1">
                  <div className={`bg-white rounded-lg border-2 ${status.border} p-4 shadow-sm hover:shadow-md transition-shadow duration-200`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{milestone.name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                            {status.label}
                          </span>
                        </div>

                        {milestone.due_date && (
                          <div className="flex items-center text-sm text-gray-600 mt-1">
                            <Calendar className="w-4 h-4 mr-1" />
                            <span>Due: {format(parseISO(milestone.due_date), 'MMM dd, yyyy')}</span>
                          </div>
                        )}
                      </div>

                      {editable && (
                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={() => onToggleComplete?.(milestone.id, milestone.completed)}
                            className={`p-2 rounded-lg transition-colors duration-200 ${
                              milestone.completed
                                ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                                : 'bg-green-100 text-green-600 hover:bg-green-200'
                            }`}
                            title={milestone.completed ? 'Mark as incomplete' : 'Mark as complete'}
                          >
                            {milestone.completed ? <Circle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => onEdit?.(milestone)}
                            className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors duration-200"
                            title="Edit milestone"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDelete?.(milestone.id)}
                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors duration-200"
                            title="Delete milestone"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-gray-700">
                <span className="font-semibold">{milestones.filter(m => m.completed).length}</span> Completed
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-gray-700">
                <span className="font-semibold">{milestones.filter(m => !m.completed && (!m.due_date || !isPast(parseISO(m.due_date)))).length}</span> In Progress
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-gray-700">
                <span className="font-semibold">{milestones.filter(m => !m.completed && m.due_date && isPast(parseISO(m.due_date))).length}</span> Overdue
              </span>
            </div>
          </div>
          <div className="text-gray-600">
            Progress: <span className="font-semibold">{Math.round((milestones.filter(m => m.completed).length / milestones.length) * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MilestoneTimeline
