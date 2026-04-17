import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { SupplierSummary, Contract, Invoice, SupplierFormData, Project, Phase } from '../types'

export const fetchSuppliers = async (): Promise<SupplierSummary[]> => {
  const [
    { data: suppliersData, error: suppliersError },
    { data: retailSuppliersData, error: retailError },
    { data: paymentsData }
  ] = await Promise.all([
    supabase.from('subcontractors').select('id, name, contact').order('name'),
    supabase.from('retail_suppliers').select('id, name, contact_person, contact_phone, contact_email, supplier_type:retail_supplier_types(name)').order('name'),
    supabase.from('accounting_payments').select('invoice_id, amount')
  ])

  if (suppliersError) throw suppliersError
  if (retailError) throw retailError

  const paymentsMap = new Map<string, number>()
  ;(paymentsData || []).forEach(payment => {
    const current = paymentsMap.get(payment.invoice_id) || 0
    paymentsMap.set(payment.invoice_id, current + parseFloat(payment.amount?.toString() || '0'))
  })

  const supplierIds = (suppliersData || []).map(s => s.id)
  const retailSupplierIds = (retailSuppliersData || []).map(s => s.id)

  const [
    { data: contractsData },
    { data: invoicesData },
    { data: retailContractsData },
    { data: retailInvoicesData }
  ] = await Promise.all([
    supabase.from('contracts').select('id, subcontractor_id, contract_amount, has_contract').in('subcontractor_id', supplierIds.length > 0 ? supplierIds : ['00000000-0000-0000-0000-000000000000']).in('status', ['draft', 'active']),
    supabase.from('accounting_invoices').select('id, supplier_id, remaining_amount, status, base_amount, contract_id').in('supplier_id', supplierIds.length > 0 ? supplierIds : ['00000000-0000-0000-0000-000000000000']),
    supabase.from('retail_contracts').select('id, supplier_id, contract_amount, has_contract').in('supplier_id', retailSupplierIds.length > 0 ? retailSupplierIds : ['00000000-0000-0000-0000-000000000000']).in('status', ['Active', 'Completed']),
    supabase.from('accounting_invoices').select('id, retail_supplier_id, remaining_amount, status, base_amount, retail_contract_id').in('retail_supplier_id', retailSupplierIds.length > 0 ? retailSupplierIds : ['00000000-0000-0000-0000-000000000000'])
  ])

  const buildStatsMap = (ids: string[]) => {
    const map = new Map<string, { contractCount: number; contractValue: number; totalPaid: number; totalRemaining: number; invoiceCount: number }>()
    ids.forEach(id => map.set(id, { contractCount: 0, contractValue: 0, totalPaid: 0, totalRemaining: 0, invoiceCount: 0 }))
    return map
  }

  const siteStats = buildStatsMap(supplierIds)

  const siteContractInvoiceTotals = new Map<string, number>()
  ;(invoicesData || []).forEach(inv => {
    const contractId = (inv as { contract_id?: string }).contract_id
    if (contractId) {
      const current = siteContractInvoiceTotals.get(contractId) || 0
      siteContractInvoiceTotals.set(contractId, current + parseFloat(inv.base_amount?.toString() || '0'))
    }
  })

  ;(contractsData || []).forEach(c => {
    const s = siteStats.get(c.subcontractor_id)
    if (s) {
      s.contractCount++
      if ((c as { has_contract?: boolean }).has_contract === false) {
        s.contractValue += siteContractInvoiceTotals.get(c.id) || 0
      } else {
        s.contractValue += parseFloat(c.contract_amount?.toString() || '0')
      }
    }
  })

  ;(invoicesData || []).forEach(inv => {
    const s = siteStats.get(inv.supplier_id)
    if (s) {
      s.invoiceCount++
      s.totalPaid += paymentsMap.get(inv.id) || 0
      if (inv.status !== 'PAID') s.totalRemaining += parseFloat(inv.remaining_amount?.toString() || '0')
    }
  })

  const retailStats = buildStatsMap(retailSupplierIds)

  const retailContractInvoiceTotals = new Map<string, number>()
  ;(retailInvoicesData || []).forEach(inv => {
    const retailContractId = (inv as { retail_contract_id?: string }).retail_contract_id
    if (retailContractId) {
      const current = retailContractInvoiceTotals.get(retailContractId) || 0
      retailContractInvoiceTotals.set(retailContractId, current + parseFloat(inv.base_amount?.toString() || '0'))
    }
  })

  ;(retailContractsData || []).forEach(c => {
    const s = retailStats.get(c.supplier_id)
    if (s) {
      s.contractCount++
      if ((c as { has_contract?: boolean }).has_contract === false) {
        s.contractValue += retailContractInvoiceTotals.get(c.id) || 0
      } else {
        s.contractValue += parseFloat(c.contract_amount?.toString() || '0')
      }
    }
  })

  ;(retailInvoicesData || []).forEach(inv => {
    const s = retailStats.get(inv.retail_supplier_id)
    if (s) {
      s.invoiceCount++
      s.totalPaid += paymentsMap.get(inv.id) || 0
      if (inv.status !== 'PAID') s.totalRemaining += parseFloat(inv.remaining_amount?.toString() || '0')
    }
  })

  interface SupplierStatsEntry { contractCount: number; contractValue: number; totalPaid: number; totalRemaining: number; invoiceCount: number }
  interface RawSupplier { id: string; name: string; contact?: string; contact_person?: string; contact_phone?: string; contact_email?: string; supplier_type?: { name: string } }
  const mapToSummary = (
    data: RawSupplier[],
    statsMap: Map<string, SupplierStatsEntry>,
    source: 'site' | 'retail'
  ): SupplierSummary[] =>
    data.map(supplier => {
      const stats = statsMap.get(supplier.id) || { contractCount: 0, contractValue: 0, totalPaid: 0, totalRemaining: 0, invoiceCount: 0 }
      const contact = source === 'retail'
        ? [supplier.contact_person, supplier.contact_phone, supplier.contact_email].filter(Boolean).join(' | ') || '-'
        : supplier.contact || ''
      return {
        id: supplier.id,
        name: supplier.name,
        contact,
        source,
        supplier_type: source === 'retail' ? supplier.supplier_type?.name : undefined,
        total_contracts: stats.contractCount,
        total_contract_value: stats.contractValue,
        total_paid: stats.totalPaid,
        total_paid_neto: stats.totalPaid,
        total_paid_pdv: 0,
        total_paid_total: stats.totalPaid,
        total_remaining: stats.totalRemaining,
        total_invoices: stats.invoiceCount,
        contracts: [],
        invoices: []
      }
    })

  const siteSuppliers = mapToSummary(suppliersData || [], siteStats, 'site')
  const retailSuppliers = mapToSummary((retailSuppliersData || []) as unknown as RawSupplier[], retailStats, 'retail')
  const all = [...siteSuppliers, ...retailSuppliers].sort((a, b) => a.name.localeCompare(b.name))

  return all
}

