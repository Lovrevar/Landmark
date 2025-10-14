import React from 'react'
import { Card } from '../common/Card'
import { StatusBadge } from '../common/StatusBadge'
import { ProjectWithApartments } from '../../services/projectService'

interface ProjectsListProps {
  projects: ProjectWithApartments[]
  onProjectSelect: (project: ProjectWithApartments) => void
}

export const ProjectsList: React.FC<ProjectsListProps> = ({ projects, onProjectSelect }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {projects.map((project) => (
        <Card key={project.id} onClick={() => onProjectSelect(project)} hover>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{project.name}</h3>
                <p className="text-sm text-gray-600">{project.location}</p>
              </div>
              <StatusBadge status={project.status} />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{project.total_units}</p>
                <p className="text-xs text-gray-600">Total Units</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{project.sold_units}</p>
                <p className="text-xs text-gray-600">Sold</p>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Sales Progress</span>
                <span className="text-sm font-medium">
                  {project.total_units > 0 ? ((project.sold_units / project.total_units) * 100).toFixed(1) : '0'}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${project.total_units > 0 ? (project.sold_units / project.total_units) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Revenue</span>
                <span className="font-bold text-green-600">€{project.total_revenue.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
