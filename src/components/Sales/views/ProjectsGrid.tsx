import React from 'react'
import { ProjectWithBuildings } from '../types/salesTypes'
import { Building2 } from 'lucide-react'

interface ProjectsGridProps {
  projects: ProjectWithBuildings[]
  onSelectProject: (project: ProjectWithBuildings) => void
}

export const ProjectsGrid: React.FC<ProjectsGridProps> = ({ projects, onSelectProject }) => {
  if (projects.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500">No projects available</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <div
          key={project.id}
          onClick={() => onSelectProject(project)}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 cursor-pointer"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{project.name}</h3>
          <p className="text-sm text-gray-600 mb-4">{project.location}</p>
          <div className="flex items-center text-sm text-gray-600">
            <Building2 className="w-4 h-4 mr-1" />
            {project.building_count || 0} buildings
          </div>
        </div>
      ))}
    </div>
  )
}
