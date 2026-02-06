import React from 'react'
import { MapPin, ArrowRight, DollarSign, Layers, Link, Edit2 } from 'lucide-react'
import { Button, Badge, EmptyState } from '../../../../components/ui'
import type { RetailProjectWithPhases } from '../../../../types/retail'

interface ProjectsGridProps {
  projects: RetailProjectWithPhases[]
  onSelectProject: (project: RetailProjectWithPhases) => void
  onEditProject: (project: RetailProjectWithPhases) => void
}

export const ProjectsGrid: React.FC<ProjectsGridProps> = ({ projects, onSelectProject, onEditProject }) => {
  const getStatusBadgeVariant = (status: string): 'green' | 'blue' | 'yellow' | 'gray' => {
    switch (status) {
      case 'Completed':
        return 'green'
      case 'In Progress':
        return 'blue'
      case 'Planning':
        return 'yellow'
      case 'On Hold':
        return 'gray'
      default:
        return 'gray'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hr-HR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <div
          key={project.id}
          onClick={() => onSelectProject(project)}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-lg transition-all duration-200"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{project.name}</h3>
              <div className="flex items-center text-sm text-gray-600 mb-2">
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
                    Povezano zemljište
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Broj čestice:</span>
              <span className="text-sm font-semibold text-gray-900">{project.plot_number}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Površina:</span>
              <span className="text-sm font-semibold text-gray-900">{project.total_area_m2.toLocaleString()} m²</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Budžet projekta:</span>
              <span className="text-sm font-semibold text-gray-900">{formatCurrency(project.purchase_price)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Cijena po m²:</span>
              <span className="text-sm font-semibold text-gray-900">{formatCurrency(project.price_per_m2)}</span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="flex items-center text-sm text-gray-600">
                <Layers className="w-4 h-4 mr-1" />
                Faze:
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
              Uredi
            </Button>
            <Button
              size="sm"
              iconRight={ArrowRight}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                onSelectProject(project)
              }}
            >
              Otvori
            </Button>
          </div>
        </div>
      ))}

      {projects.length === 0 && (
        <div className="col-span-full">
          <EmptyState
            icon={MapPin}
            title="Nema projekata"
            description="Kliknite 'Dodaj projekt' da kreirate prvi projekt"
          />
        </div>
      )}
    </div>
  )
}
