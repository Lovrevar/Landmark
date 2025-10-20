import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { ProjectWithBuildings } from '../types/salesTypes'

export const useSalesData = () => {
  const [projects, setProjects] = useState<ProjectWithBuildings[]>([])
  const [garages, setGarages] = useState<any[]>([])
  const [repositories, setRepositories] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .order('name')

      const { data: buildingsData } = await supabase
        .from('buildings')
        .select('*')

      const { data: garagesData } = await supabase
        .from('garages')
        .select('*')

      const { data: repositoriesData } = await supabase
        .from('repositories')
        .select('*')

      const { data: customersData } = await supabase
        .from('customers')
        .select('*')

      const enrichedProjects = (projectsData || []).map(project => ({
        ...project,
        buildings: (buildingsData || []).filter((b: any) => b.project_id === project.id),
        building_count: (buildingsData || []).filter((b: any) => b.project_id === project.id).length
      }))

      setProjects(enrichedProjects)
      setGarages(garagesData || [])
      setRepositories(repositoriesData || [])
      setCustomers(customersData || [])
    } catch (error) {
      console.error('Error fetching sales data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return {
    projects,
    garages,
    repositories,
    customers,
    loading,
    refetch: fetchData
  }
}
