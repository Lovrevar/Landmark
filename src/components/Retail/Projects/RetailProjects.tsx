import React, { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { ProjectsGrid } from './views/ProjectsGrid'
import { ProjectDetail } from './views/ProjectDetail'
import { ProjectFormModal } from './forms/ProjectFormModal'
import { useRetailProjects } from './hooks/useRetailProjects'
import type { RetailProjectWithPhases } from '../../../types/retail'
import { LoadingSpinner, PageHeader, Button } from '../../ui'

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
            <Button
              variant="ghost"
              icon={RefreshCw}
              onClick={handleRefresh}
              loading={isRefreshing}
            >
              Osvježi
            </Button>
            <Button
              icon={Plus}
              onClick={() => setShowProjectModal(true)}
            >
              Dodaj projekt
            </Button>
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
