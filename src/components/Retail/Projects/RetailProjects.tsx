import React, { useState } from 'react'
import { Plus, ArrowLeft, RefreshCw } from 'lucide-react'
import { ProjectsGrid } from './views/ProjectsGrid'
import { ProjectDetail } from './views/ProjectDetail'
import { ProjectFormModal } from './forms/ProjectFormModal'
import { useRetailProjects } from './hooks/useRetailProjects'
import type { RetailProjectWithPhases } from '../../../types/retail'
import { LoadingSpinner, PageHeader } from '../../ui'

const RetailProjects: React.FC = () => {
  const { projects, loading, refetch } = useRetailProjects()
  const [selectedProject, setSelectedProject] = useState<RetailProjectWithPhases | null>(null)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [editingProject, setEditingProject] = useState<RetailProjectWithPhases | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetch()
    setIsRefreshing(false)
  }

  const handleProjectCreated = async () => {
    setShowProjectModal(false)
    setEditingProject(null)
    await refetch()
  }

  const handleEditProject = (project: RetailProjectWithPhases) => {
    setEditingProject(project)
  }

  const handleBackToList = () => {
    setSelectedProject(null)
  }

  if (loading) {
    return <LoadingSpinner message="Učitavam projekte..." size="lg" />
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
      <PageHeader
        title="Retail Projekti"
        description="Upravljanje projektima razvoja zemljišta"
        className="mb-6"
        actions={
          <>
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
          </>
        }
      />

      <ProjectsGrid
        projects={projects}
        onSelectProject={setSelectedProject}
        onEditProject={handleEditProject}
      />

      {(showProjectModal || editingProject) && (
        <ProjectFormModal
          onClose={() => {
            setShowProjectModal(false)
            setEditingProject(null)
          }}
          onSuccess={handleProjectCreated}
          project={editingProject || undefined}
        />
      )}
    </div>
  )
}

export default RetailProjects
