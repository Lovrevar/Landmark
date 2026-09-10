import { supabase } from '../../../lib/supabase'
import type { SearchableOption } from '../../ui/SearchableSelect'
import { formatPhaseLabel } from '../../../utils/phaseLabel'

export type PickerEntity = 'project' | 'subcontractor' | 'contract' | 'unit' | 'customer' | 'credit'

export interface EntityScope {
  subcontractorId?: string | null
  projectId?: string | null
}

export async function fetchProjectOptions(): Promise<SearchableOption[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map(r => ({ value: r.id as string, label: r.name as string }))
}

export async function fetchSubcontractorOptions(): Promise<SearchableOption[]> {
  const { data, error } = await supabase
    .from('subcontractors')
    .select('id, name, contact')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map(r => ({
    value: r.id as string,
    label: r.name as string,
    sublabel: (r.contact as string | null) ?? undefined,
  }))
}

export async function fetchPhaseOptions(phaseWord: string): Promise<SearchableOption[]> {
  // This picker is NOT project-scoped — it lists every phase in the database. Labelling a row
  // by phase_name alone made most entries read "Faza 1", with nothing to tell the user which
  // project they were attaching a document to. The project name carries the identity; the phase
  // is the qualifier, so it goes in the sublabel.
  const { data, error } = await supabase
    .from('project_phases')
    .select('id, phase_name, phase_number, project:projects!project_phases_project_id_fkey(name)')
    .order('project_id', { ascending: true })
    .order('phase_number', { ascending: true })
  if (error) throw error
  return (data ?? []).map(r => {
    const projectName = (r.project as unknown as { name?: string } | null)?.name
    // `phaseWord` is passed rather than translated here so this stays a plain service; the
    // caller owns i18n. Without formatPhaseLabel this read "#1 Faza 1".
    const phaseLabel = r.phase_number != null
      ? formatPhaseLabel({ phase_number: r.phase_number as number, phase_name: r.phase_name as string }, phaseWord)
      : (r.phase_name as string)
    return {
      value: r.id as string,
      label: projectName ? `${projectName} — ${phaseLabel}` : phaseLabel,
      sublabel: projectName ? phaseLabel : undefined,
    }
  })
}

export async function fetchContractOptions(): Promise<SearchableOption[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select('id, contract_number, job_description')
    .order('start_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(r => {
    const num = r.contract_number as string | null
    const desc = r.job_description as string | null
    const idStr = r.id as string
    return {
      value: idStr,
      label: num || desc?.slice(0, 60) || idStr.slice(0, 8),
    }
  })
}

export async function fetchCreditOptions(): Promise<SearchableOption[]> {
  const { data, error } = await supabase
    .from('bank_credits')
    .select('id, credit_type, purpose')
    .order('start_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(r => ({
    value: r.id as string,
    label: (r.credit_type as string | null) ?? (r.id as string).slice(0, 8),
    sublabel: (r.purpose as string | null) || undefined,
  }))
}

// Used by DocumentUploadModal's EntityPicker — like the above fetchers but with
// optional scope filters on the contract list (so the picker only shows contracts
// belonging to the currently-selected subcontractor and/or project).
export async function fetchEntityOptions(
  type: PickerEntity,
  scope: EntityScope = {},
): Promise<SearchableOption[]> {
  switch (type) {
    case 'project':       return fetchProjectOptions()
    case 'subcontractor': return fetchSubcontractorOptions()
    case 'credit':        return fetchCreditOptions()
    case 'contract': {
      let q = supabase
        .from('contracts')
        .select('id, contract_number, job_description, subcontractor_id, project_id')
        .order('start_date', { ascending: false })
      if (scope.subcontractorId) q = q.eq('subcontractor_id', scope.subcontractorId)
      if (scope.projectId)       q = q.eq('project_id',       scope.projectId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map(r => {
        const num = r.contract_number as string | null
        const desc = r.job_description as string | null
        const idStr = r.id as string
        const label = num || desc?.slice(0, 60) || idStr.slice(0, 8)
        const sublabel = num && desc ? desc.slice(0, 80) : undefined
        return { value: idStr, label, sublabel }
      })
    }
    case 'unit': {
      const { data, error } = await supabase
        .from('apartments')
        .select('id, number, floor')
        .order('number', { ascending: true })
      if (error) throw error
      return (data ?? []).map(r => ({
        value: r.id as string,
        label: String(r.number),
      }))
    }
    case 'customer': {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, surname, customer_number')
        .order('surname', { ascending: true })
      if (error) throw error
      return (data ?? []).map(r => ({
        value: r.id as string,
        label: `${r.name as string} ${r.surname as string}`.trim(),
        sublabel: r.customer_number != null ? `#${r.customer_number}` : undefined,
      }))
    }
  }
}
