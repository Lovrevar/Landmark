import { supabase } from '../../../../lib/supabase'

export interface Company {
  id: string
  name: string
}

export interface Supplier {
  id: string
  name: string
}

export interface Project {
  id: string
  name: string
}

export interface Phase {
  id: string
  phase_name: string
}

export interface Contract {
  id: string
  contract_number: string
  contract_amount: number
  base_amount: number
  contract_date: string
}

export type LandPurchaseInvoiceType = 'projects' | 'retail'

export async function fetchLandPurchaseCompanies(): Promise<Company[]> {
  const { data } = await supabase
    .from('accounting_companies')
    .select('id, name')
    .order('name')
  return data || []
}

export async function fetchLandPurchaseSuppliers(invoiceType: LandPurchaseInvoiceType): Promise<Supplier[]> {
  if (invoiceType === 'projects') {
    const { data } = await supabase
      .from('subcontractors')
      .select('id, name, contracts!inner(id)')
      .order('name')
    return (data || []).map(s => ({ id: s.id, name: s.name }))
  }
  const { data } = await supabase
    .from('retail_suppliers')
    .select('id, name, retail_contracts!inner(id)')
    .order('name')
  return (data || []).map(s => ({ id: s.id, name: s.name }))
}

export async function fetchLandPurchaseProjects(
  invoiceType: LandPurchaseInvoiceType,
  supplierId: string,
): Promise<Project[]> {
  if (invoiceType === 'projects') {
    const { data } = await supabase
      .from('contracts')
      .select('project_id, projects(id, name)')
      .eq('subcontractor_id', supplierId)
    const rows = (data || []) as unknown as Array<{ projects?: { id: string; name: string } }>
    return Array.from(
      new Map(
        rows
          .filter(c => c.projects)
          .map(c => [c.projects!.id, { id: c.projects!.id, name: c.projects!.name }])
      ).values()
    )
  }
  const { data } = await supabase
    .from('retail_contracts')
    .select('phase_id, retail_project_phases!inner(project_id, retail_projects(id, name))')
    .eq('supplier_id', supplierId)
  const rows = (data || []) as unknown as Array<{
    retail_project_phases?: { project_id: string; retail_projects?: { id: string; name: string } }
  }>
  return Array.from(
    new Map(
      rows
        .filter(c => c.retail_project_phases?.retail_projects)
        .map(c => [
          c.retail_project_phases!.retail_projects!.id,
          { id: c.retail_project_phases!.retail_projects!.id, name: c.retail_project_phases!.retail_projects!.name },
        ])
    ).values()
  )
}

export async function fetchLandPurchasePhases(
  invoiceType: LandPurchaseInvoiceType,
  supplierId: string,
  projectId: string,
): Promise<Phase[]> {
  if (invoiceType === 'projects') {
    const { data } = await supabase
      .from('contracts')
      .select('phase_id, project_phases(id, phase_name)')
      .eq('subcontractor_id', supplierId)
      .eq('project_id', projectId)
    const rows = (data || []) as unknown as Array<{ project_phases?: { id: string; phase_name: string } }>
    return Array.from(
      new Map(
        rows
          .filter(c => c.project_phases)
          .map(c => [c.project_phases!.id, { id: c.project_phases!.id, phase_name: c.project_phases!.phase_name }])
      ).values()
    )
  }
  const { data } = await supabase
    .from('retail_contracts')
    .select('phase_id, retail_project_phases!inner(id, phase_name, project_id)')
    .eq('supplier_id', supplierId)
  const rows = (data || []) as unknown as Array<{
    retail_project_phases?: { id: string; phase_name: string; project_id: string }
  }>
  const filtered = rows.filter(c => c.retail_project_phases && c.retail_project_phases.project_id === projectId)
  return Array.from(
    new Map(
      filtered.map(c => [
        c.retail_project_phases!.id,
        { id: c.retail_project_phases!.id, phase_name: c.retail_project_phases!.phase_name },
      ])
    ).values()
  )
}

export async function fetchLandPurchaseContracts(
  invoiceType: LandPurchaseInvoiceType,
  supplierId: string,
  projectId: string,
  phaseId: string,
): Promise<Contract[]> {
  if (invoiceType === 'projects') {
    const { data } = await supabase
      .from('contracts')
      .select('id, contract_number, contract_amount, base_amount, start_date')
      .eq('subcontractor_id', supplierId)
      .eq('project_id', projectId)
      .eq('phase_id', phaseId)
      .gt('base_amount', 0)
      .order('start_date', { ascending: false })
    return (data || []).map(c => ({
      id: c.id,
      contract_number: c.contract_number,
      contract_amount: c.contract_amount,
      base_amount: c.base_amount,
      contract_date: c.start_date || new Date().toISOString().split('T')[0],
    }))
  }
  const { data } = await supabase
    .from('retail_contracts')
    .select('id, contract_number, contract_amount, contract_date, retail_project_phases!inner(project_id)')
    .eq('supplier_id', supplierId)
    .eq('phase_id', phaseId)
    .eq('retail_project_phases.project_id', projectId)
    .gt('contract_amount', 0)
    .order('contract_date', { ascending: false })
  return (data || []).map(c => ({
    id: c.id,
    contract_number: c.contract_number,
    contract_amount: c.contract_amount,
    base_amount: c.contract_amount,
    contract_date: c.contract_date || new Date().toISOString().split('T')[0],
  }))
}