export const fetchProjects = async (): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .order('name')

  if (error) throw error
  return data || []
}

export const fetchPhases = async (projectId: string): Promise<Phase[]> => {
  const { data, error } = await supabase
    .from('project_phases')
    .select('id, phase_name')
    .eq('project_id', projectId)
    .order('phase_number')

  if (error) throw error
  return data || []
}

export const updateSupplier = async (id: string, formData: SupplierFormData): Promise<void> => {
  const { error } = await supabase
    .from('subcontractors')
    .update({
      name: formData.name,
      contact: formData.contact
    })
    .eq('id', id)

  if (error) throw error

  logActivity({ action: 'supplier.update', entity: 'supplier', entityId: id, metadata: { severity: 'low', entity_name: formData.name } })
}

export const createSupplier = async (formData: SupplierFormData): Promise<string> => {
  const { data: newSupplier, error: supplierError } = await supabase
    .from('subcontractors')
    .insert([{
      name: formData.name,
      contact: formData.contact
    }])
    .select()
    .single()

  if (supplierError) throw supplierError

  if (formData.project_id && formData.phase_id && newSupplier) {
    const { data: existingContracts } = await supabase
      .from('contracts')
      .select('contract_number')
      .eq('project_id', formData.project_id)
      .not('contract_number', 'is', null)

    const year = new Date().getFullYear()
    const timestamp = Date.now().toString().slice(-6)
    const prefix = `CNT-${year}-`

    let maxNumber = 0
    if (existingContracts && existingContracts.length > 0) {
      existingContracts.forEach(contract => {
        if (contract.contract_number && contract.contract_number.startsWith(prefix)) {
          const parts = contract.contract_number.replace(prefix, '').split('-')
          const num = parseInt(parts[0], 10)
          if (!isNaN(num) && num > maxNumber) {
            maxNumber = num
          }
        }
      })
    }

    const contractNumber = `${prefix}${String(maxNumber + 1).padStart(4, '0')}-${timestamp}`

    const { error: contractError } = await supabase
      .from('contracts')
      .insert([{
        contract_number: contractNumber,
        project_id: formData.project_id,
        phase_id: formData.phase_id,
        subcontractor_id: newSupplier.id,
        job_description: '',
        contract_amount: 0,
        has_contract: false,
        status: 'draft'
      }])

    if (contractError) throw contractError
  }

  logActivity({ action: 'supplier.create', entity: 'supplier', entityId: newSupplier.id, projectId: formData.project_id || null, metadata: { severity: 'low', entity_name: formData.name } })

  return newSupplier.id
}

