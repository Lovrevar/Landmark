import React from 'react'
import { Building2, ArrowRight, RefreshCw } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { ProjectWithPhases, OnSelectProjectCallback } from '../types/siteTypes'

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
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
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
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {project.status}
                    </span>
                    {project.has_phases ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                        {project.phases.length} Phases
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                        No Phases
                      </span>
                    )}
                    {project.overdue_subcontractors > 0 && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        {project.overdue_subcontractors} Overdue
                      </span>
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
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Projects Found</h3>
          <p className="text-gray-600">No construction projects available for site management.</p>
        </div>
      )}
    </div>
  )
}
