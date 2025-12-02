import React, { useState, useEffect } from 'react'
import { ArrowLeft, MapPin, DollarSign, Layers, Plus, Edit2, Trash2 } from 'lucide-react'
import { retailProjectService } from '../services/retailProjectService'
import type { RetailProjectWithPhases, RetailProjectPhase } from '../../../../types/retail'

interface ProjectDetailProps {
  project: RetailProjectWithPhases
  onBack: () => void
  onRefresh: () => void
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({ project: initialProject, onBack, onRefresh }) => {
  const [project, setProject] = useState(initialProject)
  const [selectedPhase, setSelectedPhase] = useState<RetailProjectPhase | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadProjectDetails()
  }, [initialProject.id])

  const loadProjectDetails = async () => {
    try {
      setLoading(true)
      const data = await retailProjectService.fetchProjectById(initialProject.id)
      if (data) {
        setProject(data)
      }
    } catch (error) {
      console.error('Error loading project details:', error)
    } finally {
      setLoading(false)
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

  const getPhaseTypeLabel = (type: string) => {
    switch (type) {
      case 'acquisition':
        return 'Stjecanje zemljišta'
      case 'development':
        return 'Razvoj'
      case 'sales':
        return 'Prodaja'
      default:
        return type
    }
  }

  const getPhaseStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800'
      case 'In Progress':
        return 'bg-blue-100 text-blue-800'
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Nazad na projekte
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.name}</h1>
            <div className="flex items-center text-gray-600 mb-4">
              <MapPin className="w-5 h-5 mr-2" />
              {project.location} - Čestica: {project.plot_number}
            </div>
          </div>
          <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
            project.status === 'Completed' ? 'bg-green-100 text-green-800' :
            project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
            project.status === 'Planning' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {project.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-600 mb-1">Površina</div>
            <div className="text-2xl font-bold text-blue-900">{project.total_area_m2.toLocaleString()} m²</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600 mb-1">Cijena kupovine</div>
            <div className="text-2xl font-bold text-green-900">{formatCurrency(project.purchase_price)}</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-sm text-purple-600 mb-1">Cijena po m²</div>
            <div className="text-2xl font-bold text-purple-900">{formatCurrency(project.price_per_m2)}</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm text-orange-600 mb-1">Broj faza</div>
            <div className="text-2xl font-bold text-orange-900">{project.phases.length}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Faze projekta</h2>
          <button
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Dodaj fazu
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {project.phases.length === 0 ? (
              <div className="text-center py-12">
                <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Nema definisanih faza</p>
                <p className="text-gray-400 text-sm mt-2">Kliknite "Dodaj fazu" da kreirate prvu fazu</p>
              </div>
            ) : (
              project.phases.map((phase) => (
                <div
                  key={phase.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setSelectedPhase(phase)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-lg font-semibold text-gray-900">{phase.phase_name}</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPhaseStatusColor(phase.status)}`}>
                          {phase.status}
                        </span>
                        <span className="text-sm text-gray-500">
                          ({getPhaseTypeLabel(phase.phase_type)})
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <DollarSign className="w-4 h-4 mr-1" />
                          Budget: {formatCurrency(phase.budget_allocated)}
                        </div>
                        <div>Redoslijed: #{phase.phase_order}</div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {project.notes && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Napomene</h3>
          <p className="text-gray-600 whitespace-pre-wrap">{project.notes}</p>
        </div>
      )}
    </div>
  )
}
