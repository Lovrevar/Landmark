import React from 'react'
import { ProjectWithBuildings, BuildingWithUnits } from '../types/salesTypes'
import { Building2, ArrowLeft, Trash2 } from 'lucide-react'

interface BuildingsGridProps {
  project: ProjectWithBuildings
  onSelectBuilding: (building: BuildingWithUnits) => void
  onDeleteBuilding: (buildingId: string) => void
  onBack: () => void
}

export const BuildingsGrid: React.FC<BuildingsGridProps> = ({
  project,
  onSelectBuilding,
  onDeleteBuilding,
  onBack
}) => {
  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Projects
      </button>

      {!project.buildings || project.buildings.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No buildings in this project</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {project.buildings.map((building) => (
            <div
              key={building.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{building.name}</h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteBuilding(building.id)
                  }}
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">{building.description || 'No description'}</p>
              <button
                onClick={() => onSelectBuilding(building as BuildingWithUnits)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                Manage Units
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
