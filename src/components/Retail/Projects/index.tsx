import React, { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ProjectsGrid } from './ProjectsGrid'
import { ProjectDetail } from './ProjectDetail'
import { ProjectFormModal } from './forms/ProjectFormModal'
import { useRetailProjects } from './hooks/useRetailProjects'
import type { RetailProjectWithPhases } from '../../../types/retail'
import { LoadingSpinner, PageHeader, Button } from '../../ui'

const RetailProjects: React.FC = () => {
  const { t } = useTranslation()
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
    return <LoadingSpinner message={t('retail_projects.loading_projects')} size="lg" />
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
        title={t('retail_projects.title')}
        description={t('retail_projects.subtitle')}
        className="mb-6"
        actions={
          <>
            <Button
              variant="ghost"
              icon={RefreshCw}
              onClick={handleRefresh}
              loading={isRefreshing}
            >
              {t('common.refresh')}
            </Button>
            <Button
              icon={Plus}
              onClick={() => setShowProjectModal(true)}
            >
              {t('retail_projects.add')}
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
          project={editingProject as unknown as Record<string, unknown> | undefined}
        />
      )}
    </div>
  )
}

export default RetailProjects
