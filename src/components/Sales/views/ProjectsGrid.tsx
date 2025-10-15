import React from 'react'
import { ProjectWithBuildings, OnSelectProjectCallback } from '../types/salesTypes'

interface ProjectsGridProps {
  projects: ProjectWithBuildings[]
  onSelectProject: OnSelectProjectCallback
}

export const ProjectsGrid: React.FC<ProjectsGridProps> = ({ projects, onSelectProject }) => {
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
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
              project.status === 'Completed' ? 'bg-green-100 text-green-800' :
              project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {project.status}
            </span>
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
      ))}
    </div>
  )
}
