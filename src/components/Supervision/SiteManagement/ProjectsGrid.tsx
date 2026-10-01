import React from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, ArrowRight, RefreshCw } from 'lucide-react'
import { ProjectWithPhases, OnSelectProjectCallback } from './types'
import { projectTimeline, PROJECT_TIMELINE_TONE } from '../../../utils/projectTimeline'
import { Button, Badge, EmptyState, ErrorState, Alert } from '../../ui'
import ProjectCategoryBadge from '../../Common/ProjectCategoryBadge'
import { formatEuroCompact } from '../../../utils/formatters'
import { PROJECT_STATUS, statusVariant, statusLabel } from '../../../utils/statusDisplay'

interface ProjectsGridProps {
  projects: ProjectWithPhases[]
  onSelectProject: OnSelectProjectCallback
  onRefresh?: () => void
  isRefreshing?: boolean
  emptyStateVariant?: 'no_projects' | 'no_assignments'
  /** Set when the last load failed. Replaces the grid when nothing loaded, warns above it when something did. */
  error?: Error | null
  /**
   * False hides every figure derived from payments: the paid segment of the allocation bar and
   * its legend, the "paid out" line, and the overdue badge — which counts contracts whose
   * deadline has passed **and** that are not paid in full.
   */
  canManagePayments: boolean
}