export const deleteSupplier = async (supplier: SupplierSummary): Promise<void> => {
  const table = supplier.source === 'retail' ? 'retail_suppliers' : 'subcontractors'
  const { error } = await supabase.from(table).delete().eq('id', supplier.id)
  if (error) throw error

  logActivity({ action: 'supplier.delete', entity: 'supplier', entityId: supplier.id, metadata: { severity: 'medium', entity_name: supplier.name } })
}

export const fetchSupplierDetails = async (supplier: SupplierSummary): Promise<{ contracts: Contract[], invoices: Invoice[] }> => {
  let contractsWithPayments: Contract[] = []
  let invoicesWithPayments: Invoice[] = []

  if (supplier.source === 'retail') {
    const { data: rContracts } = await supabase
      .from('retail_contracts')
      .select(`id, contract_number, contract_amount, budget_realized, end_date, status, phase_id, has_contract, phases:phase_id (phase_name)`)
      .eq('supplier_id', supplier.id)
      .in('status', ['Active', 'Completed'])

    const { data: rPhases } = await supabase
      .from('retail_project_phases')
      .select('id, phase_name, project_id, retail_projects:project_id (name)')
      .in('id', (rContracts || []).map(c => c.phase_id).filter(Boolean) as string[])

    const phaseProjectMap = new Map<string, string>()
    ;((rPhases || []) as unknown as Array<{ id: string; retail_projects?: { name: string } }>).forEach((p) => {
      phaseProjectMap.set(p.id, p.retail_projects?.name || 'N/A')
    })

    const { data: rInvoices } = await supabase
      .from('accounting_invoices')
      .select('id, invoice_number, invoice_type, base_amount, total_amount, paid_amount, remaining_amount, status, issue_date, retail_contract_id')
      .eq('retail_supplier_id', supplier.id)

    const invoiceIds = (rInvoices || []).map(inv => inv.id)
    const { data: paymentsData } = await supabase
      .from('accounting_payments').select('invoice_id, amount')
      .in('invoice_id', invoiceIds.length > 0 ? invoiceIds : ['00000000-0000-0000-0000-000000000000'])

    const paymentsMap = new Map<string, number>()
    ;(paymentsData || []).forEach(p => {
      paymentsMap.set(p.invoice_id, (paymentsMap.get(p.invoice_id) || 0) + parseFloat(p.amount?.toString() || '0'))
    })

    invoicesWithPayments = (rInvoices || []).map(inv => ({ ...inv, actual_paid: paymentsMap.get(inv.id) || 0 }))

    const contractPayMap = new Map<string, number>()
    const contractInvoiceTotalMap = new Map<string, number>()
    invoicesWithPayments.forEach(inv => {
      const rContractId = (inv as { retail_contract_id?: string }).retail_contract_id
      if (rContractId) {
        contractPayMap.set(rContractId, (contractPayMap.get(rContractId) || 0) + ((inv as { actual_paid?: number }).actual_paid || 0))
        contractInvoiceTotalMap.set(rContractId, (contractInvoiceTotalMap.get(rContractId) || 0) + parseFloat(inv.base_amount?.toString() || '0'))
      }
    })

    contractsWithPayments = ((rContracts || []).map((c: Record<string, unknown>) => ({
      id: c.id,
      contract_number: c.contract_number,
      project_id: '',
      phase_id: c.phase_id,
      job_description: '',
      contract_amount: c.contract_amount,
      budget_realized: c.budget_realized,
      end_date: c.end_date,
      status: c.status,
      projects: { name: phaseProjectMap.get(c.phase_id as string) || 'N/A' },
      phases: c.phases,
      actual_paid: contractPayMap.get(c.id as string) || 0,
      has_contract: c.has_contract,
      total_invoiced: contractInvoiceTotalMap.get(c.id as string) || 0
    })) as unknown as Contract[])
  } else {
    const { data: contractsData } = await supabase
      .from('contracts')
      .select('id, contract_number, project_id, phase_id, job_description, contract_amount, budget_realized, end_date, status, has_contract, projects:project_id (name), phases:phase_id (phase_name)')
      .eq('subcontractor_id', supplier.id)
      .in('status', ['draft', 'active'])

    const { data: invoicesData } = await supabase
      .from('accounting_invoices')
      .select('id, invoice_number, invoice_type, base_amount, total_amount, paid_amount, remaining_amount, status, issue_date, contract_id')
      .eq('supplier_id', supplier.id)

    const invoiceIds = (invoicesData || []).map(inv => inv.id)
    const { data: paymentsData } = await supabase
      .from('accounting_payments').select('invoice_id, amount')
      .in('invoice_id', invoiceIds.length > 0 ? invoiceIds : ['00000000-0000-0000-0000-000000000000'])

    const paymentsMap = new Map<string, number>()
    ;(paymentsData || []).forEach(p => {
      paymentsMap.set(p.invoice_id, (paymentsMap.get(p.invoice_id) || 0) + parseFloat(p.amount?.toString() || '0'))
    })

    invoicesWithPayments = (invoicesData || []).map(inv => ({ ...inv, actual_paid: paymentsMap.get(inv.id) || 0 }))

    const contractPayMap = new Map<string, number>()
    const contractInvoiceTotalMap = new Map<string, number>()
    invoicesWithPayments.forEach(inv => {
      const contractId = (inv as { contract_id?: string }).contract_id
      if (contractId) {
        contractPayMap.set(contractId, (contractPayMap.get(contractId) || 0) + ((inv as { actual_paid?: number }).actual_paid || 0))
        contractInvoiceTotalMap.set(contractId, (contractInvoiceTotalMap.get(contractId) || 0) + parseFloat(inv.base_amount?.toString() || '0'))
      }
    })

    contractsWithPayments = (contractsData || []).map(c => ({
      ...c,
      actual_paid: contractPayMap.get(c.id) || 0,
      total_invoiced: contractInvoiceTotalMap.get(c.id) || 0
    })) as unknown as Contract[]
  }

  return { contracts: contractsWithPayments, invoices: invoicesWithPayments }
}

