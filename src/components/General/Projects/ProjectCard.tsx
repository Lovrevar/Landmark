import React from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Calendar, TrendingUp, CheckCircle, Clock, Pause, Eye } from 'lucide-react'
import { Badge, Button } from '../../ui'
import { format, differenceInDays, parseISO } from 'date-fns'
import type { ProjectWithStats } from '../types'

interface Props {
  project: ProjectWithStats
}

const getStatusConfig = (status: string) => {
  const configs = {
    'Planning': { icon: Clock, label: 'Planning' },
    'In Progress': { icon: TrendingUp, label: 'In Progress' },
    'Completed': { icon: CheckCircle, label: 'Completed' },
    'On Hold': { icon: Pause, label: 'On Hold' }
  }
  return configs[status as keyof typeof configs] || configs['Planning']
}

const getDaysInfo = (startDate: string, endDate: string | null) => {
  const start = parseISO(startDate)
  const today = new Date()

  if (endDate && parseISO(endDate) < today) {
    return { text: 'Completed', color: 'text-green-600' }
  }

  const daysElapsed = differenceInDays(today, start)
  if (endDate) {
    const daysRemaining = differenceInDays(parseISO(endDate), today)
    return {
      text: daysRemaining > 0 ? `${daysRemaining} days left` : 'Overdue',
      color: daysRemaining > 0 ? 'text-gray-600' : 'text-red-600'
    }
  }

  return { text: `${daysElapsed} days elapsed`, color: 'text-gray-600' }
}

const ProjectCard: React.FC<Props> = ({ project }) => {
  const navigate = useNavigate()
  const statusConfig = getStatusConfig(project.status)
  const daysInfo = getDaysInfo(project.start_date, project.end_date)

  return (
    <div
      className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{project.name}</h3>
          <div className="flex items-center text-sm text-gray-600">
            <MapPin className="w-4 h-4 mr-1" />
            {project.location}
          </div>
        </div>
        <Badge variant={
          project.status === 'Completed' ? 'green'
            : project.status === 'In Progress' ? 'blue'
            : project.status === 'On Hold' ? 'yellow'
            : 'gray'
        } size="sm">
          {statusConfig.label}
        </Badge>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Budget</span>
          <span className="font-semibold text-gray-900">€{project.budget.toLocaleString('hr-HR')}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Spent</span>
          <span className="font-semibold text-blue-600">€{project.stats.total_spent.toLocaleString('hr-HR')}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Remaining</span>
          <span className="font-semibold text-green-600">
            €{(project.budget - project.stats.total_spent).toLocaleString('hr-HR')}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center text-sm mb-2">
          <span className="text-gray-600">Progress</span>
          <span className="font-semibold text-gray-900">{project.stats.completion_percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${project.stats.completion_percentage}%` }}
          />
        </div>
      </div>

      <div className="flex justify-between items-center text-sm border-t border-gray-200 pt-4">
        <div className="flex items-center text-gray-600">
          <Calendar className="w-4 h-4 mr-1" />
          <span className={daysInfo.color}>{daysInfo.text}</span>
        </div>
        <div className="text-gray-600">
          <span className="font-semibold">{project.stats.milestones_completed}</span>
          <span>/{project.stats.milestones_total} milestones</span>
        </div>
      </div>

      <Button
        variant="secondary"
        icon={Eye}
        fullWidth
        className="mt-4"
        onClick={(e) => {
          e.stopPropagation()
          navigate(`/projects/${project.id}`)
        }}
      >
        View Details
      </Button>
    </div>
  )
}

export default ProjectCard