export const ProjectsGrid: React.FC<ProjectsGridProps> = ({ projects, onSelectProject, onRefresh, isRefreshing = false, emptyStateVariant = 'no_projects', error = null, canManagePayments }) => {
  const { t } = useTranslation()
  const [errorDismissed, setErrorDismissed] = React.useState(false)
  // A failed load must never render as "no projects on site" — the two look identical otherwise,
  // and this screen is where a supervisor decides there is nothing to visit.
  const failedWithNothing = !!error && projects.length === 0

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('supervision.site_management.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{t('supervision.site_management.projects_grid.subtitle')}</p>
        </div>
        {onRefresh && (
          <Button
            onClick={onRefresh}
            icon={RefreshCw}
            loading={isRefreshing}
          >
            {t('common.refresh')}
          </Button>
        )}
      </div>

      {failedWithNothing ? (
        <ErrorState onRetry={onRefresh} />
      ) : (
      <>
      {error && !errorDismissed && (
        <Alert variant="error" className="mb-6" onDismiss={() => setErrorDismissed(true)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{t('common.load_error_description')}</span>
            {onRefresh && (
              <Button size="sm" variant="secondary" onClick={onRefresh} loading={isRefreshing}>
                {t('common.retry')}
              </Button>
            )}
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          // The TIC is the only writer of planned budget, so `project.budget` means nothing
          // until one exists — and the detail screen already says so. Without this gate the card
          // shows a stale typed figure that the very next click contradicts.
          const hasBudget = project.tic_total !== null && project.tic_total > 0
          // One rule for "where is this against its end date" (src/utils/projectTimeline.ts):
          // a Completed project is never overdue, and the end date itself is not yet late.
          const timeline = projectTimeline(project.status, project.end_date)

          return (
            <div
              key={project.id}
              onClick={() => onSelectProject(project)}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 cursor-pointer hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{project.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{project.location}</p>
                  <div className="flex items-center space-x-2">
                    <Badge variant={statusVariant(PROJECT_STATUS, project.status)} size="sm">
                      {statusLabel(PROJECT_STATUS, project.status, t)}
                    </Badge>
                    <ProjectCategoryBadge category={project.category} />
                    {project.has_phases ? (
                      <Badge variant="blue" size="sm">
                        {project.phases.length} {t('supervision.site_management.projects_grid.phases')}
                      </Badge>
                    ) : (
                      <Badge variant="orange" size="sm">
                        {t('supervision.site_management.projects_grid.no_phases')}
                      </Badge>
                    )}
                    {/* "Overdue" here means past deadline AND not paid in full, so the count
                        is a payment fact. */}
                    {canManagePayments && project.overdue_subcontractors > 0 && (
                      <Badge variant="red" size="sm">
                        {project.overdue_subcontractors} {t('supervision.site_management.projects_grid.overdue')}
                      </Badge>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>

              <div className="space-y-3">
                {hasBudget && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('supervision.site_management.projects_grid.budget_allocation')}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {project.budget > 0 ? ((project.total_contracted / project.budget) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 overflow-hidden">
                    {(() => {
                      const contractedPct = project.budget > 0 ? Math.min((project.total_contracted / project.budget) * 100, 100) : 0
                      const paidPct = project.budget > 0 ? Math.min((project.total_paid_out / project.budget) * 100, 100) : 0
                      const remainingContractedPct = Math.max(contractedPct - paidPct, 0)
                      // Without payment rights the bar is one contracted segment: splitting it
                      // would draw the paid figure the rest of the card is hiding.
                      return canManagePayments ? (
                        <div className="h-full flex rounded-full overflow-hidden">
                          {/* Teal is paid everywhere else in Supervision; this bar was the one
                              place that painted it orange, the colour used for unpaid. */}
                          <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${paidPct}%` }} />
                          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${remainingContractedPct}%` }} />
                        </div>
                      ) : (
                        <div className="h-full flex rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${contractedPct}%` }} />
                        </div>
                      )
                    })()}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {canManagePayments && (
                      <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="inline-block w-2 h-2 rounded-full bg-teal-500"></span>
                        {t('common.paid')}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                      {t('supervision.site_management.projects_grid.contracted')}
                    </span>
                  </div>
                </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">{t('supervision.site_management.projects_grid.budget')}</p>
                    {hasBudget ? (
                      <p className="font-medium text-gray-900 dark:text-white">{formatEuroCompact(project.budget)}</p>
                    ) : (
                      <p className="font-medium text-orange-600 dark:text-orange-400">
                        {t('general_projects.budget_not_set')}
                      </p>
                    )}
                    {hasBudget && project.has_phases && (
                      <>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatEuroCompact(project.total_budget_allocated)} {t('supervision.site_management.projects_grid.allocated')}
                        </p>
                        {canManagePayments && (
                          <p className="text-xs text-teal-600 dark:text-teal-400 font-medium">
                            {formatEuroCompact(project.total_paid_out)} {t('supervision.site_management.projects_grid.paid_out')}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">{t('supervision.subcontractors.title')}</p>
                    <p className="font-medium text-gray-900 dark:text-white">{project.subcontractors.length}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatEuroCompact(project.total_subcontractor_cost)} {t('supervision.site_management.projects_grid.costs')}
                    </p>
                  </div>
                </div>

                {timeline.state !== 'no_end_date' && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{t('supervision.site_management.projects_grid.timeline')}</span>
                    <span className={`font-medium ${PROJECT_TIMELINE_TONE[timeline.state]}`}>
                      {timeline.state === 'completed'
                        ? t('status.completed')
                        : timeline.state === 'due_today'
                          ? t('common.due_today')
                          : timeline.state === 'overdue'
                            ? t('supervision.site_management.projects_grid.days_overdue', { count: Math.abs(timeline.days!) })
                            : t('supervision.site_management.projects_grid.days_left', { count: timeline.days! })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {projects.length === 0 && (
        <EmptyState
          icon={Building2}
          title={t(
            emptyStateVariant === 'no_assignments'
              ? 'supervision.site_management.projects_grid.no_assignments_title'
              : 'supervision.site_management.projects_grid.no_projects'
          )}
          description={t(
            emptyStateVariant === 'no_assignments'
              ? 'supervision.site_management.projects_grid.no_assignments_hint'
              : 'supervision.site_management.projects_grid.no_projects_desc'
          )}
        />
      )}
      </>
      )}
    </div>
  )
}
