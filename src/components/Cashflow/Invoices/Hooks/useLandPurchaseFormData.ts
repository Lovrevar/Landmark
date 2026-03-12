import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'

interface Company {
  id: string
  name: string
}

interface Supplier {
  id: string
  name: string
}

interface Project {
  id: string
  name: string
}

interface Phase {
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

interface UseLandPurchaseFormDataResult {
  companies: Company[]
  suppliers: Supplier[]
  projects: Project[]
  phases: Phase[]
  availableContracts: Contract[]
}

export function useLandPurchaseFormData(
  invoiceType: 'projects' | 'retail',
  supplierId: string | null,
  projectId: string | null,
  phaseId: string | null,
  isOpen: boolean
): UseLandPurchaseFormDataResult {
  const [companies, setCompanies] = useState<Company[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [availableContracts, setAvailableContracts] = useState<Contract[]>([])

  // Fetch companies when modal opens
  useEffect(() => {
    if (!isOpen) return
    supabase
      .from('accounting_companies')
      .select('id, name')
      .order('name')
      .then(({ data }) => { if (data) setCompanies(data) })
  }, [isOpen])

  // Fetch suppliers with contracts when invoiceType or isOpen changes
  useEffect(() => {
    if (!isOpen) return
    setSuppliers([])
    setProjects([])
    setPhases([])
    setAvailableContracts([])

    if (invoiceType === 'projects') {
      supabase
        .from('subcontractors')
        .select('id, name, contracts!inner(id)')
        .order('name')
        .then(({ data }) => {
          if (data) setSuppliers(data.map(s => ({ id: s.id, name: s.name })))
        })
    } else {
      supabase
        .from('retail_suppliers')
        .select('id, name, retail_contracts!inner(id)')
        .order('name')
        .then(({ data }) => {
          if (data) setSuppliers(data.map(s => ({ id: s.id, name: s.name })))
        })
    }
  }, [invoiceType, isOpen])

  // Fetch projects for supplier
  useEffect(() => {
    if (!supplierId) {
      setProjects([])
      return
    }

    if (invoiceType === 'projects') {
      supabase
        .from('contracts')
        .select('project_id, projects(id, name)')
        .eq('subcontractor_id', supplierId)
        .then(({ data }) => {
          if (data) {
            const rows = data as unknown as Array<{ projects?: { id: string; name: string } }>
            const uniqueProjects = Array.from(
              new Map(
                rows
                  .filter(c => c.projects)
                  .map(c => [c.projects!.id, { id: c.projects!.id, name: c.projects!.name }])
              ).values()
            )
            setProjects(uniqueProjects as Project[])
          }
        })
    } else {
      supabase
        .from('retail_contracts')
        .select('phase_id, retail_project_phases!inner(project_id, retail_projects(id, name))')
        .eq('supplier_id', supplierId)
        .then(({ data }) => {
          if (data) {
            const rows = data as unknown as Array<{ retail_project_phases?: { project_id: string; retail_projects?: { id: string; name: string } } }>
            const uniqueProjects = Array.from(
              new Map(
                rows
                  .filter(c => c.retail_project_phases?.retail_projects)
                  .map(c => [
                    c.retail_project_phases!.retail_projects!.id,
                    { id: c.retail_project_phases!.retail_projects!.id, name: c.retail_project_phases!.retail_projects!.name }
                  ])
              ).values()
            )
            setProjects(uniqueProjects as Project[])
          }
        })
    }
  }, [supplierId, invoiceType])

  // Fetch phases for supplier + project
  useEffect(() => {
    if (!supplierId || !projectId) {
      setPhases([])
      return
    }

    if (invoiceType === 'projects') {
      supabase
        .from('contracts')
        .select('phase_id, project_phases(id, phase_name)')
        .eq('subcontractor_id', supplierId)
        .eq('project_id', projectId)
        .then(({ data }) => {
          if (data) {
            const rows = data as unknown as Array<{ project_phases?: { id: string; phase_name: string } }>
            const uniquePhases = Array.from(
              new Map(
                rows
                  .filter(c => c.project_phases)
                  .map(c => [c.project_phases!.id, { id: c.project_phases!.id, phase_name: c.project_phases!.phase_name }])
              ).values()
            )
            setPhases(uniquePhases as Phase[])
          }
        })
    } else {
      supabase
        .from('retail_contracts')
        .select('phase_id, retail_project_phases!inner(id, phase_name, project_id)')
        .eq('supplier_id', supplierId)
        .then(({ data }) => {
          if (data) {
            const rows = data as unknown as Array<{ retail_project_phases?: { id: string; phase_name: string; project_id: string } }>
            const filteredPhases = rows.filter(c =>
              c.retail_project_phases &&
              c.retail_project_phases.project_id === projectId
            )
            const uniquePhases = Array.from(
              new Map(
                filteredPhases.map(c => [
                  c.retail_project_phases!.id,
                  { id: c.retail_project_phases!.id, phase_name: c.retail_project_phases!.phase_name }
                ])
              ).values()
            )
            setPhases(uniquePhases as Phase[])
          }
        })
    }
  }, [supplierId, projectId, invoiceType])

  // Fetch contracts for supplier + project + phase
  useEffect(() => {
    if (!supplierId || !projectId || !phaseId) {
      setAvailableContracts([])
      return
    }

    if (invoiceType === 'projects') {
      supabase
        .from('contracts')
        .select('id, contract_number, contract_amount, base_amount, start_date')
        .eq('subcontractor_id', supplierId)
        .eq('project_id', projectId)
        .eq('phase_id', phaseId)
        .gt('base_amount', 0)
        .order('start_date', { ascending: false })
        .then(({ data }) => {
          if (data) {
            setAvailableContracts(data.map(c => ({
              id: c.id,
              contract_number: c.contract_number,
              contract_amount: c.contract_amount,
              base_amount: c.base_amount,
              contract_date: c.start_date || new Date().toISOString().split('T')[0]
            })))
          } else {
            setAvailableContracts([])
          }
        })
    } else {
      supabase
        .from('retail_contracts')
        .select('id, contract_number, contract_amount, contract_date, retail_project_phases!inner(project_id)')
        .eq('supplier_id', supplierId)
        .eq('phase_id', phaseId)
        .eq('retail_project_phases.project_id', projectId)
        .gt('contract_amount', 0)
        .order('contract_date', { ascending: false })
        .then(({ data }) => {
          if (data) {
            setAvailableContracts(data.map(c => ({
              id: c.id,
              contract_number: c.contract_number,
              contract_amount: c.contract_amount,
              base_amount: c.contract_amount,
              contract_date: c.contract_date || new Date().toISOString().split('T')[0]
            })))
          } else {
            setAvailableContracts([])
          }
        })
    }
  }, [supplierId, projectId, phaseId, invoiceType])

  return { companies, suppliers, projects, phases, availableContracts }
}
