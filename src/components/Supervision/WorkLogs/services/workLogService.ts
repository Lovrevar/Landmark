import { supabase } from '../../../../lib/supabase'

export interface WorkLog {
  id: string
  contract_id: string
  project_id: string
  phase_id: string | null
  subcontractor_id: string
  date: string
  status: 'work_finished' | 'in_progress' | 'blocker' | 'quality_issue' | 'waiting_materials' | 'weather_delay'
  work_description: string
  blocker_details: string | null
  notes: string
  color: string
  created_at: string
  contracts?: { contract_number: string; job_description: string }
  subcontractors?: { name: string }
  projects?: { name: string }
  project_phases?: { phase_name: string }
}

export interface WorkLogProject {
  id: string
  name: string
}

export interface WorkLogPhase {
  id: string
  phase_name: string
}

export interface WorkLogContract {
  id: string
  contract_number: string
  job_description: string
  subcontractor_id: string
  subcontractors?: { name: string }
}

export interface WorkLogFormData {
  project_id: string
  phase_id: string
  contract_id: string
  date: string
  status: WorkLog['status']
  work_description: string
  blocker_details: string
  notes: string
  color: string
}

export async function fetchProjects(): Promise<WorkLogProject[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .order('name')

  if (error) throw error
  return data || []
}

export async function fetchWorkLogs(): Promise<WorkLog[]> {
  const { data, error } = await supabase
    .from('work_logs')
    .select(`
      *,
      contracts!work_logs_contract_id_fkey (contract_number, job_description),
      subcontractors!work_logs_subcontractor_id_fkey (name),
      projects!work_logs_project_id_fkey (name),
      project_phases!work_logs_phase_id_fkey (phase_name)
    `)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as WorkLog[]
}

export async function fetchPhasesByProject(projectId: string): Promise<WorkLogPhase[]> {
  const { data, error } = await supabase
    .from('project_phases')
    .select('id, phase_name')
    .eq('project_id', projectId)
    .order('phase_number')

  if (error) throw error
  return data || []
}

export async function fetchContractsByPhase(phaseId: string): Promise<WorkLogContract[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('id, contract_number, job_description, subcontractor_id, status, subcontractors!contracts_subcontractor_id_fkey(name)')
    .eq('phase_id', phaseId)
    .in('status', ['active', 'draft'])
    .order('contract_number')

  if (error) throw error
  return (data || []) as unknown as WorkLogContract[]
}

export async function createWorkLog(data: WorkLogFormData, subcontractorId: string, userId: string | undefined): Promise<void> {
  const { error } = await supabase.from('work_logs').insert([{
    contract_id: data.contract_id,
    project_id: data.project_id,
    phase_id: data.phase_id || null,
    subcontractor_id: subcontractorId,
    date: data.date,
    status: data.status,
    work_description: data.work_description,
    blocker_details: data.status === 'blocker' || data.status === 'quality_issue' ? data.blocker_details : null,
    notes: data.notes,
    color: data.color,
    created_by: userId,
  }])

  if (error) throw error
}

export async function updateWorkLog(id: string, data: WorkLogFormData, subcontractorId: string): Promise<void> {
  const { error } = await supabase
    .from('work_logs')
    .update({
      contract_id: data.contract_id,
      project_id: data.project_id,
      phase_id: data.phase_id || null,
      subcontractor_id: subcontractorId,
      date: data.date,
      status: data.status,
      work_description: data.work_description,
      blocker_details: data.status === 'blocker' || data.status === 'quality_issue' ? data.blocker_details : null,
      notes: data.notes,
      color: data.color,
    })
    .eq('id', id)

  if (error) throw error
}

export async function deleteWorkLog(id: string): Promise<void> {
  const { error } = await supabase.from('work_logs').delete().eq('id', id)
  if (error) throw error
}
