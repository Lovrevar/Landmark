import React from 'react'
import { ProjectWithBuildings } from '../../types'
import { ProgressBar } from '../shared/ProgressBar'
import { RevenueBadge } from '../shared/RevenueBadge'
import { StatusPill } from '../shared/StatusPill'

interface ProjectsViewProps {
  projects: ProjectWithBuildings[]
  onSelectProject: (project: ProjectWithBuildings) => void
}

export function ProjectsView({ projects, onSelectProject }: ProjectsViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <div
          key={project.id}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer"
          onClick={() => onSelectProject(project)}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{project.name}</h3>
              <p className="text-sm text-gray-600">{project.location}</p>
            </div>
            <StatusPill status={project.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{project.total_buildings}</p>
              <p className="text-xs text-gray-600">Buildings</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{project.total_units}</p>
              <p className="text-xs text-gray-600">Total Units</p>
            </div>
          </div>

          <ProgressBar
            current={project.sold_units}
            total={project.total_units}
            label="Sales Progress"
          />

          <RevenueBadge amount={project.total_revenue} />
        </div>
      ))}
    </div>
  )
}