export const fetchSuppliersForLinking = async (): Promise<{ id: string; name: string; contact: string }[]> => {
  const { data, error } = await supabase.from('subcontractors').select('id, name, contact').order('name')
  if (error) throw error
  return data || []
}

export const fetchProjectsForLinking = async (): Promise<{ id: string; name: string }[]> => {
  const { data, error } = await supabase.from('projects').select('id, name').order('name')
  if (error) throw error
  return data || []
}

export const fetchPhasesForProject = async (projectId: string): Promise<{ id: string; phase_name: string; phase_number: number; project_id: string }[]> => {
  const { data, error } = await supabase
    .from('project_phases')
    .select('id, phase_name, phase_number, project_id')
    .eq('project_id', projectId)
    .order('phase_number')
  if (error) throw error
  return data || []
}

export const generateSupplierContractNumber = async (projectId: string): Promise<string> => {
  const { data: project, error: projectError } = await supabase
    .from('projects').select('name').eq('id', projectId).single()
  if (projectError) throw projectError

  const { data: contracts, error: contractsError } = await supabase
    .from('contracts').select('contract_number').eq('project_id', projectId)
    .order('created_at', { ascending: false }).limit(1)
  if (contractsError) throw contractsError

  const projectCode = project.name.substring(0, 3).toUpperCase()
  const nextNumber = contracts && contracts.length > 0
    ? parseInt(contracts[0].contract_number.split('-').pop() || '0') + 1
    : 1
  return `${projectCode}-${String(nextNumber).padStart(4, '0')}`
}

