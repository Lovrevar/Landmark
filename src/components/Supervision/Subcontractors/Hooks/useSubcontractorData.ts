import { useState, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'
import { SubcontractorSummary, SubcontractorContract } from '../types'

export const useSubcontractorData = () => {
  const [subcontractors, setSubcontractors] = useState<Map<string, SubcontractorSummary>>(new Map())
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: subcontractorsData, error: subError } = await supabase
        .from('subcontractors')
        .select('*')
        .order('name')

      if (subError) throw subError

      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select(`
          *,
          phase:project_phases!contracts_phase_id_fkey(
            phase_name,
            project:projects!project_phases_project_id_fkey(name)
          )
        `)
        .order('created_at', { ascending: false })

      if (contractsError) throw contractsError

      const { data: invoicesData, error: invoicesError } = await supabase
        .from('accounting_invoices')
        .select('contract_id, base_amount, total_amount, paid_amount, remaining_amount')
        .eq('invoice_category', 'SUBCONTRACTOR')

      if (invoicesError) throw invoicesError

      const grouped = new Map<string, SubcontractorSummary>()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subcontractorsData?.forEach((sub: any) => {
        const subContracts = contractsData?.filter(c => c.subcontractor_id === sub.id) || []

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contracts: SubcontractorContract[] = subContracts.map((contractData: any) => {
          const phase = contractData.phase
          const cost = parseFloat(contractData.contract_amount || 0)
          const hasContract = contractData.has_contract !== false

          const contractInvoices = invoicesData?.filter(inv => inv.contract_id === contractData.id) || []
          const budgetRealized = contractInvoices.reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0)
          const invoiceValue = contractInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0)
          const progress = cost > 0 ? (budgetRealized / cost) * 100 : 0

          return {
            id: contractData.id,
            project_name: phase?.project?.name || 'Unknown Project',
            phase_name: phase?.phase_name || null,
            job_description: contractData.job_description || '',
            cost,
            budget_realized: budgetRealized,
            progress: Math.min(100, progress),
            deadline: contractData.end_date || '',
            created_at: contractData.created_at,
            has_contract: hasContract,
            invoice_value: invoiceValue
          }
        })

        const allContractIds = subContracts.map(c => c.id)
        const allInvoicesForSub = invoicesData?.filter(inv => allContractIds.includes(inv.contract_id)) || []

        let totalPaid = 0
        let totalValue = 0

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        subContracts.forEach((contractData: any) => {
          const contractInvoices = allInvoicesForSub.filter(inv => inv.contract_id === contractData.id)

          if (contractData.has_contract) {
            totalValue += parseFloat(contractData.contract_amount || 0)
          } else {
            totalValue += contractInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0)
          }

          if (contractInvoices.length > 0) {
            totalPaid += contractInvoices.reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0)
          } else if (contractData.has_contract) {
            totalPaid += parseFloat(contractData.budget_realized || 0)
          }
        })

        const activeContracts = contracts.filter(c =>
          c.progress < 100 && contractsData?.find(cd => cd.id === c.id)?.status === 'active'
        ).length
        const completedContracts = contracts.filter(c =>
          c.progress >= 100 || contractsData?.find(cd => cd.id === c.id)?.status === 'completed'
        ).length

        grouped.set(sub.id, {
          id: sub.id,
          name: sub.name,
          contact: sub.contact,
          notes: sub.notes,
          total_contracts: contracts.length,
          total_contract_value: totalValue,
          total_paid: totalPaid,
          total_remaining: totalValue - totalPaid,
          active_contracts: activeContracts,
          completed_contracts: completedContracts,
          contracts
        })
      })

      setSubcontractors(grouped)
    } catch (error) {
      console.error('Error fetching subcontractors:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteSubcontractor = async (id: string): Promise<void> => {
    const { error } = await supabase.from('subcontractors').delete().eq('id', id)
    if (error) throw error
  }

  return { subcontractors, loading, fetchData, deleteSubcontractor }
}
