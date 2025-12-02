import React, { useState } from 'react'
import { Plus, ArrowLeft, RefreshCw } from 'lucide-react'
import { ProjectsGrid } from './views/ProjectsGrid'
import { ProjectDetail } from './views/ProjectDetail'
import { ProjectFormModal } from './forms/ProjectFormModal'
import { useRetailProjects } from './hooks/useRetailProjects'
import type { RetailProjectWithPhases } from '../../../types/retail'

const RetailProjects: React.FC = () => {
  const { projects, loading, refetch } = useRetailProjects()
  const [selectedProject, setSelectedProject] = useState<RetailProjectWithPhases | null>(null)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetch()
    setIsRefreshing(false)
  }

  const handleProjectCreated = async () => {
    setShowProjectModal(false)
    await refetch()
  }

  const handleBackToList = () => {
    setSelectedProject(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Učitavam projekte...</p>
        </div>
      </div>
    )
  }

  if (selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        onBack={handleBackToList}
        onRefresh={handleRefresh}
      />
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Retail Projekti</h1>
          <p className="text-gray-600 mt-2">Upravljanje projektima razvoja zemljišta</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Osvježi
          </button>
          <button
            onClick={() => setShowProjectModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Dodaj projekt
          </button>
        </div>
      </div>

      <ProjectsGrid
        projects={projects}
        onSelectProject={setSelectedProject}
      />

      {showProjectModal && (
        <ProjectFormModal
          onClose={() => setShowProjectModal(false)}
          onSuccess={handleProjectCreated}
        />
      )}
    </div>
  )
}

export default RetailProjects
