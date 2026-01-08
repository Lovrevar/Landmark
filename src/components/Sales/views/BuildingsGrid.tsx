import React from 'react'
import { Trash2 } from 'lucide-react'
import { ProjectWithBuildings, OnSelectBuildingCallback, OnDeleteBuildingCallback } from '../types/salesTypes'

interface BuildingsGridProps {
  project: ProjectWithBuildings
  onSelectBuilding: OnSelectBuildingCallback
  onDeleteBuilding: OnDeleteBuildingCallback
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
        className="mb-4 text-gray-600 hover:text-gray-900"
      >
        ← Back to Projects
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {project.buildings.map((building) => (
          <div
            key={building.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 cursor-pointer" onClick={() => onSelectBuilding(building)}>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{building.name}</h3>
                <p className="text-sm text-gray-600">{building.total_floors} floors</p>
              </div>
              <button
                onClick={() => onDeleteBuilding(building.id)}
                className="p-1 text-gray-400 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center">
                <p className="text-lg font-bold text-blue-600">{building.total_apartments}</p>
                <p className="text-xs text-gray-600">Apartments</p>
                <p className="text-xs text-green-600">{building.sold_apartments} sold</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-orange-600">{building.total_garages}</p>
                <p className="text-xs text-gray-600">Garages</p>
                <p className="text-xs text-green-600">{building.sold_garages} sold</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-600">{building.total_repositories}</p>
                <p className="text-xs text-gray-600">Repositories</p>
                <p className="text-xs text-green-600">{building.sold_repositories} sold</p>
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Revenue</span>
                <span className="font-bold text-green-600">€{building.total_revenue.toLocaleString('hr-HR')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
