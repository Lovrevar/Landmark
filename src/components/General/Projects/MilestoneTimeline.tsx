import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, Circle, Clock, AlertTriangle, Calendar, Edit2, Trash2, ChevronDown } from 'lucide-react'
import { Badge, Button, EmptyState } from '../../ui'
import type { Milestone } from './types'
import { daysFromToday } from '../../../utils/dateOnly'
import { formatDate } from '../../../utils/formatters'
import { buildPhaseBuckets, getMilestoneStatus, NO_PHASE_KEY } from './utils'

/**
 * The one overdue rule, shared with `getMilestoneStatus`: past its due date in whole local days.
 * `isPast(parseISO(...))` called a milestone due today overdue from UTC midnight onwards, so the
 * counts in this summary disagreed with the icon on the row beside them.
 */
const isMilestoneOverdue = (m: Milestone) => !m.completed && daysFromToday(m.due_date) < 0

interface MilestoneTimelineProps {
  milestones: Milestone[]
  onEdit?: (milestone: Milestone) => void
  onDelete?: (milestoneId: string) => void
  onToggleComplete?: (milestoneId: string, completed: boolean) => void
  editable?: boolean
  groupByPhase?: boolean
  isPhaseExpanded?: (key: string) => boolean
  onTogglePhase?: (key: string) => void
}

const sortByDate = (list: Milestone[]) =>
  [...list].sort((a, b) => {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })

const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({
  milestones,
  onEdit,
  onDelete,
  onToggleComplete,
  editable = true,
  groupByPhase = false,
  isPhaseExpanded,
  onTogglePhase
}) => {
  const { t, i18n } = useTranslation()

  const sortedMilestones = useMemo(() => sortByDate(milestones), [milestones])

  const groupedBuckets = useMemo(() => {
    if (!groupByPhase) return null
    return buildPhaseBuckets(milestones).map(b => ({
      key: b.key,
      label: b.key === NO_PHASE_KEY ? t('general_projects.milestone_template.no_phase_label') : b.key,
      items: sortByDate(b.items)
    }))
  }, [groupByPhase, milestones, t])

  if (milestones.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title={t('general_projects.milestones_empty_title')}
        description={t('general_projects.milestones_empty_desc')}
      />
    )
  }

  const renderMilestoneCard = (milestone: Milestone, index: number, total: number) => {
    const status = getMilestoneStatus(milestone)
    const isLast = index === total - 1

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
            <div className={`bg-white dark:bg-gray-800 rounded-lg border-2 ${status.border} p-4 shadow-sm hover:shadow-md transition-shadow duration-200`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{milestone.name}</h3>
                    <Badge variant={status.variant} size="sm">
                      {t(status.labelKey)}
                    </Badge>
                  </div>

                  {milestone.due_date && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span>{t('general_projects.milestone_due')}: {formatDate(milestone.due_date, i18n.language)}</span>
                    </div>
                  )}
                </div>

                {editable && (
                  // Always visible on touch widths (no hover there); md+ reveals on hover or keyboard focus.
                  // focus-within needs the md: prefix too, or md:opacity-0's media rule would win.
                  <div className="flex items-center space-x-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity duration-200">
                    <Button
                      size="icon-sm"
                      variant={milestone.completed ? 'ghost-warning' : 'ghost-success'}
                      icon={milestone.completed ? Circle : CheckCircle}
                      onClick={() => onToggleComplete?.(milestone.id, milestone.completed)}
                      title={milestone.completed ? t('general_projects.milestone_mark_incomplete') : t('general_projects.milestone_mark_complete')}
                    />
                    <Button
                      size="icon-sm"
                      variant="ghost-primary"
                      icon={Edit2}
                      onClick={() => onEdit?.(milestone)}
                      title={t('general_projects.milestone_edit')}
                    />
                    <Button
                      size="icon-sm"
                      variant="ghost-danger"
                      icon={Trash2}
                      onClick={() => onDelete?.(milestone.id)}
                      title={t('general_projects.milestone_delete')}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderSummary = () => (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-gray-700 dark:text-gray-200">
              <span className="font-semibold">{milestones.filter(m => m.completed).length}</span> {t('status.completed')}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="text-gray-700 dark:text-gray-200">
              <span className="font-semibold">{milestones.filter(m => !m.completed && !isMilestoneOverdue(m)).length}</span> {t('status.in_progress')}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-gray-700 dark:text-gray-200">
              <span className="font-semibold">{milestones.filter(isMilestoneOverdue).length}</span> {t('status.overdue')}
            </span>
          </div>
        </div>
        <div className="text-gray-600 dark:text-gray-400">
          {t('general_projects.milestone_progress')}: <span className="font-semibold">{Math.round((milestones.filter(m => m.completed).length / milestones.length) * 100)}%</span>
        </div>
      </div>
    </div>
  )

  if (groupedBuckets) {
    return (
      <div className="space-y-4">
        {groupedBuckets.map(bucket => {
          const total = bucket.items.length
          const done = bucket.items.filter(m => m.completed).length
          const overdue = bucket.items.filter(isMilestoneOverdue).length
          const pct = total > 0 ? Math.round((done / total) * 100) : 0
          const expanded = isPhaseExpanded ? isPhaseExpanded(bucket.key) : true
          const handleHeaderClick = () => onTogglePhase?.(bucket.key)

          return (
            <div key={bucket.key} className="space-y-3">
              <button
                type="button"
                onClick={handleHeaderClick}
                aria-expanded={expanded}
                className="w-full text-left px-4 py-3 bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{bucket.label}</h4>
                  <div className="flex items-center gap-3 text-xs">
                    {overdue > 0 && (
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {t('general_projects.milestone_template.overdue_count', { count: overdue })}
                      </span>
                    )}
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                      {t('general_projects.milestone_template.phase_progress', { done, total })}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
              {expanded && (
                <div className="relative pt-1">
                  {bucket.items.map((m, idx) => renderMilestoneCard(m, idx, bucket.items.length))}
                </div>
              )}
            </div>
          )
        })}
        {renderSummary()}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        {sortedMilestones.map((milestone, index) =>
          renderMilestoneCard(milestone, index, sortedMilestones.length)
        )}
      </div>

      {renderSummary()}
    </div>
  )
}

export default MilestoneTimeline
