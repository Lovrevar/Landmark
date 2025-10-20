import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { ProjectWithBuildings, BuildingWithUnits } from '../types/salesTypes'

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

      const { data: apartmentsData } = await supabase
        .from('apartments')
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

      // Enrich buildings with their units
      const enrichedBuildings = (buildingsData || []).map(building => ({
        ...building,
        apartments: (apartmentsData || []).filter((a: any) => a.building_id === building.id),
        garages: (garagesData || []).filter((g: any) => g.building_id === building.id),
        repositories: (repositoriesData || []).filter((r: any) => r.building_id === building.id)
      })) as BuildingWithUnits[]

      // Enrich projects with their buildings
      const enrichedProjects = (projectsData || []).map(project => ({
        ...project,
        buildings: enrichedBuildings.filter((b: any) => b.project_id === project.id),
        building_count: enrichedBuildings.filter((b: any) => b.project_id === project.id).length
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
