import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderKanban, Plus } from 'lucide-react'
import { LoadingSpinner, PageHeader, SearchInput, Select, EmptyState, Button } from '../../ui'
import { fetchProjectsWithStats } from './services/projectService'
import type { ProjectWithStats } from './types'
import ProjectCard from './ProjectCard'
import ProjectFormModal from './forms/ProjectFormModal'

const ProjectsManagement: React.FC = () => {
  const { t } = useTranslation()
  const [projects, setProjects] = useState<ProjectWithStats[]>([])
  const [filteredProjects, setFilteredProjects] = useState<ProjectWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    filterProjects()
  }, [projects, searchTerm, statusFilter])

  const loadProjects = async () => {
    try {
      setLoading(true)
      const data = await fetchProjectsWithStats()
      setProjects(data)
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterProjects = () => {
    let filtered = projects
    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.location.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter)
    }
    setFilteredProjects(filtered)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('general_projects.title')}
        description={t('general_projects.subtitle')}
        actions={
          <Button icon={Plus} onClick={() => setShowNewProjectModal(true)}>
            {t('general_projects.new_project')}
          </Button>
        }
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <SearchInput
            className="flex-1"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm('')}
            placeholder={t('general_projects.search')}
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">{t('general_projects.all_statuses')}</option>
            <option value="Planning">{t('status.planning')}</option>
            <option value="In Progress">{t('status.in_progress')}</option>
            <option value="Completed">{t('status.completed')}</option>
            <option value="On Hold">{t('status.on_hold')}</option>
          </Select>
        </div>

        {loading ? (
          <LoadingSpinner message={t('general_projects.loading')} />
        ) : filteredProjects.length === 0 ? (
          <EmptyState icon={FolderKanban} title={t('general_projects.no_projects')} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {showNewProjectModal && (
        <ProjectFormModal
          onClose={() => setShowNewProjectModal(false)}
          onSuccess={() => {
            setShowNewProjectModal(false)
            loadProjects()
          }}
        />
      )}
    </div>
  )
}

export default ProjectsManagement
