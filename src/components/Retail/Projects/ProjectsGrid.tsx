import React from 'react'
import { MapPin, ArrowRight, Layers, Link, Edit2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Badge, EmptyState } from '../../ui'
import type { RetailProjectWithPhases } from '../../../types/retail'
import { formatCurrency, getStatusBadgeVariant } from '../utils'

interface ProjectsGridProps {
  projects: RetailProjectWithPhases[]
  onSelectProject: (project: RetailProjectWithPhases) => void
  onEditProject: (project: RetailProjectWithPhases) => void
}

export const ProjectsGrid: React.FC<ProjectsGridProps> = ({ projects, onSelectProject, onEditProject }) => {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <div
          key={project.id}
          onClick={() => onSelectProject(project)}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 cursor-pointer hover:shadow-lg transition-all duration-200"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{project.name}</h3>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-2">
                <MapPin className="w-4 h-4 mr-1" />
                {project.location}
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={getStatusBadgeVariant(project.status)}>
                  {project.status}
                </Badge>
                {project.land_plot_id && (
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 flex items-center">
                    <Link className="w-3 h-3 mr-1" />
                    {t('retail_projects.linked_land')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('retail_projects.plot_number')}:</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{project.plot_number}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('retail_projects.area')}:</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{project.total_area_m2.toLocaleString()} m²</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('retail_projects.project_budget')}:</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(project.purchase_price)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('retail_projects.price_per_m2')}:</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(project.price_per_m2)}</span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Layers className="w-4 h-4 mr-1" />
                {t('common.phases')}:
              </div>
              <span className="text-sm font-semibold text-blue-600">{project.phases.length}</span>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button
              variant="ghost"
              icon={Edit2}
              size="sm"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                onEditProject(project)
              }}
            >
              {t('common.edit')}
            </Button>
            <Button
              size="sm"
              iconRight={ArrowRight}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                onSelectProject(project)
              }}
            >
              {t('retail_projects.open')}
            </Button>
          </div>
        </div>
      ))}

      {projects.length === 0 && (
        <div className="col-span-full">
          <EmptyState
            icon={MapPin}
            title={t('retail_projects.no_projects')}
            description={t('retail_projects.no_projects_desc')}
          />
        </div>
      )}
    </div>
  )
}
