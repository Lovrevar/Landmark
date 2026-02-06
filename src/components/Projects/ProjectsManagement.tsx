import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  FolderKanban,
  Plus,
  MapPin,
  Calendar,
  TrendingUp,
  CheckCircle,
  Clock,
  Pause,
  Eye
} from 'lucide-react'
import { LoadingSpinner, PageHeader, SearchInput, Select, Button, Badge, EmptyState } from '../ui'
import { format, differenceInDays, parseISO } from 'date-fns'
import ProjectFormModal from './ProjectFormModal'

interface Project {
  id: string
  name: string
  location: string
  start_date: string
  end_date: string | null
  budget: number
  investor: string | null
  status: string
  created_at: string
}

interface ProjectStats {
  total_spent: number
  completion_percentage: number
  milestones_completed: number
  milestones_total: number
}

interface ProjectWithStats extends Project {
  stats: ProjectStats
}

const ProjectsManagement: React.FC = () => {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectWithStats[]>([])
  const [filteredProjects, setFilteredProjects] = useState<ProjectWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    filterProjects()
  }, [projects, searchTerm, statusFilter])

  const fetchProjects = async () => {
    try {
      setLoading(true)

      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const projectsWithStats = await Promise.all(
        (projectsData || []).map(async (project) => {
          const { data: contractsData } = await supabase
            .from('contracts')
            .select('budget_realized')
            .eq('project_id', project.id)

          const { data: milestonesData } = await supabase
            .from('project_milestones')
            .select('id, completed')
            .eq('project_id', project.id)

          const totalSpent = contractsData?.reduce((sum, c) => sum + Number(c.budget_realized || 0), 0) || 0
          const milestonesTotal = milestonesData?.length || 0
          const milestonesCompleted = milestonesData?.filter(m => m.completed).length || 0
          const completionPercentage = milestonesTotal > 0
            ? Math.round((milestonesCompleted / milestonesTotal) * 100)
            : 0

          return {
            ...project,
            stats: {
              total_spent: totalSpent,
              completion_percentage: completionPercentage,
              milestones_completed: milestonesCompleted,
              milestones_total: milestonesTotal
            }
          }
        })
      )

      setProjects(projectsWithStats)
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

  const getStatusConfig = (status: string) => {
    const configs = {
      'Planning': { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Planning' },
      'In Progress': { icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-100', label: 'In Progress' },
      'Completed': { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Completed' },
      'On Hold': { icon: Pause, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'On Hold' }
    }
    return configs[status as keyof typeof configs] || configs['Planning']
  }

  const getDaysInfo = (startDate: string, endDate: string | null) => {
    const start = parseISO(startDate)
    const end = endDate ? parseISO(endDate) : new Date()
    const today = new Date()

    if (endDate && parseISO(endDate) < today) {
      return { text: 'Completed', color: 'text-green-600' }
    }

    const daysElapsed = differenceInDays(today, start)
    if (endDate) {
      const totalDays = differenceInDays(parseISO(endDate), start)
      const daysRemaining = differenceInDays(parseISO(endDate), today)
      return {
        text: daysRemaining > 0 ? `${daysRemaining} days left` : 'Overdue',
        color: daysRemaining > 0 ? 'text-gray-600' : 'text-red-600'
      }
    }

    return { text: `${daysElapsed} days elapsed`, color: 'text-gray-600' }
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
            {filteredProjects.map((project) => {
              const statusConfig = getStatusConfig(project.status)
              const daysInfo = getDaysInfo(project.start_date, project.end_date)

              return (
                <div
                  key={project.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{project.name}</h3>
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="w-4 h-4 mr-1" />
                        {project.location}
                      </div>
                    </div>
                    <Badge variant={
                      project.status === 'Completed' ? 'green'
                        : project.status === 'In Progress' ? 'blue'
                        : project.status === 'On Hold' ? 'yellow'
                        : 'gray'
                    } size="sm">
                      {statusConfig.label}
                    </Badge>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Budget</span>
                      <span className="font-semibold text-gray-900">€{project.budget.toLocaleString('hr-HR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Spent</span>
                      <span className="font-semibold text-blue-600">€{project.stats.total_spent.toLocaleString('hr-HR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Remaining</span>
                      <span className="font-semibold text-green-600">
                        €{(project.budget - project.stats.total_spent).toLocaleString('hr-HR')}
                      </span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-semibold text-gray-900">{project.stats.completion_percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${project.stats.completion_percentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-sm border-t border-gray-200 pt-4">
                    <div className="flex items-center text-gray-600">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span className={daysInfo.color}>{daysInfo.text}</span>
                    </div>
                    <div className="text-gray-600">
                      <span className="font-semibold">{project.stats.milestones_completed}</span>
                      <span>/{project.stats.milestones_total} milestones</span>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    icon={Eye}
                    fullWidth
                    className="mt-4"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/projects/${project.id}`)
                    }}
                  >
                    View Details
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showNewProjectModal && (
        <ProjectFormModal
          onClose={() => setShowNewProjectModal(false)}
          onSuccess={() => {
            setShowNewProjectModal(false)
            fetchProjects()
          }}
        />
      )}
    </div>
  )
}

export default ProjectsManagement
