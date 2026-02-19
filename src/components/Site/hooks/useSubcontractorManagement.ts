import { ProjectPhase, Subcontractor } from '../../../lib/supabase'
import * as siteService from '../services/siteService'

export const useSubcontractorManagement = (fetchProjects: () => Promise<void>) => {
  const addSubcontractorToPhase = async (
    phase: ProjectPhase,
    data: {
      useExisting: boolean
      existing_subcontractor_id?: string
      name?: string
      contact?: string
      job_description: string
      start_date?: string
      deadline: string
      cost: number
      base_amount?: number
      vat_rate?: number
      vat_amount?: number
      total_amount?: number
      contract_type_id?: number
      has_contract?: boolean
      financed_by_type?: 'bank' | null
      financed_by_bank_id?: string | null
    }
  ) => {
    try {
      const hasContract = data.has_contract !== false

      if (data.useExisting) {
        if (!data.existing_subcontractor_id) {
          alert('Please select a subcontractor')
          return false
        }
        if (hasContract && data.cost > phase.budget_allocated - phase.budget_used) {
          alert('Contract cost exceeds available phase budget')
          return false
        }
        const phaseData = await siteService.getPhaseInfo(phase.id)
        const contractNumber = await siteService.generateUniqueContractNumber(phaseData.project_id)
        await siteService.createContract({
          contract_number: contractNumber,
          project_id: phaseData.project_id,
          phase_id: phase.id,
          subcontractor_id: data.existing_subcontractor_id,
          job_description: data.job_description,
          contract_amount: hasContract ? data.cost : 0,
          base_amount: hasContract ? data.base_amount : 0,
          vat_rate: hasContract ? data.vat_rate : 0,
          vat_amount: hasContract ? data.vat_amount : 0,
          total_amount: hasContract ? data.total_amount : 0,
          budget_realized: 0,
          start_date: data.start_date || null,
          end_date: data.deadline || null,
          status: 'active',
          contract_type_id: data.contract_type_id || 0,
          has_contract: hasContract
        })
        if (hasContract) {
          await siteService.updatePhase(phase.id, { budget_used: phase.budget_used + data.cost })
        }
      } else {
        if (!data.name?.trim() || !data.contact?.trim()) {
          alert('Please fill in required fields')
          return false
        }
        if (hasContract && data.cost > phase.budget_allocated - phase.budget_used) {
          alert('Contract cost exceeds available phase budget')
          return false
        }
        const phaseData = await siteService.getPhaseInfo(phase.id)
        const contractNumber = await siteService.generateUniqueContractNumber(phaseData.project_id)
        const newSubcontractor = await siteService.createSubcontractorWithReturn({
          name: data.name,
          contact: data.contact,
          financed_by_type: data.financed_by_type || null,
          financed_by_bank_id: data.financed_by_bank_id || null
        })
        await siteService.createContract({
          contract_number: contractNumber,
          project_id: phaseData.project_id,
          phase_id: phase.id,
          subcontractor_id: newSubcontractor.id,
          job_description: data.job_description,
          contract_amount: hasContract ? data.cost : 0,
          base_amount: hasContract ? data.base_amount : 0,
          vat_rate: hasContract ? data.vat_rate : 0,
          vat_amount: hasContract ? data.vat_amount : 0,
          total_amount: hasContract ? data.total_amount : 0,
          budget_realized: 0,
          start_date: data.start_date || null,
          end_date: data.deadline || null,
          status: 'active',
          contract_type_id: data.contract_type_id || 0,
          has_contract: hasContract
        })
        if (hasContract) {
          await siteService.updatePhase(phase.id, { budget_used: phase.budget_used + data.cost })
        }
      }

      await siteService.recalculatePhaseBudget(phase.id)
      await fetchProjects()
      return true
    } catch (error: any) {
      console.error('Error adding subcontractor:', error)
      if (error.message?.includes('duplicate key value violates unique constraint')) {
        alert('Contract number already exists. Please try again.')
      } else {
        alert('Error adding subcontractor to phase.')
      }
      return false
    }
  }

  const updateSubcontractor = async (subcontractor: Subcontractor) => {
    try {
      const subData = subcontractor as any
      await siteService.updateSubcontractor(subcontractor.id, {
        name: subcontractor.name,
        contact: subcontractor.contact,
        job_description: subcontractor.job_description,
        deadline: subcontractor.deadline,
        cost: subcontractor.cost,
        progress: subcontractor.progress || 0,
        base_amount: subData.base_amount,
        vat_rate: subData.vat_rate,
        vat_amount: subData.vat_amount,
        total_amount: subData.total_amount,
        phase_id: subData.phase_id,
        contract_type_id: subData.contract_type_id,
        has_contract: subData.has_contract
      })
      await fetchProjects()
      return true
    } catch (error) {
      console.error('Error updating subcontractor:', error)
      alert('Error updating subcontractor.')
      return false
    }
  }

  const deleteSubcontractor = async (subcontractorId: string) => {
    if (!confirm('Are you sure you want to delete this subcontractor?')) return false

    try {
      const subcontractor = await siteService.getSubcontractorDetails(subcontractorId)
      await siteService.deleteSubcontractor(subcontractorId)
      if (subcontractor.phase_id) {
        await siteService.recalculatePhaseBudget(subcontractor.phase_id)
      }
      await fetchProjects()
      return true
    } catch (error) {
      console.error('Error deleting subcontractor:', error)
      alert('Error deleting subcontractor.')
      return false
    }
  }

  const addPaymentToSubcontractor = async (
    _subcontractor: Subcontractor,
    _amount: number,
    _paymentDate: string,
    _notes: string,
    _userId: string,
    _milestoneId?: string,
    _paidByBankId?: string | null
  ) => {
    alert('Payment creation has moved to Accounting module. Please go to Accounting → Invoices to create and pay invoices.')
    return false
  }

  const fetchWirePayments = async (subcontractorId: string) => {
    try {
      return await siteService.fetchWirePayments(subcontractorId)
    } catch (error) {
      console.error('Error fetching wire payments:', error)
      return []
    }
  }

  const updateWirePayment = async (..._args: any[]) => {
    alert('Payment updates have moved to Accounting module. Please go to Accounting → Payments to edit payments.')
    return false
  }

  const deleteWirePayment = async (..._args: any[]) => {
    alert('Payment deletion has moved to Accounting module. Please go to Accounting → Payments to delete payments.')
    return false
  }

  return {
    addSubcontractorToPhase,
    updateSubcontractor,
    deleteSubcontractor,
    addPaymentToSubcontractor,
    fetchWirePayments,
    updateWirePayment,
    deleteWirePayment
  }
}
