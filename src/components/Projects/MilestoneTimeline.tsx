import React from 'react'
import { CheckCircle, Circle, Clock, AlertTriangle, Calendar, Edit2, Trash2 } from 'lucide-react'
import { Badge, Button, EmptyState } from '../ui'
import { format, parseISO, isPast } from 'date-fns'

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
      <EmptyState
        icon={Calendar}
        title="No milestones yet"
        description="Add milestones to track project progress"
      />
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
                          <Badge variant={
                            status.label === 'Completed' ? 'green'
                              : status.label === 'Overdue' ? 'red'
                              : 'blue'
                          } size="sm">
                            {status.label}
                          </Badge>
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
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            icon={milestone.completed ? Circle : CheckCircle}
                            onClick={() => onToggleComplete?.(milestone.id, milestone.completed)}
                            title={milestone.completed ? 'Mark as incomplete' : 'Mark as complete'}
                            className={milestone.completed ? 'text-yellow-600 hover:bg-yellow-200' : 'text-green-600 hover:bg-green-200'}
                          />
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            icon={Edit2}
                            onClick={() => onEdit?.(milestone)}
                            title="Edit milestone"
                            className="text-blue-600 hover:bg-blue-200"
                          />
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            icon={Trash2}
                            onClick={() => onDelete?.(milestone.id)}
                            title="Delete milestone"
                            className="text-red-600 hover:bg-red-200"
                          />
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
