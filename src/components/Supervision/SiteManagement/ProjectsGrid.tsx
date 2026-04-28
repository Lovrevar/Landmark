import React from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, ArrowRight, RefreshCw } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { ProjectWithPhases, OnSelectProjectCallback } from './types'
import { Button, Badge, EmptyState } from '../../ui'

interface ProjectsGridProps {
  projects: ProjectWithPhases[]
  onSelectProject: OnSelectProjectCallback
  onRefresh?: () => void
  isRefreshing?: boolean
  emptyStateVariant?: 'no_projects' | 'no_assignments'
}

export const ProjectsGrid: React.FC<ProjectsGridProps> = ({ projects, onSelectProject, onRefresh, isRefreshing = false, emptyStateVariant = 'no_projects' }) => {
  const { t } = useTranslation()
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          const daysRemaining = project.end_date ? differenceInDays(new Date(project.end_date), new Date()) : null
          const isProjectOverdue = daysRemaining !== null && daysRemaining < 0 && project.status !== 'Completed'

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
                    <Badge variant={
                      project.status === 'Completed' ? 'green' :
                      project.status === 'In Progress' ? 'blue' :
                      'gray'
                    } size="sm">
                      {project.status}
                    </Badge>
                    {project.has_phases ? (
                      <Badge variant="blue" size="sm">
                        {project.phases.length} {t('supervision.site_management.projects_grid.phases')}
                      </Badge>
                    ) : (
                      <Badge variant="orange" size="sm">
                        {t('supervision.site_management.projects_grid.no_phases')}
                      </Badge>
                    )}
                    {project.overdue_subcontractors > 0 && (
                      <Badge variant="red" size="sm">
                        {project.overdue_subcontractors} {t('supervision.site_management.projects_grid.overdue')}
                      </Badge>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>

              <div className="space-y-3">
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
                      return (
                        <div className="h-full flex rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${paidPct}%` }} />
                          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${remainingContractedPct}%` }} />
                        </div>
                      )
                    })()}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-block w-2 h-2 rounded-full bg-orange-500"></span>
                      {t('common.paid')}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                      {t('supervision.site_management.projects_grid.contracted')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">{t('supervision.site_management.projects_grid.budget')}</p>
                    <p className="font-medium text-gray-900 dark:text-white">€{(project.budget / 1000000).toFixed(1)}M</p>
                    {project.has_phases && (
                      <>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          €{(project.total_budget_allocated / 1000000).toFixed(1)}M {t('supervision.site_management.projects_grid.allocated')}
                        </p>
                        <p className="text-xs text-teal-600 font-medium">
                          €{(project.total_paid_out / 1000000).toFixed(1)}M {t('supervision.site_management.projects_grid.paid_out')}
                        </p>
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">{t('supervision.subcontractors.title')}</p>
                    <p className="font-medium text-gray-900 dark:text-white">{project.subcontractors.length}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      €{(project.total_subcontractor_cost / 1000000).toFixed(1)}M {t('supervision.site_management.projects_grid.costs')}
                    </p>
                  </div>
                </div>

                {daysRemaining !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{t('supervision.site_management.projects_grid.timeline')}</span>
                    <span className={`font-medium ${
                      isProjectOverdue ? 'text-red-600' : daysRemaining < 30 ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {daysRemaining >= 0
                        ? t('supervision.site_management.projects_grid.days_left', { count: daysRemaining })
                        : t('supervision.site_management.projects_grid.days_overdue', { count: Math.abs(daysRemaining) })}
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
    </div>
  )
}
