import React from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, ArrowLeft } from 'lucide-react'
import { ProjectWithBuildings, OnSelectBuildingCallback, OnDeleteBuildingCallback } from './types'
import { Button } from '../../ui'

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
  const { t } = useTranslation()
  return (
    <div>
      <Button variant="ghost" icon={ArrowLeft} onClick={onBack}>
        {t('sales_projects.back_to_projects')}
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {project.buildings.map((building) => (
          <div
            key={building.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 cursor-pointer" onClick={() => onSelectBuilding(building)}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{building.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{building.total_floors} {t('sales_projects.floors')}</p>
              </div>
              <button
                onClick={() => onDeleteBuilding(building.id)}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center">
                <p className="text-lg font-bold text-blue-600">{building.total_apartments}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{t('sales_projects.units.apartments')}</p>
                <p className="text-xs text-green-600">{building.sold_apartments} {t('sales_projects.sold')}</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-orange-600">{building.total_garages}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{t('sales_projects.units.garages')}</p>
                <p className="text-xs text-green-600">{building.sold_garages} {t('sales_projects.sold')}</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-600">{building.total_repositories}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{t('sales_projects.units.repositories')}</p>
                <p className="text-xs text-green-600">{building.sold_repositories} {t('sales_projects.sold')}</p>
              </div>
            </div>

            <div className="border-t dark:border-gray-700 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">{t('sales_projects.revenue')}</span>
                <span className="font-bold text-green-600">€{building.total_revenue.toLocaleString('hr-HR')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
