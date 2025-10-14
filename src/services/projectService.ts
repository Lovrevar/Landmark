import { supabase, Project, ProjectPhase } from '../lib/supabase'
import { ApartmentWithSale, getApartmentsWithSales } from './apartmentService'

export interface ProjectWithApartments extends Project {
  apartments: ApartmentWithSale[]
  total_units: number
  sold_units: number
  available_units: number
  reserved_units: number
  total_revenue: number
  average_price: number
}

export interface ProjectWithPhases extends Project {
  phases: ProjectPhase[]
  completion_percentage: number
  total_budget_allocated: number
  total_paid_out: number
}

export async function getProjectsWithApartments(): Promise<ProjectWithApartments[]> {
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .order('name')

  if (projectsError) throw projectsError

  const apartments = await getApartmentsWithSales()

  return (projects || []).map(project => {
    const projectApartments = apartments.filter(apt => apt.project_id === project.id)
    const total_units = projectApartments.length
    const sold_units = projectApartments.filter(apt => apt.status === 'Sold').length
    const available_units = projectApartments.filter(apt => apt.status === 'Available').length
    const reserved_units = projectApartments.filter(apt => apt.status === 'Reserved').length
    const total_revenue = projectApartments
      .filter(apt => apt.status === 'Sold')
      .reduce((sum, apt) => sum + (apt.sale_info?.sale_price || apt.price), 0)
    const average_price = total_units > 0
      ? projectApartments.reduce((sum, apt) => sum + apt.price, 0) / total_units
      : 0

    return {
      ...project,
      apartments: projectApartments,
      total_units,
      sold_units,
      available_units,
      reserved_units,
      total_revenue,
      average_price
    }
  })
}

export async function getProjectsWithPhases(): Promise<ProjectWithPhases[]> {
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .order('name')

  if (projectsError) throw projectsError

  const { data: phases, error: phasesError } = await supabase
    .from('project_phases')
    .select('*')
    .order('phase_number')

  if (phasesError) throw phasesError

  return (projects || []).map(project => {
    const projectPhases = (phases || []).filter(p => p.project_id === project.id)
    const total_budget_allocated = projectPhases.reduce((sum, p) => sum + p.budget_allocated, 0)
    const total_paid_out = projectPhases.reduce((sum, p) => sum + p.budget_used, 0)
    const completion_percentage = total_budget_allocated > 0
      ? (total_paid_out / total_budget_allocated) * 100
      : 0

    return {
      ...project,
      phases: projectPhases,
      completion_percentage,
      total_budget_allocated,
      total_paid_out
    }
  })
}
