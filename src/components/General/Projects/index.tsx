import React, { useState, useEffect } from 'react'
import { FolderKanban, Plus } from 'lucide-react'
import { LoadingSpinner, PageHeader, SearchInput, Select, EmptyState, Button } from '../../Ui'
import { fetchProjectsWithStats } from './Services/projectService'
import type { ProjectWithStats } from './types'
import ProjectCard from './ProjectCard'
import ProjectFormModal from './Forms/ProjectFormModal'

const ProjectsManagement: React.FC = () => {
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
        title="Projects"
        description="Manage all your projects and milestones"
        actions={
          <Button icon={Plus} onClick={() => setShowNewProjectModal(true)}>
            New Project
          </Button>
        }
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <SearchInput
            className="flex-1"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClear={() => setSearchTerm('')}
            placeholder="Search projects..."
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="Planning">Planning</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="On Hold">On Hold</option>
          </Select>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading projects..." />
        ) : filteredProjects.length === 0 ? (
          <EmptyState icon={FolderKanban} title="No projects found" />
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
