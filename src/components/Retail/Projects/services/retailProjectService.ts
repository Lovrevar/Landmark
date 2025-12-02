import { supabase } from '../../../../lib/supabase'
import type {
  RetailProject,
  RetailProjectPhase,
  RetailSupplier,
  RetailContract,
  RetailContractMilestone,
  RetailProjectWithPhases,
  RetailPhaseWithContracts,
  RetailContractWithMilestones
} from '../../../../types/retail'

export const retailProjectService = {
  async fetchProjects(): Promise<RetailProjectWithPhases[]> {
    const { data: projects, error: projectsError } = await supabase
      .from('retail_projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (projectsError) throw projectsError

    const projectsWithPhases = await Promise.all(
      (projects || []).map(async (project) => {
        const { data: phases } = await supabase
          .from('retail_project_phases')
          .select('*')
          .eq('project_id', project.id)
          .order('phase_order', { ascending: true })

        return {
          ...project,
          phases: phases || []
        }
      })
    )

    return projectsWithPhases
  },

  async fetchProjectById(id: string): Promise<RetailProjectWithPhases | null> {
    const { data: project, error: projectError } = await supabase
      .from('retail_projects')
      .select('*')
      .eq('id', id)
      .single()

    if (projectError) throw projectError

    const { data: phases } = await supabase
      .from('retail_project_phases')
      .select('*')
      .eq('project_id', id)
      .order('phase_order', { ascending: true })

    return {
      ...project,
      phases: phases || []
    }
  },

  async createProject(project: Omit<RetailProject, 'id' | 'created_at' | 'updated_at' | 'price_per_m2'>): Promise<RetailProject> {
    const { data, error } = await supabase
      .from('retail_projects')
      .insert([project])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateProject(id: string, updates: Partial<RetailProject>): Promise<RetailProject> {
    const { data, error } = await supabase
      .from('retail_projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteProject(id: string): Promise<void> {
    const { error } = await supabase
      .from('retail_projects')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async fetchPhasesByProject(projectId: string): Promise<RetailProjectPhase[]> {
    const { data, error } = await supabase
      .from('retail_project_phases')
      .select('*')
      .eq('project_id', projectId)
      .order('phase_order', { ascending: true })

    if (error) throw error
    return data || []
  },

  async fetchPhaseWithContracts(phaseId: string): Promise<RetailPhaseWithContracts | null> {
    const { data: phase, error: phaseError } = await supabase
      .from('retail_project_phases')
      .select('*')
      .eq('id', phaseId)
      .single()

    if (phaseError) throw phaseError

    const { data: contracts } = await supabase
      .from('retail_contracts')
      .select(`
        *,
        supplier:retail_suppliers(*)
      `)
      .eq('phase_id', phaseId)
      .order('created_at', { ascending: false })

    return {
      ...phase,
      contracts: contracts || []
    }
  },

  async createPhase(phase: Omit<RetailProjectPhase, 'id' | 'created_at' | 'updated_at'>): Promise<RetailProjectPhase> {
    const { data, error } = await supabase
      .from('retail_project_phases')
      .insert([phase])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async createDefaultPhases(projectId: string): Promise<RetailProjectPhase[]> {
    const defaultPhases = [
      {
        project_id: projectId,
        phase_name: 'Stjecanje zemljišta',
        phase_type: 'acquisition' as const,
        phase_order: 1,
        budget_allocated: 0,
        status: 'Pending' as const
      },
      {
        project_id: projectId,
        phase_name: 'Razvoj',
        phase_type: 'development' as const,
        phase_order: 2,
        budget_allocated: 0,
        status: 'Pending' as const
      },
      {
        project_id: projectId,
        phase_name: 'Prodaja',
        phase_type: 'sales' as const,
        phase_order: 3,
        budget_allocated: 0,
        status: 'Pending' as const
      }
    ]

    const { data, error } = await supabase
      .from('retail_project_phases')
      .insert(defaultPhases)
      .select()

    if (error) throw error
    return data || []
  },

  async updatePhase(id: string, updates: Partial<RetailProjectPhase>): Promise<RetailProjectPhase> {
    const { data, error } = await supabase
      .from('retail_project_phases')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deletePhase(id: string): Promise<void> {
    const { error } = await supabase
      .from('retail_project_phases')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async fetchSuppliers(): Promise<RetailSupplier[]> {
    const { data, error } = await supabase
      .from('retail_suppliers')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  },

  async createSupplier(supplier: Omit<RetailSupplier, 'id' | 'created_at' | 'updated_at'>): Promise<RetailSupplier> {
    const { data, error } = await supabase
      .from('retail_suppliers')
      .insert([supplier])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateSupplier(id: string, updates: Partial<RetailSupplier>): Promise<RetailSupplier> {
    const { data, error } = await supabase
      .from('retail_suppliers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteSupplier(id: string): Promise<void> {
    const { error } = await supabase
      .from('retail_suppliers')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async fetchContractsByPhase(phaseId: string): Promise<RetailContract[]> {
    const { data, error } = await supabase
      .from('retail_contracts')
      .select(`
        *,
        supplier:retail_suppliers(*)
      `)
      .eq('phase_id', phaseId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async fetchContractWithMilestones(contractId: string): Promise<RetailContractWithMilestones | null> {
    const { data: contract, error: contractError } = await supabase
      .from('retail_contracts')
      .select(`
        *,
        supplier:retail_suppliers(*)
      `)
      .eq('id', contractId)
      .single()

    if (contractError) throw contractError

    const { data: milestones } = await supabase
      .from('retail_contract_milestones')
      .select(`
        *,
        customer:retail_customers(*)
      `)
      .eq('contract_id', contractId)
      .order('created_at', { ascending: true })

    return {
      ...contract,
      milestones: milestones || []
    }
  },

  async createContract(contract: Omit<RetailContract, 'id' | 'created_at' | 'updated_at' | 'budget_realized' | 'supplier'>): Promise<RetailContract> {
    const { data, error } = await supabase
      .from('retail_contracts')
      .insert([{ ...contract, budget_realized: 0 }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateContract(id: string, updates: Partial<RetailContract>): Promise<RetailContract> {
    const { data, error } = await supabase
      .from('retail_contracts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteContract(id: string): Promise<void> {
    const { error } = await supabase
      .from('retail_contracts')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async fetchMilestonesByContract(contractId: string): Promise<RetailContractMilestone[]> {
    const { data, error } = await supabase
      .from('retail_contract_milestones')
      .select(`
        *,
        customer:retail_customers(*)
      `)
      .eq('contract_id', contractId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  async createMilestone(milestone: Omit<RetailContractMilestone, 'id' | 'created_at' | 'updated_at' | 'customer'>): Promise<RetailContractMilestone> {
    const { data, error } = await supabase
      .from('retail_contract_milestones')
      .insert([milestone])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateMilestone(id: string, updates: Partial<RetailContractMilestone>): Promise<RetailContractMilestone> {
    const { data, error } = await supabase
      .from('retail_contract_milestones')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteMilestone(id: string): Promise<void> {
    const { error } = await supabase
      .from('retail_contract_milestones')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async generateContractNumber(): Promise<string> {
    const { data, error } = await supabase
      .from('retail_contracts')
      .select('contract_number')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) throw error

    const lastNumber = data && data[0]?.contract_number
      ? parseInt(data[0].contract_number.split('-').pop() || '0')
      : 0

    const newNumber = lastNumber + 1
    const year = new Date().getFullYear()
    return `RET-${year}-${String(newNumber).padStart(6, '0')}`
  }
}
