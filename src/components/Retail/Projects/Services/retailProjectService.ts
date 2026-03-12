import { supabase } from '../../../../lib/supabase'
import type {
  RetailProject,
  RetailProjectPhase,
  RetailSupplier,
  RetailSupplierType,
  RetailContract,
  RetailContractMilestone,
  RetailProjectWithPhases,
  RetailPhaseWithContracts,
  RetailContractWithMilestones,
  RetailLandPlot
} from '../../../../types/retail'

export const retailProjectService = {
  async fetchLandPlots(): Promise<RetailLandPlot[]> {
    const { data, error } = await supabase
      .from('retail_land_plots')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async fetchProjects(): Promise<RetailProjectWithPhases[]> {
    const { data: projects, error: projectsError } = await supabase
      .from('retail_projects')
      .select(`
        *,
        land_plot:retail_land_plots(*)
      `)
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
      .select(`
        *,
        land_plot:retail_land_plots(*)
      `)
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
        phase_name: 'Razvoj',
        phase_type: 'development' as const,
        phase_order: 1,
        budget_allocated: 0,
        status: 'Pending' as const
      },
      {
        project_id: projectId,
        phase_name: 'Gradnja',
        phase_type: 'construction' as const,
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

  async fetchSupplierTypes(): Promise<RetailSupplierType[]> {
    const { data, error } = await supabase
      .from('retail_supplier_types')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  },

  async createSupplierType(name: string): Promise<RetailSupplierType> {
    const { data, error } = await supabase
      .from('retail_supplier_types')
      .insert([{ name }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async fetchSuppliers(): Promise<RetailSupplier[]> {
    const { data, error } = await supabase
      .from('retail_suppliers')
      .select(`
        *,
        supplier_type:retail_supplier_types(*)
      `)
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

  async fetchCustomers() {
    const { data, error } = await supabase
      .from('retail_customers')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  },

  async createCustomer(customer: { name: string; contact_phone?: string; contact_email?: string; oib?: string; address?: string }) {
    const { data, error } = await supabase
      .from('retail_customers')
      .insert([customer])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async fetchContractsByPhase(phaseId: string): Promise<RetailContract[]> {
    const { data, error } = await supabase
      .from('retail_contracts')
      .select(`
        *,
        supplier:retail_suppliers(*),
        customer:retail_customers(*)
      `)
      .eq('phase_id', phaseId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const contracts = data || []
    if (contracts.length === 0) return contracts

    const contractIds = contracts.map(c => c.id)
    const { data: invoices } = await supabase
      .from('accounting_invoices')
      .select('retail_contract_id, paid_amount, remaining_amount, status')
      .in('retail_contract_id', contractIds)

    const paidMap = new Map<string, number>()
    const remainingMap = new Map<string, number>()

    ;(invoices || []).forEach(inv => {
      const currentPaid = paidMap.get(inv.retail_contract_id) || 0
      paidMap.set(inv.retail_contract_id, currentPaid + parseFloat(inv.paid_amount?.toString() || '0'))

      if (inv.status !== 'PAID') {
        const currentRemaining = remainingMap.get(inv.retail_contract_id) || 0
        remainingMap.set(inv.retail_contract_id, currentRemaining + parseFloat(inv.remaining_amount?.toString() || '0'))
      }
    })

    return contracts.map(c => ({
      ...c,
      invoice_total_paid: paidMap.get(c.id) || 0,
      invoiced_remaining: remainingMap.get(c.id) || 0
    }))
  },

  async fetchContractWithMilestones(contractId: string): Promise<RetailContractWithMilestones | null> {
    const { data: contract, error: contractError } = await supabase
      .from('retail_contracts')
      .select(`
        *,
        supplier:retail_suppliers(*),
        customer:retail_customers(*)
      `)
      .eq('id', contractId)
      .single()

    if (contractError) throw contractError

    const { data: milestones } = await supabase
      .from('retail_contract_milestones')
      .select('*')
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
    const { data: milestones, error } = await supabase
      .from('retail_contract_milestones')
      .select('*')
      .eq('contract_id', contractId)
      .order('milestone_number', { ascending: true })

    if (error) throw error

    const { data: invoices } = await supabase
      .from('accounting_invoices')
      .select('retail_milestone_id, base_amount, status')
      .eq('retail_contract_id', contractId)
      .in('status', ['PAID', 'PARTIAL'])

    const milestonePayments = new Map<string, number>()
    if (invoices) {
      invoices.forEach(inv => {
        if (inv.retail_milestone_id && inv.base_amount) {
          const current = milestonePayments.get(inv.retail_milestone_id) || 0
          milestonePayments.set(inv.retail_milestone_id, current + parseFloat(inv.base_amount))
        }
      })
    }

    return (milestones || []).map(m => ({
      ...m,
      amount_paid: milestonePayments.get(m.id) || 0
    }))
  },

  async createMilestone(milestone: Omit<RetailContractMilestone, 'id' | 'created_at' | 'updated_at'>): Promise<RetailContractMilestone> {
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

  async generateContractNumber(projectId: string): Promise<string> {
    const { data: phases } = await supabase
      .from('retail_project_phases')
      .select('id')
      .eq('project_id', projectId)

    const phaseIds = (phases || []).map(p => p.id)

    const { data: projectContracts } = await supabase
      .from('retail_contracts')
      .select('contract_number')
      .in('phase_id', phaseIds)
      .not('contract_number', 'is', null)

    const year = new Date().getFullYear()
    const timestamp = Date.now().toString().slice(-6)
    const prefix = `RET-${year}-`

    let maxNumber = 0
    if (projectContracts && projectContracts.length > 0) {
      projectContracts.forEach(contract => {
        if (contract.contract_number && contract.contract_number.startsWith(prefix)) {
          const parts = contract.contract_number.replace(prefix, '').split('-')
          const num = parseInt(parts[0], 10)
          if (!isNaN(num) && num > maxNumber) {
            maxNumber = num
          }
        }
      })
    }

    return `${prefix}${String(maxNumber + 1).padStart(4, '0')}-${timestamp}`
  },

  async getNextMilestoneNumber(contractId: string): Promise<number> {
    const { data, error } = await supabase
      .from('retail_contract_milestones')
      .select('milestone_number')
      .eq('contract_id', contractId)
      .order('milestone_number', { ascending: false })
      .limit(1)

    if (error) throw error

    return (data && data[0]?.milestone_number) ? data[0].milestone_number + 1 : 1
  },

  async getMilestoneStatsForContract(contractId: string, contractCost: number) {
    const milestones = await this.fetchMilestonesByContract(contractId)

    const totalPercentage = milestones.reduce((sum, m) => sum + m.percentage, 0)
    const totalAmount = milestones.reduce((sum, m) => sum + ((contractCost * m.percentage) / 100), 0)

    const { data: invoices } = await supabase
      .from('accounting_invoices')
      .select('retail_milestone_id, base_amount, status')
      .eq('retail_contract_id', contractId)
      .in('status', ['PAID', 'PARTIAL'])

    const milestonePayments = new Map<string, number>()
    if (invoices) {
      invoices.forEach(inv => {
        if (inv.retail_milestone_id && inv.base_amount) {
          const current = milestonePayments.get(inv.retail_milestone_id) || 0
          milestonePayments.set(inv.retail_milestone_id, current + parseFloat(inv.base_amount))
        }
      })
    }

    let actualPaidAmount = 0
    let actualPendingAmount = 0

    milestones.forEach(m => {
      const milestoneAmount = (contractCost * m.percentage) / 100
      const paidForMilestone = milestonePayments.get(m.id) || 0

      if (m.status === 'paid') {
        actualPaidAmount += paidForMilestone || milestoneAmount
      } else if (m.status === 'pending') {
        actualPendingAmount += milestoneAmount - paidForMilestone
      }
    })

    return {
      totalPercentage,
      remainingPercentage: 100 - totalPercentage,
      totalAmount,
      paidAmount: actualPaidAmount,
      pendingAmount: actualPendingAmount,
      milestonesCount: milestones.length
    }
  },

  async validateMilestonePercentagesForContract(contractId: string, excludeMilestoneId?: string) {
    const milestones = await this.fetchMilestonesByContract(contractId)
    const filteredMilestones = excludeMilestoneId
      ? milestones.filter(m => m.id !== excludeMilestoneId)
      : milestones

    const totalPercentage = filteredMilestones.reduce((sum, m) => sum + m.percentage, 0)
    const remainingPercentage = 100 - totalPercentage

    return {
      isValid: totalPercentage <= 100,
      totalPercentage,
      remainingPercentage
    }
  },

  async fetchRetailContractInvoices(contractId: string) {
    type RawInvoice = {
      id: string; invoice_number: string; invoice_type: string; status: string
      base_amount: string; vat_amount: string; total_amount: string; paid_amount: string; remaining_amount: string
      issue_date: string; due_date: string; description?: string
      accounting_companies?: { name: string } | null
      retail_suppliers?: { name: string } | null
      retail_customers?: { name: string } | null
    }

    const { data, error } = await supabase
      .from('accounting_invoices')
      .select(`
        id, invoice_number, invoice_type, status,
        base_amount, vat_amount, total_amount, paid_amount, remaining_amount,
        issue_date, due_date, description,
        accounting_companies!accounting_invoices_company_id_fkey(name),
        retail_suppliers(name),
        retail_customers(name)
      `)
      .eq('retail_contract_id', contractId)
      .order('issue_date', { ascending: false })

    if (error) throw error

    return ((data as unknown as RawInvoice[]) || []).map((inv) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_type: inv.invoice_type,
      status: inv.status,
      base_amount: parseFloat(inv.base_amount),
      vat_amount: parseFloat(inv.vat_amount),
      total_amount: parseFloat(inv.total_amount),
      paid_amount: parseFloat(inv.paid_amount),
      remaining_amount: parseFloat(inv.remaining_amount),
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      description: inv.description || '',
      company_name: inv.accounting_companies?.name || 'N/A',
      supplier_name: inv.retail_suppliers?.name || null,
      customer_name: inv.retail_customers?.name || null
    }))
  },

  async fetchRetailContractPayments(contractId: string) {
    const { data: invoicesData, error: invoicesError } = await supabase
      .from('accounting_invoices')
      .select('id')
      .eq('retail_contract_id', contractId)

    if (invoicesError) throw invoicesError

    const invoiceIds = (invoicesData || []).map(inv => inv.id)
    if (invoiceIds.length === 0) return []

    type RawPayment = {
      id: string; amount: string; payment_date: string | null; payment_method: string | null
      reference_number: string | null; description: string | null; is_cesija: boolean; created_at: string
      invoice_id: string; company_bank_account_id: string | null; cesija_credit_id: string | null
      accounting_invoices?: { id: string; invoice_number: string; invoice_type: string; base_amount: string; total_amount: string; status: string } | null
      company_bank_account?: { bank_name: string; account_number: string } | null
      cesija_credit?: { credit_name: string } | null
    }

    const { data, error } = await supabase
      .from('accounting_payments')
      .select(`
        id, amount, payment_date, payment_method, reference_number,
        description, is_cesija, created_at, invoice_id,
        company_bank_account_id, cesija_credit_id,
        accounting_invoices(id, invoice_number, invoice_type, base_amount, total_amount, status),
        company_bank_account:company_bank_accounts!accounting_payments_company_bank_account_id_fkey(bank_name, account_number),
        cesija_credit:bank_credits!accounting_payments_cesija_credit_id_fkey(credit_name)
      `)
      .in('invoice_id', invoiceIds)
      .order('payment_date', { ascending: false })

    if (error) throw error

    return ((data as unknown as RawPayment[]) || []).map((payment) => {
      const paymentAmount = parseFloat(payment.amount)
      const invoice = payment.accounting_invoices
      let baseAmountPaid = paymentAmount
      if (invoice && parseFloat(invoice.total_amount) > 0) {
        baseAmountPaid = (paymentAmount / parseFloat(invoice.total_amount)) * parseFloat(invoice.base_amount)
      }
      return {
        id: payment.id,
        amount: paymentAmount,
        base_amount_paid: baseAmountPaid,
        payment_date: payment.payment_date,
        payment_method: payment.payment_method,
        reference_number: payment.reference_number,
        description: payment.description,
        is_cesija: payment.is_cesija,
        created_at: payment.created_at,
        invoice: invoice ? { ...invoice, base_amount: parseFloat(invoice.base_amount), total_amount: parseFloat(invoice.total_amount) } : undefined,
        company_bank_account: payment.company_bank_account ?? undefined,
        credit: payment.cesija_credit ?? undefined
      }
    })
  }
}
