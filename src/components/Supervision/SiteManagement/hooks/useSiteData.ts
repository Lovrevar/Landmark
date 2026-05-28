import { useSiteProjectData } from './useSiteProjectData'
import { useProjectPhases } from './useProjectPhases'
import { useSubcontractorManagement } from './useSubcontractorManagement'
import { useSubcontractorComments } from './useSubcontractorComments'

export const useSiteData = () => {
  const { projects, loading, refreshing, existingSubcontractors, fetchProjects } = useSiteProjectData()
  const phases = useProjectPhases(fetchProjects)
  const subcontractors = useSubcontractorManagement(fetchProjects)
  const comments = useSubcontractorComments()

  return {
    projects,
    loading,
    refreshing,
    existingSubcontractors,
    fetchProjects,
    ...phases,
    ...subcontractors,
    ...comments
  }
}
