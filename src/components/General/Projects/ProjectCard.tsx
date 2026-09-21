import React from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { MapPin, Calendar, Eye } from 'lucide-react'
import { Badge, Button } from '../../ui'
import ProjectCategoryBadge from '../../Common/ProjectCategoryBadge'
import type { ProjectWithStats } from './types'
import { getStatusConfig } from './utils'
import { projectTimeline, PROJECT_TIMELINE_TONE } from '../../../utils/projectTimeline'
import { formatEuro } from '../../../utils/formatters'

interface Props {
  project: ProjectWithStats
}

const ProjectCard: React.FC<Props> = ({ project }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const statusConfig = getStatusConfig(project.status)
  // Was `getDaysInfo`, which called any project past its end date green "Completed" whatever
  // its status, and said red "Overdue" the day before the end date.
  const timeline = projectTimeline(project.status, project.end_date)
  // The TIC is the only writer of planned budget, so without one there is no budget to show —
  // and "remaining" against a phantom budget is worse than saying nothing.
  const hasBudget = project.tic_total !== null && project.tic_total > 0
  const remaining = project.budget - project.stats.total_spent

  return (
    <div
      className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{project.name}</h3>
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <MapPin className="w-4 h-4 mr-1" />
            {project.location}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={
            project.status === 'Completed' ? 'green'
              : project.status === 'In Progress' ? 'blue'
              : project.status === 'On Hold' ? 'yellow'
              : 'gray'
          } size="sm">
            {statusConfig.label}
          </Badge>
          <ProjectCategoryBadge category={project.category} />
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">{t('common.budget')}</span>
          {hasBudget ? (
            <span className="font-semibold text-gray-900 dark:text-white">{formatEuro(project.budget)}</span>
          ) : (
            <span className="font-semibold text-orange-600 dark:text-orange-400">
              {t('general_projects.budget_not_set')}
            </span>
          )}
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 dark:text-gray-400">{t('general_projects.card_spent')}</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">{formatEuro(project.stats.total_spent)}</span>
        </div>
        {/* Only meaningful against a real budget — and red when it has been exceeded, which the
            constant green said was fine. */}
        {hasBudget && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600 dark:text-gray-400">{t('common.remaining')}</span>
            <span className={`font-semibold ${
              remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
            }`}>
              {formatEuro(remaining)}
            </span>
          </div>
        )}
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center text-sm mb-2">
          <span className="text-gray-600 dark:text-gray-400">{t('general_projects.card_progress')}</span>
          <span className="font-semibold text-gray-900 dark:text-white">{project.stats.completion_percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${project.stats.completion_percentage}%` }}
          />
        </div>
      </div>

      <div className="flex justify-between items-center text-sm border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center text-gray-600 dark:text-gray-400">
          <Calendar className="w-4 h-4 mr-1" />
          <span className={PROJECT_TIMELINE_TONE[timeline.state]}>
            {timeline.state === 'completed'
              ? t('status.completed')
              : timeline.state === 'no_end_date'
                ? t('general_projects.ongoing')
                : timeline.state === 'due_today'
                  ? t('common.due_today')
                  : timeline.state === 'overdue'
                    ? t('general_projects.days_overdue', { count: Math.abs(timeline.days!) })
                    : t('general_projects.days_left', { count: timeline.days! })}
          </span>
        </div>
        <div className="text-gray-600 dark:text-gray-400">
          <span className="font-semibold">{project.stats.milestones_completed}</span>
          <span>/{project.stats.milestones_total} {t('general_projects.milestones')}</span>
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
        {t('general_projects.card_view_details')}
      </Button>
    </div>
  )
}

export default ProjectCard
