import React from 'react'
import { Building2, ArrowRight, RefreshCw } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { ProjectWithPhases, OnSelectProjectCallback } from '../types/siteTypes'
import { Button, Badge, EmptyState } from '../../ui'

interface ProjectsGridProps {
  projects: ProjectWithPhases[]
  onSelectProject: OnSelectProjectCallback
  onRefresh?: () => void
  isRefreshing?: boolean
}

export const ProjectsGrid: React.FC<ProjectsGridProps> = ({ projects, onSelectProject, onRefresh, isRefreshing = false }) => {
  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Site Management</h1>
          <p className="text-gray-600 mt-2">Manage construction phases and subcontractors by project</p>
        </div>
        {onRefresh && (
          <Button
            onClick={onRefresh}
            icon={RefreshCw}
            loading={isRefreshing}
          >
            Refresh Data
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
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{project.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{project.location}</p>
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
                        {project.phases.length} Phases
                      </Badge>
                    ) : (
                      <Badge variant="orange" size="sm">
                        No Phases
                      </Badge>
                    )}
                    {project.overdue_subcontractors > 0 && (
                      <Badge variant="red" size="sm">
                        {project.overdue_subcontractors} Overdue
                      </Badge>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Overall Progress</span>
                    <span className="text-sm font-medium text-gray-900">{project.completion_percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${project.completion_percentage}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Budget</p>
                    <p className="font-medium text-gray-900">€{(project.budget / 1000000).toFixed(1)}M</p>
                    {project.has_phases && (
                      <>
                        <p className="text-xs text-gray-500">
                          €{(project.total_budget_allocated / 1000000).toFixed(1)}M allocated
                        </p>
                        <p className="text-xs text-teal-600 font-medium">
                          €{(project.total_paid_out / 1000000).toFixed(1)}M paid out
                        </p>
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-600">Subcontractors</p>
                    <p className="font-medium text-gray-900">{project.subcontractors.length}</p>
                    <p className="text-xs text-gray-500">
                      €{(project.total_subcontractor_cost / 1000000).toFixed(1)}M costs
                    </p>
                  </div>
                </div>

                {daysRemaining !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Timeline</span>
                    <span className={`font-medium ${
                      isProjectOverdue ? 'text-red-600' : daysRemaining < 30 ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {daysRemaining >= 0 ? `${daysRemaining} days left` : `${Math.abs(daysRemaining)} days overdue`}
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
          title="No projects available"
          description="Projects will appear here once they are created."
        />
      )}
    </div>
  )
}