export const createSupplierContract = async (
  supplierId: string,
  projectId: string,
  phaseId: string,
  contractNumber: string
): Promise<void> => {
  const { error } = await supabase.from('contracts').insert({
    contract_number: contractNumber,
    project_id: projectId,
    phase_id: phaseId,
    subcontractor_id: supplierId,
    job_description: 'Povezan iz Accountinga',
    contract_amount: 0,
    base_amount: 0,
    vat_rate: 0,
    vat_amount: 0,
    total_amount: 0,
    budget_realized: 0,
    status: 'active',
    has_contract: false,
    contract_type_id: 0,
    end_date: null
  })
  if (error) throw error
}

export const fetchRetailSupplierTypes = async (): Promise<{ id: string; name: string }[]> => {
  const { data, error } = await supabase.from('retail_supplier_types').select('id, name').order('name')
  if (error) throw error
  return data || []
}

export const fetchRetailProjectsForSupplier = async (): Promise<{ id: string; name: string }[]> => {
  const { data, error } = await supabase.from('retail_projects').select('id, name').order('name')
  if (error) throw error
  return data || []
}

export const fetchRetailPhasesForProject = async (projectId: string): Promise<{ id: string; phase_name: string; phase_type: string }[]> => {
  const { data, error } = await supabase
    .from('retail_project_phases')
    .select('id, phase_name, phase_type')
    .eq('project_id', projectId)
    .order('phase_order')
  if (error) throw error
  return data || []
}

export const createRetailSupplierWithContract = async (
  supplierData: { name: string; supplier_type_id: string; contact_person: string | null; contact_phone: string | null; contact_email: string | null },
  contractData?: { phase_id: string }
): Promise<void> => {
  const { data: newSupplier, error: supplierError } = await supabase
    .from('retail_suppliers')
    .insert([supplierData])
    .select()
    .single()
  if (supplierError) throw supplierError

  if (contractData && newSupplier) {
    const year = new Date().getFullYear()
    const timestamp = Date.now().toString().slice(-6)
    const contractNumber = `RCN-${year}-${timestamp}`

    const { error: contractError } = await supabase.from('retail_contracts').insert([{
      contract_number: contractNumber,
      phase_id: contractData.phase_id,
      supplier_id: newSupplier.id,
      contract_amount: 0,
      budget_realized: 0,
      status: 'Active',
      has_contract: false
    }])
    if (contractError) throw contractError
  }
}
